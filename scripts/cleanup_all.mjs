import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// 1. quotes linked_contract_id null로
console.log('quotes linked_contract_id null 처리...');
await sb.from('quotes').update({ linked_contract_id: null }).not('linked_contract_id', 'is', null);

// 2. contract_meeting_notes 삭제
await sb.from('contract_meeting_notes').delete().not('id', 'is', null).catch(() => {});

// 3. 기존 contracts 삭제 (P-로 시작 안하는 것)
const { error } = await sb.from('contracts').delete().not('contract_number', 'like', 'P-%');
console.log('기존 contracts 삭제:', error ? '❌ ' + error.message : '✅');

const { count } = await sb.from('contracts').select('*', { count: 'exact', head: true });
console.log('남은 contracts:', count);
