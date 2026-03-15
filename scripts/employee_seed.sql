-- Employee Seed Data (auto-generated)
-- Password: changeme123
-- Total: 57 employees

DELETE FROM users WHERE username NOT IN ('admin');

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ochh10',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '임철희', '원장', '원장', 'employee', true,
  '2010-02-05', NULL,
  '기업은행/SC제일은행/우리은행', '165-073302-02-014/57220237058/1002-934-960706',
  '[{"school":"단국대학교","degree":"석사,박사수료","major":"건축공학과"}]'::jsonb,
  '["원가분석사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ohs17',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '임희상', '부원장', '건설사업부', 'employee', true,
  '2017-12-11', NULL,
  '기업은행', '010-2254-7662',
  '[{"school":"광운대학교","degree":"법학석사","major":"건설법무학"}]'::jsonb,
  '["원가분석사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'oso10',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이세연', '책임 연구원', '건설사업부', 'employee', true,
  '2010-12-27', NULL,
  '기업은행', '165-079571-01-014',
  '[{"school":"단국대학교","degree":"경영학석사","major":"부동산경영학과"}]'::jsonb,
  '["원가분석사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'boj12',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '박예지', '책임 연구원', '학술사업부', 'employee', true,
  '2012-02-01', NULL,
  '기업은행', '165-079570-01-011',
  '[{"school":"단국대학교","degree":"도시계획석사","major":"도시및부동산개발학과"}]'::jsonb,
  '["원가분석사","토목기사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'sjo13',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '석준영', '이사', '경영관리실', 'employee', true,
  '2013-09-02', NULL,
  '기업은행', '010-4743-1094',
  '[{"school":"군산여자상업고등학교","degree":null,"major":null}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'hnm18',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '황난미', '선임 연구원', '건설사업부', 'employee', true,
  '2018-02-01', NULL,
  '농협', '504-12-110201',
  '[{"school":"호원대학교","degree":"공학사","major":"식품공학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'omo15',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이명원', '연구위원 본부장', '학술사업부', 'employee', true,
  '2015-02-05', NULL,
  '국민은행', '232-21-0656-659',
  '[{"school":"단국대학교","degree":"도시계획학석사","major":"도시및부동산개발학과"}]'::jsonb,
  '["도시계획기사","컴퓨터그래픽스운용기능사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ohj19',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이형주', '이사장', '학술사업부', 'employee', true,
  '2019-01-02', NULL,
  '우리은행', '1002-742-533626',
  '[{"school":"단국대학교","degree":"부동산학박사","major":"도시계획 및 부동산학과"}]'::jsonb,
  '["공인중개사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'hjh19',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '한재희', '수석 연구원', '건설사업부', 'employee', true,
  '2019-09-02', NULL,
  '하나은행', '339-18-05122-3',
  '[{"school":"고려대학교","degree":"산업공학학사","major":"산업공학과"}]'::jsonb,
  '["공정분석 감정인"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'oth20',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이태형', '선임 연구원', '건설사업부', 'employee', true,
  '2020-09-01', NULL,
  '카카오뱅크', '3333-17-1423140',
  '[{"school":"충북대학교","degree":"공학석사","major":"건축공학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'gjj20',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '김종진', '이사', '개발사업부', 'employee', true,
  '2020-04-01', NULL,
  '신한은행', '110-007-662060',
  '[{"school":"서울시립대학교","degree":"공학사","major":"환경공학과"}]'::jsonb,
  '["원가분석사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'oom22',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이용민', '이사', '개발사업부', 'employee', true,
  '2022-09-01', NULL,
  '기업은행', '010-5002-5016/(398-044715-01-013)',
  '[{"school":"수원과학대학교","degree":"공업전문학사","major":"건축과"}]'::jsonb,
  '["건축산업기사","원가분석사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'bjh23',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '박종호', '책임 연구원', '학술사업부', 'employee', true,
  '2023-04-01', NULL,
  '기업은행', '165-084549-01-015',
  '[{"school":"복단대학교 대학원","degree":"경제학석사","major":"경제학과"}]'::jsonb,
  '["CFA"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'omh24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이민호', '선임 연구원', '학술사업부', 'employee', true,
  '2024-01-01', NULL,
  '국민은행', '592202-01-678189',
  '[{"school":"건국대학교","degree":"경영학박사","major":"경영학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ooo24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이예원', '주임연구원', '학술사업부', 'employee', true,
  '2024-01-01', NULL,
  '우리은행', '1002-496-960608',
  '[{"school":"상명대학교","degree":"이학사","major":"환경조경학과"}]'::jsonb,
  '["조경기사","도시계획기사","GTQ","컴퓨터활용능력2급","중등학교 정교사(2급)식물자원.조경"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'gjg24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '김재경', '선임연구원', '학술사업부', 'employee', true,
  '2024-02-01', NULL,
  '기업은행', '010-7188-2722',
  '[{"school":"숭실대학교대학원","degree":"이학석사","major":"정보통계.보험수리학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'oht24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '유환태', '고문', '고문', 'employee', true,
  '2024-01-01', NULL,
  'SC제일은행', '636-20-075090',
  '[{"school":"단국대학교","degree":"도시계획학석사","major":"도시및부동산개발학과"}]'::jsonb,
  '["주택관리사","공인중개사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'rho24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '라현옥', '', '', 'employee', true,
  '2024-03-01', NULL,
  '국민은행', '366502-01-067722',
  '[{"school":"신안산대학교","degree":"학사","major":"영어실무학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ohj24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '유현주', '주임연구원', '건설사업부', 'employee', true,
  '2024-06-01', NULL,
  '국민은행', '673602-04-043184',
  '[{"school":"경기대학교","degree":"경영학사","major":"회계세무·경영정보학부"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'bjo24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '박종은', '연구원', '건설사업부', 'employee', true,
  '2024-06-04', NULL,
  '우리은행', '1002-054-976461',
  '[{"school":"우송대학교","degree":"졸업예정","major":"철도건설시스템학부"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'otg24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '임태건', '연구원', '학술사업부', 'employee', true,
  '2024-07-01', NULL,
  NULL, NULL,
  '[{"school":"경기대학교","degree":null,"major":"경영학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'boch24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '박용철', '연구원', '건설사업부', 'employee', true,
  '2024-08-12', NULL,
  '하나은행', '299-910810-46707',
  '[{"school":"충북대학교","degree":"공학사","major":"건축공학과"}]'::jsonb,
  '["건축기사","측량기능사","정보처리기능사","컴퓨터활용능력1급"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'gchh24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '김충현', '연구원', '', 'employee', true,
  '2024-12-01', NULL,
  'SC제일은행', '27720068868',
  '[{"school":"동원대학교","degree":null,"major":"인터넷정보과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'gmg24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '강민기', '연구원', '학술사업부', 'employee', true,
  '2024-12-16', NULL,
  '기업', '531-045363-01-016',
  '[{"school":"동아대학교","degree":"경제학사","major":"금융학과"}]'::jsonb,
  '["공인중개사","투자자산운용사","컴퓨터활용능력1급"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'scho25',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '서창원', '연구위원', '학술사업부', 'employee', true,
  '2025-09-01', NULL,
  '카카오뱅크', '3333-09-1280549',
  '[{"school":"단국대학교","degree":"도시및지역계획학박사","major":"도시계획및무동산학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'hog21',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '한인규', '이사', '개발사업부', 'employee', false,
  '2021-01-18', '2025-03-31',
  '하나은행', '562-910393-06407',
  '[{"school":"단국대학교","degree":"공학석사","major":"건축시스템경영학"}]'::jsonb,
  '["건축사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'bgb18',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '박길범', '책임 연구원', '건설사업부', 'employee', false,
  '2018-01-15', '2025-07-11',
  '국민은행', '821102-04-106677',
  '[{"school":"충북대학교","degree":"공학석사","major":"건축공학과"}]'::jsonb,
  '["건축기사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ggr24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '김가람', '연구원', '건설사업부', 'employee', false,
  '2024-08-22', '2025-09-30',
  '농협', '302-1679-3390-01',
  '[{"school":"청주대학교","degree":"경영학사","major":"글로벌경제통상학부"}]'::jsonb,
  '["실내건축기능사","전산응용건축제도기능사","정보기기운용기능사","전기기능사","승강기기능사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'oht19',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '유환태', '대표', '대표이사', 'employee', true,
  '2019-04-01', NULL,
  'SC제일은행', '636-20-075090',
  '[{"school":"단국대학교","degree":"도시계획학석사","major":"도시및부동산개발학과"}]'::jsonb,
  '["주택관리사","공인중개사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'sgh19',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '서규희', '팀장', '인증', 'employee', true,
  '2019-04-01', NULL,
  '우리은행', '1002-645-122304',
  '[{"school":"한양여자대학교","degree":"학사","major":"인테리어디자인과"}]'::jsonb,
  '["ATC1급","전산응용건축제도기능사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ghj19',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '김헌중', '총괄이사 연구소장', '계획', 'employee', true,
  '2019-07-22', NULL,
  '우리은행', '1002-029-642009',
  '[{"school":"인하대학교","degree":"공학석사","major":"건축공학과"}]'::jsonb,
  '["건축설비기사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ochh21',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '임철희', '총괄사장', '전략기획본부', 'employee', true,
  '2021-01-01', NULL,
  '우리은행', '1002-934-960706',
  '[{"school":"단국대학교","degree":"석사,박사수료","major":"건축공학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ond21',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '윤남돈', '본부장', '계획', 'employee', true,
  '2021-01-04', NULL,
  '국민은행', '519702-01-164562',
  '[{"school":"관동대학교","degree":"공학사","major":"건축학부"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'gjb21',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '김지빈', '주임', '경영관리실', 'employee', true,
  '2021-01-18', NULL,
  '국민은행', '669702-04-046030',
  '[{"school":"강남대학교","degree":"행정학사","major":"행정학과"}]'::jsonb,
  '["전산회계1급","FAT 1급"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'chms21',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '최문석', '대리', '교육환경', 'employee', true,
  '2021-01-25', NULL,
  '하나은행', '468-910197-45507',
  '[{"school":"단국대학교","degree":"공학사","major":"에너지공학과"}]'::jsonb,
  '["에너지관리기사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ogj21',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이강준', '사장', '사장', 'employee', true,
  '2021-06-01', NULL,
  '국민은행', '290-21-0269-058',
  '[{"school":"단국대학교","degree":"부동산학석사","major":"부동산경영학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'jgo23',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '정경원', '사원', '인증', 'employee', true,
  '2023-12-04', NULL,
  '카카오뱅크', '3333-26-5895230',
  '[{"school":"경동대학교","degree":"공학사","major":"건축디자인학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ggo24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '김규완', '사원', '인증', 'employee', true,
  '2024-01-02', NULL,
  '기업은행', '010-8583-7150/(524-050987-01-015)',
  '[{"school":"강원대학교","degree":"공학사","major":"건축디자인학과"}]'::jsonb,
  '["건축기사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ochh24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이충환', '사원', '인증', 'employee', true,
  '2024-02-19', NULL,
  '국민은행', '914802-01-578179',
  '[{"school":"대림대학교","degree":"실내디자인전문학사","major":"실내디자인과"}]'::jsonb,
  '["실내건축산업기사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'joj24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '정의정', '사원', '인증', 'employee', true,
  '2024-09-23', NULL,
  '우리은행', '1002-640-987890',
  '[{"school":"한국방송통신대학교","degree":"언론학사","major":"미디어영상학과"}]'::jsonb,
  '["도배기능사","실내건축기사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'sjh24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '신준호', '사원', '인증', 'employee', true,
  '2024-12-09', NULL,
  '신한은행', '110-423-390354',
  '[{"school":"두원공과대학교","degree":"공업전문학사","major":"건축디자인학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ojo25',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이재욱', '사원', '인증', 'employee', true,
  '2025-01-01', NULL,
  '국민은행', '942902-00-962327',
  '[{"school":"동서울대학교","degree":"공업전문학사","major":"건축학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'bsb25',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '박수빈', '대리', '교육환경', 'employee', true,
  '2025-01-01', NULL,
  '신한은행', '110-466-909892',
  '[{"school":"협성대학교","degree":"공학사","major":"건축공학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ochs25',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이충신', '본부장', '인증', 'employee', true,
  '2025-01-01', NULL,
  '국민은행', '431825-90-110921',
  '[{"school":"건국대학교","degree":"공학사","major":"건축공학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'osg25',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이상기', '사장', '사장', 'employee', true,
  '2025-02-01', NULL,
  '국민은행', '699202-01-084216',
  '[{"school":"단국대학교","degree":"사회복지학석사","major":"사회복지학과"}]'::jsonb,
  '["주택관리사","공인중개사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'bjo25',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '배진웅', '대리', '대리', 'employee', true,
  '2025-04-01', NULL,
  '신한은행', '110-444-869437',
  '[{"school":"군산대학교","degree":"공학사","major":"건축해양건설융합공학부"}]'::jsonb,
  '["녹색건축인증전무가 자격인정서"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ochg25',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '윤창기', '주임', '주임', 'employee', true,
  '2025-08-04', NULL,
  '신한은행', '110-447-607291',
  '[{"school":"경동대학교","degree":"공학사","major":"건축디자인학과"}]'::jsonb,
  '["녹색건축인증전무가 자격인정서"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'oj25',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이정', '사원', '사원', 'employee', true,
  '2025-08-04', NULL,
  '국민은행', '757102-04-410558',
  '[{"school":"남서울대학교","degree":"공학사","major":"건축공학과"}]'::jsonb,
  '["건축기사","건축설비기사","건설안전기사","BIM Modeling"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'shs25',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '서호수', '사장', '사장', 'employee', true,
  '2025-09-01', NULL,
  '국민은행', '699206-202479',
  '[{"school":"성균관대학교","degree":"공학석사","major":"U-City공학과"}]'::jsonb,
  '["건축사","건축기사1급"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'hdj20',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '홍동재', '대리', '인증', 'employee', false,
  '2020-11-26', '2024-01-31',
  '국민은행', '933502-00-144752',
  '[{"school":"한라대학교","degree":"공학사","major":"건축학과"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'hchs20',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '홍창성', '주임', '인증', 'employee', false,
  '2020-11-11', '2024-03-29',
  '국민은행', '438902-01-376622',
  '[{"school":"동서울대학교","degree":"공학사","major":"건축학과"}]'::jsonb,
  '["전산응용건축제도기능사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'jjo24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '정지은', '사원', '인증', 'employee', false,
  '2024-03-12', '2024-05-10',
  NULL, NULL,
  '[{"school":"백석대학교","degree":"학사","major":"경찰학"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'ojg24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '이정근', '사원', '인증', 'employee', false,
  '2024-09-23', '2024-12-20',
  '국민은행', '313502-04-172049',
  '[{"school":"세명대학교","degree":"관광학사","major":"호텔관광경영학과"}]'::jsonb,
  '["건축기사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'gjh19',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '김재현', '과장', '전략기획본부', 'employee', false,
  '2019-05-01', '2024-12-31',
  '기업은행', '643-026942-01-016',
  '[{"school":"호서대학교","degree":"공학석사","major":"안전환경기술융합학"}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'gos23',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '김연수', '사원', '인증', 'employee', false,
  '2023-09-11', '2024-12-31',
  '국민은행', '592802-04-207173',
  '[{"school":"호서대학교","degree":"공학석사","major":"건축공학과"}]'::jsonb,
  '["건축기사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'hog21',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '한인규', '기술이사', '교육환경', 'employee', false,
  '2021-09-01', '2025-04-30',
  '하나은행', '562-910393-06407',
  '[{"school":"단국대학교","degree":"공학석사","major":"건축시스템경영학과"}]'::jsonb,
  '["건축사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();

INSERT INTO users (company_id, username, password_hash, name, rank, position, role, is_active, hire_date, resignation_date, bank_name, bank_account, education, certifications) VALUES
(
  'a0000000-0000-0000-0000-000000000001', 'chbo24',
  '$2a$10$PCD2G4DGdP3UC102waE6P.cHaJjYVOyjAWEQlU8wA6XzTZzBNNMsy',
  '최보은', '과장', '인증', 'employee', false,
  '2024-03-04', '2025-06-26',
  '우리은행', '1002-858-537431',
  '[{"school":"영남대학교","degree":"공학석사 (박사수료)","major":"건축학과"}]'::jsonb,
  '["건축설비기사"]'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  company_id=EXCLUDED.company_id, name=EXCLUDED.name, rank=EXCLUDED.rank, position=EXCLUDED.position,
  is_active=EXCLUDED.is_active, hire_date=EXCLUDED.hire_date, resignation_date=EXCLUDED.resignation_date,
  bank_name=EXCLUDED.bank_name, bank_account=EXCLUDED.bank_account,
  education=EXCLUDED.education, certifications=EXCLUDED.certifications, updated_at=NOW();
