import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data: depts } = await sb.from('departments').select('*').eq('name', '사원');
for (const d of depts) {
  await sb.from('users').update({ department_id: null }).eq('department_id', d.id);
  await sb.from('departments').delete().eq('id', d.id);
}
console.log(`'사원' 부서 ${depts.length}개 삭제`);

// 회사별 부서 + 직원 수 통계
const { data: companies } = await sb.from('companies').select('*');
const { data: users } = await sb.from('users').select('company_id, is_active');
const { data: deptsAll } = await sb.from('departments').select('company_id, name');
console.log('\n=== 회사별 통계 ===');
for (const c of companies) {
  const userCount = users.filter(u => u.company_id === c.id).length;
  const deptCount = deptsAll.filter(d => d.company_id === c.id).length;
  console.log(`  ${c.name}: 직원 ${userCount}명, 부서 ${deptCount}개`);
}
