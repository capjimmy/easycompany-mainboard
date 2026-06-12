/**
 * 이지컨설턴트 + 건설환경연구소(이지소속) 전체 재임포트 (2026-04-27)
 *
 * 입력:
 *  - 계약서 목록 2025.xlsx, 계약서 목록 2026.xlsx
 *  - # 251016 (주)이지 용역진행률...xlsx (계약현황, 제네시스, 계약서X, 미수내역, 완료)
 *  - # 2026년 친환경 수주 및 청구,입금 현황표(최종).xlsx (25 시트, AI 분석)
 *  - (주)이지-인증수수료 지급현황.xlsx (7 연도 → outsourcings)
 *
 * 동작:
 *  STEP 0) 기존 EASY 계약 + 건설환경연구소 중 이지 출처 계약 삭제
 *  STEP 1) 용역진행률 시트 직접 파싱 → contracts (계약현황/제네시스/계약서X/완료)
 *  STEP 2) 계약서 목록 2025/2026 직접 파싱 → contracts (계약번호 머지)
 *  STEP 3) 친환경 수주 AI 분석 → contracts + payment_conditions + contract_payments
 *  STEP 4) 인증수수료 → outsourcings (이지컨설턴트가 외주로 지급)
 *  STEP 5) 미수내역 시트 → 기존 contracts에 미수금 정보 보강
 */

import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import OpenAI from 'openai';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);

const COMPANY_EASY = 'a0000000-0000-0000-0000-000000000001';
const COMPANY_GUNHWAN = '63903dac-0c2b-404e-9f8e-aef80bcf13b5';

const SOURCE_DIR = 'C:/Users/parkm/easy_company/mainboard/자료 26-04-27/이지컨설턴트 자료/';

const FILE_LIST_2025 = SOURCE_DIR + '계약서 목록 2025.xlsx';
const FILE_LIST_2026 = SOURCE_DIR + '계약서 목록 2026.xlsx';
const FILE_PROGRESS = SOURCE_DIR + '# 251016 (주)이지 용역진행률_발행·수금 260305 15시까지 업데이트.xlsx';
const FILE_GREEN = SOURCE_DIR + '# 2026년 친환경 수주 및 청구,입금 현황표(최종).xlsx';
const FILE_FEES = SOURCE_DIR + '(주)이지-인증수수료 지급현황.xlsx';

// ========== Helpers ==========
function excelSerialToISO(s) {
  if (s == null || s === '') return null;
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (isNaN(Number(s))) return null;
  const n = Number(s);
  if (n < 30000 || n > 70000) return null;
  const d = new Date(Math.round((n - 25569) * 86400 * 1000));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function clean(v) {
  if (v == null) return null;
  const s = String(v).replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || s === '-' || s === '∅') return null;
  return s;
}

function parseAmount(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Math.round(v);
  const s = String(v).replace(/[^\d.\-]/g, '');
  if (!s) return 0;
  const n = Number(s);
  return isFinite(n) ? Math.round(n) : 0;
}

function parseContractDateString(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const iso = excelSerialToISO(v);
    if (iso) return iso.slice(0, 7) + '-01';
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-01`;
  m = s.match(/^(\d{4})[-./](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-01`;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const iso = excelSerialToISO(Number(s));
    if (iso) return iso.slice(0, 7) + '-01';
  }
  return null;
}

async function batchInsert(table, rows, batchSize = 100) {
  if (!rows || !rows.length) return { ok: 0, fail: 0, errors: [] };
  let ok = 0, fail = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await sb.from(table).insert(batch);
    if (error) {
      for (const r of batch) {
        const { error: e2 } = await sb.from(table).insert(r);
        if (e2) {
          fail++;
          errors.push({ row: r, msg: e2.message });
        } else ok++;
      }
    } else ok += batch.length;
  }
  return { ok, fail, errors };
}

// ============= Init =============
console.log('=== 이지컨설턴트 전체 재임포트 시작 ===\n');

// OpenAI key
const { data: keyData } = await sb.from('settings').select('value').eq('key', 'openai_api_key').single();
if (!keyData?.value) {
  console.error('❌ openai_api_key 없음');
  process.exit(1);
}
const openai = new OpenAI({ apiKey: keyData.value });

// ============= STEP 0: 기존 데이터 삭제 =============
console.log('=== STEP 0: 기존 이지 데이터 삭제 ===');

// 1) 모든 이지컨설턴트 contracts 삭제 대상 ID 수집
const { data: easyAll } = await sb.from('contracts').select('id').eq('company_id', COMPANY_EASY);
const easyIds = (easyAll || []).map(c => c.id);
console.log(`  이지컨설턴트 contracts: ${easyIds.length}건 (전체 삭제)`);

// 2) 건설환경연구소: 이지 출처만 삭제 (notes 또는 source_file_path)
const { data: gunhwanAll } = await sb.from('contracts').select('id, contract_number, notes, source_file_path').eq('company_id', COMPANY_GUNHWAN);
const easyOriginInGunhwan = (gunhwanAll || []).filter(c =>
  (c.notes && /이지|건환|친환경|용역진행률/.test(c.notes)) ||
  (c.source_file_path && /이지|건환|친환경|용역진행률|인증수수료|계약서 목록|EASY/i.test(c.source_file_path))
);
const gunhwanEasyIds = easyOriginInGunhwan.map(c => c.id);
console.log(`  건설환경연구소 contracts: 전체 ${gunhwanAll?.length || 0}건 중 이지 출처 ${gunhwanEasyIds.length}건 삭제 (KERI 출처 ${(gunhwanAll?.length || 0) - gunhwanEasyIds.length}건 보존)`);

