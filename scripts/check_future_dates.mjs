import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t, c) {
  const all=[]; let f=0;
  while(true){const{data}=await sb.from(t).select(c).range(f,f+999); if(!data||!data.length)break; all.push(...data); if(data.length<1000)break; f+=1000;}
  return all;
}
const today = '2026-04-09'; // 현재 날짜
const contracts = await fetchAll('contracts', 'id, contract_number, contract_date, client_company, service_name, source_file_path');
const future = contracts.filter(c => c.contract_date && c.contract_date > today);
console.log(`총 ${contracts.length}건 중 미래 날짜 ${future.length}건`);
console.log('\n샘플 10건:');
future.slice(0, 10).forEach(c => {
  console.log(`  ${c.contract_date} | ${c.client_company} | ${c.service_name?.slice(0,40)}`);
  console.log(`    경로: ${c.source_file_path?.slice(-80)}`);
});
// 연도별
const byYear = {};
future.forEach(c => {
  const y = c.contract_date.slice(0,4);
  byYear[y] = (byYear[y] || 0) + 1;
});
console.log('\n연도별 미래 날짜:', byYear);
