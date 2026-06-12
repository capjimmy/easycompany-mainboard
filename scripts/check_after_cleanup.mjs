import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// 페이징
async function fetchAll(table, columns) {
  const all = []; let from = 0;
  while (true) {
    const { data } = await sb.from(table).select(columns).range(from, from + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

const contracts = await fetchAll('contracts', 'client_company, service_name');
const quotes = await fetchAll('quotes', 'recipient_company, service_name, title');

const cWithService = contracts.filter(c => c.service_name).length;
const cBadClient = contracts.filter(c => !c.client_company || ['시설공사','정보통신','전기공사','신축공사','상호','지급조건에따름공급가액','자명김현균수급상호(주)한국항만기술단사업자'].includes(c.client_company)).length;
console.log(`contracts ${contracts.length}건:`);
console.log(`  service_name 있음: ${cWithService}`);
console.log(`  잘못된 client_company: ${cBadClient}`);

const qWithService = quotes.filter(q => q.service_name || q.title).length;
console.log(`\nquotes ${quotes.length}건:`);
console.log(`  service_name/title 있음: ${qWithService}`);

// TOP client
const counts = {};
contracts.forEach(c => { if (c.client_company) counts[c.client_company] = (counts[c.client_company] || 0) + 1; });
const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,15);
console.log('\nTOP 15 거래처:');
top.forEach(([n,c]) => console.log(`  ${c}: ${n}`));
