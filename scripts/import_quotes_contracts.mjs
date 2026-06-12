import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

// 부서 매핑: 대표님 확인사항 + 그대로 두기
const DEPT_MAP = {
  'RES': '학술사업부',
  // 'CON': '건설사업부',  // JSON에는 G-CON만 있음, 그대로 둠
  // 'G-CON': 그대로
};

function normalizeBizNumber(s) {
  if (!s) return null;
  const clean = String(s).replace(/\D/g, '');
  if (clean.length !== 10) return String(s).trim();
  return `${clean.slice(0,3)}-${clean.slice(3,5)}-${clean.slice(5)}`;
}

// === 1. JSON 로드 ===
console.log('=== JSON 로드 ===');
const quotes = JSON.parse(fs.readFileSync('quotes.json', 'utf-8'));
const contracts = JSON.parse(fs.readFileSync('contracts.json', 'utf-8'));
console.log(`견적: ${quotes.length}건, 계약: ${contracts.length}건`);

// === 2. 회사 매핑 ===
const { data: companies } = await sb.from('companies').select('*');
const companyMap = new Map(companies.map(c => [c.name, c]));
console.log('\n회사 매핑:', [...companyMap.keys()]);

// === 3. 기존 quotes/contracts 삭제 (이미 0건일 가능성 있음) ===
console.log('\n=== 기존 데이터 삭제 ===');
const tablesToClear = [
  'quote_labor_items', 'quote_expense_items', 'quote_amount_histories', 'quotes',
  'contract_labor_items', 'contract_expense_items', 'contract_subtasks',
  'contract_sections', 'contract_payments', 'contract_events', 'contract_histories', 'contracts',
];
for (const t of tablesToClear) {
  const { count: before } = await sb.from(t).select('*', { count: 'exact', head: true });
  if (before > 0) {
    const { error } = await sb.from(t).delete().not('id', 'is', null);
    console.log(`  ${t}: ${before} → ${error ? '❌ '+error.message : '✅'}`);
  }
}

// === 4. 거래처 사전 로드 ===
console.log('\n=== 거래처 사전 로드 ===');
const { data: existingClients } = await sb.from('client_companies').select('id, company_id, name, business_number');
console.log(`기존 거래처: ${existingClients.length}개`);

// 매칭 인덱스: 사업자번호 우선, 회사 + 이름 보조
const bizIndex = new Map(); // company_id::biz → client
const nameIndex = new Map(); // company_id::name → client
for (const c of existingClients) {
  if (c.business_number) bizIndex.set(`${c.company_id}::${c.business_number}`, c);
  nameIndex.set(`${c.company_id}::${c.name}`, c);
}

// === 5. 부서 사전 로드 ===
const { data: existingDepts } = await sb.from('departments').select('id, company_id, name');
const deptIndex = new Map();
for (const d of existingDepts) {
  deptIndex.set(`${d.company_id}::${d.name}`, d);
}

// === 6. JSON 처리 + 신규 거래처/부서 수집 ===
const newClients = [];
const newDepts = [];

