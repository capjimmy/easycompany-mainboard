// Import 이지컨설턴트 contract list Excel files into contracts table.
// - 계약서 목록 2025.xlsx, 계약서 목록 2026.xlsx (2024 is password-protected, skipped)
// - 각 파일 3개 시트: 메인 / 본인증 / 건설환경연구소
//
// 회사 매핑:
//   "건설환경연구소"가 시트명에 포함 → 건설환경연구소 company_id
//   그 외 → 이지컨설턴트 company_id
//
// 본인증 시트면 service_name 앞에 "[본인증] " prefix
import xlsx from 'xlsx';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

const COMPANY_ID_EASY = 'a0000000-0000-0000-0000-000000000001'; // 이지컨설턴트
const COMPANY_ID_ENV = '63903dac-0c2b-404e-9f8e-aef80bcf13b5'; // 건설환경연구소

const FILES = [
  'C:/Users/parkm/easy_company/mainboard/자료 26-04-27/이지컨설턴트 자료/계약서 목록 2025.xlsx',
  'C:/Users/parkm/easy_company/mainboard/자료 26-04-27/이지컨설턴트 자료/계약서 목록 2026.xlsx',
];

// Excel serial 날짜 → JS Date (xlsx의 SSF 방식과 동일)
function excelSerialToDate(serial) {
  // Excel epoch: 1899-12-30 (1900 leap year bug 보정)
  const ms = Math.round((Number(serial) - 25569) * 86400 * 1000);
  return new Date(ms);
}

function pad2(n) { return String(n).padStart(2, '0'); }

// "2024년 09월" / "2025년 2월" / 숫자(serial) / "2025-09" 등을 YYYY-MM-01로 정규화
function parseContractDate(v) {
  if (v === null || v === undefined || v === '') return null;
  // 숫자 (Excel serial)
  if (typeof v === 'number') {
    const d = excelSerialToDate(v);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
    }
    return null;
  }
  const s = String(v).trim();
  // "YYYY년 MM월"
  let m = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월/);
  if (m) {
    return `${m[1]}-${pad2(parseInt(m[2], 10))}-01`;
  }
  // "YYYY-MM" / "YYYY/MM"
  m = s.match(/(\d{4})[-./](\d{1,2})/);
  if (m) {
    return `${m[1]}-${pad2(parseInt(m[2], 10))}-01`;
  }
  // 숫자만 들어있으면 serial로 시도
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = excelSerialToDate(Number(s));
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
    }
  }
  return null;
}

