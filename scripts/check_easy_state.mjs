import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const COMPANY_EASY = 'a0000000-0000-0000-0000-000000000001';
const COMPANY_GUNHWAN = '63903dac-0c2b-404e-9f8e-aef80bcf13b5';

const { data: easyContracts } = await sb.from('contracts').select('id,contract_number,client_company,service_name,notes,source_file_path').eq('company_id', COMPANY_EASY);
console.log('EASY contracts:', easyContracts.length);

const { data: gunhwanContracts } = await sb.from('contracts').select('id,contract_number,client_company,service_name,notes,source_file_path').eq('company_id', COMPANY_GUNHWAN);
console.log('GUNHWAN contracts:', gunhwanContracts.length);

// 건환연: 어떤게 이지 출처인지 확인
const easySrc = gunhwanContracts.filter(c =>
  (c.notes && /이지|건환/.test(c.notes)) ||
  (c.source_file_path && /이지|건환|친환경|용역진행률|인증수수료|계약서 목록|EASY/i.test(c.source_file_path))
);
const keriSrc = gunhwanContracts.filter(c => !((c.notes && /이지|건환/.test(c.notes)) || (c.source_file_path && /이지|건환|친환경|용역진행률|인증수수료|계약서 목록|EASY/i.test(c.source_file_path))));
console.log('  GUNHWAN with easy origin:', easySrc.length);
console.log('  GUNHWAN with non-easy origin (keep):', keriSrc.length);
console.log('  sample non-easy:', keriSrc.slice(0,5).map(c => ({n: c.contract_number, s: c.service_name?.slice(0,30), src: c.source_file_path?.slice(0,40)})));
console.log('  sample easy origin:', easySrc.slice(0,3).map(c => ({n: c.contract_number, src: c.source_file_path?.slice(0,40)})));

// schemas
const { data: con1 } = await sb.from('contracts').select('*').limit(1);
console.log('\ncontracts cols:', Object.keys(con1[0] || {}));

const { data: pc } = await sb.from('payment_conditions').select('*').limit(1);
console.log('payment_conditions cols:', Object.keys(pc[0] || {}));

const { data: cs } = await sb.from('contract_subtasks').select('*').limit(1);
console.log('contract_subtasks cols:', Object.keys(cs[0] || {}));

const { data: cp } = await sb.from('contract_payments').select('*').limit(1);
console.log('contract_payments cols:', Object.keys(cp[0] || {}));

const { data: ot } = await sb.from('outsourcings').select('*').limit(1);
console.log('outsourcings cols:', Object.keys(ot[0] || {}));

const { data: cc } = await sb.from('client_companies').select('*').limit(1);
console.log('client_companies cols:', Object.keys(cc[0] || {}));

const { data: cco } = await sb.from('client_contacts').select('*').limit(1);
console.log('client_contacts cols:', Object.keys(cco[0] || {}));

const { data: pr } = await sb.from('payment_receipts').select('*').limit(1).maybeSingle();
console.log('payment_receipts row:', pr ? Object.keys(pr) : 'empty');
