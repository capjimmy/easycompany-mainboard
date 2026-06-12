/**
 * outsourcings 스키마 정렬 SQL 실행 후 데이터 후처리
 *
 * - 노이즈 행 정리 (vendor_name='외주' & notes='회계 외주 컬럼' KERI)
 * - vendor master(client_companies)에서 사업자번호/담당자/이메일 보강
 * - 검증 출력
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);

async function fetchAllPaged(table, columns = '*', filters = (q) => q) {
  const all = [];
  let from = 0;
  while (true) {
    let q = sb.from(table).select(columns).order('id').range(from, from + 999);
    q = filters(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

console.log('=== 1. 스키마 검증 ===');
const { data: probe, error: probeErr } = await sb
  .from('outsourcings')
  .select('id, vendor_name, outsourcing_amount, vat_amount, total_amount, vendor_business_number, contract_number')
  .limit(1);
if (probeErr) {
  console.error('❌ 신규 컬럼 부재 — SQL 마이그레이션이 아직 실행되지 않았습니다.');
  console.error('   sql/align_outsourcings_schema.sql 을 Supabase Dashboard에서 먼저 실행해주세요.');
  console.error('   에러:', probeErr.message);
  process.exit(1);
}
console.log('✅ 신규 컬럼 존재 확인');

console.log('\n=== 2. 노이즈 행 삭제 (KERI vendor_name="외주") ===');
const { data: noise } = await sb
  .from('outsourcings')
  .select('id')
  .eq('vendor_name', '외주')
  .eq('notes', '회계 외주 컬럼');
if (noise?.length) {
  const ids = noise.map((r) => r.id);
  const { error } = await sb.from('outsourcings').delete().in('id', ids);
  console.log(error ? `❌ ${error.message}` : `✅ ${ids.length}건 삭제`);
} else {
  console.log('  (해당 행 없음)');
}

console.log('\n=== 3. vendor master 매핑 ===');
const vendors = await fetchAllPaged(
  'client_companies',
  'id, company_id, name, business_number',
  (q) => q.eq('client_type', 'vendor'),
);
console.log(`  vendor master: ${vendors.length}건`);
const vendorByCoName = new Map();
for (const v of vendors) {
  if (v.name) vendorByCoName.set(`${v.company_id}::${v.name.trim()}`, v);
}

const allOss = await fetchAllPaged('outsourcings', 'id, company_id, vendor_name, vendor_business_number, vendor_contact_email');
console.log(`  outsourcings: ${allOss.length}건`);

const contacts = await fetchAllPaged('client_contacts', 'client_company_id, name, phone, email, is_primary');
const primaryContactByVendor = new Map();
for (const c of contacts) {
  if (!primaryContactByVendor.has(c.client_company_id) || c.is_primary) {
    primaryContactByVendor.set(c.client_company_id, c);
  }
}

let enriched = 0;
for (const o of allOss) {
  if (!o.vendor_name) continue;
  const v = vendorByCoName.get(`${o.company_id}::${o.vendor_name.trim()}`);
  if (!v) continue;

  const patch = {};
  if (!o.vendor_business_number && v.business_number) patch.vendor_business_number = v.business_number;
  const c = primaryContactByVendor.get(v.id);
  if (c) {
    if (!o.vendor_contact_email && c.email) patch.vendor_contact_email = c.email;
  }
  if (Object.keys(patch).length === 0) continue;

  const { error } = await sb.from('outsourcings').update(patch).eq('id', o.id);
  if (!error) enriched++;
}
console.log(`  ✅ ${enriched}건 vendor 정보 보강`);

console.log('\n=== 4. 최종 상태 ===');
const final = await fetchAllPaged('outsourcings', 'id, company_id, contract_id, vendor_name, outsourcing_amount, total_amount, vendor_business_number');
const stats = {
  total: final.length,
  withVendor: final.filter((r) => r.vendor_name).length,
  withAmount: final.filter((r) => Number(r.outsourcing_amount) > 0).length,
  withTotal: final.filter((r) => Number(r.total_amount) > 0).length,
  withContract: final.filter((r) => r.contract_id).length,
  withBiz: final.filter((r) => r.vendor_business_number).length,
};
console.table(stats);

const byCo = new Map();
for (const r of final) byCo.set(r.company_id, (byCo.get(r.company_id) || 0) + 1);
console.log('\n회사별:');
for (const [k, v] of byCo) console.log(`  ${k.slice(-4)}: ${v}`);
