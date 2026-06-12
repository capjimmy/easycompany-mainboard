import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://silvsqcwearelrumtqqm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 자식 → 부모 순서로 삭제 (FK 제약 회피)
const tables = [
  // quotes 관련
  'quote_labor_items',
  'quote_expense_items',
  'quote_amount_histories',
  'quote_sections',
  'quotes',
  // contracts 관련
  'contract_labor_items',
  'contract_expense_items',
  'contract_subtasks',
  'contract_sections',
  'contract_payments',
  'contract_events',
  'contract_histories',
  'contracts',
];

async function countRows(table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) return `(조회실패: ${error.message})`;
  return count;
}

async function deleteAll(table) {
  // 모든 행 삭제 (id가 무엇이든)
  const { error } = await supabase
    .from(table)
    .delete()
    .not('id', 'is', null);
  return error;
}

console.log('=== 삭제 전 건수 ===');
for (const t of tables) {
  console.log(`  ${t}: ${await countRows(t)}`);
}

console.log('\n=== 삭제 시작 ===');
for (const t of tables) {
  process.stdout.write(`  ${t} 삭제 중... `);
  const err = await deleteAll(t);
  if (err) {
    console.log(`❌ ${err.message}`);
  } else {
    console.log('✅');
  }
}

console.log('\n=== 삭제 후 건수 ===');
for (const t of tables) {
  console.log(`  ${t}: ${await countRows(t)}`);
}

console.log('\n완료');
