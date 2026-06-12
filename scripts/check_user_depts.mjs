import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const { data: users } = await sb.from('users').select('id, name, company_id, department_id, is_active');
const total = users.length;
const withDept = users.filter(u => u.department_id).length;
const active = users.filter(u => u.is_active).length;
console.log(`전체 사용자 ${total}명, 활성 ${active}명, 부서 배정 ${withDept}명`);

const { data: depts } = await sb.from('departments').select('id, name, company_id');
const { data: companies } = await sb.from('companies').select('id, name');
const cm = new Map(companies.map(c => [c.id, c.name]));

console.log('\n=== 회사별 부서 ===');
for (const c of companies) {
  const dpts = depts.filter(d => d.company_id === c.id);
  console.log(`\n${c.name}:`);
  for (const d of dpts) {
    const cnt = users.filter(u => u.department_id === d.id).length;
    console.log(`  ${d.name}: ${cnt}명`);
  }
}
