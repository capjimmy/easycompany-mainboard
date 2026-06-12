import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

// Supabase REST API는 임의 SQL을 지원하지 않으므로,
// 테이블 존재 여부만 확인하고 사용자에게 SQL Editor 실행 안내
const tables = ['expense_requests', 'vehicles', 'vehicle_logs'];
console.log('=== Phase 3 테이블 확인 ===');
for (const t of tables) {
  const { error } = await supabase.from(t).select('id', { head: true, count: 'exact' });
  if (error) {
    console.log(`  ${t}: ❌ 미존재 (${error.message})`);
  } else {
    console.log(`  ${t}: ✅ 존재`);
  }
}
console.log('\n미존재 테이블이 있으면 Supabase SQL Editor에서');
console.log('scripts/migrate_phase3.sql 내용을 실행해주세요.');
