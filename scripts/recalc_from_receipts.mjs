import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const receipts = await fetchAll('payment_receipts', 'contract_id, amount');
const contracts = await fetchAll('contracts', 'id, total_amount, received_amount');
console.log(`receipts: ${receipts.length}, contracts: ${contracts.length}`);

const recvBy = new Map();
for (const r of receipts) {
  if (!r.contract_id) continue;
  recvBy.set(r.contract_id, (recvBy.get(r.contract_id) || 0) + (r.amount || 0));
}
console.log(`수금 있는 계약: ${recvBy.size}`);

let updated = 0;
for (const [cid, recv] of recvBy) {
  const c = contracts.find(x => x.id === cid);
  if (!c) continue;
  const total = c.total_amount || 0;
  await sb.from('contracts').update({
    received_amount: recv,
    remaining_amount: Math.max(0, total - recv),
    progress_billing_rate: total > 0 ? Math.min(100, (recv / total) * 100) : 0,
    updated_at: new Date().toISOString(),
  }).eq('id', cid);
  updated++;
}
console.log(`✅ ${updated}건 업데이트`);
const totalRecv = [...recvBy.values()].reduce((s,v)=>s+v,0);
console.log(`총 수금액: ${totalRecv.toLocaleString()}원`);
