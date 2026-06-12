import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);

const MARKER = '__AUDIT_TEST_2026_05_27__';
const inserted = [];  // [{table, id}]

async function tryInsert(table, payload) {
  payload.id = payload.id || crypto.randomUUID();
  const { data, error } = await sb.from(table).insert(payload).select().single();
  if (error) {
    return { ok: false, err: error.message };
  }
  inserted.push({ table, id: data.id });
  return { ok: true, id: data.id };
}

// 회사/사용자 ID 확보
const { data: cos } = await sb.from('companies').select('id, name').limit(1);
const { data: us } = await sb.from('users').select('id').limit(1);
const { data: ctr } = await sb.from('contracts').select('id').limit(1);
const { data: qt } = await sb.from('quotes').select('id').limit(1);
const { data: cli } = await sb.from('client_companies').select('id').limit(1);
const { data: vh } = await sb.from('vehicles').select('id').limit(1);
const { data: bil } = await sb.from('billings').select('id').limit(1);
const { data: ti } = await sb.from('tax_invoices').select('id').limit(1);

const companyId = cos?.[0]?.id;
const userId = us?.[0]?.id;
const contractId = ctr?.[0]?.id;
const quoteId = qt?.[0]?.id;
const clientId = cli?.[0]?.id;
const vehicleId = vh?.[0]?.id;
const billingId = bil?.[0]?.id;
const taxInvoiceId = ti?.[0]?.id;

console.log('=== 빈 테이블 / 누락 테이블 insert 검증 ===\n');

const tests = [
  // 1. 누락된 3개 (사용자가 SQL 실행했는지 확인)
  ['contract_meeting_notes', {
    contract_id: contractId,
    title: MARKER,
    content: 'test',
    meeting_date: '2026-05-27',
    created_by: userId,
  }],
  ['quote_sections', {
    quote_id: quoteId || contractId, // quotes 0건이라 contract id로 시도
    section_type: 'header',
    title: MARKER,
    content: 'test',
    sort_order: 0,
  }],
  ['expense_requests', {
    company_id: companyId,
    user_id: userId,
    department_id: null,
    request_date: '2026-05-27',
    category: '교통비',
    amount: 1000,
    description: MARKER,
    status: 'pending',
  }],
  // 2. 빈 핵심 테이블들
  ['billings', {
    company_id: companyId,
    contract_id: contractId,
    billing_number: MARKER,
    description: MARKER,
    billing_amount: 1000,
    paid_amount: 0,
    remaining_amount: 1000,
    billing_date: '2026-05-27',
    status: 'pending',
    client_company_name: 'test',
    client_name: 'test',
    contract_number: 'TEST',
    service_name: MARKER,
    notes: 'audit',
    created_by: userId,
  }],
  ['payment_receipts', {
    company_id: companyId,
    billing_id: billingId,
    contract_id: contractId,
    receipt_number: MARKER,
    description: MARKER,
    amount: 1000,
    received_date: '2026-05-27',
    tax_invoice_id: taxInvoiceId,
  }],
  ['receivables', {
    company_id: companyId,
    contract_id: contractId,
    description: MARKER,
    original_amount: 1000,
    expected_amount: 1000,
    outstanding_amount: 1000,
    paid_amount: 0,
    due_date: '2026-12-31',
    invoice_date: '2026-05-27',
    status: 'pending',
    client_name: 'test',
  }],
  ['payables', {
    company_id: companyId,
    description: MARKER,
    original_amount: 1000,
    outstanding_amount: 1000,
    due_date: '2026-12-31',
    status: 'pending',
  }],
  ['provisional_payments', {
    company_id: companyId,
    received_date: '2026-05-27',
    payer_name: MARKER,
    amount: 1000,
    notes: MARKER,
    status: 'pending',
  }],
  ['expense_settlements', {
    company_id: companyId,
    user_id: userId,
    title: MARKER,
    total_amount: 1000,
    settlement_date: '2026-05-27',
    status: 'draft',
    approved_by: null,
  }],
  ['contract_events', {
    contract_id: contractId,
    event_date: '2026-05-27',
    title: MARKER,
    description: 'test',
  }],
  ['contract_histories', {
    contract_id: contractId,
    change_type: 'amount_change',
    change_description: MARKER,
    previous_value: '1000',
    new_value: '2000',
    changed_by: userId,
  }],
  ['contract_members', {
    contract_id: contractId,
    user_id: userId,
    role: 'member',
  }],
  ['vehicle_logs', {
    company_id: companyId,
    vehicle_id: vehicleId,
    driver_id: userId,
    driver_name: MARKER,
    log_date: '2026-05-27',
    purpose: 'test',
    departure: 'A',
    destination: 'B',
    start_km: 0,
    end_km: 10,
  }],
  ['spaces', {
    company_id: companyId,
    name: MARKER,
    location: 'test',
    capacity: 4,
    is_active: true,
  }],
  ['attached_documents', {
    parent_type: 'contract',
    parent_id: contractId,
    name: MARKER,
    file_path: '/test/path',
    category: 'test',
    uploaded_by: userId,
  }],
  ['quote_amount_histories', {
    quote_id: quoteId,
    previous_amount: 1000,
    new_amount: 2000,
    change_reason: MARKER,
    changed_by: userId,
  }],
];

for (const [table, payload] of tests) {
  // 의존 id가 null이면 skip (참조 무결성 깨짐 회피)
  const requiredIds = Object.entries(payload).filter(([k, v]) => k.endsWith('_id') && v === null);
  // 단, 일부 NULL 허용 컬럼은 skip 안 해도 됨 — 일단 시도
  const res = await tryInsert(table, payload);
  if (res.ok) {
    console.log('✅ ' + table + ': insert OK');
  } else {
    console.log('❌ ' + table + ': ' + res.err.slice(0, 140));
  }
}

console.log('\n=== 입력된 테스트 행: ' + inserted.length + '건 ===');

// 정리 — 마커 기반 삭제 + id 기반 삭제 둘 다 시도
console.log('\n=== 테스트 데이터 정리 ===');
for (const { table, id } of inserted) {
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) console.log('  ⚠️ ' + table + ' ' + id.slice(0, 8) + ' 삭제 실패: ' + error.message.slice(0, 100));
  else console.log('  🧹 ' + table + ' ' + id.slice(0, 8) + ' 삭제 OK');
}

// 추가 보호: 마커 기반 sweep (id로 못 찾은 경우 대비)
const sweepTables = ['billings','payment_receipts','receivables','payables','provisional_payments',
  'expense_settlements','expense_requests','contract_meeting_notes','quote_sections',
  'contract_events','contract_histories','vehicle_logs','spaces','attached_documents','quote_amount_histories'];
console.log('\n=== 마커 기반 sweep ===');
for (const t of sweepTables) {
  // 텍스트 컬럼들에서 마커 검색
  for (const col of ['title', 'description', 'notes', 'name', 'service_name', 'billing_number', 'receipt_number', 'driver_name', 'change_description', 'change_reason', 'payer_name']) {
    try {
      const { error, count } = await sb.from(t).delete({ count: 'exact' }).eq(col, MARKER);
      if (!error && count && count > 0) console.log('  🧹 ' + t + '.' + col + '=마커 ' + count + '건 삭제');
    } catch {}
  }
}

console.log('\n완료.');
