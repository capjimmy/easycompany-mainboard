import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data: users } = await sb.from('users').select('name, username, hire_date, is_active').order('name');

console.log('=== 입사일-아이디 매칭 확인 ===\n');
let mismatch = 0;
for (const u of users) {
  if (!u.username || !u.hire_date) continue;
  // 아이디 끝 2자리가 입사년도 끝 2자리와 일치해야 함
  const yearMatch = u.username.match(/(\d{2})$/);
  if (!yearMatch) continue;
  const idYear = yearMatch[1];
  const hireYear = u.hire_date.slice(2, 4); // 20XX → XX
  if (idYear !== hireYear) {
    mismatch++;
    console.log(`  ❌ ${u.name} (${u.username}): 아이디연도=${idYear}, 입사일=${u.hire_date} (${hireYear}) ${u.is_active ? '' : '[비활성]'}`);
  }
}
console.log(`\n불일치: ${mismatch}건`);
