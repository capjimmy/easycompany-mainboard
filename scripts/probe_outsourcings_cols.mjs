import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
import crypto from 'crypto';

// Try minimal insert to discover columns
const candidates = ['contract_number', 'vendor_name', 'vendor_type', 'vendor_business_number',
  'vendor_contact_name', 'vendor_contact_phone', 'vendor_contact_email', 'service_description',
  'outsourcing_amount', 'vat_amount', 'total_amount', 'paid_amount', 'remaining_amount',
  'start_date', 'end_date', 'status', 'notes', 'show_on_calendar', 'vat_included',
  'name', 'phone', 'email', 'address', 'business_number', 'ceo_name', 'industry',
  'description', 'amount', 'is_active', 'category'];

const id = crypto.randomUUID();
const co = 'a0000000-0000-0000-0000-000000000002';
const probe = { id, company_id: co };
const { error } = await sb.from('outsourcings').insert(probe);
console.log('minimal:', error?.message);
if (!error) await sb.from('outsourcings').delete().eq('id', id);

for (const col of candidates) {
  const id2 = crypto.randomUUID();
  const row = { id: id2, company_id: co };
  if (['outsourcing_amount','vat_amount','total_amount','paid_amount','remaining_amount','amount'].includes(col)) row[col] = 0;
  else if (['show_on_calendar','vat_included','is_active'].includes(col)) row[col] = false;
  else if (['start_date','end_date'].includes(col)) row[col] = null;
  else row[col] = 'x';
  const { error: e } = await sb.from('outsourcings').insert(row);
  if (e) {
    if (!/Could not find the .* column/.test(e.message)) {
      console.log(`${col}: OK constraint err: ${e.message}`);
    } else {
      console.log(`${col}: ❌ MISSING`);
    }
  } else {
    console.log(`${col}: ✅ EXISTS`);
    await sb.from('outsourcings').delete().eq('id', id2);
  }
}
