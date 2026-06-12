import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// 새로 넣은 900건은 contract_number가 P-로 시작
// 기존 1329건은 다른 패턴
const { count: total } = await sb.from('contracts').select('*', { count: 'exact', head: true });
console.log('현재 contracts:', total);

// payment_receipts가 참조하는 contract_id 먼저 정리
const { error: prErr } = await sb.from('payment_receipts').delete().not('id', 'is', null);
console.log('payment_receipts 삭제:', prErr ? '❌ '+prErr.message : '✅');

// 기존 contracts (P-로 시작 안하는 것) 삭제
const { error: cErr } = await sb.from('contracts').delete().not('contract_number', 'like', 'P-%');
console.log('기존 contracts 삭제:', cErr ? '❌ '+cErr.message : '✅');

const { count: after } = await sb.from('contracts').select('*', { count: 'exact', head: true });
console.log('삭제 후 contracts:', after);
