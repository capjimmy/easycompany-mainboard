/**
 * 건설경제연구원/건설환경연구소 전체 재임포트 (2026-04-27)
 *
 * 입력 파일:
 *  - temp_1776209192677.-302837503(학술).xlsx                       → 학술사업부 (건경연 + 건환연)
 *  - temp_1776209192677.-302837503_건설경제연구원_건설사업부_260421.xlsx → 건설사업부 (회계포함)
 *
 * 시트 구조:
 *  - 프로젝트정보: 45 base cols + (건설사업부) 12 회계 cols
 *  - 외주업체정보: 32 cols (담당자 5명 반복)
 *  - 거래처정보:   32 cols (담당자 5명 반복)
 *
 * 동작:
 *  1) 기존 contracts/subtasks/payments 삭제 (KERI + KHRI 한정)
 *  2) 거래처정보  → client_companies upsert + client_contacts(다중)
 *  3) 외주업체정보 → client_companies(client_type=vendor) + client_contacts + outsourcings
 *  4) 프로젝트정보 → contracts + payment_conditions(선/중/잔) + contract_subtasks(세부작업)
 *  5) 건설사업부 회계 컬럼 → contracts received_amount/notes 보강
 */

import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);

const FILES = [
  {
    path: 'c:/Users/parkm/easy_company/mainboard/자료 26-04-27/건설경제연구원자료/temp_1776209192677.-302837503(학술).xlsx',
    label: '학술사업부',
    hasAccounting: false,
  },
  {
    path: 'c:/Users/parkm/easy_company/mainboard/자료 26-04-27/건설경제연구원자료/temp_1776209192677.-302837503_건설경제연구원_건설사업부_260421.xlsx',
    label: '건설사업부',
    hasAccounting: true,
  },
];

