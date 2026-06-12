import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
// 회사별 세금계산서 + super_admin 사용자 확인
const { data: cos } = await sb.from('companies').select('id, name');
for (const c of cos) {
  const { count } = await sb.from('tax_invoices').select('*', { count: 'exact', head: true }).eq('company_id', c.id);
  console.log(`  ${c.name} (${c.id}): ${count}건`);
}

// super_admin 사용자
const { data: sa } = await sb.from('users').select('id, name, username, role, company_id').eq('role', 'super_admin');
console.log('\n슈퍼관리자:', sa);

// tax_invoices 첫 5건
const { data: ti } = await sb.from('tax_invoices').select('id, company_id, buyer_name, total_amount, issue_date').limit(5);
console.log('\n샘플:', ti);
