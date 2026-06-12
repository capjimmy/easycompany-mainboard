/**
 * client_companies(client_type=vendor) → outsourcings 시드
 *
 * 외주업체정보 시트의 vendor 마스터(28건)가 외주관리 페이지에 보이도록
 * outsourcings에 1행씩 생성. contract_id=null, amount=0, status=pending.
 *
 * 이미 같은 (company_id, vendor_name)으로 outsourcings 행이 있으면 skip,
 * 없으면 생성하고 client_contacts(primary)에서 담당자/전화/이메일 채움.
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);

async function fetchAll(table, columns = '*', filters = (q) => q) {
  const all = [];
  let from = 0;
  while (true) {
    let q = sb.from(table).select(columns).order('id').range(from, from + 999);
    q = filters(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

const vendors = await fetchAll('client_companies', '*', (q) => q.eq('client_type', 'vendor'));
console.log(`vendor master: ${vendors.length}건`);

const existingOss = await fetchAll('outsourcings', 'company_id, vendor_name');
const existingKeys = new Set(existingOss.map((r) => `${r.company_id}::${(r.vendor_name || '').trim()}`));
console.log(`기존 outsourcings 키: ${existingKeys.size}건`);

const contacts = await fetchAll('client_contacts');
const primaryByVendor = new Map();
for (const c of contacts) {
  const cur = primaryByVendor.get(c.client_company_id);
  if (!cur || c.is_primary) primaryByVendor.set(c.client_company_id, c);
}

const newRows = [];
for (const v of vendors) {
  const key = `${v.company_id}::${(v.name || '').trim()}`;
  if (existingKeys.has(key)) continue;
  if (!v.name) continue;

  const c = primaryByVendor.get(v.id);
  newRows.push({
    id: crypto.randomUUID(),
    company_id: v.company_id,
    contract_id: null,
    contract_number: null,
    vendor_name: v.name,
    vendor_type: 'company',
    vendor_business_number: v.business_number || null,
    vendor_contact_name: c?.name || null,
    vendor_contact_phone: c?.phone || null,
    vendor_contact_email: c?.email || null,
    service_description: '외주업체 등록 (계약 미지정)',
    outsourcing_amount: 0,
    vat_amount: 0,
    total_amount: 0,
    paid_amount: 0,
    remaining_amount: 0,
    status: 'pending',
    notes: [
      v.ceo_name ? `대표: ${v.ceo_name}` : '',
      v.address ? `주소: ${v.address}` : '',
    ].filter(Boolean).join(' | ') || null,
    show_on_calendar: false,
    vat_included: true,
    // legacy 컬럼도 채움 (구코드 호환)
    outsource_company: v.name,
    outsource_contact: c?.name || null,
    outsource_phone: c?.phone || null,
    outsource_amount: 0,
    budget: 0,
    actual_cost: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

console.log(`신규 생성 대상: ${newRows.length}건`);

if (newRows.length) {
  const { data, error } = await sb.from('outsourcings').insert(newRows).select('id');
  if (error) {
    console.error('❌ insert 실패:', error.message);
    process.exit(1);
  }
  console.log(`✅ ${data.length}건 추가`);
}

// 회사별 최종 카운트
const final = await fetchAll('outsourcings', 'company_id');
const byCo = new Map();
for (const r of final) byCo.set(r.company_id, (byCo.get(r.company_id) || 0) + 1);
const { data: cos } = await sb.from('companies').select('id, name');
const nameOf = new Map(cos?.map((c) => [c.id, c.name]) || []);
console.log('\n회사별 outsourcings:');
for (const [cid, n] of byCo) console.log(`  ${nameOf.get(cid) || cid.slice(-4)}: ${n}건`);
