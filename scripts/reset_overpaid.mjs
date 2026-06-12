import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const contracts = await fetchAll('contracts', 'id, total_amount, received_amount');
const overPaid = contracts.filter(c => c.received_amount > c.total_amount * 1.1 && c.total_amount > 0);
console.log(`과다수금 ${overPaid.length}건 리셋...`);

for (const c of overPaid) {
  // 해당 계약에 매칭된 세금계산서들 unlink
  await sb.from('tax_invoices').update({ contract_id: null }).eq('contract_id', c.id);
  await sb.from('payment_receipts').update({ contract_id: null }).eq('contract_id', c.id);
  // received_amount 0으로
  await sb.from('contracts').update({
    received_amount: 0,
    remaining_amount: c.total_amount || 0,
    progress_billing_rate: 0,
  }).eq('id', c.id);
}

// 0인 total_amount + received가 있는 것도 정리
const zeroTotal = contracts.filter(c => (!c.total_amount || c.total_amount === 0) && c.received_amount > 0);
console.log(`계약금액 0 + 수금 > 0: ${zeroTotal.length}건 리셋`);
for (const c of zeroTotal) {
  await sb.from('tax_invoices').update({ contract_id: null }).eq('contract_id', c.id);
  await sb.from('payment_receipts').update({ contract_id: null }).eq('contract_id', c.id);
  await sb.from('contracts').update({ received_amount: 0, remaining_amount: 0 }).eq('id', c.id);
}

// 검증
const after = await fetchAll('contracts', 'total_amount, received_amount');
const stillOver = after.filter(c => c.received_amount > c.total_amount * 1.1 && c.total_amount > 0);
const withRecv = after.filter(c => c.received_amount > 0).length;
const totalRecv = after.reduce((s,c) => s+(c.received_amount||0), 0);
console.log(`\n과다수금: ${stillOver.length}건`);
console.log(`수금 있는 계약: ${withRecv} / ${after.length}`);
console.log(`총 수금액: ${totalRecv.toLocaleString()}원`);
