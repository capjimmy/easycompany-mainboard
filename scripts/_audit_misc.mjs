// 추가 잠재 이슈 검사:
// 1. updated_at 누락된 테이블 (IPC가 updated_at 업데이트 시 에러)
// 2. created_by 같은 표준 컬럼 누락
// 3. FK 관계의 ON DELETE 정책

import fs from 'fs';

const env = {};
fs.readFileSync('.env.local','utf8').split('\n').forEach(l => { const m=l.match(/^([A-Z_]+)=(.+)$/); if(m) env[m[1]]=m[2].trim(); });

const r = await fetch(env.SUPABASE_URL + '/rest/v1/', {
  headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
});
const spec = await r.json();

// 1) IPC 코드에서 .update({ updated_at: ... }) 패턴 사용하는 모든 테이블 찾기
const files = fs.readdirSync('src/main/ipc').filter(f => f.endsWith('.ts'));
const dbFile = fs.readFileSync('src/main/database/supabaseDb.ts', 'utf8');
const allCode = files.map(f => fs.readFileSync('src/main/ipc/' + f, 'utf8')).join('\n') + dbFile;

// 표준 컬럼 사용 패턴 찾기
const tablesNeedingUpdatedAt = new Set();
const updateRe = /\.from\(['"]([a-z_]+)['"]\)\s*\.\s*update\s*\([^)]*updated_at/gs;
let m;
while ((m = updateRe.exec(allCode)) !== null) {
  tablesNeedingUpdatedAt.add(m[1]);
}

console.log('=== updated_at 컬럼 누락 검사 ===');
console.log(`IPC가 updated_at으로 update 시도하는 테이블: ${tablesNeedingUpdatedAt.size}개\n`);
const missingUpdatedAt = [];
for (const t of tablesNeedingUpdatedAt) {
  const def = spec.definitions[t];
  if (!def) { console.log(`  ${t}: 테이블 없음`); continue; }
  const hasUpdatedAt = 'updated_at' in def.properties;
  if (!hasUpdatedAt) {
    missingUpdatedAt.push(t);
    console.log(`  ✗ ${t}: updated_at 누락!`);
  }
}
if (missingUpdatedAt.length === 0) console.log('  ✓ 모든 테이블에 updated_at 존재');

// 2) created_by 컬럼 검사
const tablesNeedingCreatedBy = new Set();
const insertRe = /\.from\(['"]([a-z_]+)['"]\)\s*\.\s*insert\s*\([^)]*created_by/gs;
while ((m = insertRe.exec(allCode)) !== null) {
  tablesNeedingCreatedBy.add(m[1]);
}
console.log(`\n=== created_by 컬럼 누락 검사 ===`);
const missingCreatedBy = [];
for (const t of tablesNeedingCreatedBy) {
  const def = spec.definitions[t];
  if (!def) continue;
  if (!('created_by' in def.properties)) {
    missingCreatedBy.push(t);
    console.log(`  ✗ ${t}: created_by 누락!`);
  }
}
if (missingCreatedBy.length === 0) console.log('  ✓ 모든 테이블에 created_by 존재');

// 3) status 컬럼 검사 (workflow 있는 테이블들)
console.log(`\n=== 잠재 deprecated 컬럼 검사 ===`);
// quote_sections에 여전히 section_type/content 있는지 (구버전 호환)
for (const [table, def] of Object.entries(spec.definitions)) {
  const cols = Object.keys(def.properties);
  // 동의어 둘 다 있는 경우 (description vs note, total_amount vs amount 등)
  if (cols.includes('description') && cols.includes('note')) {
    console.log(`  ⚠ ${table}: description과 note 둘 다 존재 (코드가 어느 쪽 쓰는지 불일치 위험)`);
  }
  if (cols.includes('total_amount') && cols.includes('amount')) {
    console.log(`  ℹ ${table}: total_amount/amount 둘 다 존재 (의도된 분리일 수 있음)`);
  }
}

// 4) FK CASCADE 정보 - PostgREST는 노출 안 함. 어쩔 수 없이 SQL 마이그레이션 파일에서 추론
console.log(`\n=== 결과 요약 ===`);
console.log(`  updated_at 누락: ${missingUpdatedAt.length}건 → ${missingUpdatedAt.join(', ')}`);
console.log(`  created_by 누락: ${missingCreatedBy.length}건 → ${missingCreatedBy.join(', ')}`);
