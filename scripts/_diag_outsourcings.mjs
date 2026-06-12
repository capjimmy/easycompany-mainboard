import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const { data: companies } = await sb.from('companies').select('id, name');
console.log('회사:', companies);

const { data: oss } = await sb.from('outsourcings').select('id, company_id, contract_id, outsource_company, notes, created_at').limit(500);
const byCo = new Map();
oss?.forEach(r => {
  const k = r.company_id + (r.contract_id ? ' :: linked' : ' :: orphan');
  byCo.set(k, (byCo.get(k) || 0) + 1);
});
console.log('breakdown:', [...byCo]);

// recent inserts
const sorted = [...(oss || [])].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
console.log('최근 3건:');
sorted.slice(0, 3).forEach(o => console.log('  ', o.created_at, o.company_id.slice(-4), o.contract_id ? 'L' : 'O', o.outsource_company));
console.log('가장 오래된 3건:');
sorted.slice(-3).forEach(o => console.log('  ', o.created_at, o.company_id.slice(-4), o.contract_id ? 'L' : 'O', o.outsource_company));

// vendor masters
const { data: vendors, count: vCount } = await sb.from('client_companies').select('id, company_id, name', { count: 'exact' }).eq('client_type', 'vendor');
const vByCo = new Map();
vendors?.forEach(r => vByCo.set(r.company_id, (vByCo.get(r.company_id) || 0) + 1));
console.log('\nclient_type=vendor 총:', vCount, '\n  by company:', [...vByCo]);

// 외주업체정보 시트가 있는 엑셀 파일에서 실제 몇 개의 vendor를 import 해야 했는지 확인
// 외주업체정보 sheet은 KERI/KHRI에 있음
