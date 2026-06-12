import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

// 1. admin 사용자 조회
const { data: admin } = await sb.from('users').select('*').eq('username', 'admin').single();
console.log('admin 사용자:');
console.log('  id:', admin.id);
console.log('  role:', admin.role);
console.log('  company_id:', admin.company_id);

// 2. IPC와 동일한 로직 시뮬레이션 (super_admin, no filter)
let companyId = admin.company_id;
if (admin.role === 'super_admin') {
  companyId = null; // filter 없음
}

console.log('\n시뮬레이션 결과:');
console.log('  companyId:', companyId);

// 3. companyId가 null이면 getAllTaxInvoices, 있으면 getTaxInvoices
if (companyId) {
  const { data, count } = await sb.from('tax_invoices').select('*', { count: 'exact' }).eq('company_id', companyId).limit(3);
  console.log(`  → getTaxInvoices(${companyId}): ${count}건`);
  console.log('  샘플:', data?.slice(0, 1));
} else {
  // getAllTaxInvoices 시뮬레이션
  const { data, count } = await sb.from('tax_invoices').select('*', { count: 'exact' }).limit(3);
  console.log(`  → getAllTaxInvoices: ${count}건`);
  console.log('  샘플:', data?.slice(0, 1));
}

// 4. TaxInvoiceList.tsx의 호출 패턴 확인
