import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// 데이터 스토어 타입
interface StoreSchema {
  users: any[];
  companies: any[];
  departments: any[];
  menuPermissions: any[];
  settings: Record<string, any>;
  // 견적/계약 관련
  quotes: any[];
  quoteLaborItems: any[];
  quoteExpenseItems: any[];
  contracts: any[];
  contractHistories: any[];
  contractPayments: any[];
  // 양식 설정
  laborGrades: any[];
  expenseCategories: any[];
  // 문서 템플릿 및 생성 문서
  documentTemplates: any[];
  generatedDocuments: any[];
  // 일련번호
  sequences: Record<string, number>;
}

// 앱 설정 스토어 (데이터 경로 저장용 - 항상 기본 위치에 저장)
let configStore: Store<{ dataPath: string | null }> | null = null;

// 데이터 스토어 인스턴스
let store: Store<StoreSchema> | null = null;

// 현재 데이터 경로
let currentDataPath: string | null = null;

// 설정 스토어 초기화
function initConfigStore(): Store<{ dataPath: string | null }> {
  if (!configStore) {
    configStore = new Store<{ dataPath: string | null }>({
      name: 'easycompany-config',
      defaults: {
        dataPath: null, // null이면 기본 경로 사용
      },
    });
  }
  return configStore;
}

// 데이터 경로 가져오기
export function getDataPath(): string {
  const config = initConfigStore();
  const customPath = config.get('dataPath');

  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  // 기본 경로: AppData/Roaming/easycompany-mainboard/data
  return path.join(app.getPath('userData'), 'data');
}

