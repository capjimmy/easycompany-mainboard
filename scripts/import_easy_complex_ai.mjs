// 이지컨설턴트 멀티시트 엑셀(친환경 수주, 용역진행률) AI 파싱 → contracts 적재
// 사용: node scripts/import_easy_complex_ai.mjs
//
// 정책:
// - 절대 기존 데이터 삭제 X (insert 만)
// - 시트별 CSV(최대 3000자) → GPT 분석 → JSON 배열로 계약 추출
// - 핵심 시트(연도별, 계약현황 등)는 gpt-4o, 나머지/외주/제네시스/계약서X 등은 gpt-4o-mini
// - 인증수수료 지급현황은 외주 지급이므로 SKIP
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const SUPABASE_URL = 'https://silvsqcwearelrumtqqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// company_id 회사명 매핑 (실제 DB 기준)
const COMPANY_EASY = 'a0000000-0000-0000-0000-000000000001'; // 이지컨설턴트
const COMPANY_GUNHWAN = '63903dac-0c2b-404e-9f8e-aef80bcf13b5'; // 건설환경연구소

// gpt-4o 단가 (per 1M tokens, 2024 기준)
const PRICE = {
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
};

const SOURCE_DIR = path.resolve('자료 26-04-27/이지컨설턴트 자료');
const FILES = [
  {
    name: '# 2026년 친환경 수주 및 청구,입금 현황표(최종).xlsx',
    defaultCompany: COMPANY_EASY,
    sheetCompanyOverride: (sheetName) => {
      // '건환' 시트 = 건설환경연구소
      if (sheetName.startsWith('건환')) return COMPANY_GUNHWAN;
      return null;
    },
    // 헤더/요약 시트 스킵
    skipSheet: (s) => /^▶/.test(s),
    importantSheet: (s) => /^(건환|2[0-6]\(공모\)|2[0-6]\(본인증\)|계약현황)/.test(s),
  },
  {
    name: '# 251016 (주)이지 용역진행률_발행·수금 260305 15시까지 업데이트.xlsx',
    defaultCompany: COMPANY_EASY,
    sheetCompanyOverride: () => null,
    skipSheet: (s) => /^계약현황_/.test(s), // 부속 시트(수금/제외) 스킵
    importantSheet: (s) => /^(계약현황|미수내역|완료)$/.test(s),
  },
  // 인증수수료 지급현황: 외주 지급. 계약 데이터 아님 → 전체 SKIP (요청사항)
];

// === OpenAI ===
const { data: keyData } = await sb.from('settings').select('value').eq('key', 'openai_api_key').single();
if (!keyData?.value) { console.error('openai_api_key 없음'); process.exit(1); }
const openai = new OpenAI({ apiKey: keyData.value });

let totalCalls = 0;
let totalInTokens = 0;
let totalOutTokens = 0;
let totalCostUsd = 0;
const sheetReport = []; // {file, sheet, model, extracted}

function trim(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n... [truncated]';
}

function normDate(s) {
  if (!s) return null;
  const str = String(s).trim();
  // YYYY-MM-DD
  let m = str.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  // YY/MM/DD or YY-MM-DD or YY.MM.DD
  m = str.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (m) {
    const y = parseInt(m[1]) + 2000;
    if (y < 2010 || y > 2030) return null;
    return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  }
  // M/D/YY (US)
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3]);
    if (y < 100) y += 2000;
    if (y < 2010 || y > 2030) return null;
    return `${y}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
  }
  return null;
}

function parseAmount(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Math.round(v);
  const s = String(v).replace(/[^\d.\-]/g, '');
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

async function aiExtract(csvText, sheetName, fileName, model) {
  const prompt = `이 엑셀 시트(파일: ${fileName}, 시트: ${sheetName})를 분석하여 계약 데이터를 추출해주세요.
시트는 한국 건축/친환경 인증/용역 계약 현황표입니다.

[중요] 반드시 아래 정확한 키 이름으로 contracts 배열을 가진 JSON 객체를 반환하세요. 원본 한글 컬럼명 사용 금지.
{ "contracts": [ { 정해진 영문 키... }, ... ] }