const allDeleteIds = [...easyIds, ...gunhwanEasyIds];
if (allDeleteIds.length > 0) {
  // unlink dependent tables
  const tables = ['payment_conditions', 'contract_subtasks', 'contract_payments', 'payment_receipts'];
  for (const t of tables) {
    let total = 0;
    for (let i = 0; i < allDeleteIds.length; i += 100) {
      const ids = allDeleteIds.slice(i, i + 100);
      const { count, error } = await sb.from(t).delete({ count: 'exact' }).in('contract_id', ids);
      if (!error && count) total += count;
    }
    console.log(`  ${t} 삭제: ${total}건`);
  }
  // outsourcings
  let osTotal = 0;
  for (let i = 0; i < allDeleteIds.length; i += 100) {
    const ids = allDeleteIds.slice(i, i + 100);
    const { count } = await sb.from('outsourcings').delete({ count: 'exact' }).in('contract_id', ids);
    if (count) osTotal += count;
  }
  console.log(`  outsourcings (contract_id) 삭제: ${osTotal}건`);

  // contracts
  let cTotal = 0;
  for (let i = 0; i < allDeleteIds.length; i += 100) {
    const ids = allDeleteIds.slice(i, i + 100);
    const { count } = await sb.from('contracts').delete({ count: 'exact' }).in('id', ids);
    if (count) cTotal += count;
  }
  console.log(`  contracts 삭제: ${cTotal}건`);
}

// 이지 outsourcings 모두 삭제 (orphan + linked 둘 다 처리됐는지 정리)
{
  const { count } = await sb.from('outsourcings').delete({ count: 'exact' }).eq('company_id', COMPANY_EASY);
  console.log(`  이지 outsourcings (orphan 포함) 삭제: ${count || 0}건`);
}

// ============= 캐시 =============
console.log('\n=== 캐시 로드 ===');
const { data: clientsRaw } = await sb.from('client_companies').select('id, company_id, name, business_number, client_type').in('company_id', [COMPANY_EASY, COMPANY_GUNHWAN]);
const clientByKey = new Map(); // company_id::name → row
for (const c of (clientsRaw || [])) {
  if (c.name) clientByKey.set(`${c.company_id}::${c.name.trim()}`, c);
}
console.log(`  client_companies 캐시: ${clientsRaw?.length || 0}건`);

const { data: contactsRaw } = await sb.from('client_contacts').select('id, client_company_id, name');
const contactKey = new Set();
for (const c of (contactsRaw || [])) {
  if (c.client_company_id && c.name) contactKey.add(`${c.client_company_id}::${c.name.trim()}`);
}

// 결과 누적기
const allContracts = []; // {id, ...}
const allPaymentConds = [];
const allContractPayments = [];
const allOutsourcings = [];
const newClients = [];
const newContacts = [];
const usedContractNumbers = new Map(); // company_id::cn → count

function uniqueCN(companyId, base) {
  let cn = base?.toString().trim();
  if (!cn) cn = `EZ-${crypto.randomUUID().slice(0, 8)}`;
  let key = `${companyId}::${cn}`;
  let n = 0;
  while (usedContractNumbers.has(key)) {
    n++;
    cn = `${base}-d${n}`;
    key = `${companyId}::${cn}`;
  }
  usedContractNumbers.set(key, 1);
  return cn;
}

