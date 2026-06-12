import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const { data: companies } = await sb.from('companies').select('id, name');
console.log('companies:', companies);

const { data: depts } = await sb.from('departments').select('id, name, company_id');
console.log('departments:', depts);

// Sample contract structure
const { data: c1 } = await sb.from('contracts').select('*').limit(1);
console.log('contracts sample keys:', c1 && c1[0] ? Object.keys(c1[0]) : 'none');

const { data: cl1 } = await sb.from('client_companies').select('*').limit(1);
console.log('client_companies sample keys:', cl1 && cl1[0] ? Object.keys(cl1[0]) : 'none');

// outsourcings
try {
  const { data: o1, error: oe } = await sb.from('outsourcings').select('*').limit(1);
  if (oe) console.log('outsourcings error:', oe.message);
  else console.log('outsourcings sample keys:', o1 && o1[0] ? Object.keys(o1[0]) : 'empty table');
} catch (e) {
  console.log('outsourcings exception:', e.message);
}

// outsource_companies
try {
  const { data: o2, error: oe2 } = await sb.from('outsource_companies').select('*').limit(1);
  if (oe2) console.log('outsource_companies error:', oe2.message);
  else console.log('outsource_companies sample keys:', o2 && o2[0] ? Object.keys(o2[0]) : 'empty table');
} catch (e) {
  console.log('outsource_companies exception:', e.message);
}
