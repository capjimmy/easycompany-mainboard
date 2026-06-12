/**
 * Re-run only the outsourcings part (contracts/clients already imported).
 * Schema discovered: id, company_id, contract_id, outsource_company,
 *   outsource_amount, vendor_type, service_description, start_date,
 *   end_date, status, notes, show_on_calendar, vat_included
 */
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J',
);

const FILES = [
  'c:/Users/parkm/easy_company/mainboard/자료 26-04-27/건설경제연구원자료/temp_1776209192677.-302837503(학술).xlsx',
  'c:/Users/parkm/easy_company/mainboard/자료 26-04-27/건설경제연구원자료/temp_1776209192677.-302837503_건설경제연구원_건설사업부_260421.xlsx',
];

function clean(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === '-' || s === '없음') return null;
  return s;
}
function normBiz(s) {
  if (!s) return null;
  const c = String(s).replace(/\D/g, '');
  if (c.length !== 10) return String(s).trim() || null;
  return `${c.slice(0,3)}-${c.slice(3,5)}-${c.slice(5)}`;
}

const KERI_ID = 'a0000000-0000-0000-0000-000000000002';
const all = [];

for (const filePath of FILES) {
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets['외주업체정보'];
  if (!ws) continue;
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  const dataRows = rows.slice(2).filter(r => r && r[1]);

  for (const r of dataRows) {
    try {
      const vendorName = clean(r[1]);
      if (!vendorName) continue;
      const biz = normBiz(clean(r[2]));
      const ceo = clean(r[3]);
      const industry = clean(r[4]);
      const subIndustry = clean(r[5]);
      const address = clean(r[6]);
      const c1Name = clean(r[7]);
      const c1Phone = clean(r[9]);
      const c1Email = clean(r[10]);
      const c1Note = clean(r[11]);

      all.push({
        id: crypto.randomUUID(),
        company_id: KERI_ID,
        contract_id: null,
        outsource_company: vendorName,
        vendor_type: vendorName === '개인' ? 'individual' : 'company',
        outsource_amount: 0,
        service_description: [
          biz ? `사업자: ${biz}` : '',
          ceo ? `대표: ${ceo}` : '',
          industry ? `업태: ${industry}` : '',
          subIndustry ? `종목: ${subIndustry}` : '',
          address ? `주소: ${address}` : '',
          c1Name ? `담당: ${c1Name}` : '',
          c1Phone ? `전화: ${c1Phone}` : '',
          c1Email ? `이메일: ${c1Email}` : '',
        ].filter(Boolean).join(' | ') || vendorName,
        start_date: null,
        end_date: null,
        status: 'pending',
        notes: c1Note || '',
        show_on_calendar: false,
        vat_included: true,
      });
    } catch (e) {
      console.log(`row error: ${e.message}`);
    }
  }
}

console.log(`외주 ${all.length}건 등록 시도`);
let ok = 0, fail = 0;
const reasons = new Map();
for (const r of all) {
  const { error } = await sb.from('outsourcings').insert(r);
  if (error) {
    fail++;
    const k = error.message.slice(0, 100);
    reasons.set(k, (reasons.get(k) || 0) + 1);
  } else ok++;
}
console.log(`✅ ${ok}건 등록, ❌ ${fail}건 실패`);
if (fail) for (const [k, v] of reasons) console.log(`  [${v}] ${k}`);