function ensureClient(companyId, name, opts = {}) {
  if (!name) return null;
  const trimmed = name.trim();
  const key = `${companyId}::${trimmed}`;
  let existing = clientByKey.get(key);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  const row = {
    id,
    company_id: companyId,
    name: trimmed,
    business_number: opts.business_number || null,
    phone: opts.phone || null,
    email: opts.email || null,
    industry: opts.industry || null,
    client_type: opts.client_type || 'both',
    is_active: true,
    notes: opts.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  newClients.push(row);
  clientByKey.set(key, { id, company_id: companyId, name: trimmed });
  return id;
}

function addContact(clientCompanyId, name, opts = {}) {
  if (!name || !clientCompanyId) return;
  const k = `${clientCompanyId}::${name.trim()}`;
  if (contactKey.has(k)) return;
  contactKey.add(k);
  newContacts.push({
    id: crypto.randomUUID(),
    client_company_id: clientCompanyId,
    name: name.trim(),
    position: opts.position || null,
    phone: opts.phone || null,
    mobile: opts.mobile || null,
    email: opts.email || null,
    is_primary: opts.is_primary || false,
    notes: opts.notes || null,
    created_at: new Date().toISOString(),
  });
}

// ============= STEP 1: 용역진행률 직접 파싱 =============
console.log('\n=== STEP 1: 용역진행률 시트 파싱 ===');
const wbProgress = xlsx.readFile(FILE_PROGRESS);

// 시트 컬럼 매핑 (각 시트 헤더 row[1] 분석 결과):
//  계약현황(24cols): 0:_,1:계약년,2:거래처명,3:용역명,4:본인증,5:계약금액,6:VAT포함여부,7:미청구기성,8:미수금,9:발행일,10:기성청구필요,11:청구필요금액,12:인허가,13:변경/취하,14:예비,15:본,16:진행단계,17:거래처담당자,18:_,19:휴대전화,20:이지측담당자,21:비고,22:외주
//  제네시스(24cols): +계약자(2) → 0:_,1:계약년,2:계약자,3:거래처명,4:용역명,5:본인증,6:계약금액,7:VAT,8:미청구기성,9:미수금,10:발행일,11:기성청구필요,12:청구필요금액,13:인허가,14:변경/취하,15:예비,16:본,17:진행단계,18:담당자,19:거래처담당자,20:휴대전화,21:비고,22:외주
//  계약서X(23cols): 0:_,1:견적번호,2:거래처명,3:용역명,4:본인증,5:계약금액,6:VAT,7:미청구기성,8:미수금,9:발행일,10:기성청구필요,11:청구필요금액,12:인허가,13:변경/취하,14:예비,15:본,16:진행단계,17:담당자,18:거래처담당자,19:휴대전화,20:비고,21:외주
//  완료(24cols): 같은 계약현황 형식 (외주 22)

function parseProgressSheet(sheetName, rows, columnMap) {
  const out = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;

    const yearOrNum = clean(r[columnMap.year]);
    const clientName = clean(r[columnMap.client]);
    const serviceName = clean(r[columnMap.service]);
    const cert = clean(r[columnMap.cert]);
    const amount = parseAmount(r[columnMap.amount]);
    const vatStatus = clean(r[columnMap.vat]); // 포함/별도
    const unbilledProgress = parseAmount(r[columnMap.unbilled]); // 미청구기성
    const unpaid = parseAmount(r[columnMap.unpaid]); // 미수금
    const invoiceDate = excelSerialToISO(r[columnMap.invoiceDate]);
    const billingNeeded = clean(r[columnMap.billingNeeded]);
    const billingAmount = parseAmount(r[columnMap.billingAmount]);
    const permit = clean(r[columnMap.permit]); // 인허가 ●
    const change = clean(r[columnMap.change]); // 변경/취하
    const preliminary = clean(r[columnMap.preliminary]); // 예비
    const main = clean(r[columnMap.main]); // 본
    const progressStep = clean(r[columnMap.progressStep]); // 진행단계
    const clientContact = clean(r[columnMap.clientContact]);
    const phone = clean(r[columnMap.phone]);
    const mobile = columnMap.mobile != null ? clean(r[columnMap.mobile]) : null;
    const easyManager = columnMap.easyManager != null ? clean(r[columnMap.easyManager]) : null;
    const remarks = clean(r[columnMap.remarks]);
    const outsource = clean(r[columnMap.outsource]);
    const contractor = columnMap.contractor != null ? clean(r[columnMap.contractor]) : null;

    if (!clientName && !serviceName) continue;
    // skip rows without service_name (header artifacts)
    if (!serviceName) continue;

    out.push({
      sheetName,
      yearOrNum,
      clientName,
      serviceName,
      cert,
      amount,
      vatStatus,
      unbilledProgress,
      unpaid,
      invoiceDate,
      billingNeeded,
      billingAmount,
      permit,
      change,
      preliminary,
      main,
      progressStep,
      clientContact,
      phone,
      mobile,
      easyManager,
      remarks,
      outsource,
      contractor,
    });
  }
  return out;
}

const PROGRESS_SHEETS = [
  {
    name: '계약현황',
    map: { year: 1, client: 2, service: 3, cert: 4, amount: 5, vat: 6, unbilled: 7, unpaid: 8, invoiceDate: 9, billingNeeded: 10, billingAmount: 11, permit: 12, change: 13, preliminary: 14, main: 15, progressStep: 16, clientContact: 17, phone: 18, mobile: 19, easyManager: 20, remarks: 21, outsource: 22 },
  },
  {
    name: '제네시스',
    map: { year: 1, contractor: 2, client: 3, service: 4, cert: 5, amount: 6, vat: 7, unbilled: 8, unpaid: 9, invoiceDate: 10, billingNeeded: 11, billingAmount: 12, permit: 13, change: 14, preliminary: 15, main: 16, progressStep: 17, easyManager: 18, clientContact: 19, phone: 20, remarks: 21, outsource: 22 },
  },
  {
    name: '계약서X',
    map: { year: 1, client: 2, service: 3, cert: 4, amount: 5, vat: 6, unbilled: 7, unpaid: 8, invoiceDate: 9, billingNeeded: 10, billingAmount: 11, permit: 12, change: 13, preliminary: 14, main: 15, progressStep: 16, easyManager: 17, clientContact: 18, phone: 19, remarks: 20, outsource: 21 },
  },
  {
    name: '완료',
    map: { year: 1, client: 2, service: 3, cert: 4, amount: 5, vat: 6, unbilled: 7, unpaid: 8, invoiceDate: 9, billingNeeded: 10, billingAmount: 11, permit: 12, change: 13, preliminary: 14, main: 15, progressStep: 16, easyManager: 17, clientContact: 18, phone: 19, remarks: 20, outsource: 21 },
  },
];

const progressByKey = new Map(); // key=`companyId::clientName::serviceName` → contractRow (for merge)

let stepStats = { '계약현황': 0, '제네시스': 0, '계약서X': 0, '완료': 0 };
let outsourceCnt = 0;