// 데이터 경로 설정
export function setDataPath(newPath: string): { success: boolean; error?: string } {
  try {
    // 경로 검증
    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath, { recursive: true });
    }

    // 쓰기 권한 확인
    const testFile = path.join(newPath, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    // 설정 저장
    const config = initConfigStore();
    config.set('dataPath', newPath);

    // 스토어 재초기화
    store = null;
    currentDataPath = newPath;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 데이터 내보내기
export function exportData(exportPath: string): { success: boolean; error?: string } {
  try {
    if (!store) {
      return { success: false, error: '데이터베이스가 초기화되지 않았습니다.' };
    }

    const data = store.store;
    const exportFile = path.join(exportPath, `easycompany-backup-${Date.now()}.json`);
    fs.writeFileSync(exportFile, JSON.stringify(data, null, 2), 'utf-8');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 데이터 가져오기
export function importData(importFile: string): { success: boolean; error?: string } {
  try {
    if (!fs.existsSync(importFile)) {
      return { success: false, error: '파일을 찾을 수 없습니다.' };
    }

    const data = JSON.parse(fs.readFileSync(importFile, 'utf-8'));

    if (!store) {
      return { success: false, error: '데이터베이스가 초기화되지 않았습니다.' };
    }

    // 기존 데이터 백업
    const backupPath = path.join(getDataPath(), `backup-before-import-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(store.store, null, 2), 'utf-8');

    // 데이터 가져오기
    store.store = data;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function initDatabase(customPath?: string): Store<StoreSchema> {
  const dataPath = customPath || getDataPath();
  currentDataPath = dataPath;

  // 데이터 폴더 생성
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }

  store = new Store<StoreSchema>({
    name: 'easycompany-data',
    cwd: dataPath, // 커스텀 경로 사용
    defaults: {
      users: [],
      companies: [],
      departments: [],
      menuPermissions: [],
      settings: {},
      // 견적/계약 관련
      quotes: [],
      quoteLaborItems: [],
      quoteExpenseItems: [],
      contracts: [],
      contractHistories: [],
      contractPayments: [],
      // 양식 설정
      laborGrades: [],
      expenseCategories: [],
      // 문서 템플릿 및 생성 문서
      documentTemplates: [],
      generatedDocuments: [],
      // 일련번호 (회사별)
      sequences: {},
    },
  });

  // 기본 회사 생성 (없는 경우)
  const companies = store.get('companies', []);
  let defaultCompanyId: string | null = null;

  if (companies.length === 0) {
    defaultCompanyId = uuidv4();
    const defaultCompany = {
      id: defaultCompanyId,
      name: '(주)이지컨설턴트',
      business_number: '000-00-00000',
      address: null,
      phone: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.set('companies', [defaultCompany]);
    console.log('Default company created: (주)이지컨설턴트');

    // 기본 부서 생성
    const defaultDepartment = {
      id: uuidv4(),
      company_id: defaultCompanyId,
      name: '학술사업부',
      description: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.set('departments', [defaultDepartment]);
    console.log('Default department created: 학술사업부');

    // 기본 인건비 등급 생성 (이지컨설턴트 양식 기준)
    const defaultLaborGrades = [
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        name: '책임연구원',
        monthly_rate: 3300000,
        daily_rate: null,
        description: null,
        sort_order: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        name: '연구원',
        monthly_rate: 2530000,
        daily_rate: null,
        description: null,
        sort_order: 2,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        name: '선임연구보조',
        monthly_rate: 1690000,
        daily_rate: null,
        description: null,
        sort_order: 3,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        name: '연구보조',
        monthly_rate: 1268000,
        daily_rate: null,
        description: null,
        sort_order: 4,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    store.set('laborGrades', defaultLaborGrades);
    console.log('Default labor grades created: 책임연구원, 연구원, 선임연구보조, 연구보조');

    // 기본 경비 항목 생성 (이지컨설턴트 양식 기준)
    const defaultExpenseCategories = [
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        name: '사무용품비',
        calculation_type: 'manual',
        base_field: null,
        default_rate: null,
        is_active: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        name: '출장비',
        calculation_type: 'manual',
        base_field: null,
        default_rate: null,
        is_active: true,
        sort_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        name: '회의비',
        calculation_type: 'manual',
        base_field: null,
        default_rate: null,
        is_active: true,
        sort_order: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        name: '제경비',
        calculation_type: 'percentage',
        base_field: 'labor_total',
        default_rate: 0.1,
        is_active: true,
        sort_order: 4,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        name: '기술료',
        calculation_type: 'percentage',
        base_field: 'labor_total',
        default_rate: 0.2,
        is_active: true,
        sort_order: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    store.set('expenseCategories', defaultExpenseCategories);
    console.log('Default expense categories created: 사무용품비, 출장비, 회의비, 제경비, 기술료');

    // ========================================
    // 샘플 견적서 데이터 생성
    // ========================================
    const sampleQuotes = [
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        quote_number: 'Q-2024-0001',
        client_company: '서울대학교',
        client_business_number: '119-82-00001',
        client_contact_name: '김교수',
        client_contact_phone: '02-880-1234',
        client_contact_email: 'kim@snu.ac.kr',
        service_name: '2024년 교육혁신 연구용역',
        service_type: 'research',
        description: '교육혁신 방안 연구 및 정책 제안',
        quote_date: '2024-01-15',
        valid_until: '2024-02-15',
        labor_total: 15000000,
        expense_total: 5000000,
        total_amount: 20000000,
        vat_amount: 2000000,
        grand_total: 22000000,
        status: 'converted',
        notes: '3차 수정본',
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        quote_number: 'Q-2024-0002',
        client_company: '한국과학기술원',
        client_business_number: '314-82-00002',
        client_contact_name: '이연구원',
        client_contact_phone: '042-350-2000',
        client_contact_email: 'lee@kaist.ac.kr',
        service_name: 'AI 기반 학습 분석 시스템 개발',
        service_type: 'service',
        description: 'AI 학습 분석 시스템 설계 및 개발',
        quote_date: '2024-02-01',
        valid_until: '2024-03-01',
        labor_total: 25000000,
        expense_total: 8000000,
        total_amount: 33000000,
        vat_amount: 3300000,
        grand_total: 36300000,
        status: 'submitted',
        notes: '',
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        quote_number: 'Q-2024-0003',
        client_company: '교육부',
        client_business_number: '110-82-00003',
        client_contact_name: '박사무관',
        client_contact_phone: '044-203-6000',
        client_contact_email: 'park@moe.go.kr',
        service_name: '2024년 교육정책 평가 연구',
        service_type: 'consulting',
        description: '교육정책 효과성 평가 및 개선방안 도출',
        quote_date: '2024-02-20',
        valid_until: '2024-03-20',
        labor_total: 45000000,
        expense_total: 15000000,
        total_amount: 60000000,
        vat_amount: 6000000,
        grand_total: 66000000,
        status: 'draft',
        notes: '초안 작성 중',
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    store.set('quotes', sampleQuotes);
    store.set('sequences', { [`${defaultCompanyId}_quote`]: 3 });
    console.log('Sample quotes created: 3 quotes');

    // ========================================
    // 샘플 계약서 데이터 생성
    // ========================================
    const contract1Id = uuidv4();
    const contract2Id = uuidv4();
    const contract3Id = uuidv4();
    const contract4Id = uuidv4();

    const sampleContracts = [
      {
        id: contract1Id,
        company_id: defaultCompanyId,
        quote_id: sampleQuotes[0].id,
        contract_number: 'C-2024-0001',
        contract_code: 'EDU-2024-001',
        client_company: '서울대학교',
        client_business_number: '119-82-00001',
        client_contact_name: '김교수',
        client_contact_phone: '02-880-1234',
        client_contact_email: 'kim@snu.ac.kr',
        service_name: '2024년 교육혁신 연구용역',
        contract_type: 'research',
        description: '교육혁신 방안 연구 및 정책 제안',
        contract_start_date: '2024-02-01',
        contract_end_date: '2024-12-31',
        contract_amount: 20000000,
        vat_amount: 2000000,
        total_amount: 22000000,
        received_amount: 11000000,
        remaining_amount: 11000000,
        progress: 'in_progress',
        notes: '선금 50% 입금 완료',
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: contract2Id,
        company_id: defaultCompanyId,
        quote_id: null,
        contract_number: 'C-2024-0002',
        contract_code: 'MAINT-2024-001',
        client_company: '경기도교육청',
        client_business_number: '127-83-00004',
        client_contact_name: '최담당',
        client_contact_phone: '031-820-0000',
        client_contact_email: 'choi@goe.go.kr',
        service_name: '교육정보시스템 유지보수',
        contract_type: 'maintenance',
        description: '2024년 연간 시스템 유지보수 계약',
        contract_start_date: '2024-01-01',
        contract_end_date: '2024-12-31',
        contract_amount: 36000000,
        vat_amount: 3600000,
        total_amount: 39600000,
        received_amount: 39600000,
        remaining_amount: 0,
        progress: 'in_progress',
        notes: '연간 계약, 전액 선금',
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: contract3Id,
        company_id: defaultCompanyId,
        quote_id: null,
        contract_number: 'C-2024-0003',
        contract_code: 'CONS-2024-001',
        client_company: '인천광역시',
        client_business_number: '120-83-00005',
        client_contact_name: '정주무관',
        client_contact_phone: '032-120-0000',
        client_contact_email: 'jung@incheon.go.kr',
        service_name: '스마트시티 교육플랫폼 컨설팅',
        contract_type: 'consulting',
        description: '스마트시티 교육플랫폼 구축 컨설팅',
        contract_start_date: '2024-03-01',
        contract_end_date: '2024-08-31',
        contract_amount: 50000000,
        vat_amount: 5000000,
        total_amount: 55000000,
        received_amount: 27500000,
        remaining_amount: 27500000,
        progress: 'contract_signed',
        notes: '착수금 50% 입금',
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: contract4Id,
        company_id: defaultCompanyId,
        quote_id: null,
        contract_number: 'C-2023-0015',
        contract_code: 'EDU-2023-015',
        client_company: '부산광역시교육청',
        client_business_number: '201-83-00006',
        client_contact_name: '한과장',
        client_contact_phone: '051-860-0000',
        client_contact_email: 'han@pen.go.kr',
        service_name: '2023년 교육과정 개편 연구',
        contract_type: 'research',
        description: '교육과정 개편 방안 연구',
        contract_start_date: '2023-04-01',
        contract_end_date: '2023-12-31',
        contract_amount: 30000000,
        vat_amount: 3000000,
        total_amount: 33000000,
        received_amount: 33000000,
        remaining_amount: 0,
        progress: 'completed',
        notes: '완료, 검수 승인',
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    store.set('contracts', sampleContracts);

    // 샘플 계약 입금 내역
    const samplePayments = [
      {
        id: uuidv4(),
        contract_id: contract1Id,
        amount: 11000000,
        payment_date: '2024-02-05',
        payment_type: 'advance',
        description: '선금 50%',
        created_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        contract_id: contract2Id,
        amount: 39600000,
        payment_date: '2024-01-10',
        payment_type: 'full',
        description: '연간 계약 전액',
        created_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        contract_id: contract3Id,
        amount: 27500000,
        payment_date: '2024-03-05',
        payment_type: 'advance',
        description: '착수금 50%',
        created_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        contract_id: contract4Id,
        amount: 16500000,
        payment_date: '2023-04-10',
        payment_type: 'advance',
        description: '선금 50%',
        created_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        contract_id: contract4Id,
        amount: 16500000,
        payment_date: '2023-12-20',
        payment_type: 'final',
        description: '잔금 50%',
        created_at: new Date().toISOString(),
      },
    ];
    store.set('contractPayments', samplePayments);

    // 샘플 계약 변경 이력
    const sampleHistories = [
      {
        id: uuidv4(),
        contract_id: contract1Id,
        change_type: 'progress',
        old_value: 'contract_signed',
        new_value: 'in_progress',
        changed_by: null,
        note: '연구 착수',
        created_at: '2024-02-01T09:00:00.000Z',
      },
      {
        id: uuidv4(),
        contract_id: contract3Id,
        change_type: 'created',
        old_value: null,
        new_value: 'contract_signed',
        changed_by: null,
        note: '계약 체결',
        created_at: '2024-03-01T09:00:00.000Z',
      },
      {
        id: uuidv4(),
        contract_id: contract4Id,
        change_type: 'progress',
        old_value: 'in_progress',
        new_value: 'completed',
        changed_by: null,
        note: '최종 검수 완료',
        created_at: '2023-12-28T09:00:00.000Z',
      },
    ];
    store.set('contractHistories', sampleHistories);

    // sequences 업데이트
    const sequences = store.get('sequences', {});
    sequences[`${defaultCompanyId}_contract`] = 4;
    store.set('sequences', sequences);
    console.log('Sample contracts created: 4 contracts with payments and histories');
  } else {
    defaultCompanyId = companies[0].id;

    // 기존 DB에도 샘플 데이터가 없으면 추가
    const existingQuotes = store.get('quotes', []);
    const existingContracts = store.get('contracts', []);

    if (existingQuotes.length === 0 && existingContracts.length === 0) {
      console.log('Adding sample data to existing database...');

      // 샘플 견적서 데이터
      const sampleQuotes = [
        {
          id: uuidv4(),
          company_id: defaultCompanyId,
          quote_number: 'Q-2024-0001',
          client_company: '서울대학교',
          client_business_number: '119-82-00001',
          client_contact_name: '김교수',
          client_contact_phone: '02-880-1234',
          client_contact_email: 'kim@snu.ac.kr',
          service_name: '2024년 교육혁신 연구용역',
          service_type: 'research',
          description: '교육혁신 방안 연구 및 정책 제안',
          quote_date: '2024-01-15',
          valid_until: '2024-02-15',
          labor_total: 15000000,
          expense_total: 5000000,
          total_amount: 20000000,
          vat_amount: 2000000,
          grand_total: 22000000,
          status: 'converted',
          notes: '3차 수정본',
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: uuidv4(),
          company_id: defaultCompanyId,
          quote_number: 'Q-2024-0002',
          client_company: '한국과학기술원',
          client_business_number: '314-82-00002',
          client_contact_name: '이연구원',
          client_contact_phone: '042-350-2000',
          client_contact_email: 'lee@kaist.ac.kr',
          service_name: 'AI 기반 학습 분석 시스템 개발',
          service_type: 'service',
          description: 'AI 학습 분석 시스템 설계 및 개발',
          quote_date: '2024-02-01',
          valid_until: '2024-03-01',
          labor_total: 25000000,
          expense_total: 8000000,
          total_amount: 33000000,
          vat_amount: 3300000,
          grand_total: 36300000,
          status: 'submitted',
          notes: '',
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: uuidv4(),
          company_id: defaultCompanyId,
          quote_number: 'Q-2024-0003',
          client_company: '교육부',
          client_business_number: '110-82-00003',
          client_contact_name: '박사무관',
          client_contact_phone: '044-203-6000',
          client_contact_email: 'park@moe.go.kr',
          service_name: '2024년 교육정책 평가 연구',
          service_type: 'consulting',
          description: '교육정책 효과성 평가 및 개선방안 도출',
          quote_date: '2024-02-20',
          valid_until: '2024-03-20',
          labor_total: 45000000,
          expense_total: 15000000,
          total_amount: 60000000,
          vat_amount: 6000000,
          grand_total: 66000000,
          status: 'draft',
          notes: '초안 작성 중',
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      store.set('quotes', sampleQuotes);

      // 샘플 계약서 데이터
      const contract1Id = uuidv4();
      const contract2Id = uuidv4();
      const contract3Id = uuidv4();
      const contract4Id = uuidv4();

      const sampleContracts = [
        {
          id: contract1Id,
          company_id: defaultCompanyId,
          quote_id: sampleQuotes[0].id,
          contract_number: 'C-2024-0001',
          contract_code: 'EDU-2024-001',
          client_company: '서울대학교',
          client_business_number: '119-82-00001',
          client_contact_name: '김교수',
          client_contact_phone: '02-880-1234',
          client_contact_email: 'kim@snu.ac.kr',
          service_name: '2024년 교육혁신 연구용역',
          contract_type: 'research',
          description: '교육혁신 방안 연구 및 정책 제안',
          contract_start_date: '2024-02-01',
          contract_end_date: '2024-12-31',
          contract_amount: 20000000,
          vat_amount: 2000000,
          total_amount: 22000000,
          received_amount: 11000000,
          remaining_amount: 11000000,
          progress: 'in_progress',
          notes: '선금 50% 입금 완료',
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: contract2Id,
          company_id: defaultCompanyId,
          quote_id: null,
          contract_number: 'C-2024-0002',
          contract_code: 'MAINT-2024-001',
          client_company: '경기도교육청',
          client_business_number: '127-83-00004',
          client_contact_name: '최담당',
          client_contact_phone: '031-820-0000',
          client_contact_email: 'choi@goe.go.kr',
          service_name: '교육정보시스템 유지보수',
          contract_type: 'maintenance',
          description: '2024년 연간 시스템 유지보수 계약',
          contract_start_date: '2024-01-01',
          contract_end_date: '2024-12-31',
          contract_amount: 36000000,
          vat_amount: 3600000,
          total_amount: 39600000,
          received_amount: 39600000,
          remaining_amount: 0,
          progress: 'in_progress',
          notes: '연간 계약, 전액 선금',
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: contract3Id,
          company_id: defaultCompanyId,
          quote_id: null,
          contract_number: 'C-2024-0003',
          contract_code: 'CONS-2024-001',
          client_company: '인천광역시',
          client_business_number: '120-83-00005',
          client_contact_name: '정주무관',
          client_contact_phone: '032-120-0000',
          client_contact_email: 'jung@incheon.go.kr',
          service_name: '스마트시티 교육플랫폼 컨설팅',
          contract_type: 'consulting',
          description: '스마트시티 교육플랫폼 구축 컨설팅',
          contract_start_date: '2024-03-01',
          contract_end_date: '2024-08-31',
          contract_amount: 50000000,
          vat_amount: 5000000,
          total_amount: 55000000,
          received_amount: 27500000,
          remaining_amount: 27500000,
          progress: 'contract_signed',
          notes: '착수금 50% 입금',
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: contract4Id,
          company_id: defaultCompanyId,
          quote_id: null,
          contract_number: 'C-2023-0015',
          contract_code: 'EDU-2023-015',
          client_company: '부산광역시교육청',
          client_business_number: '201-83-00006',
          client_contact_name: '한과장',
          client_contact_phone: '051-860-0000',
          client_contact_email: 'han@pen.go.kr',
          service_name: '2023년 교육과정 개편 연구',
          contract_type: 'research',
          description: '교육과정 개편 방안 연구',
          contract_start_date: '2023-04-01',
          contract_end_date: '2023-12-31',
          contract_amount: 30000000,
          vat_amount: 3000000,
          total_amount: 33000000,
          received_amount: 33000000,
          remaining_amount: 0,
          progress: 'completed',
          notes: '완료, 검수 승인',
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      store.set('contracts', sampleContracts);

      // 샘플 입금 내역
      const samplePayments = [
        {
          id: uuidv4(),
          contract_id: contract1Id,
          amount: 11000000,
          payment_date: '2024-02-05',
          payment_type: 'advance',
          description: '선금 50%',
          created_at: new Date().toISOString(),
        },
        {
          id: uuidv4(),
          contract_id: contract2Id,
          amount: 39600000,
          payment_date: '2024-01-10',
          payment_type: 'full',
          description: '연간 계약 전액',
          created_at: new Date().toISOString(),
        },
        {
          id: uuidv4(),
          contract_id: contract3Id,
          amount: 27500000,
          payment_date: '2024-03-05',
          payment_type: 'advance',
          description: '착수금 50%',
          created_at: new Date().toISOString(),
        },
        {
          id: uuidv4(),
          contract_id: contract4Id,
          amount: 16500000,
          payment_date: '2023-04-10',
          payment_type: 'advance',
          description: '선금 50%',
          created_at: new Date().toISOString(),
        },
        {
          id: uuidv4(),
          contract_id: contract4Id,
          amount: 16500000,
          payment_date: '2023-12-20',
          payment_type: 'final',
          description: '잔금 50%',
          created_at: new Date().toISOString(),
        },
      ];
      store.set('contractPayments', samplePayments);

      // 샘플 변경 이력
      const sampleHistories = [
        {
          id: uuidv4(),
          contract_id: contract1Id,
          change_type: 'progress',
          old_value: 'contract_signed',
          new_value: 'in_progress',
          changed_by: null,
          note: '연구 착수',
          created_at: '2024-02-01T09:00:00.000Z',
        },
        {
          id: uuidv4(),
          contract_id: contract3Id,
          change_type: 'created',
          old_value: null,
          new_value: 'contract_signed',
          changed_by: null,
          note: '계약 체결',
          created_at: '2024-03-01T09:00:00.000Z',
        },
        {
          id: uuidv4(),
          contract_id: contract4Id,
          change_type: 'progress',
          old_value: 'in_progress',
          new_value: 'completed',
          changed_by: null,
          note: '최종 검수 완료',
          created_at: '2023-12-28T09:00:00.000Z',
        },
      ];
      store.set('contractHistories', sampleHistories);

      // sequences 업데이트
      const sequences = store.get('sequences', {});
      sequences[`${defaultCompanyId}_quote`] = 3;
      sequences[`${defaultCompanyId}_contract`] = 4;
      store.set('sequences', sequences);

      console.log('Sample data added to existing database');
    }
  }

  // 기본 슈퍼관리자 계정 생성 (없는 경우)
  const users = store.get('users', []);
  const superAdmin = users.find((u: any) => u.role === 'super_admin');

  if (!superAdmin) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    const newSuperAdmin = {
      id: uuidv4(),
      company_id: null,
      department_id: null,
      username: 'admin',
      password_hash: passwordHash,
      name: '슈퍼관리자',
      email: null,
      role: 'super_admin',
      is_active: true,
      last_login: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 회사 관리자도 없으면 함께 생성
    const companyAdmin = users.find((u: any) => u.role === 'company_admin');
    const newUsers: any[] = [newSuperAdmin];

    if (!companyAdmin && defaultCompanyId) {
      const companyAdminHash = bcrypt.hashSync('easy123', 10);
      const newCompanyAdmin = {
        id: uuidv4(),
        company_id: defaultCompanyId,
        department_id: null,
        username: 'easyadmin',
        password_hash: companyAdminHash,
        name: '이지컨설턴트 관리자',
        email: null,
        role: 'company_admin',
        is_active: true,
        last_login: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      newUsers.push(newCompanyAdmin);
      console.log('Default company admin created: easyadmin / easy123');
    }

    store.set('users', [...users, ...newUsers]);
    console.log('Default super admin created: admin / admin123');
  }

  console.log('Database initialized');
  return store;
}

export function getDatabase(): Store<StoreSchema> {
  if (!store) {
    throw new Error('Database not initialized');
  }
  return store;
}

export function closeDatabase(): void {
  store = null;
}

// 데이터베이스 초기화 (모든 데이터 삭제 후 기본값으로 재설정)
export function clearDatabase(): void {
  if (!store) {
    throw new Error('Database not initialized');
  }

  // 모든 데이터 초기화
  store.clear();

  // 기본 회사 생성 (이지컨설턴트)
  const defaultCompanyId = uuidv4();
  const defaultCompany = {
    id: defaultCompanyId,
    name: '(주)이지컨설턴트',
    business_number: '000-00-00000',
    address: null,
    phone: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.set('companies', [defaultCompany]);

  // 기본 부서 생성
  const defaultDepartments = [
    {
      id: uuidv4(),
      company_id: defaultCompanyId,
      name: '학술사업부',
      description: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  store.set('departments', defaultDepartments);

  // 기본 슈퍼관리자 계정 생성
  const passwordHash = bcrypt.hashSync('admin123', 10);
  const superAdmin = {
    id: uuidv4(),
    company_id: null,
    department_id: null,
    username: 'admin',
    password_hash: passwordHash,
    name: '슈퍼관리자',
    email: null,
    role: 'super_admin',
    is_active: true,
    last_login: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 이지컨설턴트 회사 관리자 계정 생성
  const companyAdminHash = bcrypt.hashSync('easy123', 10);
  const companyAdmin = {
    id: uuidv4(),
    company_id: defaultCompanyId,
    department_id: null,
    username: 'easyadmin',
    password_hash: companyAdminHash,
    name: '이지컨설턴트 관리자',
    email: null,
    role: 'company_admin',
    is_active: true,
    last_login: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  store.set('users', [superAdmin, companyAdmin]);
  store.set('menuPermissions', []);
  store.set('settings', {});

  // 견적/계약 관련 초기화
  store.set('quotes', []);
  store.set('quoteLaborItems', []);
  store.set('quoteExpenseItems', []);
  store.set('contracts', []);
  store.set('contractHistories', []);
  store.set('contractPayments', []);
  // 문서 템플릿 및 생성 문서
  store.set('documentTemplates', []);
  store.set('generatedDocuments', []);
  store.set('sequences', {});

  // 기본 인건비 등급 생성
  const defaultLaborGrades = [
    {
      id: uuidv4(),
      company_id: defaultCompanyId,
      name: '책임연구원',
      monthly_rate: 3300000,
      daily_rate: null,
      description: null,
      sort_order: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      company_id: defaultCompanyId,
      name: '연구원',
      monthly_rate: 2530000,
      daily_rate: null,
      description: null,
      sort_order: 2,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      company_id: defaultCompanyId,
      name: '선임연구보조',
      monthly_rate: 1690000,
      daily_rate: null,
      description: null,
      sort_order: 3,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      company_id: defaultCompanyId,
      name: '연구보조',
      monthly_rate: 1268000,
      daily_rate: null,
      description: null,
      sort_order: 4,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  store.set('laborGrades', defaultLaborGrades);

  // 기본 경비 항목 생성
  const defaultExpenseCategories = [
    {
      id: uuidv4(),
      company_id: defaultCompanyId,
      name: '사무용품비',
      calculation_type: 'manual',
      base_field: null,
      default_rate: null,
      is_active: true,
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      company_id: defaultCompanyId,
      name: '출장비',
      calculation_type: 'manual',
      base_field: null,
      default_rate: null,
      is_active: true,
      sort_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      company_id: defaultCompanyId,
      name: '회의비',
      calculation_type: 'manual',
      base_field: null,
      default_rate: null,
      is_active: true,
      sort_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      company_id: defaultCompanyId,
      name: '제경비',
      calculation_type: 'percentage',
      base_field: 'labor_total',
      default_rate: 0.1,
      is_active: true,
      sort_order: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      company_id: defaultCompanyId,
      name: '기술료',
      calculation_type: 'percentage',
      base_field: 'labor_total',
      default_rate: 0.2,
      is_active: true,
      sort_order: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  store.set('expenseCategories', defaultExpenseCategories);

  console.log('Database cleared and reinitialized');
  console.log('Default accounts:');
  console.log('  - Super Admin: admin / admin123');
  console.log('  - Company Admin (이지컨설턴트): easyadmin / easy123');
}

// 헬퍼 함수들
export const db = {
  // Users
  getUsers: () => getDatabase().get('users', []),
  setUsers: (users: any[]) => getDatabase().set('users', users),
  getUserById: (id: string) => getDatabase().get('users', []).find((u: any) => u.id === id),
  getUserByUsername: (username: string) => getDatabase().get('users', []).find((u: any) => u.username === username),

  addUser: (user: any) => {
    const users = getDatabase().get('users', []);
    getDatabase().set('users', [...users, user]);
    return user;
  },

  updateUser: (id: string, updates: any) => {
    const users = getDatabase().get('users', []);
    const index = users.findIndex((u: any) => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('users', users);
      return users[index];
    }
    return null;
  },

  deleteUser: (id: string) => {
    const users = getDatabase().get('users', []);
    getDatabase().set('users', users.filter((u: any) => u.id !== id));
  },

  // Companies
  getCompanies: () => getDatabase().get('companies', []),
  setCompanies: (companies: any[]) => getDatabase().set('companies', companies),
  getCompanyById: (id: string) => getDatabase().get('companies', []).find((c: any) => c.id === id),

  addCompany: (company: any) => {
    const companies = getDatabase().get('companies', []);
    getDatabase().set('companies', [...companies, company]);
    return company;
  },

  updateCompany: (id: string, updates: any) => {
    const companies = getDatabase().get('companies', []);
    const index = companies.findIndex((c: any) => c.id === id);
    if (index !== -1) {
      companies[index] = { ...companies[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('companies', companies);
      return companies[index];
    }
    return null;
  },

  deleteCompany: (id: string) => {
    const companies = getDatabase().get('companies', []);
    getDatabase().set('companies', companies.filter((c: any) => c.id !== id));
  },

  // Departments
  getDepartments: () => getDatabase().get('departments', []),
  setDepartments: (departments: any[]) => getDatabase().set('departments', departments),
  getDepartmentById: (id: string) => getDatabase().get('departments', []).find((d: any) => d.id === id),
  getDepartmentsByCompanyId: (companyId: string) =>
    getDatabase().get('departments', []).filter((d: any) => d.company_id === companyId),

  addDepartment: (department: any) => {
    const departments = getDatabase().get('departments', []);
    getDatabase().set('departments', [...departments, department]);
    return department;
  },

  updateDepartment: (id: string, updates: any) => {
    const departments = getDatabase().get('departments', []);
    const index = departments.findIndex((d: any) => d.id === id);
    if (index !== -1) {
      departments[index] = { ...departments[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('departments', departments);
      return departments[index];
    }
    return null;
  },

  deleteDepartment: (id: string) => {
    const departments = getDatabase().get('departments', []);
    getDatabase().set('departments', departments.filter((d: any) => d.id !== id));
  },

  // Menu Permissions
  getMenuPermissions: () => getDatabase().get('menuPermissions', []),
  setMenuPermissions: (permissions: any[]) => getDatabase().set('menuPermissions', permissions),
  getPermissionsByUserId: (userId: string) =>
    getDatabase().get('menuPermissions', []).filter((p: any) => p.user_id === userId),

  deletePermissionsByUserId: (userId: string) => {
    const perms = getDatabase().get('menuPermissions', []);
    getDatabase().set('menuPermissions', perms.filter((p: any) => p.user_id !== userId));
  },

  addMenuPermission: (permission: any) => {
    const perms = getDatabase().get('menuPermissions', []);
    getDatabase().set('menuPermissions', [...perms, permission]);
    return permission;
  },

  // Settings
  getSettings: () => getDatabase().get('settings', {}),
  getSetting: (key: string) => getDatabase().get('settings', {})[key],
  setSetting: (key: string, value: any) => {
    const settings = getDatabase().get('settings', {});
    settings[key] = value;
    getDatabase().set('settings', settings);
  },

  // ========================================
  // 인건비 등급 (Labor Grades)
  // ========================================
  getLaborGrades: () => getDatabase().get('laborGrades', []),
  getLaborGradesByCompanyId: (companyId: string) =>
    getDatabase().get('laborGrades', []).filter((g: any) => g.company_id === companyId && g.is_active),
  getLaborGradeById: (id: string) => getDatabase().get('laborGrades', []).find((g: any) => g.id === id),

  addLaborGrade: (grade: any) => {
    const grades = getDatabase().get('laborGrades', []);
    getDatabase().set('laborGrades', [...grades, grade]);
    return grade;
  },

  updateLaborGrade: (id: string, updates: any) => {
    const grades = getDatabase().get('laborGrades', []);
    const index = grades.findIndex((g: any) => g.id === id);
    if (index !== -1) {
      grades[index] = { ...grades[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('laborGrades', grades);
      return grades[index];
    }
    return null;
  },

  deleteLaborGrade: (id: string) => {
    const grades = getDatabase().get('laborGrades', []);
    // 소프트 삭제 (is_active = false)
    const index = grades.findIndex((g: any) => g.id === id);
    if (index !== -1) {
      grades[index] = { ...grades[index], is_active: false, updated_at: new Date().toISOString() };
      getDatabase().set('laborGrades', grades);
    }
  },

  // ========================================
  // 경비 항목 (Expense Categories)
  // ========================================
  getExpenseCategories: () => getDatabase().get('expenseCategories', []),
  getExpenseCategoriesByCompanyId: (companyId: string) =>
    getDatabase().get('expenseCategories', []).filter((c: any) => c.company_id === companyId && c.is_active),
  getExpenseCategoryById: (id: string) => getDatabase().get('expenseCategories', []).find((c: any) => c.id === id),

  addExpenseCategory: (category: any) => {
    const categories = getDatabase().get('expenseCategories', []);
    getDatabase().set('expenseCategories', [...categories, category]);
    return category;
  },

  updateExpenseCategory: (id: string, updates: any) => {
    const categories = getDatabase().get('expenseCategories', []);
    const index = categories.findIndex((c: any) => c.id === id);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('expenseCategories', categories);
      return categories[index];
    }
    return null;
  },

  deleteExpenseCategory: (id: string) => {
    const categories = getDatabase().get('expenseCategories', []);
    // 소프트 삭제
    const index = categories.findIndex((c: any) => c.id === id);
    if (index !== -1) {
      categories[index] = { ...categories[index], is_active: false, updated_at: new Date().toISOString() };
      getDatabase().set('expenseCategories', categories);
    }
  },

  // ========================================
  // 견적서 (Quotes)
  // ========================================
  getQuotes: () => getDatabase().get('quotes', []),
  getQuotesByCompanyId: (companyId: string) =>
    getDatabase().get('quotes', []).filter((q: any) => q.company_id === companyId),
  getQuoteById: (id: string) => getDatabase().get('quotes', []).find((q: any) => q.id === id),

  addQuote: (quote: any) => {
    const quotes = getDatabase().get('quotes', []);
    getDatabase().set('quotes', [...quotes, quote]);
    return quote;
  },

  updateQuote: (id: string, updates: any) => {
    const quotes = getDatabase().get('quotes', []);
    const index = quotes.findIndex((q: any) => q.id === id);
    if (index !== -1) {
      quotes[index] = { ...quotes[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('quotes', quotes);
      return quotes[index];
    }
    return null;
  },

  deleteQuote: (id: string) => {
    const quotes = getDatabase().get('quotes', []);
    getDatabase().set('quotes', quotes.filter((q: any) => q.id !== id));
    // 관련 항목도 삭제
    const laborItems = getDatabase().get('quoteLaborItems', []);
    getDatabase().set('quoteLaborItems', laborItems.filter((i: any) => i.quote_id !== id));
    const expenseItems = getDatabase().get('quoteExpenseItems', []);
    getDatabase().set('quoteExpenseItems', expenseItems.filter((i: any) => i.quote_id !== id));
  },

  // 견적서 인건비 항목
  getQuoteLaborItems: () => getDatabase().get('quoteLaborItems', []),
  getQuoteLaborItemsByQuoteId: (quoteId: string) =>
    getDatabase().get('quoteLaborItems', []).filter((i: any) => i.quote_id === quoteId),

  addQuoteLaborItem: (item: any) => {
    const items = getDatabase().get('quoteLaborItems', []);
    getDatabase().set('quoteLaborItems', [...items, item]);
    return item;
  },

  updateQuoteLaborItem: (id: string, updates: any) => {
    const items = getDatabase().get('quoteLaborItems', []);
    const index = items.findIndex((i: any) => i.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      getDatabase().set('quoteLaborItems', items);
      return items[index];
    }
    return null;
  },

  deleteQuoteLaborItem: (id: string) => {
    const items = getDatabase().get('quoteLaborItems', []);
    getDatabase().set('quoteLaborItems', items.filter((i: any) => i.id !== id));
  },

  deleteQuoteLaborItemsByQuoteId: (quoteId: string) => {
    const items = getDatabase().get('quoteLaborItems', []);
    getDatabase().set('quoteLaborItems', items.filter((i: any) => i.quote_id !== quoteId));
  },

  // 견적서 경비 항목
  getQuoteExpenseItems: () => getDatabase().get('quoteExpenseItems', []),
  getQuoteExpenseItemsByQuoteId: (quoteId: string) =>
    getDatabase().get('quoteExpenseItems', []).filter((i: any) => i.quote_id === quoteId),

  addQuoteExpenseItem: (item: any) => {
    const items = getDatabase().get('quoteExpenseItems', []);
    getDatabase().set('quoteExpenseItems', [...items, item]);
    return item;
  },

  updateQuoteExpenseItem: (id: string, updates: any) => {
    const items = getDatabase().get('quoteExpenseItems', []);
    const index = items.findIndex((i: any) => i.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      getDatabase().set('quoteExpenseItems', items);
      return items[index];
    }
    return null;
  },

  deleteQuoteExpenseItem: (id: string) => {
    const items = getDatabase().get('quoteExpenseItems', []);
    getDatabase().set('quoteExpenseItems', items.filter((i: any) => i.id !== id));
  },

  deleteQuoteExpenseItemsByQuoteId: (quoteId: string) => {
    const items = getDatabase().get('quoteExpenseItems', []);
    getDatabase().set('quoteExpenseItems', items.filter((i: any) => i.quote_id !== quoteId));
  },

  // ========================================
  // 계약서 (Contracts)
  // ========================================
  getContracts: () => getDatabase().get('contracts', []),
  getContractsByCompanyId: (companyId: string) =>
    getDatabase().get('contracts', []).filter((c: any) => c.company_id === companyId),
  getContractById: (id: string) => getDatabase().get('contracts', []).find((c: any) => c.id === id),

  addContract: (contract: any) => {
    const contracts = getDatabase().get('contracts', []);
    getDatabase().set('contracts', [...contracts, contract]);
    return contract;
  },

  updateContract: (id: string, updates: any) => {
    const contracts = getDatabase().get('contracts', []);
    const index = contracts.findIndex((c: any) => c.id === id);
    if (index !== -1) {
      contracts[index] = { ...contracts[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('contracts', contracts);
      return contracts[index];
    }
    return null;
  },

  deleteContract: (id: string) => {
    const contracts = getDatabase().get('contracts', []);
    getDatabase().set('contracts', contracts.filter((c: any) => c.id !== id));
    // 관련 이력/입금 삭제
    const histories = getDatabase().get('contractHistories', []);
    getDatabase().set('contractHistories', histories.filter((h: any) => h.contract_id !== id));
    const payments = getDatabase().get('contractPayments', []);
    getDatabase().set('contractPayments', payments.filter((p: any) => p.contract_id !== id));
  },

  // 계약 변경 이력
  getContractHistories: () => getDatabase().get('contractHistories', []),
  getContractHistoriesByContractId: (contractId: string) =>
    getDatabase().get('contractHistories', []).filter((h: any) => h.contract_id === contractId),

  addContractHistory: (history: any) => {
    const histories = getDatabase().get('contractHistories', []);
    getDatabase().set('contractHistories', [...histories, history]);
    return history;
  },

  // 계약 입금 기록
  getContractPayments: () => getDatabase().get('contractPayments', []),
  getContractPaymentsByContractId: (contractId: string) =>
    getDatabase().get('contractPayments', []).filter((p: any) => p.contract_id === contractId),

  addContractPayment: (payment: any) => {
    const payments = getDatabase().get('contractPayments', []);
    getDatabase().set('contractPayments', [...payments, payment]);
    return payment;
  },

  updateContractPayment: (id: string, updates: any) => {
    const payments = getDatabase().get('contractPayments', []);
    const index = payments.findIndex((p: any) => p.id === id);
    if (index !== -1) {
      payments[index] = { ...payments[index], ...updates };
      getDatabase().set('contractPayments', payments);
      return payments[index];
    }
    return null;
  },

  deleteContractPayment: (id: string) => {
    const payments = getDatabase().get('contractPayments', []);
    getDatabase().set('contractPayments', payments.filter((p: any) => p.id !== id));
  },

  // ========================================
  // 일련번호 (Sequences)
  // ========================================
  getNextSequence: (companyId: string, type: 'quote' | 'contract') => {
    const key = `${companyId}_${type}`;
    const sequences = getDatabase().get('sequences', {});
    const current = sequences[key] || 0;
    const next = current + 1;
    sequences[key] = next;
    getDatabase().set('sequences', sequences);
    return next;
  },

  generateQuoteNumber: (companyId: string, prefix: string = 'Q') => {
    const seq = db.getNextSequence(companyId, 'quote');
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${seq.toString().padStart(4, '0')}`;
  },

  generateContractNumber: (companyId: string, prefix: string = 'C') => {
    const seq = db.getNextSequence(companyId, 'contract');
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${seq.toString().padStart(4, '0')}`;
  },

  // ========================================
  // 문서 템플릿 (Document Templates)
  // ========================================
  getDocumentTemplates: () => getDatabase().get('documentTemplates', []),
  getDocumentTemplatesByDepartmentId: (departmentId: string) =>
    getDatabase().get('documentTemplates', []).filter((t: any) => t.department_id === departmentId && t.is_active),
  getDocumentTemplatesByCompanyId: (companyId: string) =>
    getDatabase().get('documentTemplates', []).filter((t: any) => t.company_id === companyId && t.is_active),
  getDocumentTemplateById: (id: string) =>
    getDatabase().get('documentTemplates', []).find((t: any) => t.id === id),

  addDocumentTemplate: (template: any) => {
    const templates = getDatabase().get('documentTemplates', []);
    getDatabase().set('documentTemplates', [...templates, template]);
    return template;
  },

  updateDocumentTemplate: (id: string, updates: any) => {
    const templates = getDatabase().get('documentTemplates', []);
    const index = templates.findIndex((t: any) => t.id === id);
    if (index !== -1) {
      templates[index] = { ...templates[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('documentTemplates', templates);
      return templates[index];
    }
    return null;
  },

  deleteDocumentTemplate: (id: string) => {
    const templates = getDatabase().get('documentTemplates', []);
    const index = templates.findIndex((t: any) => t.id === id);
    if (index !== -1) {
      templates[index] = { ...templates[index], is_active: false, updated_at: new Date().toISOString() };
      getDatabase().set('documentTemplates', templates);
    }
  },

  // ========================================
  // 생성된 문서 (Generated Documents)
  // ========================================
  getGeneratedDocuments: () => getDatabase().get('generatedDocuments', []),
  getGeneratedDocumentsByContractId: (contractId: string) =>
    getDatabase().get('generatedDocuments', []).filter((d: any) => d.contract_id === contractId),
  getGeneratedDocumentById: (id: string) =>
    getDatabase().get('generatedDocuments', []).find((d: any) => d.id === id),

  addGeneratedDocument: (doc: any) => {
    const docs = getDatabase().get('generatedDocuments', []);
    getDatabase().set('generatedDocuments', [...docs, doc]);
    return doc;
  },

  updateGeneratedDocument: (id: string, updates: any) => {
    const docs = getDatabase().get('generatedDocuments', []);
    const index = docs.findIndex((d: any) => d.id === id);
    if (index !== -1) {
      docs[index] = { ...docs[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('generatedDocuments', docs);
      return docs[index];
    }
    return null;
  },

  deleteGeneratedDocument: (id: string) => {
    const docs = getDatabase().get('generatedDocuments', []);
    getDatabase().set('generatedDocuments', docs.filter((d: any) => d.id !== id));
  },

  deleteGeneratedDocumentsByContractId: (contractId: string) => {
    const docs = getDatabase().get('generatedDocuments', []);
    getDatabase().set('generatedDocuments', docs.filter((d: any) => d.contract_id !== contractId));
  },
};
