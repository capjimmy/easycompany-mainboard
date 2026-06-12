import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const contracts = await fetchAll('contracts', 'id, contract_number, client_company, service_name, contract_amount, total_amount, received_amount');
const overPaid = contracts.filter(c => c.received_amount > c.total_amount * 1.1 && c.total_amount > 0);
console.log(`과다수금 (1.1배 초과): ${overPaid.length}건`);

// 빈 total_amount 보강
const noTotal = contracts.filter(c => (!c.total_amount || c.total_amount === 0) && c.received_amount > 0);
console.log(`수금은 있는데 계약금액 0: ${noTotal.length}건`);

let fixed = 0;
for (const c of noTotal) {
  // contract_amount 있으면 그걸로 total = contract_amount * 1.1
  if (c.contract_amount > 0) {
    const total = Math.round(c.contract_amount * 1.1);
    await sb.from('contracts').update({
      total_amount: total,
      remaining_amount: Math.max(0, total - (c.received_amount || 0)),
    }).eq('id', c.id);
    fixed++;
  }
}
console.log(`보강: ${fixed}건`);

// 전체 통계
const { data: all } = await sb.from('contracts').select('total_amount, received_amount');
const withRecv = all.filter(c => c.received_amount > 0).length;
const totalRecv = all.reduce((s,c) => s+(c.received_amount||0), 0);
console.log(`\n수금 있는 계약: ${withRecv} / ${all.length}`);
console.log(`총 수금액: ${totalRecv.toLocaleString()}원`);
