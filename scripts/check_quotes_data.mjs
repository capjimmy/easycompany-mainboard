import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const { data: q } = await sb.from('quotes').select('*').limit(3);
console.log('=== quotes 샘플 3건 ===');
q.forEach((r, i) => {
  console.log(`\n[${i}]`);
  console.log(`  quote_number: ${r.quote_number}`);
  console.log(`  service_name: ${r.service_name}`);
  console.log(`  title: ${r.title}`);
  console.log(`  recipient_company: ${r.recipient_company}`);
  console.log(`  recipient_contact: ${r.recipient_contact}`);
  console.log(`  recipient_phone: ${r.recipient_phone}`);
  console.log(`  recipient_email: ${r.recipient_email}`);
  console.log(`  recipient_department: ${r.recipient_department}`);
  console.log(`  total_amount: ${r.total_amount}, vat: ${r.vat_amount}, grand: ${r.grand_total}`);
});

const { data: c } = await sb.from('contracts').select('*').limit(3);
console.log('\n=== contracts 샘플 3건 ===');
c.forEach((r, i) => {
  console.log(`\n[${i}]`);
  console.log(`  contract_number: ${r.contract_number}`);
  console.log(`  service_name: ${r.service_name}`);
  console.log(`  description: ${r.description}`);
  console.log(`  client_company: ${r.client_company}`);
  console.log(`  client_contact_name: ${r.client_contact_name}`);
  console.log(`  total_amount: ${r.total_amount}, contract_amount: ${r.contract_amount}`);
});

// 누락 통계
const { data: allQ } = await sb.from('quotes').select('service_name, title, recipient_company');
const { data: allC } = await sb.from('contracts').select('service_name, client_company');
console.log('\n=== 누락 통계 ===');
console.log(`quotes service_name 누락: ${allQ.filter(x => !x.service_name).length} / ${allQ.length}`);
console.log(`quotes title 누락: ${allQ.filter(x => !x.title).length} / ${allQ.length}`);
console.log(`quotes recipient_company 빈문자열: ${allQ.filter(x => !x.recipient_company || x.recipient_company === '').length}`);
console.log(`contracts service_name 누락: ${allC.filter(x => !x.service_name).length} / ${allC.length}`);
console.log(`contracts client_company 빈문자열: ${allC.filter(x => !x.client_company || x.client_company === '').length}`);
