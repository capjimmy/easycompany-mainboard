import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://silvsqcwearelrumtqqm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1. Find 이지컨설턴트 company
const { data: companies } = await sb.from('companies').select('id, name');
console.log('Companies:', companies.map(c => `${c.name} (${c.id})`));

const easyCompany = companies.find(c => c.name.includes('이지컨설턴트'));
if (!easyCompany) {
  console.error('이지컨설턴트 회사를 찾을 수 없습니다.');
  process.exit(1);
}
const companyId = easyCompany.id;
console.log(`\n이지컨설턴트 company_id: ${companyId}`);

// 2. Get current departments for this company
const { data: depts } = await sb.from('departments').select('*').eq('company_id', companyId);
console.log('\n현재 부서 목록:');
depts.forEach(d => console.log(`  ${d.name} (code: ${d.code || '-'}, id: ${d.id})`));

// 3. Delete "경영관리실" - first unassign users
const mgmtDept = depts.find(d => d.name === '경영관리실');
if (mgmtDept) {
  console.log(`\n"경영관리실" 삭제 중... (id: ${mgmtDept.id})`);
  const { data: affectedUsers } = await sb.from('users').select('id, name').eq('department_id', mgmtDept.id);
  if (affectedUsers && affectedUsers.length > 0) {
    console.log(`  소속 직원 ${affectedUsers.length}명 부서 해제:`, affectedUsers.map(u => u.name).join(', '));
    await sb.from('users').update({ department_id: null }).eq('department_id', mgmtDept.id);
  }
  const { error: delErr } = await sb.from('departments').delete().eq('id', mgmtDept.id);
  if (delErr) console.error('  삭제 오류:', delErr.message);
  else console.log('  삭제 완료.');
} else {
  console.log('\n"경영관리실" 없음 - 건너뜀.');
}

// 4. Rename "인증사업부" → "친환경인증사업본부"
const certDept = depts.find(d => d.name === '인증사업부');
if (certDept) {
  console.log(`\n"인증사업부" → "친환경인증사업본부" 변경 중...`);
  const { error } = await sb.from('departments').update({ name: '친환경인증사업본부', updated_at: new Date().toISOString() }).eq('id', certDept.id);
  if (error) console.error('  변경 오류:', error.message);
  else console.log('  변경 완료.');
} else {
  console.log('\n"인증사업부" 없음 - 건너뜀.');
}

// 5. Rename "친환경본부" → "교육환경본부"
const ecoDept = depts.find(d => d.name === '친환경본부');
if (ecoDept) {
  console.log(`\n"친환경본부" → "교육환경본부" 변경 중...`);
  const { error } = await sb.from('departments').update({ name: '교육환경본부', updated_at: new Date().toISOString() }).eq('id', ecoDept.id);
  if (error) console.error('  변경 오류:', error.message);
  else console.log('  변경 완료.');
} else {
  console.log('\n"친환경본부" 없음 - 건너뜀.');
}

// 6. Create new departments if they don't exist
// Re-fetch departments after renames
const { data: updatedDepts } = await sb.from('departments').select('*').eq('company_id', companyId);
const existingNames = new Set(updatedDepts.map(d => d.name));

const newDepts = ['경영지원본부', '건축계획본부', '교육환경본부'];
for (const name of newDepts) {
  if (existingNames.has(name)) {
    console.log(`\n"${name}" 이미 존재 - 건너뜀.`);
    continue;
  }
  console.log(`\n"${name}" 생성 중...`);
  const { error } = await sb.from('departments').insert({
    company_id: companyId,
    name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('  생성 오류:', error.message);
  else console.log('  생성 완료.');
}

// 7. Final state
const { data: finalDepts, error: finalErr } = await sb.from('departments').select('id, name').eq('company_id', companyId).order('name');
if (finalErr) {
  console.error('최종 목록 조회 오류:', finalErr.message);
} else {
  console.log('\n=== 최종 부서 목록 ===');
  finalDepts.forEach(d => console.log(`  ${d.name}`));
  console.log(`\n총 ${finalDepts.length}개 부서`);
}
