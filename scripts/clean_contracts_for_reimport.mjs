import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://silvsqcwearelrumtqqm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 자식 → 부모 순서로 삭제 (FK 제약 회피)
const tablesToDelete = [
  // quotes 관련 (자식 → 부모)
  'quote_labor_items',
  'quote_expense_items',
  'quote_amount_histories',
  'quote_sections',
  'quotes',
  // contracts 관련 (자식 → 부모)
  'contract_labor_items',
  'contract_expense_items',
  'contract_subtasks',
  'contract_sections',
  'contract_payments',
  'contract_events',
  'contract_histories',
  'contract_members',
  'contract_meeting_notes',
  'contracts',
];

// 보존할 테이블 (단, contract_id만 null로 unlink)
const tablesToUnlink = [
  'payment_receipts',
  'tax_invoices',
];

async function countRows(table) {
  const { count, error } = await sb
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) return `(조회실패: ${error.message})`;
  return count;
}

async function countLinked(table) {
  const { count, error } = await sb
    .from(table)
    .select('*', { count: 'exact', head: true })
    .not('contract_id', 'is', null);
  if (error) return `(조회실패: ${error.message})`;
  return count;
}

async function unlinkContractId(table) {
  const { error } = await sb
    .from(table)
    .update({ contract_id: null })
    .not('contract_id', 'is', null);
  return error;
}

async function deleteAll(table) {
  const { error } = await sb
    .from(table)
    .delete()
    .not('id', 'is', null);
  return error;
}

console.log('=== 작업 전 건수 ===');
console.log('[삭제 대상 테이블]');
const beforeCounts = {};
for (const t of tablesToDelete) {
  const c = await countRows(t);
  beforeCounts[t] = c;
  console.log(`  ${t}: ${c}`);
}

console.log('\n[unlink 대상 테이블 (전체 / contract_id 연결됨)]');
const beforeUnlink = {};
for (const t of tablesToUnlink) {
  const total = await countRows(t);
  const linked = await countLinked(t);
  beforeUnlink[t] = { total, linked };
  console.log(`  ${t}: 전체 ${total} / 연결 ${linked}`);
}

console.log('\n=== 1단계: payment_receipts, tax_invoices 의 contract_id null 처리 ===');
for (const t of tablesToUnlink) {
  process.stdout.write(`  ${t}.contract_id → null ... `);
  const err = await unlinkContractId(t);
  if (err) {
    console.log(`❌ ${err.message}`);
  } else {
    console.log('✅');
  }
}

console.log('\n=== 2단계: quotes / contracts 관련 테이블 삭제 ===');
for (const t of tablesToDelete) {
  process.stdout.write(`  ${t} 삭제 중... `);
  const err = await deleteAll(t);
  if (err) {
    console.log(`❌ ${err.message}`);
  } else {
    console.log('✅');
  }
}

console.log('\n=== 작업 후 건수 ===');
console.log('[삭제 대상 테이블]');
for (const t of tablesToDelete) {
  const after = await countRows(t);
  const before = beforeCounts[t];
  console.log(`  ${t}: ${before} → ${after}`);
}

console.log('\n[unlink 대상 테이블 (전체 / contract_id 연결됨)]');
for (const t of tablesToUnlink) {
  const total = await countRows(t);
  const linked = await countLinked(t);
  const beforeT = beforeUnlink[t].total;
  const beforeL = beforeUnlink[t].linked;
  console.log(`  ${t}: 전체 ${beforeT} → ${total} / 연결 ${beforeL} → ${linked}`);
}

console.log('\n완료');
