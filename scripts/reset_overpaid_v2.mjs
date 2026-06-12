// Task 4: 수금 > 계약 110% 초과 리셋
import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const contracts = await fetchAll('contracts', 'id, total_amount, received_amount, contract_amount');
const overPaid = contracts.filter(c => c.total_amount > 0 && c.received_amount > c.total_amount * 1.1);
console.log(`과다수금 ${overPaid.length}건 리셋...`);

let resetCount = 0;
for (const c of overPaid) {
  // 해당 계약의 세금계산서 unlink
  await sb.from('tax_invoices').update({ contract_id: null }).eq('contract_id', c.id);
  await sb.from('payment_receipts').update({ contract_id: null }).eq('contract_id', c.id);
  // received_amount 0
  await sb.from('contracts').update({
    received_amount: 0,
    remaining_amount: c.total_amount || 0,
    progress_billing_rate: 0,
  }).eq('id', c.id);
  resetCount++;
}
console.log(`✅ ${resetCount}건 리셋`);

// 검증
const after = await fetchAll('contracts', 'id, total_amount, received_amount');
const stillOver = after.filter(c => c.total_amount > 0 && c.received_amount > c.total_amount * 1.1);
console.log(`남은 과다수금: ${stillOver.length}건`);
