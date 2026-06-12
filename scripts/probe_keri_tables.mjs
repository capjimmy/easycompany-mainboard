import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);

// get a contract id
const { data: c1 } = await sb.from('contracts').select('id').limit(1);
const cid = c1[0].id;

// Try contract_subtasks table
console.log('--- contract_subtasks ---');
const stTest = {
  id: crypto.randomUUID(),
  contract_id: cid,
  title: 'TEST-PROBE',
  level: 1,
};
const r1 = await sb.from('contract_subtasks').insert(stTest).select().single();
console.log('insert error:', r1.error?.message);
if (r1.data) {
  console.log('columns:', Object.keys(r1.data));
  await sb.from('contract_subtasks').delete().eq('id', stTest.id);
}

// Try contract_payments
console.log('\n--- contract_payments ---');
const cp = await sb.from('contract_payments').select('*').limit(1);
console.log('select error:', cp.error?.message);
if (cp.data?.[0]) console.log('columns:', Object.keys(cp.data[0]));

// Try payment_conditions
console.log('\n--- payment_conditions ---');
const pc = await sb.from('payment_conditions').select('*').limit(1);
console.log('select error:', pc.error?.message);
if (pc.data?.[0]) console.log('columns:', Object.keys(pc.data[0]));
else {
  const pcTest = {
    id: crypto.randomUUID(),
    contract_id: cid,
    condition_type: 'advance',
    title: 'TEST',
    amount: 100,
    percentage: 10,
  };
  const r2 = await sb.from('payment_conditions').insert(pcTest).select().single();
  console.log('insert error:', r2.error?.message);
  if (r2.data) {
    console.log('columns:', Object.keys(r2.data));
    await sb.from('payment_conditions').delete().eq('id', pcTest.id);
  }
}
