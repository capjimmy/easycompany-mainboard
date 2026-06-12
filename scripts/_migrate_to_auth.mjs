/**
 * 기존 users 테이블의 사용자들을 Supabase Auth로 일괄 마이그레이션
 *
 * 전략:
 * - username을 가짜 email로 변환 (예: admin@easy.local)
 * - 기존 password_hash는 admin API의 password_hash 옵션으로 그대로 사용
 *   (Supabase는 bcrypt $2a$ 형식 호환)
 * - users 테이블에 auth_user_id 컬럼을 추가하여 Auth uid와 매핑
 * - 사용자 입장에선 ID(username) + 비밀번호(changeme123) 그대로
 *
 * 실행: SUPABASE_SERVICE_ROLE_KEY=... node scripts/_migrate_to_auth.mjs
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// .env.local 파싱
const env = {};
const envFile = fs.readFileSync('.env.local', 'utf8');
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE || SERVICE_ROLE.startsWith('여기에')) {
  console.error('❌ SERVICE_ROLE 키 누락');
  process.exit(1);
}

// admin 클라이언트
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('━━━ Supabase Auth 마이그레이션 ━━━\n');

// 1. 사용자 전체 조회
const { data: users, error } = await admin.from('users').select('*').eq('is_active', true);
if (error) { console.error('users 조회 실패:', error.message); process.exit(1); }
console.log('마이그레이션 대상: ' + users.length + '명 (활성 사용자만)');

// 2. 각 사용자를 Auth에 생성
const FAKE_DOMAIN = '@easy.local';
let created = 0, existed = 0, failed = 0;
const updates = []; // {userId, authUid, email}

for (const u of users) {
  const fakeEmail = `${u.username}${FAKE_DOMAIN}`;
  try {
    // admin.createUser는 password_hash 직접 받을 수 있음
    const { data, error: createErr } = await admin.auth.admin.createUser({
      email: fakeEmail,
      password_hash: u.password_hash,  // bcrypt 그대로
      email_confirm: true,
      user_metadata: {
        username: u.username,
        name: u.name,
        role: u.role,
        company_id: u.company_id,
        department_id: u.department_id,
      },
      app_metadata: {
        role: u.role,
        company_id: u.company_id,
        department_id: u.department_id,
      },
    });
    if (createErr) {
      // 이미 있으면 update로 재시도
      if (createErr.message.includes('already') || createErr.code === 'email_exists') {
        // 이미 등록된 사용자 — auth uid 가져오기
        const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = existing?.users?.find((x) => x.email === fakeEmail);
        if (found) {
          updates.push({ userId: u.id, authUid: found.id, email: fakeEmail });
          existed++;
          continue;
        }
      }
      console.log('  ❌ ' + u.username + ': ' + createErr.message.slice(0, 80));
      failed++;
      continue;
    }
    if (data?.user) {
      updates.push({ userId: u.id, authUid: data.user.id, email: fakeEmail });
      created++;
      if (created <= 3) console.log('  ✅ ' + u.username + ' → ' + data.user.id.slice(0, 8));
    }
  } catch (err) {
    console.log('  ❌ ' + u.username + ' 예외: ' + err.message.slice(0, 80));
    failed++;
  }
}

console.log(`\n결과: ✅생성 ${created} / ⏭️이미존재 ${existed} / ❌실패 ${failed}`);

// 3. users 테이블에 auth_user_id 컬럼 추가 + 매핑 갱신
console.log('\n━━━ users.auth_user_id 갱신 ━━━');
// 컬럼 추가 SQL은 별도 마이그레이션에서. 여기선 업데이트만 시도.
for (const u of updates) {
  await admin.from('users').update({ auth_user_id: u.authUid, email: u.email }).eq('id', u.userId);
}
console.log('✅ users 테이블 매핑 갱신 완료 (' + updates.length + '건)');