for (const sheetMeta of PROGRESS_SHEETS) {
  const ws = wbProgress.Sheets[sheetMeta.name];
  if (!ws) continue;
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
  const records = parseProgressSheet(sheetMeta.name, rows, sheetMeta.map);
  console.log(`  [${sheetMeta.name}] ${records.length}건`);
  stepStats[sheetMeta.name] = records.length;

  for (const rec of records) {
    // company assignment: 외주가 "건설환경연구소" → GUNHWAN
    const isGunhwan = rec.outsource && rec.outsource.includes('건설환경연구소');
    const companyId = isGunhwan ? COMPANY_GUNHWAN : COMPANY_EASY;

    // VAT 처리
    const isVATIncluded = rec.vatStatus && rec.vatStatus.includes('포함');
    let contractAmount, vatAmount, totalAmount;
    if (isVATIncluded) {
      // 계약금액 = total
      totalAmount = rec.amount;
      vatAmount = Math.round(rec.amount / 11);
      contractAmount = rec.amount - vatAmount;
    } else {
      // 별도 (없으면 별도 가정)
      contractAmount = rec.amount;
      vatAmount = Math.round(rec.amount * 0.1);
      totalAmount = contractAmount + vatAmount;
    }

    // received_amount: 계약금액 - 미수금 - 미청구기성 (사용자 명세)
    let receivedAmount = totalAmount - rec.unpaid - rec.unbilledProgress;
    if (receivedAmount < 0) receivedAmount = 0;

    // 본인증 prefix
    let serviceName = rec.serviceName;
    if (rec.cert && rec.cert.includes('본인증') && !/\[본인증\]/.test(serviceName)) {
      serviceName = `[본인증] ${serviceName}`;
    }

    // contract_number: yearOrNum (year or 견적번호)
    let cnBase;
    if (sheetMeta.name === '계약서X') {
      cnBase = rec.yearOrNum || `EZX-${allContracts.length + 1}`;
    } else {
      // year 기준 자동
      cnBase = `EZP-${rec.yearOrNum || '0000'}-${(allContracts.length + 1).toString().padStart(4, '0')}`;
    }
    const cn = uniqueCN(companyId, cnBase);

    // progress
    let progress = 'in_progress';
    if (sheetMeta.name === '완료') progress = 'completed';
    else if (rec.unbilledProgress === 0 && rec.unpaid === 0) progress = 'completed';

    // notes (전체 raw 보존)
    const notesArr = [
      `시트: ${sheetMeta.name}`,
      rec.yearOrNum ? `계약년: ${rec.yearOrNum}` : '',
      rec.contractor ? `계약자: ${rec.contractor}` : '',
      rec.cert ? `본인증: ${rec.cert}` : '',
      rec.vatStatus ? `VAT: ${rec.vatStatus}` : '',
      rec.unbilledProgress ? `미청구기성: ${rec.unbilledProgress.toLocaleString()}` : '',
      rec.unpaid ? `미수금: ${rec.unpaid.toLocaleString()}` : '',
      rec.invoiceDate ? `세금계산서발행일: ${rec.invoiceDate}` : '',
      rec.billingNeeded ? `기성청구필요: ${rec.billingNeeded}` : '',
      rec.billingAmount ? `청구필요금액: ${rec.billingAmount.toLocaleString()}` : '',
      rec.permit ? `인허가: ${rec.permit}` : '',
      rec.change ? `변경/취하: ${rec.change}` : '',
      rec.preliminary ? `예비: ${rec.preliminary}` : '',
      rec.main ? `본: ${rec.main}` : '',
      rec.progressStep ? `진행단계: ${rec.progressStep}` : '',
      rec.outsource ? `외주: ${rec.outsource}` : '',
      rec.remarks ? `비고: ${rec.remarks}` : '',
    ].filter(Boolean).join(' | ');

    // resolve client_company_id
    const clientCompanyId = rec.clientName ? ensureClient(companyId, rec.clientName) : null;
    if (clientCompanyId && rec.clientContact) {
      addContact(clientCompanyId, rec.clientContact, {
        phone: rec.phone,
        mobile: rec.mobile,
        is_primary: true,
      });
    }

    const cId = crypto.randomUUID();
    const contract = {
      id: cId,
      company_id: companyId,
      contract_number: cn,
      client_company: rec.clientName || '',
      client_contact_name: rec.clientContact || null,
      client_contact_phone: rec.phone || rec.mobile || null,
      contract_type: '용역',
      service_name: serviceName,
      contract_date: rec.invoiceDate || (rec.yearOrNum && /^\d{4}$/.test(rec.yearOrNum) ? `${rec.yearOrNum}-01-01` : null),
      contract_amount: contractAmount,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      received_amount: receivedAmount,
      remaining_amount: Math.max(0, totalAmount - receivedAmount),
      progress,
      progress_note: rec.progressStep || null,
      manager_name: rec.easyManager || rec.contractor || null,
      outsource_company: rec.outsource || null,
      notes: notesArr,
      source_file_path: `용역진행률.xlsx :: ${sheetMeta.name}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    allContracts.push(contract);
    progressByKey.set(`${companyId}::${rec.clientName || ''}::${rec.serviceName}`, contract);

    if (rec.outsource) outsourceCnt++;
  }
}
console.log(`  → contracts 누적: ${allContracts.length} (외주 정보 ${outsourceCnt})`);

// ============= STEP 2: 계약서 목록 2025/2026 =============
console.log('\n=== STEP 2: 계약서 목록 2025/2026 파싱 ===');
let listCnt = 0;
let mergedCnt = 0;
for (const filePath of [FILE_LIST_2025, FILE_LIST_2026]) {
  const wb = xlsx.readFile(filePath);
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

    const isEnv = sheetName.includes('건설환경연구소');
    const isCert = sheetName.includes('본인증');
    const companyId = isEnv ? COMPANY_GUNHWAN : COMPANY_EASY;

    let imported = 0;
    for (let i = 4; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const accReport = clean(r[1]);
      const cnRaw = clean(r[2]);
      const client = clean(r[3]);
      const serviceName = clean(r[4]);
      const amountRaw = r[5];
      const dateRaw = r[6];
      const noteRaw = clean(r[8]);

      if (!cnRaw && !client && !serviceName && !amountRaw) continue;
      if (!cnRaw) continue; // 계약번호 필수

      const amount = parseAmount(amountRaw);
      const contractDate = parseContractDateString(dateRaw);

      let finalServiceName = serviceName || '';
      if (isCert && finalServiceName && !/\[본인증\]/.test(finalServiceName)) {
        finalServiceName = `[본인증] ${finalServiceName}`;
      }

      // 머지 체크: 같은 service_name + client_company가 STEP 1에 있으면 보강
      const mergeKey = `${companyId}::${client || ''}::${serviceName || ''}`;
      const existing = progressByKey.get(mergeKey);

      if (existing) {
        // 기존 contract 보강
        existing.contract_number = cnRaw; // 정식 계약번호로 교체
        usedContractNumbers.set(`${companyId}::${cnRaw}`, 1);
        if (contractDate) existing.contract_date = contractDate;
        existing.notes = (existing.notes ? existing.notes + ' | ' : '') +
          `[목록]계약번호: ${cnRaw}` +
          (accReport ? ` | 회계보고: ${accReport}` : '') +
          (noteRaw ? ` | 목록비고: ${noteRaw}` : '');
        mergedCnt++;
        continue;
      }

      // 새 row
      const cn = uniqueCN(companyId, cnRaw);
      // VAT = 별도 가정 (목록표 단순)
      const contractAmount = amount;
      const vatAmount = Math.round(amount * 0.1);
      const totalAmount = contractAmount + vatAmount;

      const clientCompanyId = client ? ensureClient(companyId, client) : null;

      const contract = {
        id: crypto.randomUUID(),
        company_id: companyId,
        contract_number: cn,
        client_company: client || '',
        contract_type: '용역',
        service_name: finalServiceName,
        contract_date: contractDate,
        contract_amount: contractAmount,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        received_amount: 0,
        remaining_amount: totalAmount,
        progress: 'in_progress',
        notes: [
          `시트: ${sheetName}`,
          accReport ? `회계보고: ${accReport}` : '',
          noteRaw ? `비고: ${noteRaw}` : '',
        ].filter(Boolean).join(' | '),
        source_file_path: `${filePath.split('/').pop()} :: ${sheetName}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      allContracts.push(contract);
      progressByKey.set(mergeKey, contract);
      imported++;
      listCnt++;
    }
    console.log(`  [${sheetName}] (${isEnv ? '건환' : '이지'}) → 신규 ${imported}건`);
  }
}
console.log(`  → 신규 ${listCnt}건, 머지 ${mergedCnt}건`);

