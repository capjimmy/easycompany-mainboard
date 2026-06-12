import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const { data: users } = await sb.from('users').select('id, name, company_id, department_id, position, is_active').eq('is_active', true);
const { data: companies } = await sb.from('companies').select('id, name');
const cm = new Map(companies.map(c => [c.id, c.name]));

console.log('=== 활성 사용자 중 부서 미배정 ===');
const unassigned = users.filter(u => !u.department_id);
for (const u of unassigned) {
  console.log(`  ${cm.get(u.company_id)} / ${u.name} (직책: ${u.position || '-'})`);
}
console.log(`\n총 ${unassigned.length}명 미배정`);
