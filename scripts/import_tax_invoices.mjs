import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

// 메인 파일 - 모두 동일한 컬럼 구조 (법인매출계산서/EASY 세금계산서/세금계산서 시트)
const MAIN_FILES = [
  { file: '세금계산서/건설경제연구원/2024년/(사)건설경제연구원_2024년계약 및 입금현황.xlsx', company: '건설경제연구원', year: 2024, sheet: '법인매출계산서' },
  { file: '세금계산서/건설경제연구원/2025년/(사)건설경제연구원_2025년계약 및 입금현황.xlsx', company: '건설경제연구원', year: 2025, sheet: '법인매출계산서' },
  { file: '세금계산서/건설경제연구원/2026년/(사)건설경제연구원_2026년계약 및 입금현황.xlsx', company: '건설경제연구원', year: 2026, sheet: '법인매출계산서' },
  { file: '세금계산서/건설환경연구소/2024년/건설환경연구소_2024년계약 및 입금현황.xls', company: '건설환경연구소', year: 2024, sheet: '세금계산서' },
  { file: '세금계산서/건설환경연구소/2025년/건설환경연구소_2025년계약 및 입금현황.xlsx', company: '건설환경연구소', year: 2025, sheet: '세금계산서' },
  { file: '세금계산서/건설환경연구소/2026년/건설환경연구소_2026년계약 및 입금현황.xlsx', company: '건설환경연구소', year: 2026, sheet: '세금계산서' },
  { file: '세금계산서/이지컨설턴트/2024년/(주)이지컨설턴트_2024년 매출계산서발행 및 입금현황.xlsx', company: '이지컨설턴트', year: 2024, sheet: 'EASY 세금계산서' },
  { file: '세금계산서/이지컨설턴트/2025년/(주)이지컨설턴트_2025년 매출계산서발행 및 입금현황.xlsx', company: '이지컨설턴트', year: 2025, sheet: 'EASY 세금계산서' },
  { file: '세금계산서/이지컨설턴트/2026년/(주)이지컨설턴트_2026년 매출계산서발행 및 입금현황.xlsx', company: '이지컨설턴트', year: 2026, sheet: 'EASY 세금계산서' },
];

