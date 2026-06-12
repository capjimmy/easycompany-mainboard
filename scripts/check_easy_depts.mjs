import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data: cos } = await sb.from('companies').select('*').eq('name', '이지컨설턴트').single();
const { data: deps } = await sb.from('departments').select('*').eq('company_id', cos.id);
console.log('이지컨설턴트 부서:');
deps.forEach(d => console.log(`  ${d.id} : ${d.name}`));
