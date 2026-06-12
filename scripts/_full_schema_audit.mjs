import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);

// 1) 모든 주요 테이블 컬럼 추출
const TABLES = [
  'users', 'companies', 'departments',
  'contracts', 'contract_subtasks', 'contract_payments', 'contract_events', 'contract_histories', 'contract_meeting_notes', 'contract_members', 'payment_conditions',
  'quotes', 'quote_sections', 'quote_amount_histories', 'quote_preset_sections', 'quote_members',
  'client_companies', 'client_contacts',
  'tax_invoices',
  'billings', 'payment_receipts',
  'receivables', 'payables',
  'provisional_payments',
  'outsourcings',
  'expense_settlements', 'expense_settlement_items', 'expense_categories', 'expense_requests',
  'labor_grades',
  'leave_requests',
  'certificates', 'certificate_types',
  'vehicles', 'vehicle_logs',
  'spaces',
  'attached_documents',
  'menu_manuals',
  'settings',
  'notifications',
  'messenger_conversations', 'messenger_messages',
  'document_templates', 'hwpx_templates',
  'generated_documents',
  'user_companies', 'user_departments',
];

const dbColumns = {};
for (const t of TABLES) {
  const { data, error } = await sb.from(t).select('*').limit(1);
  if (error) {
    dbColumns[t] = { error: error.message };
    continue;
  }
  // 빈 테이블 — 컬럼 확인용으로 dummy 행 insert 시도해서 error 메시지 받기?
  // 더 안전: 0건이면 단순 select 컬럼 확인 어렵지만, supabase는 빈 응답이라도 OK 반환
  if (data && data.length > 0) {
    dbColumns[t] = Object.keys(data[0]);
  } else {
    // 빈 테이블: 빠진 컬럼 확인 어려움. skip.
    dbColumns[t] = '__EMPTY__';
  }
}

// 2) IPC 핸들러에서 의심 키 추출 (대표 add/update 패턴)
// 핸들러 파일을 읽어 .insert({...}) / db.addX({...}) 안의 키만 추출
const IPC_DIR = path.resolve('src/main/ipc');
const ipcFiles = fs.readdirSync(IPC_DIR).filter((f) => f.endsWith('.ts'));

const usedColumns = {};  // {table: Set<columnName>}
const mapAdd = {
  addOutsourcing: 'outsourcings', updateOutsourcing: 'outsourcings',
  addContract: 'contracts', updateContract: 'contracts',
  addQuote: 'quotes', updateQuote: 'quotes',
  addClientCompany: 'client_companies', updateClientCompany: 'client_companies',
  addUser: 'users', updateUser: 'users',
  addCompany: 'companies', updateCompany: 'companies',
  addDepartment: 'departments', updateDepartment: 'departments',
  addTaxInvoice: 'tax_invoices', updateTaxInvoice: 'tax_invoices',
  addBilling: 'billings', updateBilling: 'billings',
  addPaymentReceipt: 'payment_receipts', updatePaymentReceipt: 'payment_receipts',
  addReceivable: 'receivables', updateReceivable: 'receivables',
  addPayable: 'payables', updatePayable: 'payables',
  addProvisionalPayment: 'provisional_payments', updateProvisionalPayment: 'provisional_payments',
  addExpenseSettlement: 'expense_settlements', updateExpenseSettlement: 'expense_settlements',
  addExpenseSettlementItem: 'expense_settlement_items',
  addExpenseRequest: 'expense_requests', updateExpenseRequest: 'expense_requests',
  addLeaveRequest: 'leave_requests', updateLeaveRequest: 'leave_requests',
  addCertificate: 'certificates', updateCertificate: 'certificates',
  addCertificateType: 'certificate_types', updateCertificateType: 'certificate_types',
  addVehicle: 'vehicles', updateVehicle: 'vehicles',
  addVehicleLog: 'vehicle_logs', updateVehicleLog: 'vehicle_logs',
  addSpace: 'spaces', updateSpace: 'spaces',
  addContractEvent: 'contract_events',
  addContractHistory: 'contract_histories',
  addContractPayment: 'contract_payments',
  addContractMeetingNote: 'contract_meeting_notes',
  addPaymentCondition: 'payment_conditions',
};

