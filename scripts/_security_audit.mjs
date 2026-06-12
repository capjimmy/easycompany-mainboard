import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

console.log('━━━ 1. anon key로 접근 가능한 테이블 + 민감 컬럼 노출 검증 ━━━\n');

// 모든 주요 테이블에 익명 접근 가능한지 + 민감 컬럼 노출 확인
const tables = [
  'users', 'companies', 'departments',
  'contracts', 'quotes', 'client_companies', 'client_contacts',
  'tax_invoices', 'billings', 'payment_receipts', 'receivables', 'payables',
  'outsourcings', 'provisional_payments',
  'expense_settlements', 'expense_settlement_items', 'expense_requests',
  'leave_requests', 'certificates',
  'vehicles', 'vehicle_logs', 'spaces',
  'settings',
  'notifications', 'messenger_messages', 'messenger_conversations',
  'attached_documents',
];

let totallyOpen = 0;
const openTables = [];
for (const t of tables) {
  const { data, error, count } = await sb.from(t).select('*', { count: 'exact', head: true });
  if (error) {
    console.log(`🔒 ${t}: 접근 차단 (${error.message.slice(0, 60)})`);
  } else {
    console.log(`🔓 ${t}: 접근 가능 (${count || 0}건 보임)`);
    totallyOpen++;
    openTables.push(t);
  }
}

console.log(`\n총 ${tables.length}개 테이블 중 ${totallyOpen}개 익명 접근 가능 (RLS 미설정)`);

// 2. 가장 민감한 users 테이블 — 실제로 어떤 컬럼이 노출되는지
console.log('\n━━━ 2. users 테이블 노출 컬럼 (가장 민감) ━━━\n');
const { data: sampleUser } = await sb.from('users').select('*').limit(1);
if (sampleUser?.[0]) {
  const keys = Object.keys(sampleUser[0]);
  console.log('컬럼 ' + keys.length + '개:');
  keys.forEach(k => {
    const v = sampleUser[0][k];
    const preview = v === null ? 'NULL' : typeof v === 'string' ? v.slice(0, 30) : String(v).slice(0, 30);
    console.log(`  ${k}: ${preview}`);
  });
}

// 3. password_hash 노출 여부 (가장 위험)
console.log('\n━━━ 3. password_hash 노출 검증 ━━━\n');
const { data: hashes, error: hashErr } = await sb.from('users').select('username, password_hash').limit(3);
if (hashErr) {
  console.log('🟢 password_hash 접근 차단됨');
} else if (hashes?.length) {
  console.log('🔴 password_hash 평문 노출! 익명 사용자가 모든 비밀번호 해시 다운로드 가능');
  hashes.forEach(u => console.log(`  ${u.username}: ${(u.password_hash || '').slice(0, 30)}...`));
}

// 4. 연봉/계좌/주민번호 등 컬럼 검색
console.log('\n━━━ 4. 민감 컬럼 (연봉/계좌/주민번호 등) 검색 ━━━\n');
const sensitivePatterns = ['salary', 'wage', 'annual_salary', 'monthly_salary', 'pay', 'bank_account', 'account_number', 'ssn', 'resident_number', 'jumin', '주민', 'tax_id', 'personal_id'];
const allTableSamples = {};
for (const t of openTables.slice(0, 30)) {  // open 테이블만 검사
  const { data } = await sb.from(t).select('*').limit(1);
  if (data?.[0]) {
    const keys = Object.keys(data[0]);
    const found = keys.filter(k => sensitivePatterns.some(p => k.toLowerCase().includes(p.toLowerCase())));
    if (found.length) {
      console.log(`🔴 ${t}: 민감 컬럼 [${found.join(', ')}]`);
      allTableSamples[t] = found;
    }
  }
}
if (Object.keys(allTableSamples).length === 0) {
  console.log('연봉/주민번호 등 명시적 민감 컬럼 없음');
}

// 5. 익명으로 write 가능 여부 (insert 시도)
console.log('\n━━━ 5. 익명 INSERT 가능 여부 (데이터 변조 위험) ━━━\n');
const writeTests = ['users', 'contracts', 'tax_invoices', 'payment_receipts'];
for (const t of writeTests) {
  const { error } = await sb.from(t).insert({ id: '00000000-0000-0000-0000-000000000000' });
  if (error) {
    if (/duplicate|conflict|primary key|null/.test(error.message.toLowerCase())) {
      console.log(`🔴 ${t}: INSERT 가능 (스키마 오류만 차단, 권한 차단 X) — "${error.message.slice(0, 60)}"`);
    } else {
      console.log(`🟢 ${t}: INSERT 차단 (${error.message.slice(0, 60)})`);
    }
  } else {
    console.log(`🔴🔴 ${t}: INSERT 완전 가능! (정리 필요)`);
  }
}

// 6. 익명으로 UPDATE 가능 여부
console.log('\n━━━ 6. 익명 UPDATE 가능 여부 ━━━\n');
const { error: upErr } = await sb.from('users').update({ name: 'test' }).eq('id', '00000000-0000-0000-0000-000000000000');
if (upErr && /not allowed|policy/.test(upErr.message.toLowerCase())) {
  console.log('🟢 익명 UPDATE 차단');
} else {
  console.log('🔴 UPDATE 가능 — 누구나 사용자 정보 변조 가능');
  console.log('  결과:', upErr ? upErr.message : '성공 (영향 0행)');
}

// 7. 익명으로 DELETE 가능 여부
console.log('\n━━━ 7. 익명 DELETE 가능 여부 ━━━\n');
const { error: delErr } = await sb.from('users').delete().eq('id', '00000000-0000-0000-0000-000000000000');
if (delErr && /not allowed|policy/.test(delErr.message.toLowerCase())) {
  console.log('🟢 익명 DELETE 차단');
} else {
  console.log('🔴 DELETE 가능 — 누구나 데이터 삭제 가능');
}
