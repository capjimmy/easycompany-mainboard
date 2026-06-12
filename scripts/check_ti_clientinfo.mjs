import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
// 세금계산서가 buyer 정보 가지고 있는지 확인
const { data } = await sb.from('tax_invoices').select('buyer_name, buyer_business_number, buyer_representative, item_description').limit(5);
data.forEach((t, i) => {
  console.log(`\n[${i}]`);
  console.log('  buyer_name:', t.buyer_name);
  console.log('  business_number:', t.buyer_business_number);
  console.log('  representative:', t.buyer_representative);
  console.log('  item_description:', t.item_description?.slice(0, 80));
});

// 누락 통계
const { data: all } = await sb.from('tax_invoices').select('buyer_name, item_description, buyer_business_number');
console.log('\n=== 통계 ===');
console.log(`buyer_name 있음: ${all.filter(x=>x.buyer_name).length}/${all.length}`);
console.log(`item_description 있음: ${all.filter(x=>x.item_description).length}/${all.length}`);
console.log(`business_number 있음: ${all.filter(x=>x.buyer_business_number).length}/${all.length}`);
