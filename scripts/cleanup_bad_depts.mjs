import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// "과"로 끝나거나 "학과" 포함하는 부서는 학과명이므로 삭제
const { data: depts } = await sb.from('departments').select('*');
const bad = depts.filter(d => /과$/.test(d.name) || d.name.includes('학과') || d.name.includes('학부'));
console.log(`삭제 대상 ${bad.length}개:`);
bad.forEach(d => console.log(`  ${d.name}`));

// 해당 부서에 속한 사용자의 department_id를 null로
for (const d of bad) {
  await sb.from('users').update({ department_id: null }).eq('department_id', d.id);
  await sb.from('departments').delete().eq('id', d.id);
}
console.log(`\n정리 완료. 남은 부서:`);
const { data: remaining } = await sb.from('departments').select('name, company_id').order('name');
remaining.forEach(d => console.log(`  ${d.name}`));
