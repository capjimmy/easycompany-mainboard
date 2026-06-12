import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const merges = [
  { keepName: '(사)건설경제연구원', removeName: '건설경제연구원', newName: '건설경제연구원' },
  { keepName: '(주)이지컨설턴트', removeName: '이지컨설턴트', newName: '이지컨설턴트' },
];

for (const { keepName, removeName, newName } of merges) {
  const { data: keep } = await sb.from('companies').select('*').eq('name', keepName).single();
  const { data: remove } = await sb.from('companies').select('*').eq('name', removeName).single();
  if (!keep || !remove) {
    console.log(`스킵: ${keepName} 또는 ${removeName} 없음`);
    continue;
  }
  console.log(`\n통합: ${removeName}(${remove.id}) → ${keepName}(${keep.id})`);

  // users 이전
  const { error: ue, count: uc } = await sb.from('users').update({ company_id: keep.id }, { count: 'exact' }).eq('company_id', remove.id);
  console.log(`  users 이전: ${uc || '?'} ${ue ? '❌'+ue.message : '✓'}`);

  // departments 이전
  const { error: de, count: dc } = await sb.from('departments').update({ company_id: keep.id }, { count: 'exact' }).eq('company_id', remove.id);
  console.log(`  departments 이전: ${dc || '?'} ${de ? '❌'+de.message : '✓'}`);

  // 빈 회사 삭제
  const { error: ce } = await sb.from('companies').delete().eq('id', remove.id);
  console.log(`  회사 삭제: ${ce ? '❌'+ce.message : '✓'}`);

  // 이름 정식화
  const { error: re } = await sb.from('companies').update({ name: newName }).eq('id', keep.id);
  console.log(`  이름 변경: ${keepName} → ${newName} ${re ? '❌'+re.message : '✓'}`);
}

// 최종 통계
const { data: companies } = await sb.from('companies').select('*');
const { data: users } = await sb.from('users').select('company_id');
const { data: deptsAll } = await sb.from('departments').select('company_id');
console.log('\n=== 최종 회사별 통계 ===');
for (const c of companies) {
  const u = users.filter(x => x.company_id === c.id).length;
  const d = deptsAll.filter(x => x.company_id === c.id).length;
  console.log(`  ${c.name}: 직원 ${u}명, 부서 ${d}개`);
}

// 부서 중복 (같은 회사 내 동일 이름) 확인
console.log('\n=== 부서 중복 확인 ===');
const { data: allDepts } = await sb.from('departments').select('id, company_id, name').order('name');
const seen = new Map();
const dups = [];
for (const d of allDepts) {
  const key = `${d.company_id}::${d.name}`;
  if (seen.has(key)) dups.push({ keep: seen.get(key), remove: d });
  else seen.set(key, d);
}
console.log(`중복 ${dups.length}개`);
for (const { keep, remove } of dups) {
  await sb.from('users').update({ department_id: keep.id }).eq('department_id', remove.id);
  await sb.from('departments').delete().eq('id', remove.id);
  console.log(`  병합: ${remove.name}`);
}
