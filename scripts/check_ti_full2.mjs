import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { count } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true });
console.log('tax_invoices 총:', count);

// id 기반 페이징 (range가 컬럼 순서에 영향받음)
const all = [];
let f = 0;
while (true) {
  const { data } = await sb.from('tax_invoices').select('id, contract_id, total_amount, status, supply_amount').order('id').range(f, f+999);
  if (!data || data.length === 0) break;
  all.push(...data);
  if (data.length < 1000) break;
  f += 1000;
}
console.log('가져온 건수:', all.length);
const paidWithContract = all.filter(t => t.status === 'paid' && t.contract_id).length;
const paidNoContract = all.filter(t => t.status === 'paid' && !t.contract_id).length;
const issuedNoContract = all.filter(t => t.status !== 'paid' && !t.contract_id).length;
console.log(`paid + contract 연결: ${paidWithContract}`);
console.log(`paid + contract 미연결: ${paidNoContract}`);
console.log(`paid가 아닌 것 + 미연결: ${issuedNoContract}`);

// contracts 중 받은 금액 있는 것
const { data: c } = await sb.from('contracts').select('id', { count: 'exact', head: true }).gt('received_amount', 0);
console.log(`\nreceived_amount > 0 contracts:`, c);
