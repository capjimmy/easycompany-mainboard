import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

// 파일 → 회사명 매핑
const FILES = [
  { file: '(사)건설경제연구원_근로자명부.xlsx', company: '건설경제연구원', layout: 'standard' },
  { file: '(주)이지컨설턴트_근로자명부 2026.xlsx', company: '이지컨설턴트', layout: 'standard' },
  { file: '건설환경연구소_근로자명부.xlsx', company: '건설환경연구소', layout: 'standard' },
  { file: '이지건축사사무소_근로자명부.xlsx', company: '이지건축사사무소', layout: 'standard' },
  { file: '어반브릿지파트너스_현직원명부.xlsx', company: '어반브릿지파트너스', layout: 'urban' },
];

// Excel serial date → JS Date
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  if (serial < 10000 || serial > 60000) return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date = new Date(utc_value * 1000);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

// 주민번호 → 생년월일
function rrnToBirthDate(rrn) {
  if (!rrn) return null;
  const clean = String(rrn).replace(/\D/g, '');
  if (clean.length < 7) return null;
  const yy = parseInt(clean.slice(0, 2));
  const mm = clean.slice(2, 4);
  const dd = clean.slice(4, 6);
  const g = parseInt(clean[6]);
  const century = (g === 1 || g === 2 || g === 5 || g === 6) ? '19' : '20';
  return `${century}${String(yy).padStart(2, '0')}-${mm}-${dd}`;
}

// 주민번호 → 성별
function rrnToGender(rrn) {
  if (!rrn) return null;
  const clean = String(rrn).replace(/\D/g, '');
  if (clean.length < 7) return null;
  const g = parseInt(clean[6]);
  return (g === 1 || g === 3 || g === 5 || g === 7) ? 'M' : 'F';
}

// 표준 레이아웃 (4개 회사) 행 → 직원 객체
function parseStandardRow(row, companyName) {
  const name = row[1];
  if (!name || typeof name !== 'string' || name.trim() === '') return null;
  return {
    company_name: companyName,
    name: name.trim(),
    rrn: row[2] || null,
    birth_date: rrnToBirthDate(row[2]),
    gender: rrnToGender(row[2]),
    address: row[4] || null,
    phone: row[5] || null,
    dependents: row[6] || null,
    workplace: row[7] || null,
    position: row[8] || null,
    job_duty: row[9] || null,
    qualifications: row[10] || null,
    school: row[11] || null,
    degree: row[12] || null,
    department_raw: row[13] || null,
    major: row[14] || null,
    education_level: row[15] || null,
    military: row[17] || null,
    hire_date: typeof row[18] === 'number' ? excelDateToISO(row[18]) : (row[18] || null),
    resignation_date: typeof row[20] === 'number' ? excelDateToISO(row[20]) : (row[20] || null),
    bank_name: row[28] || null,
    bank_account: row[30] || null,
  };
}

// 어반브릿지 레이아웃 행 → 직원 객체
function parseUrbanRow(row, companyName) {
  const name = row[1];
  if (!name || typeof name !== 'string' || name.trim() === '') return null;
  return {
    company_name: companyName,
    name: name.trim(),
    rrn: row[2] || null,
    birth_date: typeof row[18] === 'number' ? excelDateToISO(row[18]) : rrnToBirthDate(row[2]),
    gender: rrnToGender(row[2]),
    phone: row[3] || null,
    email: row[4] || null,
    address: row[6] || null,
    department_raw: row[7] || null,
    position: row[8] || null,
    school: row[9] || null,
    degree: row[10] || null,
    qualifications: row[14] || null,
    hire_date: typeof row[15] === 'number' ? excelDateToISO(row[15]) : (row[15] || null),
    resignation_date: typeof row[16] === 'number' ? excelDateToISO(row[16]) : (row[16] || null),
    bank_name: row[22] || null,
    bank_account: row[23] || null,
  };
}

// 부서명 추출 (종사업무에서만, "과"는 학과이므로 제외)
function detectDepartmentName(emp) {
  // 종사업무가 부서명 (예: "건설사업부", "학술사업부", "경영관리실", "개발사업부")
  if (emp.job_duty && /[부실팀]$/.test(emp.job_duty)) return emp.job_duty;
  return null;
}

// 한글이름 → 영문 이니셜 (간단 버전)
function nameToInitials(name) {
  const map = {
    'ㄱ': 'g', 'ㄲ': 'g', 'ㄴ': 'n', 'ㄷ': 'd', 'ㄸ': 'd',
    'ㄹ': 'r', 'ㅁ': 'm', 'ㅂ': 'b', 'ㅃ': 'b', 'ㅅ': 's',
    'ㅆ': 's', 'ㅈ': 'j', 'ㅉ': 'j', 'ㅊ': 'c', 'ㅋ': 'k',
    'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 'h',
  };
  const initials = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  let result = '';
  let isFirst = true;
  for (const ch of name) {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const idx = Math.floor((code - 0xAC00) / (21 * 28));
      const initial = initials[idx];
      if (initial === 'ㅇ') {
        // 이/임 → l, 나머지 → 모음의 첫글자
        if (isFirst) result += 'l';
        else result += 'o';
      } else {
        result += map[initial] || 'x';
      }
      isFirst = false;
    }
  }
  return result;
}

// === 메인 ===
console.log('=== 직원 명부 임포트 시작 ===\n');

