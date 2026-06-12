import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

const FILES = [
  { file: '(사)건설경제연구원_근로자명부.xlsx', company: '건설경제연구원', layout: 'standard' },
  { file: '(주)이지컨설턴트_근로자명부 2026.xlsx', company: '이지컨설턴트', layout: 'standard' },
  { file: '건설환경연구소_근로자명부.xlsx', company: '건설환경연구소', layout: 'standard' },
  { file: '이지건축사사무소_근로자명부.xlsx', company: '이지건축사사무소', layout: 'standard' },
  { file: '어반브릿지파트너스_현직원명부.xlsx', company: '어반브릿지파트너스', layout: 'urban' },
];

// job_duty = row[9] for standard, department_raw = row[7] for urban
function parseStandardRow(row, companyName) {
  const name = row[1];
  if (!name || typeof name !== 'string' || name.trim() === '') return null;
  return {
    company_name: companyName,
    name: name.trim(),
    position: row[8] || null,
    job_duty: row[9] || null,
    resignation_date: row[20] || null,
  };
}
function parseUrbanRow(row, companyName) {
  const name = row[1];
  if (!name || typeof name !== 'string' || name.trim() === '') return null;
  return {
    company_name: companyName,
    name: name.trim(),
    position: row[8] || null,
    job_duty: row[7] || null, // department_raw for urban
    resignation_date: row[16] || null,
  };
}

const EXECUTIVE_TITLES = ['대표', '사장', '대표이사', '고문', '이사', '부원장', '원장', '회장'];
const NON_DEPT_ROLES = ['사원', '주임', '대리', '과장', '차장', '본부장', '연구원', '팀장', '실장', '부장'];

function inferDepartment(jobDuty, position) {
  if (!jobDuty) return { dept: null, reason: 'job_duty 없음' };
  const jd = String(jobDuty).trim();
  if (!jd) return { dept: null, reason: 'job_duty 비어있음' };

  // 임원 체크 (job_duty 또는 position)
  const pos = String(position || '').trim();
  if (EXECUTIVE_TITLES.some(t => jd === t || pos === t)) {
    return { dept: null, reason: `임원(${jd || pos})` };
  }

  // 키워드 매핑
  if (jd.includes('인증')) return { dept: '인증사업부', reason: null };
  if (jd.includes('전략기획')) return { dept: '전략기획본부', reason: null };
  if (jd.includes('친환경')) return { dept: '친환경본부', reason: null };
  if (jd.includes('교육환경')) return { dept: '건축계획부', reason: null };
  if (jd.includes('계획')) return { dept: '건축계획부', reason: null };
  if (jd.includes('건설사업')) return { dept: '건설사업부', reason: null };
  if (jd.includes('학술사업')) return { dept: '학술사업부', reason: null };
  if (jd.includes('개발사업')) return { dept: '개발사업부', reason: null };
  if (jd.includes('경영지원')) return { dept: '경영지원부', reason: null };
  if (jd.includes('경영관리')) return { dept: '경영관리실', reason: null };

  // 끝이 부/팀/실/본부
  if (/(부|팀|실|본부)$/.test(jd)) return { dept: jd, reason: null };

  // 단독 직급
  if (NON_DEPT_ROLES.includes(jd)) return { dept: null, reason: `직급(${jd})` };

  return { dept: null, reason: `미매핑(${jd})` };
}

console.log('=== 부서 재할당 시작 ===\n');

// 1) Excel 읽기
const allEmployees = [];
for (const { file, company, layout } of FILES) {
  let wb;
  try { wb = xlsx.readFile(file); }
  catch (e) { console.log(`❌ ${file}: ${e.message}`); continue; }

  let employees = [];
  if (layout === 'urban') {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    for (let i = 4; i < rows.length; i++) {
      const emp = parseUrbanRow(rows[i], company);
      if (emp) employees.push(emp);
    }
  } else {
    const ws = wb.Sheets['리스트(입력)'] || wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    for (let i = 3; i < rows.length; i++) {
      const emp = parseStandardRow(rows[i], company);
      if (emp) employees.push(emp);
    }
  }
  console.log(`✓ ${company}: ${employees.length}명`);
  allEmployees.push(...employees);
}
console.log(`\n총 ${allEmployees.length}명 추출\n`);

// 2) 회사 / 부서 / 사용자 로드
const { data: companies } = await supabase.from('companies').select('*');
const companyByName = new Map(companies.map(c => [c.name, c]));

const { data: departments } = await supabase.from('departments').select('*');
const deptKey = (cid, name) => `${cid}::${name}`;
const deptMap = new Map(departments.map(d => [deptKey(d.company_id, d.name), d]));

