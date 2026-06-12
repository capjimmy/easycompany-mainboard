import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

const { data: c } = await sb.from('client_companies').select('*').limit(5);
console.log('=== 거래처 샘플 5건 ===');
c.forEach((r, i) => {
  console.log(`\n[${i}] ${r.name}`);
  console.log(`  사업자: ${r.business_number}`);
  console.log(`  대표자: ${r.ceo_name}`);
  console.log(`  이메일: ${r.email}`);
  console.log(`  전화: ${r.phone}`);
  console.log(`  주소: ${r.address}`);
});

// 통계
const { count: total } = await sb.from('client_companies').select('*', { count: 'exact', head: true });
const { count: hasEmail } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).not('email', 'is', null);
const { count: hasCeo } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).not('ceo_name', 'is', null);
const { count: hasBiz } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).not('business_number', 'is', null);
const { count: hasAddr } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).not('address', 'is', null);
const { count: hasPhone } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).not('phone', 'is', null);
console.log(`\n=== 거래처 ${total}개 통계 ===`);
console.log(`사업자번호: ${hasBiz}`);
console.log(`대표자: ${hasCeo}`);
console.log(`이메일: ${hasEmail}`);
console.log(`전화: ${hasPhone}`);
console.log(`주소: ${hasAddr}`);

// client_contacts 테이블 확인
const { data: contacts } = await sb.from('client_contacts').select('*').limit(3);
console.log('\nclient_contacts 샘플:', contacts);
