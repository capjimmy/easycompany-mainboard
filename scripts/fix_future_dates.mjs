import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t, c) {
  const all=[]; let f=0;
  while(true){const{data}=await sb.from(t).select(c).range(f,f+999); if(!data||!data.length)break; all.push(...data); if(data.length<1000)break; f+=1000;}
  return all;
}
const today = '2026-04-09';
// 1년 이후 날짜는 잘못 추출된 것으로 간주 (계약서가 2027년 이후일 수는 없음)
const cutoff = '2026-12-31';
const contracts = await fetchAll('contracts', 'id, contract_date');
const future = contracts.filter(c => c.contract_date && c.contract_date > cutoff);
console.log(`${cutoff} 이후 미래 날짜 ${future.length}건 → null 처리`);
for (const c of future) {
  await sb.from('contracts').update({ contract_date: null }).eq('id', c.id);
}
console.log('✅ 완료');

// quotes도 동일
const quotes = await fetchAll('quotes', 'id, quote_date');
const fq = quotes.filter(q => q.quote_date && q.quote_date > cutoff);
console.log(`\nquotes 미래 날짜 ${fq.length}건 → null 처리`);
for (const q of fq) {
  await sb.from('quotes').update({ quote_date: null }).eq('id', q.id);
}
console.log('✅ 완료');