// ============= STEP 3: 친환경 수주 AI 분석 =============
console.log('\n=== STEP 3: 친환경 수주 AI 분석 ===');
const wbGreen = xlsx.readFile(FILE_GREEN);

const GREEN_SHEETS = wbGreen.SheetNames.filter(s => !/^▶/.test(s) && !/외주\d/.test(s) && s !== '제네시스' && !s.startsWith('계약서 X'));
console.log(`  대상 시트 (${GREEN_SHEETS.length}): ${GREEN_SHEETS.join(', ')}`);

// 각 시트를 6-row 블록으로 분할 (사실은 5 row 데이터 + 1 row 소계 = 6 row 패턴)
function splitGreenIntoProjects(rows) {
  // rows 인덱스 0~4 부근까지 헤더, 5~10 = 첫 프로젝트, 11~16 = 둘째, ...
  // 헤더 끝 = row 4 (cell 4의 첫 컬럼 "업체"). 그 다음부터 데이터.
  const blocks = [];
  let curr = [];
  for (let i = 5; i < rows.length; i++) {
    const r = rows[i] || [];
    curr.push(r);
    // 소계 row = 첫 7 col 안에 "소계" 포함
    const text = r.map(c => String(c == null ? '' : c)).join('|');
    if (/소계|소 계/.test(text)) {
      blocks.push(curr);
      curr = [];
    }
  }
  if (curr.length > 0) blocks.push(curr);
  // filter empty
  return blocks.filter(b => b.some(r => r.some(c => c != null && c !== '')));
}

function blockToCsv(block, maxRows = 8) {
  return block.slice(0, maxRows).map(r => r.map(c => {
    if (c == null) return '';
    const s = String(c).replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/,/g, '·');
    return s.slice(0, 80);
  }).join(',')).join('\n');
}