// 1) 모든 파일에서 직원 데이터 추출
const allEmployees = [];
const fileResults = [];
for (const { file, company, layout } of FILES) {
  let wb;
  try { wb = xlsx.readFile(file); }
  catch (e) { console.log(`❌ ${file} 읽기 실패: ${e.message}`); continue; }

  let employees = [];

  if (layout === 'urban') {
    // 어반브릿지: 첫 시트 = '직원정보', 헤더 행 2-3, 데이터 행 4+
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    for (let i = 4; i < rows.length; i++) {
      const emp = parseUrbanRow(rows[i], company);
      if (emp) employees.push(emp);
    }
  } else {
    // 표준: '리스트(입력)' 시트, 헤더 행 2, 데이터 행 3+
    const ws = wb.Sheets['리스트(입력)'] || wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    for (let i = 3; i < rows.length; i++) {
      const emp = parseStandardRow(rows[i], company);
      if (emp) employees.push(emp);
    }
  }

  console.log(`✓ ${company}: ${employees.length}명`);
  fileResults.push({ company, count: employees.length });
  allEmployees.push(...employees);
}
console.log(`\n총 ${allEmployees.length}명 추출\n`);

// 2) 회사 목록 확인 및 필요 시 생성
const { data: existingCompanies } = await supabase.from('companies').select('*');
const companyMap = new Map(existingCompanies.map(c => [c.name, c]));

const companiesNeeded = [...new Set(allEmployees.map(e => e.company_name))];
for (const cname of companiesNeeded) {
  if (!companyMap.has(cname)) {
    const id = crypto.randomUUID();
    const { error } = await supabase.from('companies').insert({
      id,
      name: cname,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.log(`❌ 회사 생성 실패 [${cname}]: ${error.message}`);
    } else {
      console.log(`✓ 회사 생성: ${cname} (${id})`);
      companyMap.set(cname, { id, name: cname });
    }
  } else {
    console.log(`- 회사 존재: ${cname}`);
  }
}

// 3) 부서 자동 생성
const { data: existingDepts } = await supabase.from('departments').select('*');
const deptKey = (companyId, name) => `${companyId}::${name}`;
const deptMap = new Map(existingDepts.map(d => [deptKey(d.company_id, d.name), d]));

let deptCreated = 0;
for (const emp of allEmployees) {
  const deptName = detectDepartmentName(emp);
  if (!deptName) continue;
  const company = companyMap.get(emp.company_name);
  if (!company) continue;
  const k = deptKey(company.id, deptName);
  if (!deptMap.has(k)) {
    const id = crypto.randomUUID();
    const { error } = await supabase.from('departments').insert({
      id,
      company_id: company.id,
      name: deptName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (!error) {
      deptMap.set(k, { id, company_id: company.id, name: deptName });
      deptCreated++;
    }
  }
}
console.log(`\n부서 ${deptCreated}개 신규 생성, 총 ${deptMap.size}개 부서\n`);

// 4) 사용자 매칭 + 업데이트/생성
const { data: existingUsers } = await supabase.from('users').select('*');
console.log(`기존 사용자 ${existingUsers.length}명\n`);

let updated = 0, created = 0, skipped = 0;
const log = [];

for (const emp of allEmployees) {
  const company = companyMap.get(emp.company_name);
  if (!company) { skipped++; continue; }

  const deptName = detectDepartmentName(emp);
  const dept = deptName ? deptMap.get(deptKey(company.id, deptName)) : null;

  // 이름 + (옵션) 전화번호로 기존 사용자 검색
  const matches = existingUsers.filter(u => u.name === emp.name);

  // 업데이트 페이로드
  const payload = {
    company_id: company.id,
    department_id: dept?.id || null,
    name: emp.name,
    phone: emp.phone || undefined,
    address: emp.address || undefined,
    position: emp.position || undefined,
    birth_date: emp.birth_date || undefined,
    hire_date: emp.hire_date || undefined,
    resignation_date: emp.resignation_date || undefined,
    bank_name: emp.bank_name || undefined,
    bank_account: emp.bank_account || undefined,
    email: emp.email || undefined,
    is_active: emp.resignation_date ? false : true,
    updated_at: new Date().toISOString(),
  };
  // undefined 제거
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  if (matches.length > 0) {
    // 업데이트 (첫 번째 매칭)
    const target = matches[0];
    const { error } = await supabase.from('users').update(payload).eq('id', target.id);
    if (error) {
      log.push(`❌ 업데이트 실패 [${emp.company_name}/${emp.name}]: ${error.message}`);
      skipped++;
    } else {
      updated++;
      log.push(`✓ 업데이트: ${emp.company_name}/${emp.name}${dept ? ' ['+dept.name+']' : ''}`);
    }
  } else {
    // 신규 생성 - username 자동 생성
    const id = crypto.randomUUID();
    const initials = nameToInitials(emp.name) || 'user';
    const yearSuffix = emp.hire_date ? emp.hire_date.slice(2, 4) : '00';
    let username = `${initials}${yearSuffix}`;
    // 중복 체크
    let suffix = 0;
    let candidate = username;
    while (existingUsers.find(u => u.username === candidate)) {
      suffix++;
      candidate = `${username}_${suffix}`;
    }
    username = candidate;

    const newUser = {
      id,
      ...payload,
      username,
      role: 'employee',
      password_hash: '$2a$10$ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz12', // 더미
      created_at: new Date().toISOString(),
    };
    existingUsers.push({ id, username, name: emp.name });
    const { error } = await supabase.from('users').insert(newUser);
    if (error) {
      log.push(`❌ 신규 생성 실패 [${emp.company_name}/${emp.name}]: ${error.message}`);
      skipped++;
    } else {
      created++;
      log.push(`+ 신규 생성: ${emp.company_name}/${emp.name}${dept ? ' ['+dept.name+']' : ''}`);
    }
  }
}

console.log(`\n=== 결과 ===`);
console.log(`업데이트: ${updated}`);
console.log(`신규 생성: ${created}`);
console.log(`스킵/실패: ${skipped}`);
console.log(`\n=== 상세 로그 (마지막 30) ===`);
log.slice(-30).forEach(l => console.log(l));
