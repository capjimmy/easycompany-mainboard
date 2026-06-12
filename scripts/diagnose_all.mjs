import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// 1. vehicles 테이블
const { error: vErr } = await sb.from('vehicles').select('id').limit(1);
console.log('vehicles 테이블:', vErr ? `❌ ${vErr.message}` : '✅');

// 2. tax_invoices 데이터 회사별
const { data: tiAll } = await sb.from('tax_invoices').select('company_id', { count: 'exact' });
const { data: cos } = await sb.from('companies').select('id, name');
const cm = new Map(cos.map(c => [c.id, c.name]));
const grouped = {};
tiAll.forEach(t => { const n = cm.get(t.company_id) || 'NULL'; grouped[n] = (grouped[n] || 0) + 1; });
console.log('\n세금계산서 회사별:');
Object.entries(grouped).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
