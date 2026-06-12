import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
// payment_receipts 스키마
const { data: pr } = await sb.from('payment_receipts').select('*').limit(2);
console.log('payment_receipts 컬럼:', Object.keys(pr?.[0] || {}));
console.log('샘플:', pr);

const { count: prCount } = await sb.from('payment_receipts').select('*', { count: 'exact', head: true });
console.log('\npayment_receipts 총:', prCount);

// contracts received_amount
const { data: c } = await sb.from('contracts').select('id, contract_number, total_amount, received_amount, remaining_amount').limit(3);
console.log('\ncontracts 샘플:', c);

// tax_invoices가 paid 상태인 것들의 contract_id 매칭 비율
async function fetchAll(t,col){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(col).range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}
const ti = await fetchAll('tax_invoices', 'id, contract_id, total_amount, status, payment_date');
const paidWithContract = ti.filter(t => t.status === 'paid' && t.contract_id).length;
const paidNoContract = ti.filter(t => t.status === 'paid' && !t.contract_id).length;
console.log(`\n전체 세금계산서: ${ti.length}`);
console.log(`paid + contract 연결: ${paidWithContract}`);
console.log(`paid + contract 미연결: ${paidNoContract}`);
