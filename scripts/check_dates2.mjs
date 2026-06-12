import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t, c) { const all=[]; let f=0; while(true){const{data}=await sb.from(t).select(c).range(f,f+999); if(!data||!data.length)break; all.push(...data); if(data.length<1000)break; f+=1000;} return all; }

const c = await fetchAll('contracts', 'id, contract_number, contract_date, contract_start_date, contract_end_date');
console.log(`총 ${c.length}건`);
console.log(`contract_date: ${c.filter(x=>x.contract_date).length}`);
console.log(`contract_start_date: ${c.filter(x=>x.contract_start_date).length}`);
console.log(`contract_end_date: ${c.filter(x=>x.contract_end_date).length}`);

console.log('\n샘플 5건:');
c.slice(0, 5).forEach(x => console.log(`  ${x.contract_number}: date=${x.contract_date}, start=${x.contract_start_date}, end=${x.contract_end_date}`));
