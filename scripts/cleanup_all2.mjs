import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// 1. quotes linked_contract_id null
await sb.from('quotes').update({ linked_contract_id: null }).not('linked_contract_id', 'is', null);
console.log('quotes linked cleared');

// 2. contract_meeting_notes
try { await sb.from('contract_meeting_notes').delete().not('id', 'is', null); } catch(e) {}
console.log('meeting_notes cleared');

// 3. 기존 contracts 삭제
const { error } = await sb.from('contracts').delete().not('contract_number', 'like', 'P-%');
console.log('old contracts:', error ? '❌ '+error.message : '✅');

const { count } = await sb.from('contracts').select('*', { count: 'exact', head: true });
console.log('남은 contracts:', count);

// quotes도 삭제 (기존 견적은 없앨거니까)
await sb.from('quote_labor_items').delete().not('id', 'is', null);
await sb.from('quote_expense_items').delete().not('id', 'is', null);
await sb.from('quotes').delete().not('id', 'is', null);
const { count: qc } = await sb.from('quotes').select('*', { count: 'exact', head: true });
console.log('quotes:', qc);