// Excel serial → ISO date
function excelSerialToISO(s) {
  if (s == null || s === '' || isNaN(Number(s))) return null;
  const n = Number(s);
  if (n < 30000 || n > 70000) return null;
  const d = new Date(Math.floor(n - 25569) * 86400 * 1000);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseAmount(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Math.round(v);
  const s = String(v).replace(/[,원\s￦]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
}

function normalizeBizNumber(s) {
  if (!s) return null;
  const clean = String(s).replace(/\D/g, '');
  if (clean.length !== 10) return String(s).trim();
  return `${clean.slice(0,3)}-${clean.slice(3,5)}-${clean.slice(5)}`;
}

// === 1. 회사 매핑 ===
const { data: companies } = await sb.from('companies').select('*');
const companyMap = new Map(companies.map(c => [c.name, c]));
console.log('회사 목록:', [...companyMap.keys()]);

// === 2. 기존 거래처/세금계산서 모두 삭제 ===
console.log('\n=== 기존 데이터 삭제 ===');
const tablesToClear = ['tax_invoices', 'client_companies'];
for (const t of tablesToClear) {
  const { count: before } = await sb.from(t).select('*', { count: 'exact', head: true });
  const { error } = await sb.from(t).delete().not('id', 'is', null);
  console.log(`  ${t}: ${before}건 → ${error ? '❌ ' + error.message : '✅ 삭제'}`);
}

// === 3. 파일에서 데이터 추출 ===
const allInvoices = [];
const allClients = new Map(); // key: company_id::client_name, value: {company_id, name, business_number, ...}

function getOrCreateClient(companyId, name, biz, ceo, contact, phone, email, address) {
  if (!name || !companyId) return null;
  const key = `${companyId}::${name}`;
  if (!allClients.has(key)) {
    allClients.set(key, {
      id: crypto.randomUUID(),
      company_id: companyId,
      name: name.trim(),
      business_number: normalizeBizNumber(biz),
      ceo_name: ceo || null,
      phone: phone || null,
      email: email ? String(email).trim() : null,
      address: address || null,
      is_active: true,
      client_type: 'both',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    const c = allClients.get(key);
    if (!c.business_number && biz) c.business_number = normalizeBizNumber(biz);
    if (!c.ceo_name && ceo) c.ceo_name = ceo;
    if (!c.phone && phone) c.phone = phone;
    if (!c.email && email) c.email = String(email).trim();
    if (!c.address && address) c.address = address;
  }
  return allClients.get(key).id;
}

console.log('\n=== 파일 처리 ===');
// 통합 컬럼 매핑 (법인매출계산서/세금계산서/EASY 세금계산서 모두 동일):
// 0=NO, 1=일자, 2=업체, 3=적요, 4=금액(공급가액), 5=부가세, 6=합계, 7=입금완료일, 8=은행, 9=계약년도
// 거래처 정보는 같은 행 또는 다음 행에 분산: 18~28에 사업자번호/대표자/업태/종목/주소/이메일 등
for (const { file, company, year, sheet } of MAIN_FILES) {
  if (!fs.existsSync(file)) { console.log(`  ⚠️ 없음: ${file}`); continue; }
  const co = companyMap.get(company);
  if (!co) { console.log(`  ❌ 회사 없음: ${company}`); continue; }
  const wb = xlsx.readFile(file);
  const ws = wb.Sheets[sheet] || wb.Sheets[wb.SheetNames.find(n => n.includes('세금') || n.includes('매출'))];
  if (!ws) { console.log(`  ❌ 시트 없음: ${file} (${sheet})`); continue; }
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

  let count = 0;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i] || [];
    // 합계행, 빈 행 skip
    if (!r[2] || typeof r[2] !== 'string') continue;
    if (r[0] === '합계' || String(r[0]).trim() === '합계') continue;

    const clientName = String(r[2]).trim();
    const issueDate = excelSerialToISO(r[1]);
    if (!issueDate) continue; // 발행일 없으면 skip (NOT NULL 제약)

    const description = r[3] ? String(r[3]).trim() : '';
    const supply = parseAmount(r[4]);
    let vat = parseAmount(r[5]);
    let total = parseAmount(r[6]);
    // 합계 검증: 부가세가 누락되었거나 잘못된 경우
    if (total === 0 && supply > 0) total = supply + vat;
    if (vat === 0 && total > supply && total > 0) vat = total - supply;
    if (vat === 0 && supply > 0 && total === 0) {
      vat = Math.round(supply * 0.1);
      total = supply + vat;
    }

    const paidDate = excelSerialToISO(r[7]);
    const bank = r[8] || null;

    // 거래처 정보 (행마다 위치가 다를 수 있어 후보 셀에서 검색)
    let bizNum = null, ceo = null, email = null, address = null;
    // 사업자번호 패턴: \d{3}-\d{2}-\d{5}
    for (let j = 15; j < r.length; j++) {
      const v = r[j];
      if (typeof v === 'string') {
        if (!bizNum && /\d{3}-?\d{2}-?\d{5}/.test(v)) bizNum = v;
        if (!email && v.includes('@')) email = v.trim();
      }
    }
    // 대표자/주소 추정 (사업자번호 다음 컬럼들)
    if (bizNum) {
      const bizIdx = r.findIndex(v => v === bizNum);
      if (bizIdx >= 0) {
        if (typeof r[bizIdx+1] === 'string' && r[bizIdx+1].length < 20) ceo = r[bizIdx+1];
        if (typeof r[bizIdx+4] === 'string' && r[bizIdx+4].length > 5) address = r[bizIdx+4];
      }
    }

    const clientId = getOrCreateClient(co.id, clientName, bizNum, ceo, null, null, email, address);

    allInvoices.push({
      id: crypto.randomUUID(),
      company_id: co.id,
      client_company_id: clientId,
      invoice_number: `TI-${year}-${(count+1).toString().padStart(4, '0')}-${company.slice(0,2)}`,
      direction: 'issued',
      issue_date: issueDate,
      supply_amount: supply,
      vat_amount: vat,
      total_amount: total,
      supplier_name: company,
      supplier_business_number: '',
      supplier_representative: '',
      buyer_name: clientName,
      buyer_business_number: normalizeBizNumber(bizNum) || '',
      buyer_representative: ceo || '',
      item_description: description,
      status: paidDate ? 'paid' : 'issued',
      notes: bank ? `입금은행: ${bank}${paidDate ? ', 입금일: '+paidDate : ''}` : (paidDate ? `입금일: ${paidDate}` : ''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    count++;
  }
  console.log(`  ✓ ${company} ${year}: ${count}건`);
}

console.log(`\n총 거래처: ${allClients.size}`);
console.log(`총 세금계산서: ${allInvoices.length}`);

// === 4. 거래처 일괄 INSERT ===
console.log('\n=== 거래처 등록 ===');
const clientsArr = [...allClients.values()];
const CHUNK = 100;
for (let i = 0; i < clientsArr.length; i += CHUNK) {
  const batch = clientsArr.slice(i, i + CHUNK);
  const { error } = await sb.from('client_companies').insert(batch);
  if (error) {
    console.log(`  ❌ ${i}-${i+batch.length}: ${error.message}`);
    // 한 건씩 재시도
    for (const c of batch) {
      const { error: e2 } = await sb.from('client_companies').insert(c);
      if (e2) console.log(`    실패 [${c.name}]: ${e2.message}`);
    }
  } else {
    process.stdout.write(`  ${i+batch.length}/${clientsArr.length} `);
  }
}
console.log('\n  ✅ 거래처 등록 완료');

// === 5. 세금계산서 일괄 INSERT ===
console.log('\n=== 세금계산서 등록 ===');
let success = 0, failed = 0;
const errSamples = [];
for (let i = 0; i < allInvoices.length; i += CHUNK) {
  const batch = allInvoices.slice(i, i + CHUNK);
  const { error } = await sb.from('tax_invoices').insert(batch);
  if (error) {
    for (const inv of batch) {
      const { error: e2 } = await sb.from('tax_invoices').insert(inv);
      if (e2) {
        failed++;
        if (errSamples.length < 5) errSamples.push({ inv, err: e2.message });
      } else success++;
    }
  } else {
    success += batch.length;
  }
  process.stdout.write(`  ${success+failed}/${allInvoices.length} `);
}
console.log(`\n  ✅ ${success}건 등록, ❌ ${failed}건 실패`);
if (errSamples.length) {
  console.log('\n=== 에러 샘플 5건 ===');
  errSamples.forEach((s, idx) => {
    console.log(`\n[${idx+1}] ${s.err}`);
    console.log(`    issue_date=${s.inv.issue_date}, supply=${s.inv.supply_amount}, buyer=${s.inv.buyer_name}, num=${s.inv.invoice_number}`);
  });
}

// === 6. 회사별 통계 ===
console.log('\n=== 최종 통계 ===');
const { data: finalClients } = await sb.from('client_companies').select('company_id');
const { data: finalInvoices } = await sb.from('tax_invoices').select('company_id, total_amount');
for (const [name, c] of companyMap) {
  const cc = finalClients.filter(x => x.company_id === c.id).length;
  const ic = finalInvoices.filter(x => x.company_id === c.id);
  const sum = ic.reduce((s, x) => s + (x.total_amount || 0), 0);
  console.log(`  ${name}: 거래처 ${cc}개, 세금계산서 ${ic.length}건, 합계 ${sum.toLocaleString()}원`);
}