// AI: 한 시트의 여러 프로젝트 블록을 한 번에 보낸다
async function aiExtractGreen(sheetName, blocks, isCert, isGunhwan) {
  // 모든 블록 합쳐서 CSV
  const csvParts = blocks.map((b, i) => `[프로젝트 ${i + 1}]\n${blockToCsv(b)}`);
  let csv = csvParts.join('\n\n');
  if (csv.length > 12000) csv = csv.slice(0, 12000) + '\n... [truncated]';

  const certHint = isCert ? '본인증 시트입니다. service_name 앞에 "[본인증] " prefix 필수.' : '';
  const orgHint = isGunhwan ? '건설환경연구소 자료. 자체 본사명은 "건설환경연구소".' : '이지컨설턴트 자료.';

  const prompt = `이 데이터는 한국 친환경 인증/용역 사업의 청구·입금 현황표 일부입니다.
${orgHint} ${certHint}

각 [프로젝트 N] 블록은 1개 프로젝트(=1 service_name)에 대해 5개 거래처(설계사 A~E/F)와 1개 소계 행으로 구성됩니다.
같은 프로젝트라도 거래처가 다르면 별도 contract row로 추출해야 합니다 (한 프로젝트가 A/B/C에 분배).

블록 형식 (열 순서):
- 첫 컬럼: NO/구분/프로젝트(여러 줄), 계약유무(견적번호/계약번호), 용역구분(계획/인허가/예비/본/변경)
- 업체 (거래처/설계사명) - 이게 client_name
- 청구 담당자 + 연락처
- 공급가액(VAT별도) + VAT + 합계
- 미성금액 (비율, 금액)
- 기성조건 시점/결제조건 비율
- 업체별 기성 현황 A~F: 청구일, 입금일, 금액 (Excel serial date 가능)

규칙:
- 업체가 비어있는 행, 소계 행은 무시.
- 업체="㈜이지컨설턴트" 또는 "건설환경연구소"면 본사이므로 client_name으로 쓰지 말고 무시.
- 진짜 거래처(설계사명, 건설사명)만 client_name에 넣기.
- contract_number: 해당 블록의 "계약번호" 셀 값. 없으면 견적번호.
- service_name: 프로젝트 셀 (여러 줄이면 첫 줄)
- 발주처(LH, 용인시 등 = 구분 컬럼) → service_name 앞에 "[발주처]" 포함 가능, 또는 notes에.
- contract_amount = 공급가액 (VAT 별도). total_amount = 합계.
- payments 배열 = 업체별 기성 현황 A~F 중 데이터 있는 항목들. 각 항목 {label,billing_date,paid_date,amount}. Excel serial은 1900-01-01 기준 일수 (예: 45644 → "2024-12-09").
- payment_conditions 배열: 미성금액의 비율/금액 + 기성조건의 시점/결제조건/비율 (있을 때만).

JSON 객체로 반환:
{
  "contracts": [
    {
      "contract_number": "string|null",
      "client_name": "거래처/설계사명",
      "client_contact_name": null,
      "client_contact_phone": null,
      "service_name": "프로젝트명",
      "client_org": "발주처 (LH 등)|null",
      "contract_amount": 0,
      "vat_amount": 0,
      "total_amount": 0,
      "permit_status": "인허가/예비/본/변경 표시|null",
      "payment_conditions": [{"timing":"string|null","ratio":0,"amount":0}],
      "payments": [{"label":"A|B|C|D|E|F","billing_date":"YYYY-MM-DD|null","paid_date":"YYYY-MM-DD|null","amount":0}],
      "notes": "string|null"
    }
  ]
}

데이터:
${csv}`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: '한국 친환경 인증 청구·입금 현황 분석기. 정확한 JSON만 반환.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0,
    max_tokens: 6000,
    response_format: { type: 'json_object' },
  });
  const txt = res.choices[0]?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(txt); } catch { return { contracts: [], usage: res.usage }; }
  const contracts = parsed.contracts || [];
  return { contracts, usage: res.usage };
}

let totalAiCalls = 0;
let totalInTok = 0, totalOutTok = 0;
let aiCost = 0;
let aiContractsCount = 0;
let aiPaymentsCount = 0;
let aiPaymentCondsCount = 0;

