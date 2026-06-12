// contracts.received_amount 재계산 스크립트
// 단일 소스: contract_payments 테이블의 amount 합계
// (이전 버전은 tax_invoices paid 합계를 사용했으나, 이중 집계 방지를 위해 변경)
import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

async function fetchAll(t, c) {
  const all=[]; let f=0;
  while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}
  return all;
}

const payments = await fetchAll('contract_payments', 'id, contract_id, amount');
const contracts = await fetchAll('contracts', 'id, total_amount, received_amount');
console.log(`contract_payments: ${payments.length}, contracts: ${contracts.length}`);

// contract_id별로 실제 입금 합계
const receivedByContract = new Map();
for (const p of payments) {
  if (!p.contract_id) continue;
  const cur = receivedByContract.get(p.contract_id) || 0;
  receivedByContract.set(p.contract_id, cur + (p.amount || 0));
}

console.log(`\n입금 기록이 있는 계약: ${receivedByContract.size}개`);

let updated = 0;
let corrected = 0;

// 입금 기록이 있는 계약 업데이트
for (const [contractId, received] of receivedByContract) {
  const c = contracts.find(x => x.id === contractId);
  if (!c) continue;

  // 이미 정확하면 스킵
  if (Math.abs((c.received_amount || 0) - received) < 1) continue;

  const remaining = (c.total_amount || 0) - received;
  const { error } = await sb.from('contracts').update({
    received_amount: received,
    remaining_amount: Math.max(0, remaining),
    updated_at: new Date().toISOString(),
  }).eq('id', contractId);
  if (!error) {
    corrected++;
    if (corrected % 50 === 0) process.stdout.write(`${corrected} `);
  }
  updated++;
}

// 입금 기록이 없는데 received_amount > 0인 계약 리셋
const contractsWithNoPayments = contracts.filter(
  c => !receivedByContract.has(c.id) && (c.received_amount || 0) > 0
);
console.log(`\n입금 기록 없이 received_amount > 0인 계약: ${contractsWithNoPayments.length}개`);

let reset = 0;
for (const c of contractsWithNoPayments) {
  const { error } = await sb.from('contracts').update({
    received_amount: 0,
    remaining_amount: c.total_amount || 0,
    updated_at: new Date().toISOString(),
  }).eq('id', c.id);
  if (!error) reset++;
}

console.log(`\n=== 결과 ===`);
console.log(`수정: ${corrected}건, 리셋: ${reset}건`);

// 검증
const after = await fetchAll('contracts', 'received_amount, total_amount');
const withReceived = after.filter(c => c.received_amount > 0).length;
const totalReceived = after.reduce((s, c) => s + (c.received_amount || 0), 0);
console.log(`수금 있는 계약: ${withReceived} / ${after.length}`);
console.log(`총 수금액: ${totalReceived.toLocaleString()}원`);
