import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const ti = await fetchAll('tax_invoices', 'buyer_name, item_description, contract_id');
const pr = await fetchAll('payment_receipts', 'id, contract_id, amount');
const contracts = await fetchAll('contracts', 'id, contract_date, received_amount, total_amount');

console.log('=== 최종 데이터 상태 ===');
console.log(`세금계산서: ${ti.length}건`);
console.log(`  거래처 있음: ${ti.filter(t=>t.buyer_name?.trim()).length}`);
console.log(`  적요 있음: ${ti.filter(t=>t.item_description?.trim()).length}`);
console.log(`  계약 연결: ${ti.filter(t=>t.contract_id).length}`);
console.log(`입금기록: ${pr.length}건`);
console.log(`계약: ${contracts.length}건`);
console.log(`  수금 있음: ${contracts.filter(c=>c.received_amount > 0).length}`);
console.log(`  날짜 있음: ${contracts.filter(c=>c.contract_date && /^\d{4}-\d{2}-\d{2}$/.test(c.contract_date)).length}`);

// 월별 분포 (최근 6개월)
const byMonth = {};
contracts.forEach(c => { const m = c.contract_date?.slice(0,7) || 'NULL'; byMonth[m] = (byMonth[m]||0)+1; });
console.log('\n최근 계약 월별:');
Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,8).forEach(([m,c]) => console.log(`  ${m}: ${c}건`));