function cleanText(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length ? s : null;
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/[,\s원]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

const records = [];
const sheetStats = [];

for (const filePath of FILES) {
  console.log(`\n=== 파일: ${filePath}`);
  const wb = xlsx.readFile(filePath);
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

    const isEnv = sheetName.includes('건설환경연구소');
    const isCert = sheetName.includes('본인증');
    const companyId = isEnv ? COMPANY_ID_ENV : COMPANY_ID_EASY;
    const companyLabel = isEnv ? '건설환경연구소' : '이지컨설턴트';

    // 헤더는 row 3 (index 3), 데이터는 row 4부터.
    // 컬럼 인덱스(0-based, sheet_to_json header:1):
    //   1: 회계보고, 2: 계약번호, 3: 발주처, 4: 용역명,
    //   5: 계약금액, 6: 계약 날짜, 8: 비고 (7은 빈칸)
    let imported = 0;
    let totalDataRows = 0;
    for (let i = 4; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const accReport = cleanText(r[1]);
      const contractNumberRaw = cleanText(r[2]);
      const client = cleanText(r[3]);
      const serviceName = cleanText(r[4]);
      const amountRaw = r[5];
      const dateRaw = r[6];
      const noteRaw = cleanText(r[8]);

      // 완전 빈 행은 skip
      const allEmpty = !accReport && !contractNumberRaw && !client && !serviceName
        && (amountRaw === null || amountRaw === undefined || amountRaw === '')
        && (dateRaw === null || dateRaw === undefined || dateRaw === '')
        && !noteRaw;
      if (allEmpty) continue;
      totalDataRows++;

      // 계약번호 없는 데이터는 skip (계약번호 자체가 PK 역할)
      if (!contractNumberRaw) continue;

      const amount = toNumber(amountRaw) || 0;
      const contractDate = parseContractDate(dateRaw);

      // 본인증 시트 → service_name prefix
      let finalServiceName = serviceName;
      if (isCert) {
        finalServiceName = serviceName ? `[본인증] ${serviceName}` : '[본인증]';
      }

      // notes: 비고 + 회계보고 정보
      const noteParts = [];
      if (noteRaw) noteParts.push(noteRaw);
      if (accReport) noteParts.push(`회계보고: ${accReport}`);
      const notes = noteParts.length ? noteParts.join(' | ') : null;

      records.push({
        id: crypto.randomUUID(),
        company_id: companyId,
        contract_number: contractNumberRaw,
        client_company: client || '',
        service_name: finalServiceName,
        contract_amount: amount,
        contract_date: contractDate,
        notes,
        source_file_path: filePath.split('/').pop() + ` :: ${sheetName}`,
        contract_type: '용역',
        progress: 'in_progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      imported++;
    }
    sheetStats.push({
      file: filePath.split('/').pop(),
      sheet: sheetName,
      company: companyLabel,
      dataRows: totalDataRows,
      imported,
    });
    console.log(`  [${sheetName}] (${companyLabel}) 데이터행 ${totalDataRows}건 → import ${imported}건`);
  }
}

console.log('\n=== 변환 완료, 총 import 후보:', records.length);

// 계약번호 중복 처리 (같은 회사 내 동일 계약번호가 있으면 suffix 추가)
const seen = new Map(); // company_id::number → count
for (const r of records) {
  const key = `${r.company_id}::${r.contract_number}`;
  const cnt = seen.get(key) || 0;
  if (cnt > 0) {
    r.contract_number = `${r.contract_number}-dup${cnt}`;
  }
  seen.set(key, cnt + 1);
}

// 기존 contracts 테이블의 동일 (company_id, contract_number)와 충돌 회피
console.log('\n기존 contracts 동일 번호 충돌 검사 중...');
const easyExisting = await sb.from('contracts')
  .select('contract_number')
  .eq('company_id', COMPANY_ID_EASY);
const envExisting = await sb.from('contracts')
  .select('contract_number')
  .eq('company_id', COMPANY_ID_ENV);
const existingSet = new Set();
for (const x of (easyExisting.data || [])) {
  if (x.contract_number) existingSet.add(`${COMPANY_ID_EASY}::${x.contract_number}`);
}
for (const x of (envExisting.data || [])) {
  if (x.contract_number) existingSet.add(`${COMPANY_ID_ENV}::${x.contract_number}`);
}
console.log(`  이지컨설턴트 기존 ${easyExisting.data?.length || 0}건, 건설환경연구소 기존 ${envExisting.data?.length || 0}건`);

let collisions = 0;
for (const r of records) {
  let key = `${r.company_id}::${r.contract_number}`;
  let suffix = 1;
  while (existingSet.has(key)) {
    r.contract_number = r.contract_number.replace(/-existdup\d+$/, '') + `-existdup${suffix}`;
    key = `${r.company_id}::${r.contract_number}`;
    suffix++;
    collisions++;
  }
  existingSet.add(key);
}
if (collisions > 0) console.log(`  기존 데이터와 ${collisions}건 충돌 → suffix 추가 회피`);

// === 등록 ===
console.log(`\n=== contracts ${records.length}건 등록 ===`);
let ok = 0, fail = 0;
const errSamples = [];
const CHUNK = 100;
for (let i = 0; i < records.length; i += CHUNK) {
  const batch = records.slice(i, i + CHUNK);
  const { error } = await sb.from('contracts').insert(batch);
  if (error) {
    // batch fail → 개별 fallback
    for (const c of batch) {
      const { error: e2 } = await sb.from('contracts').insert(c);
      if (e2) {
        fail++;
        if (errSamples.length < 5) errSamples.push({ msg: e2.message, contract_number: c.contract_number });
      } else ok++;
    }
  } else {
    ok += batch.length;
  }
  process.stdout.write(`  ${ok+fail}/${records.length} `);
}
console.log(`\n  성공 ${ok}, 실패 ${fail}`);
if (errSamples.length) console.log('  에러 샘플:', errSamples);

// === 통계 ===
console.log('\n=== 시트별 import 결과 ===');
for (const s of sheetStats) {
  console.log(`  ${s.file} :: ${s.sheet} (${s.company}) - 데이터행 ${s.dataRows}건, import ${s.imported}건`);
}
const totalImported = sheetStats.reduce((acc, s) => acc + s.imported, 0);
console.log(`\n총 import 후보 행: ${totalImported}건`);
console.log(`실제 DB insert 성공: ${ok}건, 실패: ${fail}건`);

// 회사별 분포
const byCompany = {};
for (const r of records) {
  const label = r.company_id === COMPANY_ID_ENV ? '건설환경연구소' : '이지컨설턴트';
  byCompany[label] = (byCompany[label] || 0) + 1;
}
console.log('\n=== 회사별 분포 (insert 시도 기준) ===');
for (const [k, v] of Object.entries(byCompany)) {
  console.log(`  ${k}: ${v}건`);
}

// 실제 DB 상의 최신 카운트
const easyCount = await sb.from('contracts').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID_EASY);
const envCount = await sb.from('contracts').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID_ENV);
console.log('\n=== 현재 DB contracts 카운트 ===');
console.log(`  이지컨설턴트: ${easyCount.count}건`);
console.log(`  건설환경연구소: ${envCount.count}건`);
