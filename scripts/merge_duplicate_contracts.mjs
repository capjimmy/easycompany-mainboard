import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const contracts = await fetchAll('contracts', '*');

// 같은 회사+거래처+용역명 그룹화
const groups = new Map();
for (const c of contracts) {
  if (!c.client_company || !c.service_name) continue;
  const key = `${c.company_id}::${c.client_company}::${c.service_name}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
}

const dups = [...groups.entries()].filter(([,v]) => v.length > 1);
console.log(`중복 그룹 ${dups.length}개 병합...`);

let merged = 0;
for (const [, group] of dups) {
  // 가장 정보 많은 것을 keeper로 (날짜+금액 있는 것 우선)
  group.sort((a, b) => {
    const aScore = (a.contract_date ? 10 : 0) + (a.contract_amount > 0 ? 5 : 0) + (a.received_amount > 0 ? 3 : 0);
    const bScore = (b.contract_date ? 10 : 0) + (b.contract_amount > 0 ? 5 : 0) + (b.received_amount > 0 ? 3 : 0);
    return bScore - aScore;
  });
  const keeper = group[0];
  const dupes = group.slice(1);

  // 합계: contract_amount, total_amount, received_amount 합산
  const sumContract = group.reduce((s, c) => s + (c.contract_amount || 0), 0);
  const sumTotal = group.reduce((s, c) => s + (c.total_amount || 0), 0);
  const sumReceived = group.reduce((s, c) => s + (c.received_amount || 0), 0);

  // tax_invoices의 contract_id를 keeper로 이전
  for (const d of dupes) {
    await sb.from('tax_invoices').update({ contract_id: keeper.id }).eq('contract_id', d.id);
    await sb.from('payment_receipts').update({ contract_id: keeper.id }).eq('contract_id', d.id);
    await sb.from('contracts').delete().eq('id', d.id);
    merged++;
  }

  // keeper 업데이트
  await sb.from('contracts').update({
    contract_amount: sumContract,
    total_amount: sumTotal,
    received_amount: sumReceived,
    remaining_amount: Math.max(0, sumTotal - sumReceived),
    updated_at: new Date().toISOString(),
  }).eq('id', keeper.id);
}
console.log(`✅ ${merged}개 중복 계약 병합`);

// 수금률 재계산 + 100% 초과 건 진단
const after = await fetchAll('contracts', 'id, total_amount, received_amount');
const overPaid = after.filter(c => c.received_amount > c.total_amount * 1.1 && c.total_amount > 0);
console.log(`\n남은 과다수금 (110% 초과): ${overPaid.length}건`);

// total_amount가 0인 계약 (received가 있는데)
const zeroTotal = after.filter(c => (!c.total_amount || c.total_amount === 0) && c.received_amount > 0);
console.log(`수금은 있는데 계약금액 0: ${zeroTotal.length}건`);

console.log(`\n총 계약: ${after.length}건`);
