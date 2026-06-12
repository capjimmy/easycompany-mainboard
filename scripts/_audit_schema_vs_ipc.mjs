// 모든 IPC 핸들러의 INSERT/UPDATE 페이로드와 실제 DB 스키마 컬럼을 비교해서
// 코드가 가정하지만 DB에 없는 컬럼을 찾아냅니다 (BUG #1 같은 동종 버그 색출)

import fs from 'fs';
import path from 'path';

function glob(pattern) {
  // 단순 글로브 대체: src/main/ipc/*.ts
  const dir = path.dirname(pattern);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.ts')).map(f => path.join(dir, f));
}

const env = {};
fs.readFileSync('.env.local','utf8').split('\n').forEach(l => { const m=l.match(/^([A-Z_]+)=(.+)$/); if(m) env[m[1]]=m[2].trim(); });

// 1) DB 실제 스키마 가져오기 (PostgREST OpenAPI)
const r = await fetch(env.SUPABASE_URL + '/rest/v1/', {
  headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
});
const spec = await r.json();
const tableCols = {};
for (const [table, def] of Object.entries(spec.definitions)) {
  tableCols[table] = new Set(Object.keys(def.properties || {}));
}
console.log('DB 테이블 수:', Object.keys(tableCols).length);

// 2) IPC 핸들러 파일들 스캔
const ipcFiles = glob('src/main/ipc/*.ts').filter(f => !f.includes('.test.'));
const dbFile = 'src/main/database/supabaseDb.ts';
const issues = [];

// 정규식: supabase.from('TABLE').insert({...}) 또는 .update({...}) 패턴
// 멀티라인 매칭
function findInsertObjects(content, filename) {
  const result = [];
  // 단순화: supabase.from('xxx').insert({...}) 의 '...' 내부 키 추출
  const fromInsertRe = /supabase\s*\.\s*from\s*\(\s*['"]([a-z_]+)['"]\s*\)\s*\.\s*(insert|update|upsert)\s*\(\s*([^)]*)\)/gs;
  let m;
  while ((m = fromInsertRe.exec(content)) !== null) {
    const [, table, op, payload] = m;
    if (!tableCols[table]) continue;
    // payload에서 key 패턴 추출
    const keyRe = /([a-z_][a-z_0-9]*)\s*:/g;
    const keys = new Set();
    let km;
    while ((km = keyRe.exec(payload)) !== null) {
      keys.add(km[1]);
    }
    // DB 스키마에 없는 키 찾기
    const missing = [...keys].filter(k => !tableCols[table].has(k));
    if (missing.length > 0) {
      const line = content.substring(0, m.index).split('\n').length;
      result.push({ filename, table, op, line, missingCols: missing });
    }
  }
  return result;
}

// db.addXxx, db.updateXxx 같은 wrapper 호출의 페이로드는 검사 어려움
// 그래서 supabaseDb.ts에서 from().insert/update 패턴 직접 검사
for (const file of [...ipcFiles, dbFile]) {
  const content = fs.readFileSync(file, 'utf8');
  const found = findInsertObjects(content, file);
  issues.push(...found);
}

// 3) 결과
console.log('\n=== 스키마 불일치 자동 검출 ===');
if (issues.length === 0) {
  console.log('✓ 검출된 불일치 없음');
} else {
  for (const i of issues) {
    console.log(`\n[${i.filename}:${i.line}] ${i.op} on '${i.table}'`);
    console.log(`  ✗ DB에 없는 컬럼: ${i.missingCols.join(', ')}`);
    console.log(`  실제 DB 컬럼: ${[...tableCols[i.table]].join(', ')}`);
  }
}

// 4) 추가 검사: addXxx wrapper에 어떤 키를 넣어 호출하는지 정적 검사
// (생략 — 복잡하지만 IPC에서 직접 보는 위의 검사로 80% 커버됨)

// 5) IPC 코드가 호출하는 .eq('col', ...) 같은 WHERE 절이 존재하는 컬럼 사용하는지도 검사
function findWhereFilters(content, filename) {
  const result = [];
  // supabase.from('x')...eq('col', ...) 또는 .neq, .gt, .lt, .order
  const fromRe = /supabase\s*\.\s*from\s*\(\s*['"]([a-z_]+)['"]\s*\)([^;]+?)(?=(?:supabase\s*\.\s*from)|;|\n\s*const|\n\s*let|\n\s*await)/gs;
  let m;
  while ((m = fromRe.exec(content)) !== null) {
    const [, table, chain] = m;
    if (!tableCols[table]) continue;
    const filterRe = /\.(eq|neq|gt|gte|lt|lte|like|ilike|in|contains|order)\s*\(\s*['"]([a-z_]+)['"]/g;
    let fm;
    while ((fm = filterRe.exec(chain)) !== null) {
      const col = fm[2];
      if (!tableCols[table].has(col)) {
        const line = content.substring(0, m.index + fm.index).split('\n').length;
        result.push({ filename, table, line, missingCol: col, op: fm[1] });
      }
    }
  }
  return result;
}

console.log('\n=== WHERE/ORDER 필터에 사용된 미존재 컬럼 검사 ===');
const filterIssues = [];
for (const file of [...ipcFiles, dbFile]) {
  const content = fs.readFileSync(file, 'utf8');
  filterIssues.push(...findWhereFilters(content, file));
}
if (filterIssues.length === 0) {
  console.log('✓ 검출된 불일치 없음');
} else {
  for (const i of filterIssues) {
    console.log(`[${i.filename}:${i.line}] .${i.op}('${i.missingCol}', ...) on '${i.table}' — 컬럼 없음`);
  }
}

console.log('\n=== 요약 ===');
console.log('INSERT/UPDATE 키 불일치:', issues.length, '건');
console.log('WHERE 필터 컬럼 불일치:', filterIssues.length, '건');