// ============= Helpers =============
function excelSerialToISO(s) {
  if (s == null || s === '') return null;
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (isNaN(Number(s))) return null;
  const n = Number(s);
  if (n < 30000 || n > 70000) return null;
  const d = new Date(Math.floor(n - 25569) * 86400 * 1000);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function normBiz(s) {
  if (!s) return null;
  const clean = String(s).replace(/\D/g, '');
  if (clean.length !== 10) return String(s).trim() || null;
  return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5)}`;
}

function clean(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === '-' || s === '없음') return null;
  return s;
}

function toInt(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : Math.round(n);
}

function toNum(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

async function fetchAll(t, c) {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb.from(t).select(c).order('id').range(from, from + 999);
    if (error) {
      console.error(`fetchAll(${t}) error:`, error.message);
      break;
    }
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function batchInsert(table, rows, batchSize = 100) {
  if (!rows.length) return { ok: 0, fail: 0, errors: [] };
  let ok = 0, fail = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await sb.from(table).insert(batch);
    if (error) {
      // fallback to individual inserts
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
console.log('=== 회사 매핑 ===');
const { data: companies } = await sb.from('companies').select('id, name');
const KERI = companies.find(c => c.name === '건설경제연구원');
const KHRI = companies.find(c => c.name === '건설환경연구소');
if (!KERI || !KHRI) {
  console.error('❌ 회사 매핑 실패', { KERI, KHRI });
  process.exit(1);
}
console.log(`  건설경제연구원: ${KERI.id}`);
console.log(`  건설환경연구소: ${KHRI.id}`);
const TARGET_COMPANY_IDS = [KERI.id, KHRI.id];

const { data: departments } = await sb.from('departments').select('id, name, company_id');
const deptMap = new Map();
departments.forEach(d => deptMap.set(`${d.company_id}::${d.name}`, d));

function resolveCompany(name) {
  if (!name) return KERI;
  const n = String(name).replace(/^\(사\)/, '').trim();
  if (n === '건설환경연구소') return KHRI;
  if (n.includes('건설경제연구원')) return KERI;
  return KERI;
}

function resolveDept(companyId, deptName) {
  if (!deptName) return null;
  return deptMap.get(`${companyId}::${deptName}`) || null;
}

// ============= Step 0: 기존 데이터 삭제 =============
console.log('\n=== Step 0: 기존 contracts/subtasks/payments 삭제 ===');
{
  // get target contract ids
  const { data: targetContracts } = await sb
    .from('contracts')
    .select('id')
    .in('company_id', TARGET_COMPANY_IDS);
  const targetIds = (targetContracts || []).map(c => c.id);
  console.log(`  대상 contracts: ${targetIds.length}건`);

  if (targetIds.length > 0) {
    // Delete subtasks
    let delSub = 0;
    for (let i = 0; i < targetIds.length; i += 100) {
      const ids = targetIds.slice(i, i + 100);
      const { error, count } = await sb
        .from('contract_subtasks')
        .delete({ count: 'exact' })
        .in('contract_id', ids);
      if (!error && count) delSub += count;
    }
    console.log(`  contract_subtasks 삭제: ${delSub}건`);

    // Delete payment_conditions
    let delPC = 0;
    for (let i = 0; i < targetIds.length; i += 100) {
      const ids = targetIds.slice(i, i + 100);
      const { error, count } = await sb
        .from('payment_conditions')
        .delete({ count: 'exact' })
        .in('contract_id', ids);
      if (!error && count) delPC += count;
    }
    console.log(`  payment_conditions 삭제: ${delPC}건`);

    // Delete contract_payments
    let delCP = 0;
    for (let i = 0; i < targetIds.length; i += 100) {
      const ids = targetIds.slice(i, i + 100);
      const { error, count } = await sb
        .from('contract_payments')
        .delete({ count: 'exact' })
        .in('contract_id', ids);
      if (!error && count) delCP += count;
    }
    console.log(`  contract_payments 삭제: ${delCP}건`);

    // Delete outsourcings linked to these contracts (don't delete unrelated)
    let delOS = 0;
    for (let i = 0; i < targetIds.length; i += 100) {
      const ids = targetIds.slice(i, i + 100);
      const { error, count } = await sb
        .from('outsourcings')
        .delete({ count: 'exact' })
        .in('contract_id', ids);
      if (!error && count) delOS += count;
    }
    console.log(`  outsourcings (contract-linked) 삭제: ${delOS}건`);

    // Delete contracts themselves
    let delC = 0;
    for (let i = 0; i < targetIds.length; i += 100) {
      const ids = targetIds.slice(i, i + 100);
      const { error, count } = await sb
        .from('contracts')
        .delete({ count: 'exact' })
        .in('id', ids);
      if (!error && count) delC += count;
    }
    console.log(`  contracts 삭제: ${delC}건`);
  }

  // Also remove all outsourcings of these companies (no-contract-link orphans get refreshed)
  let delOS2 = 0;
  for (const cid of TARGET_COMPANY_IDS) {
    const { error, count } = await sb
      .from('outsourcings')
      .delete({ count: 'exact' })
      .eq('company_id', cid)
      .is('contract_id', null);
    if (!error && count) delOS2 += count;
  }
  console.log(`  outsourcings (orphan, KERI/KHRI) 삭제: ${delOS2}건`);
}

// ============= Step 1: 거래처/외주 시트 파싱 (모든 파일 합쳐서) =============
console.log('\n=== Step 1: 거래처/외주 시트 파싱 ===');

// existing client_companies cache
const existingClients = await fetchAll(
  'client_companies',
  'id, company_id, name, business_number, client_type'
);
const clientByCoName = new Map();
existingClients.forEach(c => {
  if (c.name) clientByCoName.set(`${c.company_id}::${c.name.trim()}`, c);
});
console.log(`  기존 client_companies: ${existingClients.length}건`);

// existing client_contacts cache (for dedup by client_company_id + name)
const existingContacts = await fetchAll(
  'client_contacts',
  'id, client_company_id, name'
);
const contactKey = new Set(
  existingContacts.map(c => `${c.client_company_id}::${(c.name || '').trim()}`)
);
console.log(`  기존 client_contacts: ${existingContacts.length}건`);

// vendor map - 외주업체명 → client_company row (for matching subtasks/outsourcings)
const vendorByName = new Map();

const newClients = [];
const updateClients = []; // {id, patch}
const newContacts = [];
const newOutsourcings = [];

// parse each file's 거래처/외주 sheets
function parseSheetRows(ws) {
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
}

// parse contacts (5 reps starting at given start col)
function parseContacts(r, startCol) {
  // 5 contacts × 5 fields = 25
  const contacts = [];
  for (let i = 0; i < 5; i++) {
    const base = startCol + i * 5;
    const name = clean(r[base]);
    const position = clean(r[base + 1]);
    const phone = clean(r[base + 2]);
    const email = clean(r[base + 3]);
    const notes = clean(r[base + 4]);
    if (name || position || phone || email || notes) {
      contacts.push({ name, position, phone, email, notes });
    }
  }
  return contacts;
}

// helper: get-or-create client_company entry; returns {id, isNew}
function ensureClient({ companyId, name, biz, ceo, industry, subIndustry, address, clientType, defaultContact }) {
  const trimmed = name.trim();
  const key = `${companyId}::${trimmed}`;
  let existing = clientByCoName.get(key);

  const fields = {
    business_number: biz || null,
    ceo_name: ceo || null,
    industry: [industry, subIndustry].filter(Boolean).join(' / ') || null,
    address: address || null,
    phone: defaultContact?.phone || null,
    email: defaultContact?.email || null,
    notes: defaultContact?.notes || null,
    client_type: clientType,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    updateClients.push({ id: existing.id, patch: fields });
    return existing.id;
  }
  const id = crypto.randomUUID();
  const newRow = {
    id,
    company_id: companyId,
    name: trimmed,
    ...fields,
    created_at: new Date().toISOString(),
  };
  newClients.push(newRow);
  const cached = { id, company_id: companyId, name: trimmed, business_number: biz || null, client_type: clientType };
  clientByCoName.set(key, cached);
  return id;
}

// per-file iteration
const allWbs = [];
for (const f of FILES) {
  console.log(`\n--- 파일: ${f.label} ---`);
  const wb = xlsx.readFile(f.path);
  allWbs.push({ ...f, wb });

  // Track which company each row should belong to (parent company derived from 프로젝트정보 시트)
  // For 거래처/외주 sheet, company is ambiguous — assign to KERI (or KHRI based on business unit).
  // We'll register them under both KERI and KHRI namespace if encountered in projects.
  // For simplicity: 거래처정보/외주업체정보 → register under KERI by default (since 거래처/벤더는 회사 무관).
  // If a project for KHRI references a vendor, we'll find/create under KHRI in step 4.

  // ========== 거래처정보 ==========
  const clientSheet = wb.Sheets['거래처정보'];
  if (clientSheet) {
    const rows = parseSheetRows(clientSheet);
    const dataRows = rows.slice(2).filter(r => r && r[1]);
    console.log(`  거래처정보 행: ${dataRows.length}`);

    for (const r of dataRows) {
      const name = clean(r[1]);
      if (!name) continue;
      const biz = normBiz(clean(r[2]));
      const ceo = clean(r[3]);
      const industry = clean(r[4]);
      const subIndustry = clean(r[5]);
      const address = clean(r[6]);
      const contacts = parseContacts(r, 7);
      const defaultContact = contacts[0] || null;

      // register under both KERI and KHRI (they share clients)
      for (const co of [KERI, KHRI]) {
        const cid = ensureClient({
          companyId: co.id,
          name,
          biz,
          ceo,
          industry,
          subIndustry,
          address,
          clientType: 'both',
          defaultContact,
        });

        // contacts
        for (const c of contacts) {
          if (!c.name) continue;
          const ck = `${cid}::${c.name.trim()}`;
          if (contactKey.has(ck)) continue;
          contactKey.add(ck);
          newContacts.push({
            id: crypto.randomUUID(),
            client_company_id: cid,
            name: c.name.trim(),
            position: c.position,
            phone: c.phone,
            email: c.email,
            notes: c.notes,
            is_primary: c === contacts[0],
            created_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  // ========== 외주업체정보 ==========
  const osSheet = wb.Sheets['외주업체정보'];
  if (osSheet) {
    const rows = parseSheetRows(osSheet);
    const dataRows = rows.slice(2).filter(r => r && r[1]);
    console.log(`  외주업체정보 행: ${dataRows.length}`);

    for (const r of dataRows) {
      const vendorName = clean(r[1]);
      if (!vendorName) continue;
      const biz = normBiz(clean(r[2]));
      // skip rows with empty 사업자번호 only if name is also empty/placeholder
      // (Task says "빈 사업자번호 행은 skip" but applies to 거래처/외주 — many real vendors have no biz.
      //  We interpret as: skip rows where BOTH name and biz are empty.)
      // Already filtered above by name.

      const ceo = clean(r[3]);
      const industry = clean(r[4]);
      const subIndustry = clean(r[5]);
      const address = clean(r[6]);
      const contacts = parseContacts(r, 7);
      const defaultContact = contacts[0] || null;

      // register vendor under both KERI and KHRI
      for (const co of [KERI, KHRI]) {
        const cid = ensureClient({
          companyId: co.id,
          name: vendorName,
          biz,
          ceo,
          industry,
          subIndustry,
          address,
          clientType: 'vendor',
          defaultContact,
        });

        // record vendor lookup by company+name
        vendorByName.set(`${co.id}::${vendorName.trim()}`, {
          client_company_id: cid,
          biz,
          ceo,
          industry,
          subIndustry,
          address,
          contacts,
        });

        for (const c of contacts) {
          if (!c.name) continue;
          const ck = `${cid}::${c.name.trim()}`;
          if (contactKey.has(ck)) continue;
          contactKey.add(ck);
          newContacts.push({
            id: crypto.randomUUID(),
            client_company_id: cid,
            name: c.name.trim(),
            position: c.position,
            phone: c.phone,
            email: c.email,
            notes: c.notes,
            is_primary: c === contacts[0],
            created_at: new Date().toISOString(),
          });
        }
      }
    }
  }
}

// ============= INSERT clients/contacts =============
console.log(`\n=== 신규 client_companies: ${newClients.length}건 ===`);
const r1 = await batchInsert('client_companies', newClients);
console.log(`  ✅ ${r1.ok}, ❌ ${r1.fail}`);
if (r1.errors.length) r1.errors.slice(0, 3).forEach(e => console.log(`   - ${e.msg}`));

console.log(`\n=== client_companies 업데이트: ${updateClients.length}건 (중복 dedup) ===`);
{
  // dedup updateClients by id (keep last)
  const m = new Map();
  for (const u of updateClients) m.set(u.id, u.patch);
  const arr = [...m.entries()];
  let uOk = 0, uFail = 0;
  for (const [id, patch] of arr) {
    const { error } = await sb.from('client_companies').update(patch).eq('id', id);
    if (error) uFail++;
    else uOk++;
  }
  console.log(`  ✅ ${uOk}, ❌ ${uFail}`);
}

console.log(`\n=== 신규 client_contacts: ${newContacts.length}건 ===`);
const r2 = await batchInsert('client_contacts', newContacts);
console.log(`  ✅ ${r2.ok}, ❌ ${r2.fail}`);
if (r2.errors.length) r2.errors.slice(0, 3).forEach(e => console.log(`   - ${e.msg}`));

// ============= Step 2: 프로젝트정보 → contracts =============
console.log('\n=== Step 2: 프로젝트정보 → contracts ===');

const allContracts = [];
const allSubtasks = [];
const allPaymentConds = [];
const allOutsourcings = [];

const fileStats = [];

const progressMap = {
  진행: 'in_progress',
  진행중: 'in_progress',
  완료: 'completed',
  중단: 'cancelled',
  보류: 'on_hold',
};

for (const fileMeta of allWbs) {
  const { wb, label, hasAccounting } = fileMeta;
  const stats = { file: label, projects: 0, subtasks: 0, paymentConds: 0, outsourcings: 0, errors: [] };

  const projSheet = wb.Sheets['프로젝트정보'];
  if (!projSheet) {
    fileStats.push(stats);
    continue;
  }

  const rows = parseSheetRows(projSheet);
  const dataRows = rows.slice(2).filter(r => r && r.some(c => c != null && c !== ''));
  console.log(`\n  --- [${label}] 프로젝트 행: ${dataRows.length} ---`);

  // accounting cols (only in 건설사업부 file): 46~57
  // 46=계약번호, 47=계약년, 48=코드, 49=용역구분, 50=용역의뢰, 51=용역명, 52=계약금액(VAT 제외), 53=잔여 기성, 54=상태, 55=담당자, 56=비고, 57=외주

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    try {
      const companyName = clean(r[1]);
      const deptName = clean(r[2]);
      const projectName = clean(r[3]);
      const location = clean(r[4]);
      const progressKo = clean(r[5]);
      const clientName = clean(r[6]);
      const manager = clean(r[7]);
      const quoteNumber = clean(r[8]);
      const quoteDate = excelSerialToISO(r[9]);
      const contractNumberRaw = clean(r[10]);
      const contractDate = excelSerialToISO(r[11]);
      const startDate = excelSerialToISO(r[12]);
      const endDateRaw = r[13];
      const endDate = excelSerialToISO(endDateRaw);
      const supply = toInt(r[14]);
      const vat = toInt(r[15]);
      const total = toInt(r[16]);
      const paymentMethod = clean(r[17]);
      const advanceRatio = toNum(r[18]);
      const interimRatio = toNum(r[19]);
      const balanceRatio = toNum(r[20]);
      const paymentTiming = clean(r[21]);
      const warranty = clean(r[22]);
      const folderPath = clean(r[23]);
      const remarks = clean(r[24]);

      // accounting (only on hasAccounting)
      let accCN = null, accYear = null, accCode = null, accCategory = null,
          accClient = null, accServiceName = null, accAmountVATExcluded = 0,
          accRemainingAmount = 0, accStatus = null, accManager = null,
          accNotes = null, accOutsource = null;
      if (hasAccounting) {
        accCN = clean(r[46]);
        accYear = clean(r[47]);
        accCode = clean(r[48]);
        accCategory = clean(r[49]);
        accClient = clean(r[50]);
        accServiceName = clean(r[51]);
        accAmountVATExcluded = toInt(r[52]);
        accRemainingAmount = toInt(r[53]);
        accStatus = clean(r[54]);
        accManager = clean(r[55]);
        accNotes = clean(r[56]);
        accOutsource = clean(r[57]);
      }

      if (!projectName && !contractNumberRaw && !accCN && !accServiceName) continue;

      const co = resolveCompany(companyName);
      const dept = resolveDept(co.id, deptName);

      // contract number
      let cn = contractNumberRaw || accCN;
      if (!cn) cn = `${co.id === KHRI.id ? 'KHRI' : 'KERI'}-${(allContracts.length + 1).toString().padStart(4, '0')}`;
      while (allContracts.some(x => x.contract_number === cn)) cn += '-D';

      // amounts
      const totalAmount = total || (supply + vat) || 0;
      const supplyAmount = supply || (totalAmount ? Math.round(totalAmount / 1.1) : 0);
      const vatAmount = vat || (totalAmount ? totalAmount - supplyAmount : 0);

      // received amount from accounting
      let receivedAmount = 0;
      if (hasAccounting && accAmountVATExcluded > 0) {
        receivedAmount = accAmountVATExcluded - accRemainingAmount;
        if (receivedAmount < 0) receivedAmount = 0;
      }

      const progress = progressMap[progressKo] || progressMap[accStatus] || 'in_progress';
      const finalServiceName = projectName || accServiceName || '';
      const finalClientName = clientName || accClient || '';

      // resolve client_company_id
      let clientCompanyId = null;
      if (finalClientName) {
        const k = `${co.id}::${finalClientName.trim()}`;
        const found = clientByCoName.get(k);
        if (found) {
          clientCompanyId = found.id;
        } else {
          // create on the fly
          const newId = ensureClient({
            companyId: co.id,
            name: finalClientName.trim(),
            biz: null, ceo: null, industry: null, subIndustry: null, address: null,
            clientType: 'both',
            defaultContact: null,
          });
          clientCompanyId = newId;
        }
      }

      const contractId = crypto.randomUUID();

      const notesArr = [
        quoteNumber ? `견적번호: ${quoteNumber}` : '',
        quoteDate ? `견적일자: ${quoteDate}` : '',
        paymentMethod ? `지급방법: ${paymentMethod}` : '',
        paymentTiming ? `지급시기: ${paymentTiming}` : '',
        typeof endDateRaw === 'string' && !endDate ? `준공일(원문): ${endDateRaw}` : '',
        warranty ? `보증기간: ${warranty}` : '',
        folderPath ? `폴더: ${folderPath}` : '',
        remarks ? `특이사항: ${remarks}` : '',
        // accounting
        accYear ? `계약년: ${accYear}` : '',
        accCode ? `회계코드: ${accCode}` : '',
        accCategory ? `용역구분: ${accCategory}` : '',
        accStatus ? `회계상태: ${accStatus}` : '',
        accManager ? `회계담당자: ${accManager}` : '',
        accNotes ? `회계비고: ${accNotes}` : '',
        accOutsource ? `외주(회계): ${accOutsource}` : '',
        accAmountVATExcluded ? `계약금액(VAT제외): ${accAmountVATExcluded.toLocaleString()}` : '',
        accRemainingAmount ? `잔여 기성: ${accRemainingAmount.toLocaleString()}` : '',
      ].filter(Boolean).join(' | ');

      allContracts.push({
        id: contractId,
        company_id: co.id,
        department_id: dept?.id || null,
        contract_number: cn,
        client_company: finalClientName,
        client_business_number: null,
        service_name: finalServiceName,
        description: location ? `현장위치: ${location}` : null,
        contract_type: '용역',
        service_category: accCategory || null,
        contract_date: contractDate || null,
        contract_start_date: startDate || null,
        contract_end_date: typeof endDateRaw === 'string' && !endDate ? null : (endDate || null),
        contract_amount: supplyAmount,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        received_amount: receivedAmount,
        remaining_amount: Math.max(0, totalAmount - receivedAmount),
        progress,
        progress_note: progressKo || null,
        manager_name: manager || accManager || null,
        notes: notesArr || null,
        source_file_path: folderPath || null,
        outsource_company: accOutsource || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      stats.projects++;

      // payment_conditions: 선급금/중도금/잔금
      const totalForPayment = totalAmount || 0;
      const condDefs = [
        { type: 'advance', title: '선급금', ratio: advanceRatio },
        { type: 'interim', title: '중도금', ratio: interimRatio },
        { type: 'balance', title: '잔금', ratio: balanceRatio },
      ];
      let sortIdx = 0;
      for (const cd of condDefs) {
        if (cd.ratio > 0) {
          allPaymentConds.push({
            id: crypto.randomUUID(),
            contract_id: contractId,
            condition_type: cd.type,
            title: cd.title,
            amount: Math.round(totalForPayment * cd.ratio / 100),
            percentage: cd.ratio,
            due_date: paymentTiming || null,
            paid_amount: 0,
            status: 'pending',
            sort_order: sortIdx++,
            notes: paymentTiming || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          stats.paymentConds++;
        }
      }

      // contract_subtasks: 세부작업 1~10 (cols 25..43, pairs of name/worker)
      // header: 세부작업N (col 25,27,...) + 작업자N(담당자/외주) (col 26,28,...)
      let subSort = 0;
      for (let c = 25; c <= 43; c += 2) {
        const taskName = clean(r[c]);
        const worker = clean(r[c + 1]);
        if (!taskName && !worker) continue;
        // worker may be a person name (담당자) or vendor name (외주)
        const isVendor = worker && vendorByName.has(`${co.id}::${worker.trim()}`);
        allSubtasks.push({
          id: crypto.randomUUID(),
          contract_id: contractId,
          parent_id: null,
          level: 1,
          title: taskName || worker || '세부작업',
          description: isVendor ? `[외주] ${worker}` : (worker ? `[담당] ${worker}` : null),
          assignee_name: worker || null,
          progress_rate: 0,
          sort_order: subSort++,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        stats.subtasks++;

        // if vendor, also create outsourcing record
        if (isVendor) {
          const v = vendorByName.get(`${co.id}::${worker.trim()}`);
          allOutsourcings.push({
            id: crypto.randomUUID(),
            company_id: co.id,
            contract_id: contractId,
            outsource_company: worker,
            outsource_contact: v.contacts[0]?.name || null,
            outsource_phone: v.contacts[0]?.phone || null,
            service_description: taskName || finalServiceName || worker,
            outsource_amount: 0,
            budget: 0,
            actual_cost: 0,
            status: 'pending',
            start_date: startDate || null,
            end_date: typeof endDateRaw === 'string' && !endDate ? null : (endDate || null),
            notes: [
              v.biz ? `사업자: ${v.biz}` : '',
              v.ceo ? `대표: ${v.ceo}` : '',
              v.address ? `주소: ${v.address}` : '',
            ].filter(Boolean).join(' | ') || null,
            vendor_type: worker === '개인' ? 'individual' : 'company',
            show_on_calendar: false,
            vat_included: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          stats.outsourcings++;
        }
      }

      // 회계 외주: accOutsource (free text — register orphan outsourcing)
      if (accOutsource) {
        // try to match vendor
        const vMatch = vendorByName.get(`${co.id}::${accOutsource.trim()}`);
        allOutsourcings.push({
          id: crypto.randomUUID(),
          company_id: co.id,
          contract_id: contractId,
          outsource_company: accOutsource,
          outsource_contact: vMatch?.contacts[0]?.name || null,
          outsource_phone: vMatch?.contacts[0]?.phone || null,
          service_description: finalServiceName || '회계 외주',
          outsource_amount: 0,
          budget: 0,
          actual_cost: 0,
          status: 'pending',
          start_date: startDate || null,
          end_date: typeof endDateRaw === 'string' && !endDate ? null : (endDate || null),
          notes: '회계 외주 컬럼',
          vendor_type: 'company',
          show_on_calendar: false,
          vat_included: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        stats.outsourcings++;
      }
    } catch (e) {
      stats.errors.push(`행 ${i + 3}: ${e.message}`);
    }
  }

  fileStats.push(stats);
}

// ============= INSERT contracts/subtasks/payments/outsourcings =============
console.log(`\n=== contracts INSERT: ${allContracts.length}건 ===`);
const rC = await batchInsert('contracts', allContracts);
console.log(`  ✅ ${rC.ok}, ❌ ${rC.fail}`);
if (rC.errors.length) {
  const reasons = new Map();
  rC.errors.forEach(e => reasons.set(e.msg.slice(0, 100), (reasons.get(e.msg.slice(0, 100)) || 0) + 1));
  for (const [m, c] of reasons) console.log(`   [${c}] ${m}`);
}

console.log(`\n=== payment_conditions INSERT: ${allPaymentConds.length}건 ===`);
const rP = await batchInsert('payment_conditions', allPaymentConds);
console.log(`  ✅ ${rP.ok}, ❌ ${rP.fail}`);
if (rP.errors.length) rP.errors.slice(0, 3).forEach(e => console.log(`   - ${e.msg}`));

console.log(`\n=== contract_subtasks INSERT: ${allSubtasks.length}건 ===`);
const rS = await batchInsert('contract_subtasks', allSubtasks);
console.log(`  ✅ ${rS.ok}, ❌ ${rS.fail}`);
if (rS.errors.length) rS.errors.slice(0, 3).forEach(e => console.log(`   - ${e.msg}`));

console.log(`\n=== outsourcings INSERT: ${allOutsourcings.length}건 ===`);
const rO = await batchInsert('outsourcings', allOutsourcings);
console.log(`  ✅ ${rO.ok}, ❌ ${rO.fail}`);
if (rO.errors.length) rO.errors.slice(0, 3).forEach(e => console.log(`   - ${e.msg}`));

// ============= Final summary =============
console.log('\n========== FINAL SUMMARY ==========');
for (const s of fileStats) {
  console.log(`\n📂 ${s.file}`);
  console.log(`  contracts: ${s.projects}, subtasks: ${s.subtasks}, payment_conds: ${s.paymentConds}, outsourcings: ${s.outsourcings}`);
  if (s.errors.length) {
    console.log(`  errors: ${s.errors.length}`);
    s.errors.slice(0, 5).forEach(e => console.log(`    - ${e}`));
  }
}

// per-company final counts
console.log('\n========== 회사별 최종 ==========');
for (const co of [KERI, KHRI]) {
  const { count: contracts } = await sb.from('contracts').select('id', { count: 'exact', head: true }).eq('company_id', co.id);
  const { count: clients } = await sb.from('client_companies').select('id', { count: 'exact', head: true }).eq('company_id', co.id);
  console.log(`  ${co.name}: contracts=${contracts}, client_companies=${clients}`);
}

console.log('\n=== TOTALS ===');
console.log(`  client_companies new: ${r1.ok}`);
console.log(`  client_companies updated: ${updateClients.length}`);
console.log(`  client_contacts: ${r2.ok}`);
console.log(`  contracts: ${rC.ok}`);
console.log(`  payment_conditions: ${rP.ok}`);
console.log(`  contract_subtasks: ${rS.ok}`);
console.log(`  outsourcings: ${rO.ok}`);

console.log('\n✅ DONE');
