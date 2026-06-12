import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

// 1. 세금계산서 상태
const ti = await fetchAll('tax_invoices', 'id, buyer_name, item_description, issue_date, total_amount, contract_id');
console.log('=== 세금계산서 ===');
console.log(`총: ${ti.length}`);
console.log(`buyer_name 있음: ${ti.filter(t=>t.buyer_name && t.buyer_name.trim()).length}`);
console.log(`buyer_name 비어있음: ${ti.filter(t=>!t.buyer_name || !t.buyer_name.trim()).length}`);
console.log(`item_description 있음: ${ti.filter(t=>t.item_description && t.item_description.trim()).length}`);
console.log(`item_description 비어있음: ${ti.filter(t=>!t.item_description || !t.item_description.trim()).length}`);
console.log(`contract_id 연결: ${ti.filter(t=>t.contract_id).length}`);
console.log('\n빈 거래처 샘플:');
ti.filter(t=>!t.buyer_name || !t.buyer_name.trim()).slice(0,3).forEach(t => {
  console.log(`  id=${t.id.slice(0,8)}, desc=${t.item_description?.slice(0,50)}, date=${t.issue_date}, amt=${t.total_amount}`);
});

// 2. 계약 날짜 분포
const contracts = await fetchAll('contracts', 'id, contract_date, service_name, client_company');
console.log('\n=== 계약 날짜 분포 ===');
const byMonth = {};
contracts.forEach(c => {
  const m = c.contract_date ? c.contract_date.slice(0,7) : 'NULL';
  byMonth[m] = (byMonth[m] || 0) + 1;
});
Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10).forEach(([m,c]) => console.log(`  ${m}: ${c}건`));
console.log(`\n2026-04: ${byMonth['2026-04'] || 0}건`);
console.log(`NULL 날짜: ${byMonth['NULL'] || 0}건`);

// 2026-04 샘플
const apr = contracts.filter(c => c.contract_date?.startsWith('2026-04'));
console.log('\n2026-04 샘플 5건:');
apr.slice(0,5).forEach(c => console.log(`  ${c.contract_date} | ${c.client_company} | ${c.service_name?.slice(0,40)}`));

// 3. payment_receipts
const pr = await fetchAll('payment_receipts', 'id, amount, payment_date');
console.log(`\n=== payment_receipts: ${pr.length}건 ===`);

// 4. 계약 service_name/client_company 빈 값
console.log(`\n=== 계약 빈 필드 ===`);
console.log(`service_name 비어있음: ${contracts.filter(c=>!c.service_name || !c.service_name.trim()).length}`);
console.log(`client_company 비어있음: ${contracts.filter(c=>!c.client_company || !c.client_company.trim()).length}`);