// 함수 호출 인자의 키 추출 (greedy text matching, 한계 있음)
function extractKeysAfterCall(text, callName) {
  const keys = new Set();
  const pattern = new RegExp(`${callName}\\s*\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)`, 'g');
  let m;
  while ((m = pattern.exec(text))) {
    const body = m[1];
    // 객체 키만 (key: value 패턴)
    const keyPattern = /([a-z_][a-zA-Z_0-9]*)\s*:/g;
    let km;
    while ((km = keyPattern.exec(body))) {
      keys.add(km[1]);
    }
  }
  return keys;
}

for (const f of ipcFiles) {
  const content = fs.readFileSync(path.join(IPC_DIR, f), 'utf8');
  for (const [fnName, tableName] of Object.entries(mapAdd)) {
    const keys = extractKeysAfterCall(content, `db\\.${fnName}`);
    if (keys.size === 0) continue;
    if (!usedColumns[tableName]) usedColumns[tableName] = new Set();
    keys.forEach((k) => usedColumns[tableName].add(k));
  }
  // supabase.from(X).insert/.update 직접 호출도
  const directPattern = /supabase\.from\(['"`](\w+)['"`]\)\.(?:insert|update|upsert)\(\s*\{([\s\S]*?)\}\s*[\),]/g;
  let m;
  while ((m = directPattern.exec(content))) {
    const t = m[1];
    const body = m[2];
    if (!usedColumns[t]) usedColumns[t] = new Set();
    const keyPattern = /([a-z_][a-zA-Z_0-9]*)\s*:/g;
    let km;
    while ((km = keyPattern.exec(body))) {
      usedColumns[t].add(km[1]);
    }
  }
}

// 3) supabaseDb.ts 도 확인 (실제 인서트 위치)
const dbFile = fs.readFileSync('src/main/database/supabaseDb.ts', 'utf8');
const directPattern = /supabase\.from\(['"`](\w+)['"`]\)\.(?:insert|update|upsert)\(/g;
let m;
const tablesInDb = new Set();
while ((m = directPattern.exec(dbFile))) tablesInDb.add(m[1]);

// 4) 비교
console.log('=== 의심 컬럼 (IPC가 사용 OR supabaseDb가 사용 BUT DB에 없음) ===\n');
const mismatches = [];
for (const [table, columns] of Object.entries(usedColumns)) {
  const dbCols = dbColumns[table];
  if (!dbCols || dbCols === '__EMPTY__' || dbCols.error) {
    if (dbCols?.error) console.log(`⚠️ [${table}] DB 접근 실패: ${dbCols.error}`);
    else if (dbCols === '__EMPTY__') console.log(`⚪ [${table}] DB 빈 테이블 — 검증 skip (사용 키: ${[...columns].slice(0, 6).join(',')}${columns.size > 6 ? '...' : ''})`);
    continue;
  }
  const dbSet = new Set(dbCols);
  const missing = [...columns].filter((c) => !dbSet.has(c));
  if (missing.length === 0) continue;
  // 자동 생성/공통 키 제외
  const ignored = new Set(['id', 'created_at', 'updated_at']);
  const real = missing.filter((c) => !ignored.has(c));
  if (real.length === 0) continue;
  mismatches.push({ table, missing: real });
  console.log(`❌ [${table}] 누락 컬럼: ${real.join(', ')}`);
}
if (mismatches.length === 0) console.log('✅ IPC가 시도하는 모든 컬럼이 DB에 존재합니다.');

console.log('\n=== 정보: 각 테이블 컬럼 (빈 테이블 제외) ===');
for (const [t, cols] of Object.entries(dbColumns)) {
  if (Array.isArray(cols)) {
    console.log(`  [${t}] (${cols.length} cols)`);
  } else if (cols === '__EMPTY__') {
    console.log(`  [${t}] EMPTY`);
  } else if (cols?.error) {
    console.log(`  [${t}] ERROR: ${cols.error}`);
  }
}