규칙:
- 진짜 "행 단위 계약"만 추출. 합계/소계/공란/헤더는 제외.
- 동일 프로젝트라도 거래처(설계사)가 다르면 별도 row로 추출 (한 프로젝트에 A/B/C 여러 업체가 분배되는 패턴 흔함).
- "업체"가 "㈜이지컨설턴트"면 그건 발주처가 아니라 본사명이므로 client_name으로 쓰지 말고, 실제 거래처(설계사 A/B/C)를 client_name으로 넣을 것.
- 발주처(LH, 전남개발공사 등)는 service_name 앞에 붙이거나 notes에 기재.
- 날짜는 YYYY-MM-DD 형식으로 정규화. 한국식 'YY/MM/DD'(예: 25/3/20)는 20YY-MM-DD로 변환. 추출 불가면 null.
- 금액은 숫자만 (콤마/원/스페이스 제거).
- contract_amount = 공급가액(VAT 별도), total_amount = VAT 포함 합계.
- paid_amount = "입금"/"수금"/"기성" 컬럼 합산.
- status: '완료'/'완납' → completed, '취하'/'취소' → cancelled, 그 외 → in_progress
- client_name 비어있는 행은 제외.

반환 JSON 객체 형식 (정확히 이 영문 키 사용):
{
  "contracts": [
    {
      "contract_number": "string|null",
      "client_name": "거래처/설계사명",
      "service_name": "프로젝트/용역명 (발주처 포함 가능)",
      "contract_amount": 0,
      "total_amount": 0,
      "contract_date": "YYYY-MM-DD|null",
      "paid_amount": 0,
      "status": "in_progress",
      "manager_name": null,
      "client_contact_name": null,
      "client_contact_phone": null,
      "notes": null
    }
  ]
}

