import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { getSampleQuotes, getSampleContracts, getSamplePayments, getSampleHistories } from './seedData';

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
  contractEvents: any[];
  // 양식 설정
  laborGrades: any[];
  expenseCategories: any[];
  // 문서 템플릿 및 생성 문서
  documentTemplates: any[];
  generatedDocuments: any[];
  // 첨부 문서
  attachedDocuments: any[];
  // 외주 관리
  outsourcings: any[];
  // 거래처 관리
  clientCompanies: any[];
  clientContacts: any[];
  // HWPX 양식 템플릿 관리
  hwpxTemplates: any[];
  // 메신저
  messengerConversations: any[];
  messengerMessages: any[];
  messengerReadReceipts: any[];
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
      contractEvents: [],
      // 양식 설정
      laborGrades: [],
      expenseCategories: [],
      // 문서 템플릿 및 생성 문서
      documentTemplates: [],
      generatedDocuments: [],
      // 첨부 문서
      attachedDocuments: [],
      // 외주 관리
      outsourcings: [],
      // 거래처 관리
      clientCompanies: [],
      clientContacts: [],
      // HWPX 양식 템플릿 관리
      hwpxTemplates: [],
      // 메신저
      messengerConversations: [],
      messengerMessages: [],
      messengerReadReceipts: [],
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
    // 실제 견적서 데이터 생성 (seedData.ts 기반)
    // ========================================
    const sampleQuotes = getSampleQuotes(defaultCompanyId).map(q => ({
      ...q,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    store.set('quotes', sampleQuotes);
    store.set('sequences', { [`${defaultCompanyId}_quote`]: sampleQuotes.length });
    console.log(`Real quotes created: ${sampleQuotes.length} quotes`);

    // ========================================
    // 실제 계약서 데이터 생성 (seedData.ts 기반)
    // ========================================
    const sampleContracts = getSampleContracts(defaultCompanyId).map(c => ({
      ...c,
      id: uuidv4(),
      quote_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    store.set('contracts', sampleContracts);

    // 실제 입금 내역
    const samplePayments = getSamplePayments(sampleContracts).map(p => ({
      ...p,
      id: uuidv4(),
      created_at: new Date().toISOString(),
    }));
    store.set('contractPayments', samplePayments);

    // 실제 변경 이력
    const sampleHistories = getSampleHistories(sampleContracts).map(h => ({
      ...h,
      id: uuidv4(),
      created_at: new Date().toISOString(),
    }));
    store.set('contractHistories', sampleHistories);

    // sequences 업데이트
    const sequences = store.get('sequences', {});
    sequences[`${defaultCompanyId}_contract`] = sampleContracts.length;
    store.set('sequences', sequences);
    console.log(`Real contracts created: ${sampleContracts.length} contracts with payments and histories`);
  } else {
    defaultCompanyId = companies[0].id;

    // Migration: 견적서 금액 업데이트 (이전 시드에서 금액이 0이었던 데이터 갱신)
    const amountsMigrated = store.get('settings', {})['quote_amounts_migrated'];
    if (!amountsMigrated && defaultCompanyId) {
      const existingQ = store.get('quotes', []);
      if (existingQ.length > 0) {
        const freshQuotes = getSampleQuotes(defaultCompanyId);
        const freshMap = new Map(freshQuotes.map(q => [q.quote_number, q]));

        let updatedCount = 0;
        for (const q of existingQ) {
          const fresh = freshMap.get(q.quote_number);
          if (fresh && (q.grand_total === 0 || q.grand_total === undefined) && fresh.grand_total > 0) {
            q.total_amount = fresh.total_amount;
            q.vat_amount = fresh.vat_amount;
            q.grand_total = fresh.grand_total;
            updatedCount++;
          }
        }

        if (updatedCount > 0) {
          store.set('quotes', existingQ);
          console.log(`Migrated ${updatedCount} quote amounts from seed data`);
        }
      }

      const settings = store.get('settings', {});
      settings['quote_amounts_migrated'] = true;
      store.set('settings', settings);
    }

    // Migration: 계약서 service_category 추가
    const categoriesMigrated = store.get('settings', {})['contract_categories_migrated'];
    if (!categoriesMigrated && defaultCompanyId) {
      const existingC = store.get('contracts', []);
      if (existingC.length > 0) {
        const categoryKeywords: Array<[string, string[]]> = [
          ['apartment', ['공동주택', '아파트']],
          ['public_housing', ['공공주택']],
          ['private_rental', ['민간임대', '임대주택']],
          ['happy_housing', ['행복주택']],
          ['mixed_use', ['주상복합']],
          ['officetel', ['오피스텔']],
          ['residential_improvement', ['주거환경개선', '주거환경 개선']],
          ['urban_development', ['도시개발']],
          ['redevelopment', ['재개발', '정비사업', '재건축']],
          ['knowledge_industry', ['지식산업', '산업단지', '산업센터']],
          ['educational', ['초등학교', '중학교', '고등학교', '학교', '교육시설']],
        ];

        let catUpdated = 0;
        for (const c of existingC) {
          if (!c.service_category && c.contract_type === 'service' && c.service_name) {
            const svcName = c.service_name;
            let found = false;
            for (const [value, keywords] of categoryKeywords) {
              if (keywords.some(kw => svcName.includes(kw))) {
                c.service_category = value;
                found = true;
                catUpdated++;
                break;
              }
            }
            if (!found) {
              c.service_category = 'other';
              catUpdated++;
            }
          }
        }

        if (catUpdated > 0) {
          store.set('contracts', existingC);
          console.log(`Migrated ${catUpdated} contract service categories`);
        }
      }

      const settings2 = store.get('settings', {});
      settings2['contract_categories_migrated'] = true;
      store.set('settings', settings2);
    }

    // Migration: 견적서 source_file_path 추가 (상대경로)
    const filePathsMigrated = store.get('settings', {})['quote_file_paths_migrated'];
    if (!filePathsMigrated && defaultCompanyId) {
      const existingQ = store.get('quotes', []);
      if (existingQ.length > 0) {
        const freshQuotes = getSampleQuotes(defaultCompanyId);
        const freshMap = new Map(freshQuotes.map(q => [q.quote_number, q]));

        let fpUpdated = 0;
        for (const q of existingQ) {
          if (!q.source_file_path) {
            const fresh = freshMap.get(q.quote_number);
            if (fresh && (fresh as any).source_file_path) {
              q.source_file_path = (fresh as any).source_file_path;
              fpUpdated++;
            }
          }
        }

        if (fpUpdated > 0) {
          store.set('quotes', existingQ);
          console.log(`Migrated ${fpUpdated} quote source_file_paths`);
        }
      }

      const settings3 = store.get('settings', {});
      settings3['quote_file_paths_migrated'] = true;
      store.set('settings', settings3);
    }

    // Migration: 거래처 자동 생성 (기존 계약/견적에서 추출)
    const clientsMigrated = store.get('settings', {})['client_companies_migrated'];
    if (!clientsMigrated && defaultCompanyId) {
      const existingContracts2 = store.get('contracts', []);
      const existingQuotes2 = store.get('quotes', []);
      const clientMap = new Map<string, { name: string; business_number?: string; contact_name?: string; contact_phone?: string; contact_email?: string; contact_department?: string }>();

      // 계약서에서 거래처 추출
      existingContracts2.forEach((c: any) => {
        if (c.client_company && c.client_company.trim()) {
          const key = c.client_company.trim();
          if (!clientMap.has(key)) {
            clientMap.set(key, {
              name: key,
              business_number: c.client_business_number || undefined,
              contact_name: c.client_contact_name || undefined,
              contact_phone: c.client_contact_phone || undefined,
              contact_email: c.client_contact_email || undefined,
            });
          }
        }
      });

      // 견적서에서 거래처 추출
      existingQuotes2.forEach((q: any) => {
        if (q.recipient_company && q.recipient_company.trim()) {
          const key = q.recipient_company.trim();
          if (!clientMap.has(key)) {
            clientMap.set(key, {
              name: key,
              contact_name: q.recipient_contact || undefined,
              contact_phone: q.recipient_phone || undefined,
              contact_email: q.recipient_email || undefined,
              contact_department: q.recipient_department || undefined,
            });
          }
        }
      });

      const newClients: any[] = [];
      const newContacts: any[] = [];

      clientMap.forEach((info) => {
        const clientId = uuidv4();
        newClients.push({
          id: clientId,
          company_id: defaultCompanyId,
          name: info.name,
          business_number: info.business_number || null,
          address: null,
          phone: null,
          industry: null,
          notes: null,
          created_by: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (info.contact_name) {
          newContacts.push({
            id: uuidv4(),
            client_id: clientId,
            name: info.contact_name,
            position: null,
            department: info.contact_department || null,
            phone: info.contact_phone || null,
            email: info.contact_email || null,
            is_primary: true,
            notes: null,
            created_at: new Date().toISOString(),
          });
        }
      });

      if (newClients.length > 0) {
        const existingClients = store.get('clientCompanies', []);
        store.set('clientCompanies', [...existingClients, ...newClients]);
        store.set('clientContacts', [...store.get('clientContacts', []), ...newContacts]);
        console.log(`Migrated ${newClients.length} client companies, ${newContacts.length} contacts from contracts/quotes`);
      }

      const settings4 = store.get('settings', {});
      settings4['client_companies_migrated'] = true;
      store.set('settings', settings4);
    }

    // 마이그레이션: 기존 생성 문서에 created_by_department_id 백필
    const docDeptMigrated = store.get('settings', {})['generated_docs_dept_migrated'];
    if (!docDeptMigrated) {
      const genDocs = store.get('generatedDocuments', []);
      const users = store.get('users', []);
      const userMap = new Map(users.map((u: any) => [u.id, u]));

      let migratedCount = 0;
      for (const doc of genDocs) {
        if (!doc.created_by_department_id && doc.generated_by) {
          const creator = userMap.get(doc.generated_by);
          if (creator && creator.department_id) {
            doc.created_by_department_id = creator.department_id;
            migratedCount++;
          }
        }
      }

      if (migratedCount > 0) {
        store.set('generatedDocuments', genDocs);
        console.log(`Migrated ${migratedCount} generated documents with department_id`);
      }

      const settings5 = store.get('settings', {});
      settings5['generated_docs_dept_migrated'] = true;
      store.set('settings', settings5);
    }

    // 마이그레이션: 기본 내장 HWPX 양식을 hwpxTemplates에 등록
    const hwpxTemplatesMigrated = store.get('settings', {})['hwpx_builtin_templates_migrated'];
    if (!hwpxTemplatesMigrated) {
      try {
        const { getTemplatesDir, DOCUMENT_TYPE_LABELS } = require('../services/hwpxGenerator');
        const templatesDir = getTemplatesDir();

        const builtinTemplates: Array<{ file: string; docType: string; name: string }> = [
          { file: 'contract.hwpx', docType: 'contract', name: '계약서' },
          { file: 'commencement.hwpx', docType: 'commencement', name: '착수계' },
          { file: 'completion.hwpx', docType: 'completion', name: '준공계' },
          { file: 'invoice.hwpx', docType: 'invoice', name: '청구서(대금청구서)' },
        ];

        // hwpx_templates 디렉토리 생성
        const customPath = store.get('settings', {})['documentStoragePath'];
        let docsBase: string;
        if (customPath && typeof customPath === 'string' && customPath.trim()) {
          docsBase = customPath;
        } else {
          docsBase = path.join(app.getPath('userData'), 'documents');
        }
        const hwpxTemplatesDir = path.join(docsBase, 'hwpx_templates');
        if (!fs.existsSync(hwpxTemplatesDir)) {
          fs.mkdirSync(hwpxTemplatesDir, { recursive: true });
        }

        const existingHwpx = store.get('hwpxTemplates', []);
        const newTemplates: any[] = [];

        for (const bt of builtinTemplates) {
          const srcPath = path.join(templatesDir, bt.file);
          if (!fs.existsSync(srcPath)) continue;

          // 이미 같은 doc_type이 등록되어 있으면 스킵
          if (existingHwpx.some((t: any) => t.doc_type === bt.docType && t.is_active)) continue;

          const tplId = uuidv4();
          const storedFile = `${tplId}.hwpx`;
          const destPath = path.join(hwpxTemplatesDir, storedFile);

          fs.copyFileSync(srcPath, destPath);

          newTemplates.push({
            id: tplId,
            name: bt.name,
            doc_type: bt.docType,
            description: `기본 내장 양식 (${bt.name})`,
            original_filename: bt.file,
            stored_filename: storedFile,
            file_path: destPath,
            file_size: fs.statSync(destPath).size,
            is_active: true,
            created_by: 'system',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        if (newTemplates.length > 0) {
          store.set('hwpxTemplates', [...existingHwpx, ...newTemplates]);
          console.log(`Built-in HWPX templates registered: ${newTemplates.map(t => t.name).join(', ')}`);

          // 매니페스트 파일 생성 (공유 동기화용)
          try {
            const allTemplates = store.get('hwpxTemplates', []).filter((t: any) => t.is_active);
            const manifest = allTemplates.map((t: any) => ({
              id: t.id, name: t.name, doc_type: t.doc_type,
              description: t.description, original_filename: t.original_filename,
              stored_filename: t.stored_filename, file_size: t.file_size,
              created_by: t.created_by, created_at: t.created_at, updated_at: t.updated_at,
            }));
            const manifestPath = path.join(hwpxTemplatesDir, 'templates.json');
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
          } catch (mErr) {
            console.error('Failed to write templates manifest:', mErr);
          }
        }
      } catch (err) {
        console.error('Failed to migrate built-in HWPX templates:', err);
      }

      const settings6 = store.get('settings', {});
      settings6['hwpx_builtin_templates_migrated'] = true;
      store.set('settings', settings6);
    }

    // 기존 DB에도 실제 데이터가 없으면 추가
    const existingQuotes = store.get('quotes', []);
    const existingContracts = store.get('contracts', []);

    if (existingQuotes.length === 0 && existingContracts.length === 0) {
      console.log('Adding real data to existing database...');

      // 실제 견적서 데이터
      const sampleQuotes = getSampleQuotes(defaultCompanyId).map(q => ({
        ...q,
        id: uuidv4(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      store.set('quotes', sampleQuotes);

      // 실제 계약서 데이터
      const sampleContracts = getSampleContracts(defaultCompanyId).map(c => ({
        ...c,
        id: uuidv4(),
        quote_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      store.set('contracts', sampleContracts);

      // 실제 입금 내역
      const samplePayments = getSamplePayments(sampleContracts).map(p => ({
        ...p,
        id: uuidv4(),
        created_at: new Date().toISOString(),
      }));
      store.set('contractPayments', samplePayments);

      // 실제 변경 이력
      const sampleHistories = getSampleHistories(sampleContracts).map(h => ({
        ...h,
        id: uuidv4(),
        created_at: new Date().toISOString(),
      }));
      store.set('contractHistories', sampleHistories);

      // sequences 업데이트
      const sequences = store.get('sequences', {});
      sequences[`${defaultCompanyId}_quote`] = sampleQuotes.length;
      sequences[`${defaultCompanyId}_contract`] = sampleContracts.length;
      store.set('sequences', sequences);

      console.log(`Real data added: ${sampleQuotes.length} quotes, ${sampleContracts.length} contracts`);
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

  // 마이그레이션: 샘플 직원 계정 추가 (메신저 테스트용)
  const sampleUsersMigrated = store.get('settings', {})['sample_employees_migrated'];
  if (!sampleUsersMigrated && defaultCompanyId) {
    const allUsers = store.get('users', []);
    const departments = store.get('departments', []);
    const firstDept = departments.length > 0 ? departments[0] : null;

    const sampleEmployees = [
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        department_id: firstDept?.id || null,
        username: 'kimyj',
        password_hash: bcrypt.hashSync('1234', 10),
        name: '김영진',
        email: 'kimyj@example.com',
        role: 'employee',
        is_active: true,
        last_login: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        company_id: defaultCompanyId,
        department_id: firstDept?.id || null,
        username: 'parksh',
        password_hash: bcrypt.hashSync('1234', 10),
        name: '박서현',
        email: 'parksh@example.com',
        role: 'department_manager',
        is_active: true,
        last_login: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    store.set('users', [...allUsers, ...sampleEmployees]);
    console.log('Sample employees created: kimyj/1234 (김영진), parksh/1234 (박서현)');

    const settingsM = store.get('settings', {});
    settingsM['sample_employees_migrated'] = true;
    store.set('settings', settingsM);
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
  store.set('attachedDocuments', []);
  store.set('outsourcings', []);
  store.set('clientCompanies', []);
  store.set('clientContacts', []);
  store.set('hwpxTemplates', []);
  store.set('messengerConversations', []);
  store.set('messengerMessages', []);
  store.set('messengerReadReceipts', []);
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

// Supabase DB 사용 (기존 로컬 DB는 localDb로 보존)
export { db } from './supabaseDb';

// 로컬 전용 헬퍼 함수들 (폴백용으로 보존)
export const localDb = {
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
    const events = getDatabase().get('contractEvents', []);
    getDatabase().set('contractEvents', events.filter((e: any) => e.contract_id !== id));
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
  // 계약 커스텀 이벤트 (Contract Events)
  // ========================================
  getContractEvents: () => getDatabase().get('contractEvents', []),
  getContractEventsByContractId: (contractId: string) =>
    getDatabase().get('contractEvents', []).filter((e: any) => e.contract_id === contractId),

  addContractEvent: (event: any) => {
    const events = getDatabase().get('contractEvents', []);
    getDatabase().set('contractEvents', [...events, event]);
    return event;
  },

  updateContractEvent: (id: string, updates: any) => {
    const events = getDatabase().get('contractEvents', []);
    const index = events.findIndex((e: any) => e.id === id);
    if (index !== -1) {
      events[index] = { ...events[index], ...updates };
      getDatabase().set('contractEvents', events);
      return events[index];
    }
    return null;
  },

  deleteContractEvent: (id: string) => {
    const events = getDatabase().get('contractEvents', []);
    getDatabase().set('contractEvents', events.filter((e: any) => e.id !== id));
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
    const seq = localDb.getNextSequence(companyId, 'quote');
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${seq.toString().padStart(4, '0')}`;
  },

  generateContractNumber: (companyId: string, prefix: string = 'C') => {
    const seq = localDb.getNextSequence(companyId, 'contract');
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

  // ========================================
  // 첨부 문서 (Attached Documents)
  // ========================================
  getAttachedDocuments: () => getDatabase().get('attachedDocuments', []),
  getAttachedDocumentsByParent: (parentType: string, parentId: string) =>
    getDatabase().get('attachedDocuments', []).filter(
      (d: any) => d.parent_type === parentType && d.parent_id === parentId
    ),
  getAttachedDocumentById: (id: string) =>
    getDatabase().get('attachedDocuments', []).find((d: any) => d.id === id),

  addAttachedDocument: (doc: any) => {
    const docs = getDatabase().get('attachedDocuments', []);
    getDatabase().set('attachedDocuments', [...docs, doc]);
    return doc;
  },

  updateAttachedDocument: (id: string, updates: any) => {
    const docs = getDatabase().get('attachedDocuments', []);
    const index = docs.findIndex((d: any) => d.id === id);
    if (index !== -1) {
      docs[index] = { ...docs[index], ...updates };
      getDatabase().set('attachedDocuments', docs);
      return docs[index];
    }
    return null;
  },

  deleteAttachedDocument: (id: string) => {
    const docs = getDatabase().get('attachedDocuments', []);
    getDatabase().set('attachedDocuments', docs.filter((d: any) => d.id !== id));
  },

  deleteAttachedDocumentsByParent: (parentType: string, parentId: string) => {
    const docs = getDatabase().get('attachedDocuments', []);
    getDatabase().set('attachedDocuments', docs.filter(
      (d: any) => !(d.parent_type === parentType && d.parent_id === parentId)
    ));
  },

  // ========================================
  // 외주 관리 (Outsourcings)
  // ========================================
  getOutsourcings: () => getDatabase().get('outsourcings', []),
  getOutsourcingsByCompanyId: (companyId: string) =>
    getDatabase().get('outsourcings', []).filter((o: any) => o.company_id === companyId),
  getOutsourcingsByContractId: (contractId: string) =>
    getDatabase().get('outsourcings', []).filter((o: any) => o.contract_id === contractId),
  getOutsourcingById: (id: string) => getDatabase().get('outsourcings', []).find((o: any) => o.id === id),

  addOutsourcing: (outsourcing: any) => {
    const items = getDatabase().get('outsourcings', []);
    getDatabase().set('outsourcings', [...items, outsourcing]);
    return outsourcing;
  },

  updateOutsourcing: (id: string, updates: any) => {
    const items = getDatabase().get('outsourcings', []);
    const index = items.findIndex((o: any) => o.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('outsourcings', items);
      return items[index];
    }
    return null;
  },

  deleteOutsourcing: (id: string) => {
    const items = getDatabase().get('outsourcings', []);
    getDatabase().set('outsourcings', items.filter((o: any) => o.id !== id));
  },

  // ========================================
  // 거래처 (Client Companies)
  // ========================================
  getClientCompanies: () => getDatabase().get('clientCompanies', []),
  getClientCompaniesByCompanyId: (companyId: string) =>
    getDatabase().get('clientCompanies', []).filter((c: any) => c.company_id === companyId),
  getClientCompanyById: (id: string) =>
    getDatabase().get('clientCompanies', []).find((c: any) => c.id === id),

  addClientCompany: (client: any) => {
    const clients = getDatabase().get('clientCompanies', []);
    getDatabase().set('clientCompanies', [...clients, client]);
    return client;
  },

  updateClientCompany: (id: string, updates: any) => {
    const clients = getDatabase().get('clientCompanies', []);
    const index = clients.findIndex((c: any) => c.id === id);
    if (index !== -1) {
      clients[index] = { ...clients[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('clientCompanies', clients);
      return clients[index];
    }
    return null;
  },

  deleteClientCompany: (id: string) => {
    const clients = getDatabase().get('clientCompanies', []);
    getDatabase().set('clientCompanies', clients.filter((c: any) => c.id !== id));
    // 담당자 캐스케이드 삭제
    const contacts = getDatabase().get('clientContacts', []);
    getDatabase().set('clientContacts', contacts.filter((c: any) => c.client_id !== id));
  },

  // 거래처 담당자 (Client Contacts)
  getClientContacts: () => getDatabase().get('clientContacts', []),
  getClientContactsByClientId: (clientId: string) =>
    getDatabase().get('clientContacts', []).filter((c: any) => c.client_id === clientId),

  addClientContact: (contact: any) => {
    const contacts = getDatabase().get('clientContacts', []);
    getDatabase().set('clientContacts', [...contacts, contact]);
    return contact;
  },

  updateClientContact: (id: string, updates: any) => {
    const contacts = getDatabase().get('clientContacts', []);
    const index = contacts.findIndex((c: any) => c.id === id);
    if (index !== -1) {
      contacts[index] = { ...contacts[index], ...updates };
      getDatabase().set('clientContacts', contacts);
      return contacts[index];
    }
    return null;
  },

  deleteClientContact: (id: string) => {
    const contacts = getDatabase().get('clientContacts', []);
    getDatabase().set('clientContacts', contacts.filter((c: any) => c.id !== id));
  },

  // ========================================
  // HWPX 양식 템플릿 관리 (HWPX Templates)
  // ========================================
  getHwpxTemplates: () => getDatabase().get('hwpxTemplates', []),
  getHwpxTemplateById: (id: string) =>
    getDatabase().get('hwpxTemplates', []).find((t: any) => t.id === id),
  getHwpxTemplateByDocType: (docType: string) =>
    getDatabase().get('hwpxTemplates', []).find((t: any) => t.doc_type === docType && t.is_active),
  getActiveHwpxTemplates: () =>
    getDatabase().get('hwpxTemplates', []).filter((t: any) => t.is_active),

  addHwpxTemplate: (template: any) => {
    const templates = getDatabase().get('hwpxTemplates', []);
    getDatabase().set('hwpxTemplates', [...templates, template]);
    return template;
  },

  updateHwpxTemplate: (id: string, updates: any) => {
    const templates = getDatabase().get('hwpxTemplates', []);
    const index = templates.findIndex((t: any) => t.id === id);
    if (index !== -1) {
      templates[index] = { ...templates[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('hwpxTemplates', templates);
      return templates[index];
    }
    return null;
  },

  deleteHwpxTemplate: (id: string) => {
    const templates = getDatabase().get('hwpxTemplates', []);
    getDatabase().set('hwpxTemplates', templates.filter((t: any) => t.id !== id));
  },

  // ========================================
  // 메신저 (Messenger)
  // ========================================

  // 대화방
  getConversations: () => getDatabase().get('messengerConversations', []),
  getConversationById: (id: string) =>
    getDatabase().get('messengerConversations', []).find((c: any) => c.id === id),
  getConversationsByUserId: (userId: string) =>
    getDatabase().get('messengerConversations', []).filter(
      (c: any) => c.participants && c.participants.includes(userId)
    ),

  addConversation: (conversation: any) => {
    const convs = getDatabase().get('messengerConversations', []);
    getDatabase().set('messengerConversations', [...convs, conversation]);
    return conversation;
  },

  updateConversation: (id: string, updates: any) => {
    const convs = getDatabase().get('messengerConversations', []);
    const index = convs.findIndex((c: any) => c.id === id);
    if (index !== -1) {
      convs[index] = { ...convs[index], ...updates, updated_at: new Date().toISOString() };
      getDatabase().set('messengerConversations', convs);
      return convs[index];
    }
    return null;
  },

  deleteConversation: (id: string) => {
    const convs = getDatabase().get('messengerConversations', []);
    getDatabase().set('messengerConversations', convs.filter((c: any) => c.id !== id));
    // 관련 메시지도 삭제
    const msgs = getDatabase().get('messengerMessages', []);
    getDatabase().set('messengerMessages', msgs.filter((m: any) => m.conversation_id !== id));
    // 읽음 처리도 삭제
    const receipts = getDatabase().get('messengerReadReceipts', []);
    getDatabase().set('messengerReadReceipts', receipts.filter((r: any) => r.conversation_id !== id));
  },

  // 메시지
  getMessages: () => getDatabase().get('messengerMessages', []),
  getMessagesByConversationId: (conversationId: string) =>
    getDatabase().get('messengerMessages', []).filter(
      (m: any) => m.conversation_id === conversationId && !m.is_deleted
    ),

  addMessage: (message: any) => {
    const msgs = getDatabase().get('messengerMessages', []);
    getDatabase().set('messengerMessages', [...msgs, message]);
    return message;
  },

  updateMessage: (id: string, updates: any) => {
    const msgs = getDatabase().get('messengerMessages', []);
    const index = msgs.findIndex((m: any) => m.id === id);
    if (index !== -1) {
      msgs[index] = { ...msgs[index], ...updates };
      getDatabase().set('messengerMessages', msgs);
      return msgs[index];
    }
    return null;
  },

  deleteMessage: (id: string) => {
    const msgs = getDatabase().get('messengerMessages', []);
    const index = msgs.findIndex((m: any) => m.id === id);
    if (index !== -1) {
      msgs[index] = { ...msgs[index], is_deleted: true, content: '', deleted_at: new Date().toISOString() };
      getDatabase().set('messengerMessages', msgs);
    }
  },

  // 읽음 확인
  getReadReceipts: () => getDatabase().get('messengerReadReceipts', []),
  getReadReceiptsByConversation: (conversationId: string, userId: string) =>
    getDatabase().get('messengerReadReceipts', []).find(
      (r: any) => r.conversation_id === conversationId && r.user_id === userId
    ),

  upsertReadReceipt: (conversationId: string, userId: string, lastReadMessageId: string) => {
    const receipts = getDatabase().get('messengerReadReceipts', []);
    const index = receipts.findIndex(
      (r: any) => r.conversation_id === conversationId && r.user_id === userId
    );
    const now = new Date().toISOString();
    if (index !== -1) {
      receipts[index] = { ...receipts[index], last_read_message_id: lastReadMessageId, read_at: now };
    } else {
      receipts.push({
        id: uuidv4(),
        conversation_id: conversationId,
        user_id: userId,
        last_read_message_id: lastReadMessageId,
        read_at: now,
      });
    }
    getDatabase().set('messengerReadReceipts', receipts);
  },
};
