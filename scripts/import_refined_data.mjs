/**
 * 정제된 데이터 일괄 임포트
 * 1. 기존 contracts, quotes, tax_invoices + 관련 테이블 삭제
 * 2. projects_trusted_only.json → contracts + client_companies
 * 3. keri_세금계산서.json + easy_매출계산서.json → tax_invoices + client_companies
 * 4. keri_계약현황.json → contracts 보강 (계약현황에만 있는 데이터)
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const DIR = 'c:/Users/parkm/easy_company/정제된데이터';

async function fetchAll(t, c) {
  const all = []; let f = 0;
  while (true) { const { data } = await sb.from(t).select(c).order('id').range(f, f + 999); if (!data || !data.length) break; all.push(...data); if (data.length < 1000) break; f += 1000; }
  return all;
}

function normBiz(s) {
  if (!s) return null;
  const clean = String(s).replace(/\D/g, '');
  if (clean.length !== 10) return String(s).trim() || null;
  return `${clean.slice(0,3)}-${clean.slice(3,5)}-${clean.slice(5)}`;
}

// === 0. 회사/부서 매핑 ===
const { data: companies } = await sb.from('companies').select('*');
const companyMap = new Map(companies.map(c => [c.name, c]));
const { data: departments } = await sb.from('departments').select('*');
const deptMap = new Map();
departments.forEach(d => deptMap.set(`${d.company_id}::${d.name}`, d));
console.log('회사:', [...companyMap.keys()]);

// === 1. 기존 데이터 삭제 ===
console.log('\n=== 기존 데이터 삭제 ===');
const tablesToClear = [
  'quote_labor_items', 'quote_expense_items', 'quote_amount_histories', 'quotes',
  'contract_labor_items', 'contract_expense_items', 'contract_subtasks',
  'contract_sections', 'contract_payments', 'contract_events', 'contract_histories',
  'contract_members', 'quote_members', 'contracts',
  'tax_invoices',
];
for (const t of tablesToClear) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
  if (count > 0) {
    await sb.from(t).delete().not('id', 'is', null);
    console.log(`  ${t}: ${count} → 삭제`);
  }
}

// === 2. 거래처 사전 로드 ===
let existingClients = await fetchAll('client_companies', 'id, company_id, name, business_number');
const clientByBiz = new Map();
const clientByName = new Map();
existingClients.forEach(c => {
  if (c.business_number) clientByBiz.set(`${c.company_id}::${c.business_number}`, c);
  clientByName.set(`${c.company_id}::${c.name}`, c);
});

function getOrCreateClient(companyId, name, biz, ceo, email, address, contact) {
  if (!name || !companyId) return null;
  const nb = normBiz(biz);
  let found = nb ? clientByBiz.get(`${companyId}::${nb}`) : null;
  if (!found) found = clientByName.get(`${companyId}::${name.trim()}`);
  if (found) return found.id;
  const id = crypto.randomUUID();
  const newClient = {
    id, company_id: companyId, name: name.trim(),
    business_number: nb, ceo_name: ceo || null,
    email: email || null, address: address || null,
    phone: contact || null, is_active: true, client_type: 'both',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  clientByName.set(`${companyId}::${name.trim()}`, { id, company_id: companyId, name: name.trim(), business_number: nb });
  if (nb) clientByBiz.set(`${companyId}::${nb}`, { id, company_id: companyId });
  return { _new: true, ...newClient };
}

const newClients = [];

// === 3. projects_trusted_only.json → contracts ===
console.log('\n=== projects_trusted_only.json → contracts ===');
const projects = JSON.parse(fs.readFileSync(`${DIR}/projects_trusted_only.json`, 'utf-8'));
const contractRecords = [];
const contractNumberSet = new Set();

for (const p of projects) {
  const co = companyMap.get(p.company);
  if (!co) continue;
  const dept = p.department ? deptMap.get(`${co.id}::${p.department}`) : null;

  const clientResult = getOrCreateClient(co.id, p.client_name, p.client_biz_number, p.client_ceo, p.client_email, p.client_address, p.client_contact);
  let clientId = null;
  if (clientResult && typeof clientResult === 'string') clientId = clientResult;
  else if (clientResult && clientResult._new) { newClients.push(clientResult); clientId = clientResult.id; }

  let contractNumber = `P-${p.company.slice(0,2)}-${(contractRecords.length + 1).toString().padStart(4, '0')}`;
  while (contractNumberSet.has(contractNumber)) contractNumber += '_';
  contractNumberSet.add(contractNumber);

  contractRecords.push({
    id: crypto.randomUUID(),
    company_id: co.id,
    department_id: dept?.id || null,
    contract_number: contractNumber,
    client_company: p.client_name || '',
    client_business_number: normBiz(p.client_biz_number) || null,
    client_contact_name: p.client_contact || null,
    client_contact_email: p.client_email || null,
    service_name: p.project_name || null,
    contract_type: p.service_type || '용역',
    contract_date: p.contract_date || null,
    contract_amount: p.contract_amount || 0,
    vat_amount: Math.round((p.contract_amount || 0) * 0.1),
    total_amount: p.contract_amount ? Math.round(p.contract_amount * 1.1) : 0,
    received_amount: p.total_paid || 0,
    remaining_amount: Math.max(0, (p.contract_amount ? Math.round(p.contract_amount * 1.1) : 0) - (p.total_paid || 0)),
    manager_name: p.manager || null,
    outsource_company: p.sub_contractor || null,
    outsource_amount: p.sub_amount || 0,
    progress: p.unpaid === 0 && p.total_paid > 0 ? 'completed' : 'in_progress',
    notes: [p.sources ? `출처: ${p.sources}` : '', p.record_count ? `레코드: ${p.record_count}건` : ''].filter(Boolean).join(' | '),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}
console.log(`  변환: ${contractRecords.length}건`);

// === 4. 세금계산서 (keri + easy) → tax_invoices ===
console.log('\n=== 세금계산서 → tax_invoices ===');
const keriTI = JSON.parse(fs.readFileSync(`${DIR}/keri_세금계산서.json`, 'utf-8'));
const easyTI = JSON.parse(fs.readFileSync(`${DIR}/easy_매출계산서.json`, 'utf-8'));
const allTI = [...keriTI, ...easyTI];
const tiRecords = [];

for (let i = 0; i < allTI.length; i++) {
  const t = allTI[i];
  const co = companyMap.get(t.company);
  if (!co) continue;

  const clientResult = getOrCreateClient(co.id, t.client_name, t.client_biz_number, t.client_ceo, t.client_email, t.client_address, t.client_contact);
  let clientCompanyId = null;
  if (clientResult && typeof clientResult === 'string') clientCompanyId = clientResult;
  else if (clientResult && clientResult._new) { newClients.push(clientResult); clientCompanyId = clientResult.id; }

  tiRecords.push({
    id: crypto.randomUUID(),
    company_id: co.id,
    client_company_id: clientCompanyId,
    invoice_number: `TI-${t.source_year || '2024'}-${(i + 1).toString().padStart(4, '0')}-${t.company.slice(0,2)}`,
    direction: 'issued',
    issue_date: t.issue_date || '2024-01-01',
    supply_amount: t.supply_amount || 0,
    vat_amount: t.vat || 0,
    total_amount: t.total_amount || 0,
    supplier_name: t.company,
    buyer_name: t.client_name || '',
    buyer_business_number: normBiz(t.client_biz_number) || '',
    buyer_representative: t.client_ceo || '',
    buyer_email: t.client_email || '',
    item_description: t.description || '',
    status: t.paid_date ? 'paid' : 'issued',
    notes: [t.payment_status ? `은행: ${t.payment_status}` : '', t.paid_date ? `입금일: ${t.paid_date}` : '', t.department ? `부서: ${t.department}` : '', t.manager ? `담당: ${t.manager}` : '', t.notes || ''].filter(Boolean).join(', '),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}
console.log(`  변환: ${tiRecords.length}건`);

// === 5. 신규 거래처 등록 ===
const uniqueNewClients = [];
const seenClientIds = new Set();
for (const c of newClients) {
  if (seenClientIds.has(c.id)) continue;
  seenClientIds.add(c.id);
  const { _new, ...clean } = c;
  uniqueNewClients.push(clean);
}
console.log(`\n=== 신규 거래처 ${uniqueNewClients.length}개 등록 ===`);
for (let i = 0; i < uniqueNewClients.length; i += 100) {
  const batch = uniqueNewClients.slice(i, i + 100);
  const { error } = await sb.from('client_companies').insert(batch);
  if (error) { for (const c of batch) { await sb.from('client_companies').insert(c).catch(() => {}); } }
  process.stdout.write(`${Math.min(i + 100, uniqueNewClients.length)} `);
}
console.log('✅');

// === 6. contracts 등록 ===
console.log(`\n=== contracts ${contractRecords.length}건 등록 ===`);
let cOk = 0, cFail = 0;
for (let i = 0; i < contractRecords.length; i += 100) {
  const batch = contractRecords.slice(i, i + 100);
  const { error } = await sb.from('contracts').insert(batch);
  if (error) {
    for (const r of batch) {
      const { error: e2 } = await sb.from('contracts').insert(r);
      if (e2) cFail++; else cOk++;
    }
  } else cOk += batch.length;
  process.stdout.write(`${cOk + cFail}/${contractRecords.length} `);
}
console.log(`\n✅ ${cOk}건 등록, ❌ ${cFail}건 실패`);

// === 7. tax_invoices 등록 ===
console.log(`\n=== tax_invoices ${tiRecords.length}건 등록 ===`);
let tOk = 0, tFail = 0;
for (let i = 0; i < tiRecords.length; i += 100) {
  const batch = tiRecords.slice(i, i + 100);
  const { error } = await sb.from('tax_invoices').insert(batch);
  if (error) {
    for (const r of batch) {
      const { error: e2 } = await sb.from('tax_invoices').insert(r);
      if (e2) tFail++; else tOk++;
    }
  } else tOk += batch.length;
  process.stdout.write(`${tOk + tFail}/${tiRecords.length} `);
}
console.log(`\n✅ ${tOk}건 등록, ❌ ${tFail}건 실패`);

// === 8. 최종 통계 ===
console.log('\n=== 최종 통계 ===');
for (const t of ['contracts', 'tax_invoices', 'client_companies']) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
  console.log(`  ${t}: ${count}`);
}
