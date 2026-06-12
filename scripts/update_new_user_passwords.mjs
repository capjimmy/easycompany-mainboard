import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// 신규 8명: import 시 password_hash가 임시값('$2a$10$ABCDEFGHIJKLMN...')이었음
const targetPrefix = '$2a$10$ABCDEFGHIJKLMN';
const { data: users } = await sb.from('users').select('id, name, username, password_hash');
const targets = users.filter(u => u.password_hash && u.password_hash.startsWith(targetPrefix));
console.log(`임시 비밀번호 사용자 ${targets.length}명:`);
targets.forEach(u => console.log(`  ${u.name} (${u.username})`));

const newHash = bcrypt.hashSync('changeme123', 10);
let updated = 0;
for (const u of targets) {
  const { error } = await sb.from('users').update({ password_hash: newHash, updated_at: new Date().toISOString() }).eq('id', u.id);
  if (!error) updated++;
  else console.log(`  ❌ ${u.name}: ${error.message}`);
}
console.log(`\n✅ ${updated}명 비밀번호 'changeme123'으로 설정 완료`);
