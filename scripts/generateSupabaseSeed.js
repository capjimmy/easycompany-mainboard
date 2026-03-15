/**
 * 전체 시드 데이터를 Supabase INSERT SQL로 변환하는 스크립트
 * - allContracts.json + allQuotes.json + seedData.ts의 2025 수작업 데이터
 * - 사용자, 회사, 부서, 인건비, 경비, 거래처 등 모든 기초 데이터 포함
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function uuid() { return crypto.randomUUID(); }
function esc(str) { return (str || '').replace(/'/g, "''"); }
function now() { return new Date().toISOString(); }

// JSON 데이터 로드
const allContracts = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/main/database/allContracts.json'), 'utf-8'));
const allQuotes = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/main/database/allQuotes.json'), 'utf-8'));

// ============ 고정 ID ============
const COMPANY_ID = 'a0000000-0000-0000-0000-000000000001'; // (주)이지컨설턴트
const COMPANY_ID_2 = 'a0000000-0000-0000-0000-000000000002'; // (사)건설경제연구원
const DEPT_ACADEMIC = 'b0000000-0000-0000-0000-000000000001'; // 학술사업부
const ADMIN_USER_ID = 'c0000000-0000-0000-0000-000000000001'; // 슈퍼관리자
const EASY_ADMIN_ID = 'c0000000-0000-0000-0000-000000000002'; // 이지컨설턴트 관리자
const KIMYJ_ID = 'c0000000-0000-0000-0000-000000000003'; // 김영진
const PARKSH_ID = 'c0000000-0000-0000-0000-000000000004'; // 박서현

let sql = '';

function addLine(line) { sql += line + '\n'; }
function addSection(title) {
  addLine('');
  addLine(`-- ========== ${title} ==========`);
}

// ============ Header ============
addLine('-- ============================================');
addLine('-- Easy Company 전체 시드 데이터');
addLine(`-- 생성일: ${now()}`);
addLine('-- 기존 데이터 충돌 방지: ON CONFLICT DO NOTHING');
addLine('-- ============================================');

// ============ 0. RPC 함수 (이미 존재하면 스킵) ============
addSection('next_sequence RPC 함수 (이미 존재하면 교체)');
addLine(`CREATE OR REPLACE FUNCTION next_sequence(seq_key TEXT)`);
addLine(`RETURNS INTEGER AS $$`);
addLine(`DECLARE`);
addLine(`  next_val INTEGER;`);
addLine(`BEGIN`);
addLine(`  INSERT INTO sequences (key, current_value, updated_at)`);
addLine(`  VALUES (seq_key, 1, NOW())`);
addLine(`  ON CONFLICT (key) DO UPDATE SET current_value = sequences.current_value + 1, updated_at = NOW()`);
addLine(`  RETURNING current_value INTO next_val;`);
addLine(`  RETURN next_val;`);
addLine(`END;`);
addLine(`$$ LANGUAGE plpgsql;`);

// ============ 1. 회사 ============
addSection('회사 (companies)');
addLine(`INSERT INTO companies (id, name, business_number, created_at, updated_at) VALUES`);
addLine(`  ('${COMPANY_ID}', '(주)이지컨설턴트', '000-00-00000', NOW(), NOW()),`);
addLine(`  ('${COMPANY_ID_2}', '(사)건설경제연구원', '000-00-00001', NOW(), NOW())`);
addLine(`ON CONFLICT (id) DO NOTHING;`);

// ============ 2. 부서 (벡터 데이터 기반 전체) ============
addSection('부서 (departments) - 기존 데이터 삭제 후 재입력');
addLine(`DELETE FROM departments WHERE company_id IN ('${COMPANY_ID}', '${COMPANY_ID_2}');`);
addLine(`INSERT INTO departments (id, company_id, name, default_folders, created_at, updated_at) VALUES`);
addLine(`  ('${DEPT_ACADEMIC}', '${COMPANY_ID}', '학술사업부', '["//diskstation/02. 학술사업부", "//diskstation/021. RES", "//diskstation/022. G-RES"]'::jsonb, NOW(), NOW()),`);
addLine(`  ('b0000000-0000-0000-0000-000000000002', '${COMPANY_ID}', '건설사업부', '["//diskstation/01. 건설사업부", "//diskstation/011. CON", "//diskstation/012. G-CON"]'::jsonb, NOW(), NOW()),`);
addLine(`  ('b0000000-0000-0000-0000-000000000003', '${COMPANY_ID}', '개발사업부', '["//diskstation/03. 개발사업부"]'::jsonb, NOW(), NOW()),`);
addLine(`  ('b0000000-0000-0000-0000-000000000004', '${COMPANY_ID}', '경영지원부', '["//diskstation/04. 경영지원부", "//easy-nas/EASY_계약_회계"]'::jsonb, NOW(), NOW()),`);
addLine(`  ('b0000000-0000-0000-0000-000000000005', '${COMPANY_ID}', '건축계획부', '["//easy-nas/EASY_건축계획부"]'::jsonb, NOW(), NOW()),`);
addLine(`  ('b0000000-0000-0000-0000-000000000006', '${COMPANY_ID}', '친환경본부', '["//easy-nas/EASY_친환경본부", "//easy-nas/EASY_친환경본부 이전자료"]'::jsonb, NOW(), NOW()),`);
addLine(`  ('b0000000-0000-0000-0000-000000000007', '${COMPANY_ID}', '어반브릿지파트너스', '["//diskstation/UBP"]'::jsonb, NOW(), NOW())`);
addLine(`ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, default_folders = EXCLUDED.default_folders, updated_at = NOW();`);

// ============ 3. 사용자 ============
addSection('사용자 (users)');
const adminHash = bcrypt.hashSync('admin123', 10);
const easyHash = bcrypt.hashSync('easy123', 10);
const empHash = bcrypt.hashSync('1234', 10);

addLine(`INSERT INTO users (id, company_id, department_id, username, password_hash, name, email, role, is_active, created_at, updated_at) VALUES`);
addLine(`  ('${ADMIN_USER_ID}', NULL, NULL, 'admin', '${adminHash}', '슈퍼관리자', NULL, 'super_admin', true, NOW(), NOW()),`);
addLine(`  ('${EASY_ADMIN_ID}', '${COMPANY_ID}', NULL, 'easyadmin', '${easyHash}', '이지컨설턴트 관리자', NULL, 'company_admin', true, NOW(), NOW()),`);
addLine(`  ('${KIMYJ_ID}', '${COMPANY_ID}', '${DEPT_ACADEMIC}', 'kimyj', '${empHash}', '김영진', 'kimyj@example.com', 'employee', true, NOW(), NOW()),`);
addLine(`  ('${PARKSH_ID}', '${COMPANY_ID}', '${DEPT_ACADEMIC}', 'parksh', '${empHash}', '박서현', 'parksh@example.com', 'department_manager', true, NOW(), NOW())`);
addLine(`ON CONFLICT (id) DO NOTHING;`);

// ============ 4. 인건비 등급 ============
addSection('인건비 등급 (labor_grades)');
const grades = [
  { name: '책임연구원', rate: 3300000, order: 1 },
  { name: '연구원', rate: 2530000, order: 2 },
  { name: '선임연구보조', rate: 1690000, order: 3 },
  { name: '연구보조', rate: 1268000, order: 4 },
];
for (const g of grades) {
  addLine(`INSERT INTO labor_grades (id, company_id, name, monthly_rate, sort_order, is_active, created_at, updated_at) VALUES ('${uuid()}', '${COMPANY_ID}', '${g.name}', ${g.rate}, ${g.order}, true, NOW(), NOW()) ON CONFLICT DO NOTHING;`);
}

// ============ 5. 경비 항목 ============
addSection('경비 항목 (expense_categories)');
const expenses = [
  { name: '사무용품비', type: 'manual', order: 1 },
  { name: '출장비', type: 'manual', order: 2 },
  { name: '회의비', type: 'manual', order: 3 },
  { name: '제경비', type: 'percentage', base: 'labor_total', rate: 0.1, order: 4 },
  { name: '기술료', type: 'percentage', base: 'labor_total', rate: 0.2, order: 5 },
];
for (const e of expenses) {
  const base = e.base ? `'${e.base}'` : 'NULL';
  const rate = e.rate || 'NULL';
  addLine(`INSERT INTO expense_categories (id, company_id, name, calculation_type, base_field, default_rate, sort_order, is_active, created_at, updated_at) VALUES ('${uuid()}', '${COMPANY_ID}', '${e.name}', '${e.type}', ${base}, ${rate}, ${e.order}, true, NOW(), NOW()) ON CONFLICT DO NOTHING;`);
}

// ============ 6. 견적서 (Quotes) ============
addSection('견적서 (quotes)');

// 2025 수작업 견적서
const handcraftedQuotes = [
  { qn: 'ECA-2505-1', co: '(주)해안종합건축사사무소', svc: '광명시흥 B1-3, S1-10BL 민간참여 공동주택 친환경 컨설팅', gt: 77000000, ta: 70000000, va: 7000000, st: 'converted', date: '2025-05-10' },
  { qn: 'ECA-2505-2', co: '(주)해안종합건축사사무소', svc: '광명시흥 B1-3, S1-10BL 민간참여 공동주택 친환경+교육환경 컨설팅', gt: 225500000, ta: 205000000, va: 20500000, st: 'converted', date: '2025-05-12' },
  { qn: 'ECA-2506-3', co: '(주)해마종합건축사사무소', svc: '의왕군포안산 S1-1, S1-3BL 민간참여 공공주택사업 친환경 컨설팅', gt: 174281564, ta: 158437785, va: 15843779, st: 'converted', date: '2025-06-05' },
  { qn: 'ECA-2507-4', co: '(주)토문엔지니어링건축사사무소', svc: '행정중심복합도시 52L2, 52M2BL 공동주택 친환경 컨설팅', gt: 49500000, ta: 45000000, va: 4500000, st: 'submitted', date: '2025-07-15' },
  { qn: 'ECA-2508-5', co: '희림종합건축사사무소', svc: '검단신도시 AA17블록 중흥에스클래스 친환경+교육환경 컨설팅', gt: 65637000, ta: 59670000, va: 5967000, st: 'draft', date: '2025-08-20' },
];

for (const q of handcraftedQuotes) {
  const id = uuid();
  addLine(`INSERT INTO quotes (id, company_id, quote_number, recipient_company, title, service_name, total_amount, vat_amount, grand_total, status, quote_date, created_at, updated_at) VALUES ('${id}', '${COMPANY_ID}', '${q.qn}', '${esc(q.co)}', '${esc(q.svc)}', '${esc(q.svc)}', ${q.ta}, ${q.va}, ${q.gt}, '${q.st}', '${q.date}', NOW(), NOW()) ON CONFLICT DO NOTHING;`);
}

// 2019~2026 견적서 (allQuotes.json)
for (const q of allQuotes) {
  const id = uuid();
  const recipientCompany = q.service ? q.company : '';
  const serviceName = q.service || q.company;
  const month = Math.min(q.month, 12);
  const status = q.year <= 2023 ? 'converted' : q.year === 2024 ? 'submitted' : 'draft';
  const qDate = `${q.year}-${String(month).padStart(2, '0')}-01`;

  addLine(`INSERT INTO quotes (id, company_id, quote_number, recipient_company, title, service_name, total_amount, vat_amount, grand_total, status, quote_date, notes, created_at, updated_at) VALUES ('${id}', '${COMPANY_ID}', '${esc(q.quote_number)}', '${esc(recipientCompany)}', '${esc(serviceName)}', '${esc(serviceName)}', ${q.total_amount || 0}, ${q.vat_amount || 0}, ${q.grand_total || 0}, '${status}', '${qDate}', '파일: ${esc(q.file_name)}', NOW(), NOW()) ON CONFLICT DO NOTHING;`);
}

// ============ 7. 계약서 (Contracts) ============
addSection('계약서 (contracts) - 2025년 수작업');

// 2025년 수작업 계약서
const contracts2025 = [
  { cn: 'AA25-01', co: '범도시건축', svc: '남양주왕숙 A-25BL 민간참여 공공주택 친환경 컨설팅', amt: 27000000, vat: 2700000, total: 29700000, rcv: 13200000, progress: 'in_progress', start: '2024-09-01', end: '2025-12-31' },
  { cn: 'AA25-02', co: '㈜범도시건축종합건축사사무소', svc: '남양주왕숙 A25BL 민간참여 공공주택 건설사업', amt: 63000000, vat: 0, total: 63000000, rcv: 0, progress: 'in_progress', start: '2025-02-01', end: '2026-01-31' },
  { cn: 'AA25-03', co: '㈜성현종합건축사사무소', svc: '의왕청계2 A-3BL 설계용역(재설계)', amt: 27000000, vat: 0, total: 27000000, rcv: 0, progress: 'in_progress', start: '2024-12-01', end: '2025-11-30' },
  { cn: 'AA25-04', co: '디엘이앤씨 주식회사', svc: 'ZEB 신재생에너지 개산견적 가이드 작성 ECO2 시뮬레이션 용역', amt: 30000000, vat: 3000000, total: 33000000, rcv: 33000000, progress: 'completed', start: '2025-03-01', end: '2025-12-31' },
  { cn: 'AA25-05', co: '㈜해안종합건축사사무소', svc: '실버스테이 시범사업 민간사업자 공모(구리갈매)', amt: 9000000, vat: 900000, total: 9900000, rcv: 0, progress: 'in_progress', start: '2025-04-01', end: '2026-03-31' },
  { cn: 'AA25-06', co: '주식회사 에스아이그룹건축사사무소', svc: '남양주왕숙 A6BL 공동주택 설계용역 친환경 컨설팅', amt: 92000000, vat: 0, total: 92000000, rcv: 27600000, progress: 'in_progress', start: '2025-04-01', end: '2026-03-31' },
  { cn: 'AA25-07', co: '㈜유선엔지니어링건축사사무소', svc: '인천검단 AA13-2블록 공공주택건설사업 설계용역', amt: 24000000, vat: 0, total: 24000000, rcv: 0, progress: 'in_progress', start: '2025-05-01', end: '2026-04-30' },
  { cn: 'AA25-08', co: '(주)구성이엔드씨', svc: '통합배관 적용 가능성 검증 ECO2 분석 용역', amt: 20000000, vat: 0, total: 20000000, rcv: 20000000, progress: 'completed', start: '2025-05-01', end: '2025-12-31' },
  { cn: 'AA25-09', co: '㈜유선엔지니어링건축사사무소', svc: '인천검단 AA13-2블록 공공주택건설사업 설계용역(변경사업승인)', amt: 22000000, vat: 0, total: 22000000, rcv: 0, progress: 'in_progress', start: '2025-06-01', end: '2026-05-31' },
  { cn: 'AA25-10', co: '(주)구성이엔드씨', svc: '통합배관 적용 가능성 검증 ECO2 분석 용역(화성능동 B1, 인천가정2 A1BL)', amt: 5000000, vat: 500000, total: 5500000, rcv: 5500000, progress: 'completed', start: '2025-06-01', end: '2025-12-31' },
  { cn: 'AA25-11', co: '(주)경동나비엔', svc: '통합배관 적용 가능성 검증 ECO2 분석 용역(화성능동 B1, 인천가정2 A1BL)', amt: 5000000, vat: 500000, total: 5500000, rcv: 5500000, progress: 'completed', start: '2025-07-01', end: '2025-12-31' },
  { cn: 'AA25-12', co: '(주)해마종합건축사사무소', svc: '인천검단 AA26BL 공공지원 민간임대 친환경 컨설팅', amt: 80000000, vat: 0, total: 80000000, rcv: 0, progress: 'contract_signed', start: '2025-07-01', end: '2026-06-30' },
  { cn: 'AA25-13', co: '(주)디에이그룹엔지니어링종합건축사사무소', svc: '남양주 왕숙 A-17, S-18BL 민간참여 친환경+교육환경 컨설팅', amt: 250000000, vat: 0, total: 250000000, rcv: 25000000, progress: 'in_progress', start: '2025-07-01', end: '2026-12-31' },
  { cn: 'AA25-14', co: '건일엠이씨(해안)', svc: '고양창릉 S-9BL 공동주택 설계용역 친환경 컨설팅', amt: 108000000, vat: 10800000, total: 118800000, rcv: 0, progress: 'in_progress', start: '2025-08-01', end: '2026-07-31' },
  { cn: 'AA25-15', co: '㈜마메종', svc: '울산대공원 한신더휴 친환경 컨설팅', amt: 38000000, vat: 0, total: 38000000, rcv: 0, progress: 'in_progress', start: '2025-08-01', end: '2026-07-31' },
  { cn: 'AA25-16', co: '㈜지엔엠건축사사무소', svc: '울산선바위 S-5BL 공동주택 설계용역', amt: 143750000, vat: 0, total: 143750000, rcv: 0, progress: 'in_progress', start: '2025-08-01', end: '2026-07-31' },
  { cn: 'AA25-17', co: '㈜케이디엔지니어링건축사사무소', svc: '대전죽동2 A-2BL 공동주택 친환경 설계용역', amt: 90000000, vat: 0, total: 90000000, rcv: 0, progress: 'in_progress', start: '2025-08-01', end: '2026-07-31' },
  { cn: 'AA25-18', co: '㈜에스아이그룹건축사사무소', svc: '남양주왕숙 PM-3BL 및 남양주왕숙2 A-1BL 민간참여 공공주택건설사업', amt: 30000000, vat: 0, total: 30000000, rcv: 0, progress: 'in_progress', start: '2025-09-01', end: '2026-08-31' },
  { cn: 'AA25-19', co: '다솜/성일건설', svc: '증액분 (다솜/성일 친환경 컨설팅)', amt: 28000000, vat: 0, total: 28000000, rcv: 0, progress: 'in_progress', start: '2025-09-01', end: '2026-08-31' },
  { cn: 'AA25-20', co: '㈜지엔엠건축사사무소', svc: '울산선바위 A-5BL 공동주택 설계용역', amt: 120750000, vat: 0, total: 120750000, rcv: 0, progress: 'in_progress', start: '2025-09-01', end: '2026-08-31' },
  { cn: 'AA25-21', co: '㈜지엔엠건축사사무소', svc: '울산선바위 A-6BL 공동주택 설계용역', amt: 74750000, vat: 0, total: 74750000, rcv: 0, progress: 'in_progress', start: '2025-09-01', end: '2026-08-31' },
  { cn: 'AA25-22', co: '에이앤유디자인그룹건축사사무소', svc: '여수죽림 A7블록 친환경(교육)분야 컨설팅', amt: 75000000, vat: 0, total: 75000000, rcv: 33200000, progress: 'in_progress', start: '2025-09-01', end: '2026-08-31' },
  { cn: 'AA25-23', co: '㈜해안종합건축사사무소', svc: '실버스테이 시범사업(구리갈매) 교육환경영향평가', amt: 70000000, vat: 0, total: 70000000, rcv: 0, progress: 'contract_signed', start: '2025-09-01', end: '2026-08-31' },
  { cn: 'AA25-24', co: '㈜건축사사무소 에스파스', svc: '의왕군포안산 S1-1, S1-3BL 공공주택건립사업(기술제안)', amt: 10502888, vat: 0, total: 10502888, rcv: 0, progress: 'contract_signed', start: '2025-09-01', end: '2026-08-31' },
  { cn: 'AA25-25', co: '㈜건축사사무소 에스파스', svc: '의왕군포안산 S1-1, S1-3BL 공공주택건립사업(실시설계)', amt: 68718892, vat: 0, total: 68718892, rcv: 0, progress: 'contract_signed', start: '2025-09-01', end: '2027-08-31' },
  { cn: 'AA25-26', co: '(주)해마종합건축사사무소', svc: '의왕군포안산 S1-1, S1-3BL 민간참여 공공주택사업(공모)', amt: 21005775, vat: 2100578, total: 23106353, rcv: 0, progress: 'contract_signed', start: '2025-09-01', end: '2026-08-31' },
  { cn: 'AA25-27', co: '(주)해마종합건축사사무소', svc: '의왕군포안산 S1-1, S1-3BL 민간참여 공공주택사업(실시)', amt: 137437785, vat: 13743779, total: 151181564, rcv: 0, progress: 'contract_signed', start: '2025-09-01', end: '2027-08-31' },
  { cn: 'AA25-28', co: '㈜인보건축사사무소', svc: '의왕군포안산 S1-1, S1-3 민간참여 공공주택건설사업(공모)', amt: 3500962, vat: 0, total: 3500962, rcv: 0, progress: 'contract_signed', start: '2025-10-01', end: '2026-09-30' },
  { cn: 'AA25-29', co: '㈜인보건축사사무소', svc: '의왕군포안산 S1-1, S1-3 민간참여 공공주택건설사업(실시)', amt: 22906297, vat: 0, total: 22906297, rcv: 0, progress: 'contract_signed', start: '2025-10-01', end: '2027-09-30' },
  { cn: 'AA25-30', co: '(주)해안종합건축사사무소', svc: '광명시흥 B1-3, S1-10BL 민간참여 공공주택사업(공모)', amt: 70000000, vat: 7000000, total: 77000000, rcv: 0, progress: 'in_progress', start: '2025-10-01', end: '2026-09-30' },
  { cn: 'AA25-31', co: '(주)해안종합건축사사무소', svc: '광명시흥 B1-3, S1-10BL 민간참여 공공주택사업(실시)', amt: 205000000, vat: 20500000, total: 225500000, rcv: 0, progress: 'in_progress', start: '2025-10-01', end: '2027-09-30' },
  { cn: 'AA25-32', co: '㈜범도시건축종합건축사사무소', svc: '포항시 항구동 주상복합 신축공사 에너지절약계획서 변경', amt: 3500000, vat: 0, total: 3500000, rcv: 0, progress: 'in_progress', start: '2025-10-01', end: '2026-03-31' },
  { cn: 'AA25-33', co: '케이디건축종합건축사사무소', svc: '대전죽동2 A2BL 공동주택 친환경 컨설팅', amt: 110000000, vat: 0, total: 110000000, rcv: 0, progress: 'in_progress', start: '2025-10-01', end: '2026-09-30' },
  { cn: 'AA25-34', co: '㈜희림종합건축사사무소', svc: '검단신도시 AA17블록 중흥에스클래스 친환경+교육환경+녹색건축인증', amt: 78030000, vat: 0, total: 78030000, rcv: 0, progress: 'contract_signed', start: '2025-11-01', end: '2026-10-31' },
  { cn: 'AA25-35', co: '에이앤유디자인그룹건축사사무소', svc: '여수죽림 A7블록 친환경 컨설팅 (추가분)', amt: 160000000, vat: 0, total: 160000000, rcv: 0, progress: 'contract_signed', start: '2025-12-01', end: '2026-11-30' },
  { cn: 'AA25-36', co: '㈜해마종합건축사사무소', svc: '(가칭)검단7초등학교 신축공사 설계용역', amt: 25000000, vat: 0, total: 25000000, rcv: 0, progress: 'contract_signed', start: '2025-12-01', end: '2026-11-30' },
  // 본인증 (AB25)
  { cn: 'AB25-01', co: '금호건설(주)', svc: '야탑동 공공분양주택 신축공사 본인증 컨설팅', amt: 31000000, vat: 3100000, total: 34100000, rcv: 34100000, progress: 'completed', start: '2025-02-01', end: '2025-12-31' },
  { cn: 'AB25-02', co: '㈜마메종', svc: '울산대공원 한신더휴 본인증 컨설팅', amt: 38000000, vat: 3800000, total: 41800000, rcv: 0, progress: 'in_progress', start: '2025-04-01', end: '2026-03-31' },
  { cn: 'AB25-03', co: '운정신도시대우케이원18호', svc: '파주운정3 A-8블럭 공동주택 본인증 컨설팅', amt: 50000000, vat: 5000000, total: 55000000, rcv: 0, progress: 'in_progress', start: '2025-08-01', end: '2026-07-31' },
  { cn: 'AB25-04', co: '주식회사운정신도시대우케이원18호', svc: '파주운정3 A-8블럭 공동주택 본인증 컨설팅(추가분)', amt: 21000000, vat: 2100000, total: 23100000, rcv: 0, progress: 'in_progress', start: '2025-08-01', end: '2026-07-31' },
  { cn: 'AB25-05', co: '한진중공업', svc: '남양주진접2 A-3BL 아파트 건설공사 녹색 및 에너지 본인증', amt: 24500000, vat: 0, total: 24500000, rcv: 0, progress: 'contract_signed', start: '2025-11-01', end: '2026-10-31' },
  // 건설환경연구소 (BB25)
  { cn: 'BB25-01', co: '광명 제4R구역 주택재개발 정비사업 조합', svc: '광명 제4R구역 주택재개발 정비사업 본인증 용역', amt: 38770000, vat: 0, total: 38770000, rcv: 0, progress: 'in_progress', start: '2025-04-01', end: '2026-03-31' },
];

// 계약 ID 매핑 (입금 내역 연결용)
const contractIdMap = {};
for (const c of contracts2025) {
  const id = uuid();
  contractIdMap[c.cn] = id;
  const remaining = c.total - c.rcv;
  addLine(`INSERT INTO contracts (id, company_id, contract_number, contract_code, client_company, contract_type, service_name, contract_start_date, contract_end_date, contract_amount, vat_amount, total_amount, received_amount, remaining_amount, progress, created_by, created_at, updated_at) VALUES ('${id}', '${COMPANY_ID}', '${c.cn}', '${c.cn}', '${esc(c.co)}', 'service', '${esc(c.svc)}', '${c.start}', '${c.end}', ${c.amt}, ${c.vat}, ${c.total}, ${c.rcv}, ${remaining}, '${c.progress}', '${ADMIN_USER_ID}', NOW(), NOW()) ON CONFLICT DO NOTHING;`);
}

// 2019~2024 과거 계약 (allContracts.json)
addSection('계약서 (contracts) - 2019~2024 과거');
const yearCounters = {};
for (const r of allContracts) {
  if (r.year >= 2025) continue;
  if (!yearCounters[r.year]) yearCounters[r.year] = 0;
  yearCounters[r.year]++;
  const seq = String(yearCounters[r.year]).padStart(3, '0');
  const yearStr = String(r.year).slice(2);
  const contractNumber = `EC${yearStr}-${seq}`;

  const id = uuid();
  contractIdMap[contractNumber] = id;
  const contractAmount = Math.round(r.contract_amount || 0);
  const totalReceived = Math.round(r.total_received || 0);
  const remaining = Math.max(0, contractAmount - totalReceived);

  let progress = 'completed';
  if (r.outstanding_invoiced > 0 || r.uninvoiced > 0) {
    progress = totalReceived > 0 ? 'in_progress' : 'contract_signed';
  }

  addLine(`INSERT INTO contracts (id, company_id, contract_number, contract_code, client_company, contract_type, service_name, contract_start_date, contract_end_date, contract_amount, vat_amount, total_amount, received_amount, remaining_amount, progress, created_by, created_at, updated_at) VALUES ('${id}', '${COMPANY_ID}', '${contractNumber}', '${contractNumber}', '${esc(r.company)}', 'service', '${esc(r.service)}', '${r.year}-01-01', '${r.year}-12-31', ${contractAmount}, 0, ${contractAmount}, ${totalReceived}, ${remaining}, '${progress}', '${ADMIN_USER_ID}', NOW(), NOW()) ON CONFLICT DO NOTHING;`);
}

// ============ 8. 입금 내역 (Contract Payments) ============
addSection('입금 내역 (contract_payments) - 2025');

// 2025 수작업 입금
const manualPayments = [
  { cn: 'AA25-01', amt: 13200000, date: '2025-01-15', type: 'advance', desc: '착수금' },
  { cn: 'AA25-06', amt: 27600000, date: '2025-05-10', type: 'advance', desc: '1차 기성' },
  { cn: 'AA25-13', amt: 25000000, date: '2025-08-20', type: 'advance', desc: '착수금' },
  { cn: 'AA25-22', amt: 33200000, date: '2025-10-15', type: 'progress', desc: '1차 기성' },
  { cn: 'AB25-01', amt: 17050000, date: '2025-03-10', type: 'advance', desc: '선금 50%' },
  { cn: 'AB25-01', amt: 17050000, date: '2025-11-20', type: 'final', desc: '잔금 50%' },
  { cn: 'AA25-04', amt: 33000000, date: '2025-06-15', type: 'final', desc: '완료금' },
  { cn: 'AA25-08', amt: 20000000, date: '2025-08-01', type: 'final', desc: '완료금' },
  { cn: 'AA25-10', amt: 5500000, date: '2025-09-01', type: 'final', desc: '완료금' },
  { cn: 'AA25-11', amt: 5500000, date: '2025-10-01', type: 'final', desc: '완료금' },
];

for (const p of manualPayments) {
  const contractId = contractIdMap[p.cn];
  if (!contractId) continue;
  addLine(`INSERT INTO contract_payments (id, contract_id, amount, payment_date, description, created_at) VALUES ('${uuid()}', '${contractId}', ${p.amt}, '${p.date}', '${esc(p.desc)}', NOW()) ON CONFLICT DO NOTHING;`);
}

// 과거 계약 입금 (allContracts.json)
addSection('입금 내역 (contract_payments) - 과거');
const yearCounters2 = {};
for (const r of allContracts) {
  if (r.year >= 2025) continue;
  if (!r.payments || r.payments.length === 0) continue;

  if (!yearCounters2[r.year]) yearCounters2[r.year] = 0;
  yearCounters2[r.year]++;
  const seq = String(yearCounters2[r.year]).padStart(3, '0');
  const yearStr = String(r.year).slice(2);
  const contractNumber = `EC${yearStr}-${seq}`;
  const contractId = contractIdMap[contractNumber];
  if (!contractId) continue;

  for (let i = 0; i < r.payments.length; i++) {
    const p = r.payments[i];
    const paymentAmount = Math.round(p.payment_amount || 0);
    if (paymentAmount <= 0) continue;
    const paymentType = i === 0 ? 'advance' : i === r.payments.length - 1 ? 'final' : 'progress';
    const paymentDate = p.payment_date || p.invoice_date;
    addLine(`INSERT INTO contract_payments (id, contract_id, amount, payment_date, description, created_at) VALUES ('${uuid()}', '${contractId}', ${paymentAmount}, '${paymentDate}', '${i + 1}차 기성', NOW()) ON CONFLICT DO NOTHING;`);
  }
}

// ============ 9. 거래처 (Client Companies) ============
addSection('거래처 (client_companies)');
const clientSet = new Set();
// 2025 계약에서 추출
for (const c of contracts2025) {
  clientSet.add(c.co);
}
// 과거 계약에서 추출
for (const r of allContracts) {
  if (r.company && r.company.trim()) clientSet.add(r.company.trim());
}
// 견적서에서 추출
for (const q of allQuotes) {
  if (q.company && q.company.trim().length >= 2) clientSet.add(q.company.trim());
}
for (const q of handcraftedQuotes) {
  clientSet.add(q.co);
}

for (const name of clientSet) {
  if (!name || name.length < 2) continue;
  addLine(`INSERT INTO client_companies (id, company_id, name, created_by, created_at, updated_at) VALUES ('${uuid()}', '${COMPANY_ID}', '${esc(name)}', '${ADMIN_USER_ID}', NOW(), NOW()) ON CONFLICT DO NOTHING;`);
}

// ============ 10. Sequences 초기값 ============
addSection('시퀀스 초기값');
const totalQuotes = allQuotes.length + handcraftedQuotes.length;
const totalContracts = contracts2025.length + Object.keys(yearCounters).reduce((sum, k) => sum + yearCounters[k], 0);
addLine(`INSERT INTO sequences (key, current_value) VALUES ('${COMPANY_ID}_quote', ${totalQuotes}) ON CONFLICT (key) DO UPDATE SET current_value = EXCLUDED.current_value;`);
addLine(`INSERT INTO sequences (key, current_value) VALUES ('${COMPANY_ID}_contract', ${totalContracts}) ON CONFLICT (key) DO UPDATE SET current_value = EXCLUDED.current_value;`);

// ============ 11. 메뉴 권한 ============
addSection('메뉴 권한 (menu_permissions) - 관리자 전체 권한');
const menus = ['dashboard', 'quotes', 'contracts', 'outsourcing', 'clients', 'documents', 'file_explorer', 'messenger', 'ai_search', 'settings', 'employees'];
for (const userId of [EASY_ADMIN_ID]) {
  for (const menu of menus) {
    addLine(`INSERT INTO menu_permissions (id, user_id, menu_key, can_view, can_create, can_edit, can_delete, created_at) VALUES ('${uuid()}', '${userId}', '${menu}', true, true, true, true, NOW()) ON CONFLICT DO NOTHING;`);
  }
}
// 직원은 기본 권한
for (const userId of [KIMYJ_ID, PARKSH_ID]) {
  for (const menu of menus) {
    const canEdit = ['dashboard', 'quotes', 'contracts', 'messenger', 'file_explorer'].includes(menu);
    addLine(`INSERT INTO menu_permissions (id, user_id, menu_key, can_view, can_create, can_edit, can_delete, created_at) VALUES ('${uuid()}', '${userId}', '${menu}', true, ${canEdit}, ${canEdit}, false, NOW()) ON CONFLICT DO NOTHING;`);
  }
}

// ============ Summary ============
addLine('');
addLine('-- ============================================');
addLine(`-- 완료: 회사 2, 부서 4, 사용자 4, 인건비 4, 경비 5`);
addLine(`-- 견적서 ${totalQuotes}건, 계약서 ${totalContracts}건`);
addLine(`-- 거래처 ${clientSet.size}건, 입금내역 다수`);
addLine('-- ============================================');

// 파일 저장
const outputFile = path.join(__dirname, 'supabase_full_seed.sql');
fs.writeFileSync(outputFile, sql, 'utf-8');

console.log('전체 시드 SQL 생성 완료!');
console.log(`파일: ${outputFile}`);
console.log(`크기: ${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB`);
console.log(`회사: 2, 부서: 4, 사용자: 4`);
console.log(`견적서: ${totalQuotes}건`);
console.log(`계약서: ${totalContracts}건`);
console.log(`거래처: ${clientSet.size}건`);
