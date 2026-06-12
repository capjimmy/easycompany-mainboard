import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const pr = await fetchAll('payment_receipts', 'id, contract_id, amount, payment_date, notes, depositor_name');
console.log('총 payment_receipts:', pr.length);

// 금액별 분포
const byAmount = {};
pr.forEach(r => { const k = r.amount; byAmount[k] = (byAmount[k] || 0) + 1; });
const top = Object.entries(byAmount).sort((a,b) => b[1] - a[1]).slice(0, 10);
console.log('\n금액별 TOP 10 (중복 의심):');
top.forEach(([amt, cnt]) => console.log(`  ${Number(amt).toLocaleString()}원: ${cnt}건`));

// 2200만원 건 상세
const suspicious = pr.filter(r => r.amount === 22000000 || r.amount === 2200000);
console.log(`\n2200만원/220만원 건수: ${suspicious.length}`);
suspicious.slice(0, 5).forEach(r => {
  console.log(`  contract_id=${r.contract_id?.slice(0,8)}, date=${r.payment_date}, desc=${r.depositor_name?.slice(0,40)}`);
});

// contract_id별 중복 체크
const byContract = {};
pr.forEach(r => {
  const k = `${r.contract_id}::${r.amount}::${r.payment_date}`;
  byContract[k] = (byContract[k] || 0) + 1;
});
const dups = Object.entries(byContract).filter(([,c]) => c > 1);
console.log(`\n동일 계약+금액+날짜 중복: ${dups.length}건`);
dups.slice(0, 5).forEach(([k, c]) => console.log(`  ${c}건: ${k}`));

// 계약별 received_amount 확인
const contracts = await fetchAll('contracts', 'id, contract_number, client_company, total_amount, received_amount');
const overPaid = contracts.filter(c => c.received_amount > c.total_amount * 1.5 && c.total_amount > 0);
console.log(`\n수금이 계약금액의 1.5배 초과: ${overPaid.length}건`);
overPaid.slice(0, 5).forEach(c => {
  console.log(`  ${c.client_company}: 계약=${c.total_amount?.toLocaleString()}, 수금=${c.received_amount?.toLocaleString()}`);
});
