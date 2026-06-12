import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

async function fetchAll(t, c) {
  const all=[]; let f=0;
  while(true) { const {data}=await sb.from(t).select(c).range(f,f+999); if(!data||!data.length)break; all.push(...data); if(data.length<1000)break; f+=1000; }
  return all;
}

const c = await fetchAll('contracts', 'contract_date, contract_start_date, contract_end_date');
const q = await fetchAll('quotes', 'quote_date, valid_until');
console.log('=== contracts ===');
console.log(`총 ${c.length}건`);
console.log(`contract_date 있음: ${c.filter(x=>x.contract_date).length}`);
console.log(`contract_start_date 있음: ${c.filter(x=>x.contract_start_date).length}`);
console.log(`contract_end_date 있음: ${c.filter(x=>x.contract_end_date).length}`);
console.log('\n=== quotes ===');
console.log(`총 ${q.length}건`);
console.log(`quote_date 있음: ${q.filter(x=>x.quote_date).length}`);
console.log(`valid_until 있음: ${q.filter(x=>x.valid_until).length}`);