function getOrCreateClient(companyId, name, biz, ceo, phone, email, address, contact) {
  if (!name || !companyId) return null;
  const normBiz = normalizeBizNumber(biz);
  // 1순위: 사업자번호 매칭
  if (normBiz) {
    const found = bizIndex.get(`${companyId}::${normBiz}`);
    if (found) return found.id;
  }
  // 2순위: 이름 매칭
  const found = nameIndex.get(`${companyId}::${name.trim()}`);
  if (found) {
    // 사업자번호 없으면 보강
    if (!found.business_number && normBiz) {
      bizIndex.set(`${companyId}::${normBiz}`, found);
    }
    return found.id;
  }
  // 3순위: 신규
  const id = crypto.randomUUID();
  const newClient = {
    id,
    company_id: companyId,
    name: name.trim(),
    business_number: normBiz,
    ceo_name: ceo || null,
    phone: phone || null,
    email: email ? String(email).trim() : null,
    address: address || null,
    is_active: true,
    client_type: 'both',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  newClients.push(newClient);
  nameIndex.set(`${companyId}::${name.trim()}`, { id, company_id: companyId, name: name.trim(), business_number: normBiz });
  if (normBiz) bizIndex.set(`${companyId}::${normBiz}`, { id, company_id: companyId });
  return id;
}

function getOrCreateDept(companyId, deptNameRaw) {
  if (!deptNameRaw || !companyId) return null;
  const deptName = DEPT_MAP[deptNameRaw] || deptNameRaw;
  const found = deptIndex.get(`${companyId}::${deptName}`);
  if (found) return found.id;
  const id = crypto.randomUUID();
  const newDept = {
    id,
    company_id: companyId,
    name: deptName,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  newDepts.push(newDept);
  deptIndex.set(`${companyId}::${deptName}`, { id, company_id: companyId, name: deptName });
  return id;
}

// === 7. quotes 변환 ===
console.log('\n=== quotes 변환 ===');
const quoteRecords = [];
let qSkipped = 0;
const qNumberSeen = new Set();
for (const q of quotes) {
  const co = companyMap.get(q.company);
  if (!co) { qSkipped++; continue; }

  const clientId = q.client_name ? getOrCreateClient(
    co.id, q.client_name, q.client_business_number, null,
    q.client_phone, q.client_email, q.client_address, q.client_contact_person
  ) : null;
  const deptId = getOrCreateDept(co.id, q.department_name);

  // 견적번호 unique 보장
  let quoteNumber = q.quote_number || `Q-${crypto.randomUUID().slice(0,8)}`;
  while (qNumberSeen.has(quoteNumber)) {
    quoteNumber = `${q.quote_number || 'Q'}-${crypto.randomUUID().slice(0,4)}`;
  }
  qNumberSeen.add(quoteNumber);

  quoteRecords.push({
    id: crypto.randomUUID(),
    company_id: co.id,
    department_id: deptId,
    quote_number: quoteNumber,
    quote_date: q.quote_date || null,
    valid_until: q.valid_until || null,
    service_name: q.project_name || null,
    recipient_company: q.client_name || '',
    recipient_contact: q.client_contact_person || null,
    recipient_phone: q.client_phone || null,
    recipient_email: q.client_email || null,
    recipient_address: q.client_address || null,
    supply_amount: q.supply_amount || 0,
    vat_amount: q.vat || 0,
    total_amount: q.total_amount || 0,
    status: q.status || 'draft',
    notes: [q.writer_name ? `작성자: ${q.writer_name}` : '', q.notes || '', q.source_file ? `출처: ${q.source_file}` : ''].filter(Boolean).join(' | '),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}
console.log(`  변환: ${quoteRecords.length}건, 스킵: ${qSkipped}건`);

// === 8. contracts 변환 ===
console.log('\n=== contracts 변환 ===');
const contractRecords = [];
let cSkipped = 0;
const cNumberSeen = new Set();
for (const c of contracts) {
  const co = companyMap.get(c.company);
  if (!co) { cSkipped++; continue; }

  const clientId = c.client_name ? getOrCreateClient(
    co.id, c.client_name, c.client_business_number, null,
    c.client_phone, c.client_email, c.client_address, c.client_contact_person
  ) : null;
  const deptId = getOrCreateDept(co.id, c.department_name);

  let contractNumber = c.contract_number || `C-${crypto.randomUUID().slice(0,8)}`;
  while (cNumberSeen.has(contractNumber)) {
    contractNumber = `${c.contract_number || 'C'}-${crypto.randomUUID().slice(0,4)}`;
  }
  cNumberSeen.add(contractNumber);

  contractRecords.push({
    id: crypto.randomUUID(),
    company_id: co.id,
    department_id: deptId,
    contract_number: contractNumber,
    contract_date: c.contract_date || null,
    contract_type: c.contract_type || '용역',
    service_name: c.project_name || null,
    description: c.project_location || null,
    client_company: c.client_name || '',
    client_contact_name: c.client_contact_person || null,
    client_contact_phone: c.client_phone || null,
    client_contact_email: c.client_email || null,
    client_business_number: normalizeBizNumber(c.client_business_number) || null,
    contract_start_date: c.start_date || null,
    contract_end_date: c.end_date || null,
    contract_amount: c.supply_amount || 0,
    vat_amount: c.vat || 0,
    total_amount: c.total_amount || 0,
    progress: c.status === 'completed' ? 'completed' : (c.status === 'cancelled' ? 'cancelled' : 'in_progress'),
    notes: [c.writer_name ? `작성자: ${c.writer_name}` : '', c.notes || '', c.warranty_period ? `하자보수: ${c.warranty_period}` : '', c.payment_method ? `지급: ${c.payment_method}` : '', c.source_file ? `출처: ${c.source_file}` : ''].filter(Boolean).join(' | '),
    source_file_path: c.source_file || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}
console.log(`  변환: ${contractRecords.length}건, 스킵: ${cSkipped}건`);

// === 9. 신규 부서 등록 ===
if (newDepts.length > 0) {
  console.log(`\n=== 신규 부서 ${newDepts.length}개 등록 ===`);
  const { error } = await sb.from('departments').insert(newDepts);
  console.log(error ? `  ❌ ${error.message}` : '  ✅');
}

// === 10. 신규 거래처 등록 ===
if (newClients.length > 0) {
  console.log(`\n=== 신규 거래처 ${newClients.length}개 등록 ===`);
  const CHUNK = 100;
  let ok = 0;
  for (let i = 0; i < newClients.length; i += CHUNK) {
    const batch = newClients.slice(i, i + CHUNK);
    const { error } = await sb.from('client_companies').insert(batch);
    if (error) {
      for (const c of batch) {
        const { error: e2 } = await sb.from('client_companies').insert(c);
        if (!e2) ok++;
      }
    } else ok += batch.length;
    process.stdout.write(`  ${ok}/${newClients.length} `);
  }
  console.log(`\n  ✅ ${ok}개 등록`);
}

// === 11. quotes 등록 ===
console.log(`\n=== quotes ${quoteRecords.length}건 등록 ===`);
let qOk = 0, qFail = 0;
const qErrSamples = [];
const CHUNK = 100;
for (let i = 0; i < quoteRecords.length; i += CHUNK) {
  const batch = quoteRecords.slice(i, i + CHUNK);
  const { error } = await sb.from('quotes').insert(batch);
  if (error) {
    for (const q of batch) {
      const { error: e2 } = await sb.from('quotes').insert(q);
      if (e2) {
        qFail++;
        if (qErrSamples.length < 3) qErrSamples.push(e2.message);
      } else qOk++;
    }
  } else qOk += batch.length;
  process.stdout.write(`  ${qOk+qFail}/${quoteRecords.length} `);
}
console.log(`\n  ✅ ${qOk} 등록, ❌ ${qFail} 실패`);
if (qErrSamples.length) console.log('  에러 샘플:', qErrSamples);

// === 12. contracts 등록 ===
console.log(`\n=== contracts ${contractRecords.length}건 등록 ===`);
let cOk = 0, cFail = 0;
const cErrSamples = [];
for (let i = 0; i < contractRecords.length; i += CHUNK) {
  const batch = contractRecords.slice(i, i + CHUNK);
  const { error } = await sb.from('contracts').insert(batch);
  if (error) {
    for (const c of batch) {
      const { error: e2 } = await sb.from('contracts').insert(c);
      if (e2) {
        cFail++;
        if (cErrSamples.length < 3) cErrSamples.push(e2.message);
      } else cOk++;
    }
  } else cOk += batch.length;
  process.stdout.write(`  ${cOk+cFail}/${contractRecords.length} `);
}
console.log(`\n  ✅ ${cOk} 등록, ❌ ${cFail} 실패`);
if (cErrSamples.length) console.log('  에러 샘플:', cErrSamples);

// === 13. 통계 ===
console.log('\n=== 최종 통계 ===');
const { data: finalQ } = await sb.from('quotes').select('company_id, total_amount');
const { data: finalC } = await sb.from('contracts').select('company_id, total_amount');
const { data: finalCl } = await sb.from('client_companies').select('company_id');
const { data: finalD } = await sb.from('departments').select('company_id, name');
for (const [name, c] of companyMap) {
  const q = finalQ.filter(x => x.company_id === c.id);
  const ct = finalC.filter(x => x.company_id === c.id);
  const cl = finalCl.filter(x => x.company_id === c.id).length;
  const dp = finalD.filter(x => x.company_id === c.id);
  const qs = q.reduce((s,x)=>s+(x.total_amount||0),0);
  const cs = ct.reduce((s,x)=>s+(x.total_amount||0),0);
  console.log(`\n  ${name}:`);
  console.log(`    거래처 ${cl}개, 부서 ${dp.length}개`);
  console.log(`    견적 ${q.length}건 (${qs.toLocaleString()}원)`);
  console.log(`    계약 ${ct.length}건 (${cs.toLocaleString()}원)`);
  if (dp.length) console.log(`    부서: ${dp.map(d=>d.name).join(', ')}`);
}
