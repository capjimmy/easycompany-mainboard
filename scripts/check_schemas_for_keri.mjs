import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);

const tables = [
  'companies',
  'departments',
  'client_companies',
  'client_contacts',
  'contracts',
  'contract_subtasks',
  'contract_payments',
  'outsourcings',
];

for (const t of tables) {
  const { data, error } = await sb.from(t).select('*').limit(1);
  if (error) {
    console.log(`\n[${t}] ❌ ${error.message}`);
    continue;
  }
  console.log(`\n[${t}] columns:`, data?.[0] ? Object.keys(data[0]).join(', ') : '(empty)');
  if (data?.[0]) {
    console.log(`  sample:`, JSON.stringify(data[0]).slice(0, 500));
  }
}

// also list current 건경연/건환연 contract counts
const { data: cos } = await sb.from('companies').select('id, name');
const keri = cos.find(c => c.name === '건설경제연구원');
const khri = cos.find(c => c.name === '건설환경연구소');
console.log('\n건설경제연구원 ID:', keri?.id);
console.log('건설환경연구소 ID:', khri?.id);

if (keri) {
  const { count: cc1 } = await sb.from('contracts').select('id', { count: 'exact', head: true }).eq('company_id', keri.id);
  console.log('  contracts:', cc1);
}
if (khri) {
  const { count: cc2 } = await sb.from('contracts').select('id', { count: 'exact', head: true }).eq('company_id', khri.id);
  console.log('  contracts:', cc2);
}
