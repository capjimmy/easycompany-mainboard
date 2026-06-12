import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const { count: cTotal } = await sb.from('contracts').select('*', { count: 'exact', head: true });
const { count: cLinked } = await sb.from('contracts').select('*', { count: 'exact', head: true }).not('linked_quote_id', 'is', null);
const { count: tiLinked } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true }).not('contract_id', 'is', null);
const { count: tiTotal } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true });
console.log(`계약 총 ${cTotal}, 견적 연결 ${cLinked} (${(cLinked/cTotal*100).toFixed(1)}%)`);
console.log(`세금계산서 총 ${tiTotal}, 계약 연결 ${tiLinked} (${(tiLinked/tiTotal*100).toFixed(1)}%)`);

// 거래처명 분포 (어떤 게 일반명사인지)
const { data: cs } = await sb.from('contracts').select('client_company').limit(1000);
const counts = {};
cs.forEach(c => { if (c.client_company) counts[c.client_company] = (counts[c.client_company] || 0) + 1; });
const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,15);
console.log('\n계약 거래처 TOP 15:');
top.forEach(([n,c]) => console.log(`  ${c}: ${n}`));
