// 침투 가능성 재현: 회사A 직원이 INSERT/UPDATE 시 다른 회사 company_id 지정해도 통과되는지
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = {};
fs.readFileSync('.env.local','utf8').split('\n').forEach(l => { const m=l.match(/^([A-Z_]+)=(.+)$/); if(m) env[m[1]]=m[2].trim(); });
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

console.log('=== RLS WITH CHECK 누락 — 실제 침투 가능 여부 검증 ===\n');

// 회사A의 employee 가져오기
const { data: empA } = await sb.from('users').select('id, auth_user_id, role, company_id, username').eq('role','employee').not('auth_user_id','is',null).limit(1).single();
// 다른 회사 ID 찾기
const { data: otherCompanies } = await sb.from('users').select('company_id').not('company_id','is',null).neq('company_id', empA.company_id).limit(5);
const otherCompanyId = otherCompanies[0]?.company_id;

console.log('회사A 직원:', empA.username, '@', empA.company_id);
console.log('침투 시도 대상 회사:', otherCompanyId, '\n');

// 회사A 직원으로 로그인
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
const { error: le } = await anon.auth.signInWithPassword({ email: empA.username + '@easy.local', password: 'changeme123' });
if (le) { console.log('login fail:', le.message); process.exit(1); }

// SCENARIO A: client_companies INSERT 시 다른 회사로 가장
console.log('[A] client_companies INSERT 시 company_id를 회사B로 변조 시도');
const { data: a1, error: a1e } = await anon.from('client_companies').insert({
  company_id: otherCompanyId,   // ← 다른 회사로 침투
  name: '[침투테스트] 가짜거래처',
  is_active: true,
}).select();
console.log('  결과:', a1e ? '✓ 차단됨 (' + a1e.code + ': ' + a1e.message + ')' : '✗ 침투 성공! id=' + a1?.[0]?.id);
if (a1?.[0]?.id) { await sb.from('client_companies').delete().eq('id', a1[0].id); }

// SCENARIO B: 내 회사 client_companies 한 건 만들고 UPDATE로 회사 이동 시도
console.log('\n[B] UPDATE로 자사 client → 회사B 이동 시도');
const { data: ownC } = await anon.from('client_companies').insert({
  company_id: empA.company_id,
  name: '[침투테스트2] 우리회사거래처',
  is_active: true,
}).select().single();
if (ownC) {
  const { data: b1, error: b1e } = await anon.from('client_companies').update({
    company_id: otherCompanyId,
  }).eq('id', ownC.id).select();
  console.log('  결과:', b1e ? '✓ 차단됨 (' + b1e.code + ': ' + b1e.message + ')' : (b1?.[0]?.company_id === otherCompanyId ? '✗ 침투 성공! 회사 변경됨' : '⚠ UPDATE 통과했지만 변경 안 됨'));
  await sb.from('client_companies').delete().eq('id', ownC.id);
}

// SCENARIO C: contracts INSERT 시 다른 회사로 가장
console.log('\n[C] contracts INSERT 시 다른 회사로 가장 시도');
const { data: c1, error: c1e } = await anon.from('contracts').insert({
  company_id: otherCompanyId,
  contract_number: 'HACK_' + Date.now(),
  contract_amount: 1,
  vat_amount: 0,
  total_amount: 1,
  progress: 'contract_signed',
}).select();
console.log('  결과:', c1e ? '✓ 차단됨 (' + c1e.code + ': ' + c1e.message + ')' : '✗ 침투 성공! id=' + c1?.[0]?.id);
if (c1?.[0]?.id) { await sb.from('contracts').delete().eq('id', c1[0].id); }

// SCENARIO D: users INSERT 시 다른 회사 직원 만들기
console.log('\n[D] users INSERT로 다른 회사 직원 생성 시도');
const { data: d1, error: d1e } = await anon.from('users').insert({
  company_id: otherCompanyId,
  username: 'hack_' + Date.now(),
  name: '해커',
  role: 'super_admin',  // 권한 격상까지 시도
  is_active: true,
}).select();
console.log('  결과:', d1e ? '✓ 차단됨 (' + d1e.code + ': ' + d1e.message + ')' : '✗ 침투 성공! id=' + d1?.[0]?.id);
if (d1?.[0]?.id) { await sb.from('users').delete().eq('id', d1[0].id); }

await anon.auth.signOut();
console.log('\n=== 검증 완료 ===');
