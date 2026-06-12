import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const tables = ['tax_invoices', 'contracts', 'client_companies', 'client_contacts', 'payment_receipts'];
for (const t of tables) {
  const { data, error } = await sb.from(t).select('*').limit(1);
  if (error) console.log(t, 'ERROR', error.message);
  else console.log(t, ':', Object.keys(data[0] || {}).join(', '));
  console.log();
}
