import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const contracts = await fetchAll('contracts', 'id, contract_number, client_company, service_name, contract_amount, total_amount, received_amount, company_id');
const overPaid = contracts.filter(c => c.received_amount > c.total_amount * 1.1 && c.total_amount > 0);
console.log(`수금률 110% 초과: ${overPaid.length}건`);
console.log('\n샘플 10건:');
overPaid.slice(0, 10).forEach(c => {
  const rate = Math.round(c.received_amount / c.total_amount * 100);
  console.log(`  ${rate}% | ${c.client_company} | ${c.service_name?.slice(0,40)} | 계약 ${c.total_amount?.toLocaleString()} / 수금 ${c.received_amount?.toLocaleString()}`);
});

// 같은 용역+거래처가 분리된 것
console.log('\n\n=== 같은 거래처+용역명 중복 계약 ===');
const groups = new Map();
for (const c of contracts) {
  if (!c.client_company || !c.service_name) continue;
  const key = `${c.company_id}::${c.client_company}::${c.service_name}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
}
const dups = [...groups.entries()].filter(([,v]) => v.length > 1);
console.log(`중복 그룹: ${dups.length}개`);
dups.slice(0, 8).forEach(([k, v]) => {
  console.log(`\n  [${v.length}건] ${v[0].client_company} | ${v[0].service_name?.slice(0,40)}`);
  v.forEach(c => {
    const rate = c.total_amount > 0 ? Math.round(c.received_amount/c.total_amount*100) : 0;
    console.log(`    ${c.contract_number} | 계약 ${c.total_amount?.toLocaleString()} / 수금 ${c.received_amount?.toLocaleString()} (${rate}%)`);
  });
});
