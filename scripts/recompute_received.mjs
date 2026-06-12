// Task 6: payment_receipts 합계로 contracts.received_amount 재계산
// payment_receipts에 contract_id가 없으면 tax_invoices(paid)를 사용
import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const prs = await fetchAll('payment_receipts', 'id, contract_id, amount, status');
const prLinked = prs.filter(p => p.contract_id).length;
console.log(`payment_receipts: ${prs.length} (contract_id 있음: ${prLinked})`);

const sumByContract = new Map();

// 우선 payment_receipts (contract_id 있는 것)
for (const p of prs) {
  if (!p.contract_id) continue;
  if (p.status && ['cancelled', 'canceled', 'void'].includes(p.status)) continue;
  sumByContract.set(p.contract_id, (sumByContract.get(p.contract_id) || 0) + (Number(p.amount) || 0));
}
console.log(`payment_receipts 기준 contracts: ${sumByContract.size}`);

// payment_receipts 정보 부족하면 tax_invoices(paid)로 보완
const tis = await fetchAll('tax_invoices', 'id, contract_id, total_amount, status');
let tiContribution = 0;
for (const t of tis) {
  if (!t.contract_id) continue;
  if (t.status !== 'paid') continue;
  // payment_receipts에 이미 있으면 스킵
  if (sumByContract.has(t.contract_id)) continue;
  const cur = sumByContract.get(t.contract_id) || 0;
  sumByContract.set(t.contract_id, cur + (Number(t.total_amount) || 0));
  tiContribution++;
}
// 위 로직은 contract 단위로 한 번만 추가하기 위함 -- 다시
sumByContract.clear();
for (const p of prs) {
  if (!p.contract_id) continue;
  if (p.status && ['cancelled', 'canceled', 'void'].includes(p.status)) continue;
  sumByContract.set(p.contract_id, (sumByContract.get(p.contract_id) || 0) + (Number(p.amount) || 0));
}
const prContracts = new Set(sumByContract.keys());
for (const t of tis) {
  if (!t.contract_id) continue;
  if (t.status !== 'paid') continue;
  if (prContracts.has(t.contract_id)) continue;  // pr이 있으면 그것 우선
  sumByContract.set(t.contract_id, (sumByContract.get(t.contract_id) || 0) + (Number(t.total_amount) || 0));
}
console.log(`최종 수금 정보 있는 계약: ${sumByContract.size} (PR기반 ${prContracts.size} + TI기반 ${sumByContract.size - prContracts.size})`);

const contracts = await fetchAll('contracts', 'id, total_amount, received_amount, remaining_amount, progress_billing_rate');
const cmap = new Map(contracts.map(c => [c.id, c]));

let updated = 0;
let skipped = 0;
let outOfRange = 0;
for (const c of contracts) {
  const recv = sumByContract.get(c.id) || 0;
  const total = Number(c.total_amount) || 0;

  if (total <= 0 && recv > 0) { outOfRange++; continue; }
  if (recv < 0) { outOfRange++; continue; }
  if (total > 0 && recv > total * 1.1) { outOfRange++; continue; }

  const effRecv = total > 0 ? Math.min(recv, total) : 0;
  const remaining = Math.max(0, total - effRecv);
  const rate = total > 0 ? (effRecv / total) * 100 : 0;

  if (Math.abs((c.received_amount || 0) - effRecv) < 1
   && Math.abs((c.remaining_amount || 0) - remaining) < 1) {
    skipped++; continue;
  }

  const { error } = await sb.from('contracts').update({
    received_amount: effRecv,
    remaining_amount: remaining,
    progress_billing_rate: rate,
    updated_at: new Date().toISOString(),
  }).eq('id', c.id);
  if (!error) updated++;
}
console.log(`✅ ${updated}건 업데이트, 스킵 ${skipped}, 범위벗어남 ${outOfRange}`);

// 검증
const after = await fetchAll('contracts', 'id, total_amount, received_amount');
const totalRecv = after.reduce((s,c) => s+(Number(c.received_amount)||0), 0);
const totalAmt = after.reduce((s,c) => s+(Number(c.total_amount)||0), 0);
const withRecv = after.filter(c => Number(c.received_amount) > 0).length;
const overP = after.filter(c => c.total_amount > 0 && c.received_amount > c.total_amount * 1.1).length;
console.log(`총 계약액: ${totalAmt.toLocaleString()}원`);
console.log(`총 수금액: ${totalRecv.toLocaleString()}원`);
console.log(`수금률: ${(totalRecv/totalAmt*100).toFixed(1)}%`);
console.log(`수금있는 계약: ${withRecv}/${after.length}`);
console.log(`과다수금: ${overP}건`);