for (const sheetName of GREEN_SHEETS) {
  const ws = wbGreen.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
  const blocks = splitGreenIntoProjects(rows);
  if (!blocks.length) {
    console.log(`  [${sheetName}] 블록 없음, 스킵`);
    continue;
  }

  const isGunhwan = sheetName.startsWith('건환');
  const isCert = sheetName.includes('본인증');
  const companyId = isGunhwan ? COMPANY_GUNHWAN : COMPANY_EASY;

  // 블록이 많으면 chunk로 나눠서 처리 (AI context 한계)
  const CHUNK_SIZE = 10; // 한 번에 10개 블록씩
  let extractedAll = [];
  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    const chunk = blocks.slice(i, i + CHUNK_SIZE);
    process.stdout.write(`  [${sheetName}] AI 분석 ${i}-${i + chunk.length}/${blocks.length} ... `);
    try {
      const { contracts, usage } = await aiExtractGreen(sheetName, chunk, isCert, isGunhwan);
      extractedAll.push(...contracts);
      totalAiCalls++;
      totalInTok += usage?.prompt_tokens || 0;
      totalOutTok += usage?.completion_tokens || 0;
      aiCost += ((usage?.prompt_tokens || 0) * 2.5 + (usage?.completion_tokens || 0) * 10) / 1_000_000;
      console.log(`${contracts.length}건`);
    } catch (e) {
      console.log(`AI ERR: ${e.message}`);
    }
  }
  console.log(`  [${sheetName}] 추출 ${extractedAll.length}건`);

  // contracts 변환
  for (const c of extractedAll) {
    if (!c.client_name) continue;
    const clientName = c.client_name.trim();
    if (/㈜이지컨설턴트|건설환경연구소|이지컨설턴트/.test(clientName)) continue; // 본사명

    const contractAmount = parseAmount(c.contract_amount);
    let totalAmount = parseAmount(c.total_amount);
    let vatAmount = parseAmount(c.vat_amount);
    if (!totalAmount && contractAmount) {
      totalAmount = contractAmount + (vatAmount || Math.round(contractAmount * 0.1));
    }
    if (!vatAmount && totalAmount && contractAmount) {
      vatAmount = totalAmount - contractAmount;
    }

    let serviceName = c.service_name || '';
    if (c.client_org) {
      serviceName = `[${c.client_org}] ${serviceName}`;
    }
    if (isCert && serviceName && !/\[본인증\]/.test(serviceName)) {
      serviceName = `[본인증] ${serviceName}`;
    }

    const cn = uniqueCN(companyId, c.contract_number);
    const cId = crypto.randomUUID();

    // 받은 amount = sum payments
    const payments = (c.payments || []).filter(p => parseAmount(p.amount) > 0);
    const receivedAmount = payments.reduce((sum, p) => sum + parseAmount(p.amount), 0);

    const clientCompanyId = ensureClient(companyId, clientName);
    if (clientCompanyId && c.client_contact_name) {
      addContact(clientCompanyId, c.client_contact_name, {
        phone: c.client_contact_phone,
        is_primary: true,
      });
    }

    allContracts.push({
      id: cId,
      company_id: companyId,
      contract_number: cn,
      client_company: clientName,
      client_contact_name: c.client_contact_name || null,
      client_contact_phone: c.client_contact_phone || null,
      contract_type: '용역',
      service_name: serviceName,
      contract_amount: contractAmount,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      received_amount: receivedAmount,
      remaining_amount: Math.max(0, totalAmount - receivedAmount),
      progress: receivedAmount >= totalAmount && totalAmount > 0 ? 'completed' : 'in_progress',
      progress_note: c.permit_status || null,
      notes: [
        `친환경수주: ${sheetName}`,
        c.client_org ? `발주처: ${c.client_org}` : '',
        c.permit_status ? `인허가: ${c.permit_status}` : '',
        c.notes || '',
      ].filter(Boolean).join(' | '),
      source_file_path: `친환경수주.xlsx :: ${sheetName}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    aiContractsCount++;

    // payment_conditions
    let sortIdx = 0;
    for (const pc of (c.payment_conditions || [])) {
      const pcAmount = parseAmount(pc.amount);
      const pcRatio = parseAmount(pc.ratio);
      if (pcAmount === 0 && pcRatio === 0) continue;
      allPaymentConds.push({
        id: crypto.randomUUID(),
        contract_id: cId,
        condition_type: 'progress',
        title: pc.timing || `기성 ${sortIdx + 1}`,
        amount: pcAmount,
        percentage: pcRatio,
        paid_amount: 0,
        status: 'pending',
        sort_order: sortIdx++,
        notes: pc.timing || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      aiPaymentCondsCount++;
    }

    // contract_payments
    for (const p of payments) {
      const amt = parseAmount(p.amount);
      if (amt <= 0) continue;
      allContractPayments.push({
        id: crypto.randomUUID(),
        contract_id: cId,
        payment_date: p.paid_date || p.billing_date || null,
        amount: amt,
        invoice_date: p.billing_date || null,
        invoice_amount: amt,
        description: p.label ? `기성 ${p.label}` : null,
        notes: `청구일: ${p.billing_date || '-'} / 입금일: ${p.paid_date || '-'}`,
        created_at: new Date().toISOString(),
      });
      aiPaymentsCount++;
    }
  }
}
console.log(`  → AI 호출 ${totalAiCalls}, 토큰 in=${totalInTok}, out=${totalOutTok}, 비용 $${aiCost.toFixed(2)}`);
console.log(`  → contracts ${aiContractsCount}, payment_conditions ${aiPaymentCondsCount}, contract_payments ${aiPaymentsCount}`);

// ============= STEP 4: 인증수수료 → outsourcings =============
console.log('\n=== STEP 4: 인증수수료 → outsourcings ===');
const wbFees = xlsx.readFile(FILE_FEES);
let feesCnt = 0;
for (const sheetName of wbFees.SheetNames) {
  const ws = wbFees.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
  // 헤더 = row 2: 일자, 지급일, 거래처명, 내용, 공급가액, 부가세, 합계, 담당자, 계좌번호, 비고
  // 데이터 = row 3+
  let added = 0;
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const dateRaw = r[1];
    const payDateRaw = r[2];
    const vendor = clean(r[3]);
    const desc = clean(r[4]);
    const supplyAmount = parseAmount(r[5]);
    const vat = parseAmount(r[6]);
    const total = parseAmount(r[7]);
    const manager = clean(r[8]);
    const account = clean(r[9]);
    const remark = clean(r[10]);

    if (!vendor && !desc && !total) continue;
    if (!vendor) continue;

    const startDate = excelSerialToISO(dateRaw);
    const endDate = excelSerialToISO(payDateRaw);

    // outsource_company가 vendor → ensure client_company (vendor)
    const vendorClientId = ensureClient(COMPANY_EASY, vendor, { client_type: 'vendor' });

    allOutsourcings.push({
      id: crypto.randomUUID(),
      company_id: COMPANY_EASY,
      contract_id: null,
      outsource_company: vendor,
      outsource_contact: manager || null,
      service_description: desc || `[${sheetName}] 인증수수료`,
      outsource_amount: total || (supplyAmount + vat),
      budget: total || (supplyAmount + vat),
      actual_cost: total || (supplyAmount + vat),
      status: endDate ? 'completed' : 'pending',
      start_date: startDate,
      end_date: endDate,
      notes: [
        manager ? `담당자: ${manager}` : '',
        account ? `계좌: ${account}` : '',
        remark ? `비고: ${remark}` : '',
        `공급가액: ${supplyAmount.toLocaleString()} / VAT: ${vat.toLocaleString()}`,
        `시트: ${sheetName}`,
      ].filter(Boolean).join(' | '),
      vendor_type: 'company',
      show_on_calendar: false,
      vat_included: total > 0 && Math.abs(total - (supplyAmount + vat)) < 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    added++;
    feesCnt++;
  }
  console.log(`  [${sheetName}] ${added}건`);
}
console.log(`  → outsourcings 누적: ${feesCnt}건`);

// ============= 미수내역 시트 → notes 보강 =============
console.log('\n=== STEP 5 (보너스): 미수내역 시트 보강 ===');
{
  const ws = wbProgress.Sheets['미수내역'];
  if (ws) {
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    let merged = 0;
    for (let i = 4; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const invDate = excelSerialToISO(r[0]);
      const client = clean(r[1]);
      const service = clean(r[2]);
      const amt = parseAmount(r[3]);
      const vat = parseAmount(r[4]);
      const total = parseAmount(r[5]);
      const paidDate = clean(r[6]);
      const year = clean(r[7]);
      const note = clean(r[8]);
      const balance = parseAmount(r[9]);

      if (!client || !service) continue;
      // find contract by client + service
      const matched = allContracts.find(c =>
        c.company_id === COMPANY_EASY &&
        (c.client_company || '').includes(client.slice(0, 4)) &&
        (c.service_name || '').includes(service.slice(0, 8))
      );
      if (matched) {
        matched.notes = (matched.notes ? matched.notes + ' | ' : '') +
          `[미수내역] 발행일=${invDate || '-'}, 합계=${total.toLocaleString()}, 잔액=${balance.toLocaleString()}, 입금=${paidDate || '-'}, 비고=${note || '-'}`;
        merged++;
      }
    }
    console.log(`  미수내역 → contracts notes 보강: ${merged}건`);
  }
}

// ============= INSERT =============
console.log('\n=== DB INSERT 시작 ===');

// 1) clients
console.log(`\n[1] client_companies INSERT: ${newClients.length}건`);
const r1 = await batchInsert('client_companies', newClients);
console.log(`  ✅ ${r1.ok}, ❌ ${r1.fail}`);
if (r1.errors.length) r1.errors.slice(0, 3).forEach(e => console.log(`   - ${e.msg}`));

// 2) contacts
console.log(`\n[2] client_contacts INSERT: ${newContacts.length}건`);
const r2 = await batchInsert('client_contacts', newContacts);
console.log(`  ✅ ${r2.ok}, ❌ ${r2.fail}`);
if (r2.errors.length) r2.errors.slice(0, 3).forEach(e => console.log(`   - ${e.msg}`));

// 3) contracts (drop duplicates by (company_id,contract_number))
{
  const seen = new Set();
  const dedup = [];
  for (const c of allContracts) {
    const k = `${c.company_id}::${c.contract_number}`;
    if (seen.has(k)) {
      // append suffix
      let n = 1;
      while (seen.has(`${c.company_id}::${c.contract_number}-x${n}`)) n++;
      c.contract_number = `${c.contract_number}-x${n}`;
    }
    seen.add(`${c.company_id}::${c.contract_number}`);
    dedup.push(c);
  }
  console.log(`\n[3] contracts INSERT: ${dedup.length}건`);
  const r3 = await batchInsert('contracts', dedup);
  console.log(`  ✅ ${r3.ok}, ❌ ${r3.fail}`);
  if (r3.errors.length) {
    const reasons = new Map();
    r3.errors.forEach(e => reasons.set(e.msg.slice(0, 100), (reasons.get(e.msg.slice(0, 100)) || 0) + 1));
    for (const [m, c] of reasons) console.log(`   [${c}] ${m}`);
  }
}

// 4) payment_conditions
console.log(`\n[4] payment_conditions INSERT: ${allPaymentConds.length}건`);
const r4 = await batchInsert('payment_conditions', allPaymentConds);
console.log(`  ✅ ${r4.ok}, ❌ ${r4.fail}`);
if (r4.errors.length) r4.errors.slice(0, 3).forEach(e => console.log(`   - ${e.msg}`));

// 5) contract_payments
console.log(`\n[5] contract_payments INSERT: ${allContractPayments.length}건`);
const r5 = await batchInsert('contract_payments', allContractPayments);
console.log(`  ✅ ${r5.ok}, ❌ ${r5.fail}`);
if (r5.errors.length) r5.errors.slice(0, 3).forEach(e => console.log(`   - ${e.msg}`));

// 6) outsourcings
console.log(`\n[6] outsourcings INSERT: ${allOutsourcings.length}건`);
const r6 = await batchInsert('outsourcings', allOutsourcings);
console.log(`  ✅ ${r6.ok}, ❌ ${r6.fail}`);
if (r6.errors.length) r6.errors.slice(0, 3).forEach(e => console.log(`   - ${e.msg}`));

// ============= 최종 보고 =============
console.log('\n========== FINAL SUMMARY ==========');
const { count: easyFinal } = await sb.from('contracts').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_EASY);
const { count: gunhwanFinal } = await sb.from('contracts').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_GUNHWAN);
const { count: easyClients } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_EASY);
const { count: gunhwanClients } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_GUNHWAN);
const { count: easyOS } = await sb.from('outsourcings').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_EASY);

console.log('\n[contracts (DB 현재)]');
console.log(`  이지컨설턴트: ${easyFinal}`);
console.log(`  건설환경연구소: ${gunhwanFinal}`);
console.log('\n[client_companies (DB 현재)]');
console.log(`  이지컨설턴트: ${easyClients}`);
console.log(`  건설환경연구소: ${gunhwanClients}`);
console.log('\n[outsourcings (DB 현재)]');
console.log(`  이지컨설턴트: ${easyOS}`);

console.log('\n[STEP별 통계]');
console.log(`  STEP 1 용역진행률: 계약현황 ${stepStats['계약현황']}, 제네시스 ${stepStats['제네시스']}, 계약서X ${stepStats['계약서X']}, 완료 ${stepStats['완료']}`);
console.log(`  STEP 2 계약서 목록: 신규 ${listCnt}, 머지 ${mergedCnt}`);
console.log(`  STEP 3 친환경 (AI): contracts ${aiContractsCount}, payment_conditions ${aiPaymentCondsCount}, contract_payments ${aiPaymentsCount}`);
console.log(`  STEP 4 인증수수료: outsourcings ${feesCnt}`);

console.log('\n[AI 비용]');
console.log(`  호출: ${totalAiCalls}, in=${totalInTok}, out=${totalOutTok}, 비용=$${aiCost.toFixed(2)}`);

console.log('\n✅ DONE');
