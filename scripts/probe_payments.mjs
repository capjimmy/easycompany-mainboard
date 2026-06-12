import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);
const { data: c1 } = await sb.from('contracts').select('id').limit(1);
const cid = c1[0].id;

// Try with various column hypotheses
console.log('--- contract_payments insert tests ---');
const tries = [
  { id: crypto.randomUUID(), contract_id: cid, stage: '선급금', ratio: 30, amount: 100, due_condition: '계약시' },
  { id: crypto.randomUUID(), contract_id: cid, payment_type: 'advance', amount: 100 },
  { id: crypto.randomUUID(), contract_id: cid, payment_stage: '선급금', amount: 100 },
];
for (const t of tries) {
  const r = await sb.from('contract_payments').insert(t).select().single();
  console.log(`Try [${Object.keys(t).join(',')}] →`, r.error?.message || `OK: ${Object.keys(r.data).join(',')}`);
  if (r.data) await sb.from('contract_payments').delete().eq('id', t.id);
}

// Just empty insert to see required cols
const r2 = await sb.from('contract_payments').insert({ id: crypto.randomUUID() }).select().single();
console.log('empty insert:', r2.error?.message);
