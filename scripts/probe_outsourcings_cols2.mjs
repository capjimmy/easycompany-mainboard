import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
import crypto from 'crypto';

const co = 'a0000000-0000-0000-0000-000000000002';
const candidates = [
  'subcontractor_name','company_name','partner_name','outsource_name','outsource_company',
  'biz_number','representative','representative_name','contact_name','contact_phone','contact_email',
  'work_description','title','service_name','contract_id',
  'outsource_amount','contract_amount','amount_supply','total','price',
  'vat','paid','remaining','progress',
];

for (const col of candidates) {
  const id2 = crypto.randomUUID();
  const row = { id: id2, company_id: co };
  if (col.includes('amount') || ['vat','paid','remaining','total','price'].includes(col)) row[col] = 0;
  else row[col] = 'x';
  const { error: e } = await sb.from('outsourcings').insert(row);
  if (e) {
    if (!/Could not find the .* column/.test(e.message)) {
      console.log(`${col}: OK col exists, constraint: ${e.message.slice(0,80)}`);
      await sb.from('outsourcings').delete().eq('id', id2);
    } else {
      console.log(`${col}: missing`);
    }
  } else {
    console.log(`${col}: ✅ EXISTS`);
    await sb.from('outsourcings').delete().eq('id', id2);
  }
}
