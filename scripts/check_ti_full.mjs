import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t, c) {
  const all=[]; let f=0;
  while(true) { const {data}=await sb.from(t).select(c).range(f,f+999); if(!data||!data.length)break; all.push(...data); if(data.length<1000)break; f+=1000; }
  return all;
}
const all = await fetchAll('tax_invoices', 'buyer_name, item_description, buyer_business_number');
console.log(`총 ${all.length}건`);
console.log(`buyer_name 있음: ${all.filter(x=>x.buyer_name).length}`);
console.log(`item_description 있음: ${all.filter(x=>x.item_description).length}`);
console.log(`business_number 있음: ${all.filter(x=>x.buyer_business_number).length}`);
console.log(`buyer_name 빈 거: ${all.filter(x=>!x.buyer_name).length}`);
