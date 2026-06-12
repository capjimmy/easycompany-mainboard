import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

const DEPT_MAP = { 'RES': '학술사업부' };

function normalizeBizNumber(s) {
  if (!s) return null;
  const clean = String(s).replace(/\D/g, '');
  if (clean.length !== 10) return String(s).trim();
  return `${clean.slice(0,3)}-${clean.slice(3,5)}-${clean.slice(5)}`;
}

const quotes = JSON.parse(fs.readFileSync('quotes.json', 'utf-8'));
console.log(`견적: ${quotes.length}건`);

// 기존 quotes 비우기
const { count: before } = await sb.from('quotes').select('*', { count: 'exact', head: true });
if (before > 0) {
  await sb.from('quote_labor_items').delete().not('id', 'is', null);
  await sb.from('quote_expense_items').delete().not('id', 'is', null);
  await sb.from('quote_amount_histories').delete().not('id', 'is', null);
  await sb.from('quotes').delete().not('id', 'is', null);
  console.log(`기존 quotes ${before}건 삭제`);
}

const { data: companies } = await sb.from('companies').select('*');
const companyMap = new Map(companies.map(c => [c.name, c]));
const { data: existingDepts } = await sb.from('departments').select('id, company_id, name');
const deptIndex = new Map(existingDepts.map(d => [`${d.company_id}::${d.name}`, d]));

function getDeptId(companyId, deptNameRaw) {
  if (!deptNameRaw || !companyId) return null;
  const deptName = DEPT_MAP[deptNameRaw] || deptNameRaw;
  return deptIndex.get(`${companyId}::${deptName}`)?.id || null;
}

// 변환
const records = [];
const seen = new Set();
for (const q of quotes) {
  const co = companyMap.get(q.company);
  if (!co) continue;
  let qn = q.quote_number || `Q-${crypto.randomUUID().slice(0,8)}`;
  while (seen.has(qn)) qn = `${q.quote_number || 'Q'}-${crypto.randomUUID().slice(0,4)}`;
  seen.add(qn);
  records.push({
    id: crypto.randomUUID(),
    company_id: co.id,
    quote_number: qn,
    quote_date: q.quote_date || null,
    valid_until: q.valid_until || null,
    service_name: q.project_name || null,
    title: q.project_name || null,
    recipient_company: q.client_name || '',
    recipient_contact: q.client_contact_person || null,
    recipient_phone: q.client_phone || null,
    recipient_email: q.client_email || null,
    recipient_department: DEPT_MAP[q.department_name] || q.department_name || null,
    recipient_address: q.client_address || null,
    total_amount: q.supply_amount || 0,
    vat_amount: q.vat || 0,
    grand_total: q.total_amount || 0,
    status: q.status || 'draft',
    notes: [q.writer_name ? `작성자: ${q.writer_name}` : '', q.notes || '', q.client_business_number ? `사업자: ${normalizeBizNumber(q.client_business_number)}` : ''].filter(Boolean).join(' | '),
    source_file_path: q.source_file || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}
console.log(`변환: ${records.length}건`);

let ok = 0, fail = 0;
const errs = [];
const CHUNK = 100;
for (let i = 0; i < records.length; i += CHUNK) {
  const batch = records.slice(i, i + CHUNK);
  const { error } = await sb.from('quotes').insert(batch);
  if (error) {
    for (const r of batch) {
      const { error: e2 } = await sb.from('quotes').insert(r);
      if (e2) { fail++; if (errs.length < 3) errs.push(e2.message); } else ok++;
    }
  } else ok += batch.length;
  process.stdout.write(`${ok+fail}/${records.length} `);
}
console.log(`\n✅ ${ok} 등록, ❌ ${fail} 실패`);
if (errs.length) console.log('에러:', errs);