const { data: users } = await supabase.from('users').select('*');
console.log(`사용자 ${users.length}명, 부서 ${departments.length}개, 회사 ${companies.length}개\n`);

// 3) Excel 직원을 (company_name, name)으로 맵핑
const empByKey = new Map();
for (const emp of allEmployees) {
  empByKey.set(`${emp.company_name}::${emp.name}`, emp);
}

// 4) 활성 사용자 중 department_id가 없는 사람 처리
const activeUsers = users.filter(u => u.is_active !== false);
const targets = activeUsers.filter(u => !u.department_id);
console.log(`활성 사용자 ${activeUsers.length}명 중 부서 없음: ${targets.length}명\n`);

let updated = 0;
const skipReasons = [];
const createdDepts = [];

for (const user of targets) {
  const company = companies.find(c => c.id === user.company_id);
  if (!company) {
    skipReasons.push(`${user.name}: 회사 없음`);
    continue;
  }
  const emp = empByKey.get(`${company.name}::${user.name}`);
  if (!emp) {
    // fallback: 이름만으로
    const fallback = allEmployees.find(e => e.name === user.name);
    if (!fallback) {
      skipReasons.push(`${company.name}/${user.name}: Excel에 없음`);
      continue;
    }
    // 이름 매칭 가능하면 그걸 사용
    var jobDuty = fallback.job_duty;
    var posVal = fallback.position;
  } else {
    var jobDuty = emp.job_duty;
    var posVal = emp.position;
  }

  const { dept: deptName, reason } = inferDepartment(jobDuty, posVal || user.position);
  if (!deptName) {
    skipReasons.push(`${company.name}/${user.name}: ${reason} [job_duty=${jobDuty}, pos=${posVal || user.position}]`);
    continue;
  }

  // 부서 찾기 or 생성
  let dept = deptMap.get(deptKey(company.id, deptName));
  if (!dept) {
    const id = crypto.randomUUID();
    const { error } = await supabase.from('departments').insert({
      id,
      company_id: company.id,
      name: deptName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) {
      skipReasons.push(`${company.name}/${user.name}: 부서 생성 실패 ${error.message}`);
      continue;
    }
    dept = { id, company_id: company.id, name: deptName };
    deptMap.set(deptKey(company.id, deptName), dept);
    createdDepts.push(`${company.name}/${deptName}`);
  }

  const { error } = await supabase.from('users').update({
    department_id: dept.id,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);

  if (error) {
    skipReasons.push(`${company.name}/${user.name}: 업데이트 실패 ${error.message}`);
  } else {
    updated++;
    console.log(`✓ ${company.name}/${user.name} → ${deptName}`);
  }
}

console.log(`\n=== 업데이트 결과 ===`);
console.log(`업데이트됨: ${updated}명`);
console.log(`신규 부서: ${createdDepts.length}개  ${createdDepts.join(', ')}`);
console.log(`\n=== 스킵 (${skipReasons.length}명) ===`);
skipReasons.forEach(r => console.log(`- ${r}`));

// 5) 최종 통계
const { data: usersAfter } = await supabase.from('users').select('*');
const { data: deptsAfter } = await supabase.from('departments').select('*');
const activeAfter = usersAfter.filter(u => u.is_active !== false);
const withDept = activeAfter.filter(u => u.department_id);
const withoutDept = activeAfter.filter(u => !u.department_id);

console.log(`\n=== 최종 통계 ===`);
console.log(`총 활성 사용자: ${activeAfter.length}명`);
console.log(`부서 할당됨: ${withDept.length}명`);
console.log(`부서 없음: ${withoutDept.length}명`);

console.log(`\n=== 부서 없는 활성 사용자 ===`);
for (const u of withoutDept) {
  const c = companies.find(cc => cc.id === u.company_id);
  console.log(`- ${c?.name || '?'}/${u.name} (position=${u.position || '-'})`);
}

console.log(`\n=== 회사별/부서별 인원 ===`);
const deptById = new Map(deptsAfter.map(d => [d.id, d]));
const byCompany = new Map();
for (const u of activeAfter) {
  const c = companies.find(cc => cc.id === u.company_id);
  const cname = c?.name || '(회사없음)';
  if (!byCompany.has(cname)) byCompany.set(cname, new Map());
  const dName = u.department_id ? (deptById.get(u.department_id)?.name || '(?)') : '(미지정)';
  const m = byCompany.get(cname);
  m.set(dName, (m.get(dName) || 0) + 1);
}
for (const [cname, m] of byCompany) {
  console.log(`\n[${cname}] ${[...m.values()].reduce((a,b)=>a+b,0)}명`);
  for (const [dname, cnt] of [...m.entries()].sort((a,b)=>b[1]-a[1])) {
    console.log(`  - ${dname}: ${cnt}명`);
  }
}