CSV:
${csvText}`;

  totalCalls++;
  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: '한국 건축/인증 계약현황표 파서. JSON 배열만 정확히 반환.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });
  const usage = res.usage || {};
  totalInTokens += usage.prompt_tokens || 0;
  totalOutTokens += usage.completion_tokens || 0;
  const p = PRICE[model] || PRICE['gpt-4o-mini'];
  totalCostUsd += ((usage.prompt_tokens || 0) * p.in + (usage.completion_tokens || 0) * p.out) / 1_000_000;

  const txt = res.choices[0]?.message?.content || '';
  // response_format=json_object 강제했으므로 객체. 내부에 배열 키 추정.
  let parsed;
  try { parsed = JSON.parse(txt); }
  catch { return []; }
  if (Array.isArray(parsed)) return parsed;
  // 객체로 반환되면 배열 키 찾기
  for (const k of Object.keys(parsed)) {
    if (Array.isArray(parsed[k])) return parsed[k];
  }
  return [];
}

async function processFile(fileMeta) {
  const fpath = path.join(SOURCE_DIR, fileMeta.name);
  if (!fs.existsSync(fpath)) {
    console.log(`  파일 없음 스킵: ${fpath}`);
    return [];
  }
  const wb = XLSX.readFile(fpath);
  const allRows = [];

  for (const sheetName of wb.SheetNames) {
    if (fileMeta.skipSheet && fileMeta.skipSheet(sheetName)) {
      console.log(`  [스킵] ${sheetName}`);
      sheetReport.push({ file: fileMeta.name, sheet: sheetName, model: '-', extracted: 0, note: 'skip-header' });
      continue;
    }
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws);
    if (!csv || csv.replace(/[\s,]/g, '').length < 30) {
      console.log(`  [빈 시트] ${sheetName}`);
      sheetReport.push({ file: fileMeta.name, sheet: sheetName, model: '-', extracted: 0, note: 'empty' });
      continue;
    }
    const trimmed = trim(csv, 3000);
    const isImportant = fileMeta.importantSheet && fileMeta.importantSheet(sheetName);
    const model = isImportant ? 'gpt-4o' : 'gpt-4o-mini';
    const companyId = fileMeta.sheetCompanyOverride(sheetName) || fileMeta.defaultCompany;

    process.stdout.write(`  [${model}] ${sheetName} ... `);
    let extracted = [];
    try {
      extracted = await aiExtract(trimmed, sheetName, fileMeta.name, model);
    } catch (e) {
      console.log(`AI ERR ${e.message}`);
      sheetReport.push({ file: fileMeta.name, sheet: sheetName, model, extracted: 0, note: 'ai-error' });
      continue;
    }
    if (!Array.isArray(extracted)) extracted = [];
    console.log(`${extracted.length}건`);
    sheetReport.push({ file: fileMeta.name, sheet: sheetName, model, extracted: extracted.length });

    for (const r of extracted) {
      if (!r || !r.client_name) continue;
      allRows.push({
        sourceFile: fileMeta.name,
        sourceSheet: sheetName,
        companyId,
        raw: r,
      });
    }
  }
  return allRows;
}

// === 메인 ===
console.log('=== 이지컨설턴트 멀티시트 AI 임포트 ===');
console.log('파일:', FILES.map(f => f.name).join('\n  '));

const allExtracted = [];
for (const f of FILES) {
  console.log(`\n[FILE] ${f.name}`);
  const rows = await processFile(f);
  allExtracted.push(...rows);
}

console.log(`\n=== 총 추출 ${allExtracted.length}건 (LLM 호출 ${totalCalls}회) ===`);

// === contracts 변환 ===
const seenNum = new Set();
function uniqueContractNumber(base) {
  let n = base && base.toString().trim() ? base.toString().trim() : `EZAI-${crypto.randomUUID().slice(0,8)}`;
  if (!seenNum.has(n)) { seenNum.add(n); return n; }
  const sfx = `${n}-${crypto.randomUUID().slice(0,4)}`;
  seenNum.add(sfx);
  return sfx;
}

const contractRecords = [];
for (const item of allExtracted) {
  const r = item.raw;
  const contract_amount = parseAmount(r.contract_amount);
  const total_amount = parseAmount(r.total_amount) || (contract_amount ? Math.round(contract_amount * 1.1) : 0);
  const vat_amount = total_amount && contract_amount ? Math.max(0, total_amount - contract_amount) : 0;
  const paid = parseAmount(r.paid_amount);
  const status = ['completed','cancelled','in_progress'].includes(r.status) ? r.status : 'in_progress';
  const date = normDate(r.contract_date);

  const notesArr = [
    `출처: ${item.sourceFile} / ${item.sourceSheet}`,
    r.notes ? `비고: ${r.notes}` : '',
  ].filter(Boolean);

  contractRecords.push({
    id: crypto.randomUUID(),
    company_id: item.companyId,
    contract_number: uniqueContractNumber(r.contract_number),
    client_company: String(r.client_name || '').trim(),
    client_contact_name: r.client_contact_name || null,
    client_contact_phone: r.client_contact_phone || null,
    contract_type: '용역',
    service_name: r.service_name || null,
    contract_date: date,
    contract_amount,
    vat_amount,
    total_amount,
    received_amount: paid || 0,
    remaining_amount: Math.max(0, total_amount - paid),
    progress: status,
    manager_name: r.manager_name || null,
    notes: notesArr.join(' | '),
    source_file_path: item.sourceFile,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

console.log(`변환 후 ${contractRecords.length}건 → contracts 적재 시작`);

// === insert chunks ===
let inserted = 0;
let failed = 0;
const CHUNK = 100;
for (let i = 0; i < contractRecords.length; i += CHUNK) {
  const batch = contractRecords.slice(i, i + CHUNK);
  const { error } = await sb.from('contracts').insert(batch);
  if (error) {
    // 단건 재시도
    for (const c of batch) {
      const { error: e2 } = await sb.from('contracts').insert(c);
      if (e2) {
        failed++;
        if (failed <= 3) console.log(`  ❌ ${c.contract_number} ${c.client_company}: ${e2.message}`);
      } else inserted++;
    }
  } else {
    inserted += batch.length;
  }
  process.stdout.write(`  ${inserted}/${contractRecords.length} `);
}
console.log(`\n  ✅ insert ${inserted}건, 실패 ${failed}건`);

// === 리포트 ===
console.log('\n=== 시트별 리포트 ===');
for (const r of sheetReport) {
  console.log(`  [${r.model}] ${r.file} :: ${r.sheet} → ${r.extracted}${r.note ? ' ('+r.note+')' : ''}`);
}
console.log(`\n=== 합계 ===`);
console.log(`LLM 호출: ${totalCalls}`);
console.log(`입력 토큰: ${totalInTokens.toLocaleString()}`);
console.log(`출력 토큰: ${totalOutTokens.toLocaleString()}`);
console.log(`예상 비용: $${totalCostUsd.toFixed(4)}`);
console.log(`총 contracts insert: ${inserted}`);
