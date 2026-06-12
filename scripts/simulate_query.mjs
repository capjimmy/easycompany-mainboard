import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
// 임철희(이지컨설턴트 super_admin)로 회사 선택했을 때 조회
const tilCompanyId = 'a0000000-0000-0000-0000-000000000001'; // 이지컨설턴트
const { data, error } = await sb.from('tax_invoices').select('*').eq('company_id', tilCompanyId).order('issue_date', { ascending: false }).limit(5);
console.log('이지컨설턴트 세금계산서:', data?.length || 0, '건');
if (error) console.log('error:', error);
if (data && data.length > 0) {
  console.log('첫 건:', JSON.stringify(data[0], null, 2));
}
