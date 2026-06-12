import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
async function fetchAll(t,c){const all=[];let f=0;while(true){const{data}=await sb.from(t).select(c).order('id').range(f,f+999);if(!data||!data.length)break;all.push(...data);if(data.length<1000)break;f+=1000;}return all;}

const today = '2026-04-09';

// contracts
const contracts = await fetchAll('contracts', 'id, contract_date, source_file_path');
const future = contracts.filter(c => c.contract_date && c.contract_date > today);
console.log(`contracts 미래 날짜 ${future.length}건 → null 처리`);

// 연도별 분포
const byYear = {};
future.forEach(c => { const y = c.contract_date.slice(0,7); byYear[y] = (byYear[y]||0)+1; });
console.log('월별:', byYear);

for (const c of future) {
  await sb.from('contracts').update({ contract_date: null, updated_at: new Date().toISOString() }).eq('id', c.id);
}
console.log('✅ contracts 완료');

// quotes
const quotes = await fetchAll('quotes', 'id, quote_date');
const fq = quotes.filter(q => q.quote_date && q.quote_date > today);
console.log(`\nquotes 미래 날짜 ${fq.length}건 → null`);
for (const q of fq) {
  await sb.from('quotes').update({ quote_date: null, updated_at: new Date().toISOString() }).eq('id', q.id);
}
console.log('✅ quotes 완료');

// tax_invoices
const tis = await fetchAll('tax_invoices', 'id, issue_date');
const ft = tis.filter(t => t.issue_date && t.issue_date > today);
console.log(`\ntax_invoices 미래 날짜 ${ft.length}건`);
ft.slice(0,5).forEach(t => console.log(' -', t.issue_date));
// 세금계산서는 발행일이 NOT NULL이라 null 못 함 → 2026-04-08로 변경
for (const t of ft) {
  await sb.from('tax_invoices').update({ issue_date: today, updated_at: new Date().toISOString() }).eq('id', t.id);
}
console.log('✅ tax_invoices 완료');
