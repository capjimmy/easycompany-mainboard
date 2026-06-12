import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const KERI = 'a0000000-0000-0000-0000-000000000002';

const { count: cKeri } = await sb.from('contracts').select('*', { count: 'exact', head: true }).eq('company_id', KERI);
const { count: cOsKeri } = await sb.from('outsourcings').select('*', { count: 'exact', head: true }).eq('company_id', KERI);
const { count: cClKeri } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).eq('company_id', KERI);

const { data: byDept } = await sb.from('contracts').select('department_id').eq('company_id', KERI);
const deptCounts = {};
byDept.forEach(c => { const k = c.department_id || 'null'; deptCounts[k] = (deptCounts[k]||0)+1; });

const { data: depts } = await sb.from('departments').select('id, name').eq('company_id', KERI);
const deptName = Object.fromEntries(depts.map(d => [d.id, d.name]));

console.log(`KERI contracts: ${cKeri}`);
console.log(`KERI outsourcings: ${cOsKeri}`);
console.log(`KERI client_companies: ${cClKeri}`);
console.log('contracts by dept:', Object.entries(deptCounts).map(([k,v]) => `${deptName[k]||k}: ${v}`).join(', '));

// Sample inserted contracts
const { data: sample } = await sb.from('contracts').select('contract_number, service_name, contract_amount, total_amount, department_id, source_file_path').eq('company_id', KERI).order('created_at', { ascending: false }).limit(5);
console.log('\n최근 입력 샘플:');
sample.forEach(s => console.log(`  ${s.contract_number} | ${(s.service_name||'').slice(0,40)} | 공급=${s.contract_amount} 총액=${s.total_amount} | dept=${deptName[s.department_id]||'null'}`));
