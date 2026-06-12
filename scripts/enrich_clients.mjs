import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

// 회사별 파일과 컬럼 매핑
const FILES = [
  { file: '세금계산서/이지컨설턴트/2024년/(주)이지컨설턴트_2024년 매출계산서발행 및 입금현황.xlsx', company: '이지컨설턴트', sheet: 'EASY 세금계산서' },
  { file: '세금계산서/이지컨설턴트/2025년/(주)이지컨설턴트_2025년 매출계산서발행 및 입금현황.xlsx', company: '이지컨설턴트', sheet: 'EASY 세금계산서' },
  { file: '세금계산서/이지컨설턴트/2026년/(주)이지컨설턴트_2026년 매출계산서발행 및 입금현황.xlsx', company: '이지컨설턴트', sheet: 'EASY 세금계산서' },
  { file: '세금계산서/건설경제연구원/2024년/(사)건설경제연구원_2024년계약 및 입금현황.xlsx', company: '건설경제연구원', sheet: '법인매출계산서' },
  { file: '세금계산서/건설경제연구원/2025년/(사)건설경제연구원_2025년계약 및 입금현황.xlsx', company: '건설경제연구원', sheet: '법인매출계산서' },
  { file: '세금계산서/건설경제연구원/2026년/(사)건설경제연구원_2026년계약 및 입금현황.xlsx', company: '건설경제연구원', sheet: '법인매출계산서' },
  { file: '세금계산서/건설환경연구소/2025년/건설환경연구소_2025년계약 및 입금현황.xlsx', company: '건설환경연구소', sheet: '세금계산서' },
  { file: '세금계산서/건설환경연구소/2026년/건설환경연구소_2026년계약 및 입금현황.xlsx', company: '건설환경연구소', sheet: '세금계산서' },
];

function normalizeBizNumber(s) {
  if (!s) return null;
  const clean = String(s).replace(/\D/g, '');
  if (clean.length !== 10) return String(s).trim();
  return `${clean.slice(0,3)}-${clean.slice(3,5)}-${clean.slice(5)}`;
}

function cleanEmail(s) {
  if (!s) return null;
  // 여러 이메일이 있으면 첫 번째만
  const m = String(s).match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}

// 담당자 연락처에서 이름과 전화 분리
// "박선영 차장 010-5120-8531 / 070-4633-4774" → name: "박선영 차장", phone: "010-5120-8531"
function parseContact(s) {
  if (!s) return { name: null, phone: null };
  const str = String(s).trim();
  const phoneMatch = str.match(/(\d{2,4}[-\s]?\d{3,4}[-\s]?\d{4})/);
  const phone = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : null;
  // 전화번호 앞부분이 이름
  let name = null;
  if (phoneMatch) {
    name = str.slice(0, phoneMatch.index).trim();
  } else {
    name = str;
  }
  // 너무 길면 자르기
  if (name && name.length > 30) name = name.slice(0, 30);
  return { name: name || null, phone };
}

// === 1. 회사 매핑 ===
const { data: companies } = await sb.from('companies').select('*');
const companyMap = new Map(companies.map(c => [c.name, c]));

// === 2. 기존 거래처 로드 ===
const { data: existingClients } = await sb.from('client_companies').select('*');
console.log(`기존 거래처: ${existingClients.length}개`);

// 인덱스: 회사+사업자번호, 회사+이름
const bizIdx = new Map();
const nameIdx = new Map();
for (const c of existingClients) {
  if (c.business_number) bizIdx.set(`${c.company_id}::${c.business_number}`, c);
  nameIdx.set(`${c.company_id}::${c.name}`, c);
}

// === 3. 모든 엑셀에서 거래처 정보 수집 ===
console.log('\n=== 엑셀에서 거래처 정보 수집 ===');
const enrichmentMap = new Map(); // client_id → { ... 보강할 정보 }

for (const { file, company, sheet } of FILES) {
  if (!fs.existsSync(file)) continue;
  const co = companyMap.get(company);
  if (!co) continue;
  const wb = xlsx.readFile(file);
  const ws = wb.Sheets[sheet];
  if (!ws) continue;
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

  // 컬럼 매핑 (회사별로 살짝 다름)
  // 이지: 0=e세로, 1=일자, 2=업체, ..., 13=이메일, 15=사업자, 16=대표, 17=업태, 18=종목, 19=주소, 20=담당자연락처
  // 건경연: 0=e세로, 1=일자, 2=업체, ..., 19=비고, 20=이메일, 22=사업자, 23=대표, 24=업태, 25=종목, 26=주소, 27=담당자
  // 건환연: 0=e세로, 1=일자, 2=업체, ..., 15=이메일, 18=사업자, 19=대표, 20=업태, 21=종목, 22=주소, 23=담당자

  // 위치 자동 감지 (행 1~3에서 헤더 키워드로)
  let emailCol, bizCol, ceoCol, addrCol, contactCol;
  for (let h = 0; h < 4; h++) {
    const r = rows[h] || [];
    for (let j = 0; j < r.length; j++) {
      const v = r[j];
      if (typeof v !== 'string') continue;
      if (v.includes('이메일') || v.includes('e-mail') || v.toLowerCase() === 'email') emailCol = j;
      if (v.includes('사업자등록번호')) bizCol = j;
      if (v.includes('대표자')) ceoCol = j;
      if (v === '주소' || v.includes('사업장소재지')) addrCol = j;
      if (v.includes('담당자') && v.includes('연락처')) contactCol = j;
      if (v.includes('세금계산서발행관련담당자')) contactCol = j;
    }
  }

  let cnt = 0;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[2] || typeof r[2] !== 'string') continue;
    if (String(r[0]).trim() === '합계') continue;

    const clientName = String(r[2]).trim();
    const biz = bizCol !== undefined ? normalizeBizNumber(r[bizCol]) : null;
    const ceo = ceoCol !== undefined ? r[ceoCol] : null;
    const email = emailCol !== undefined ? cleanEmail(r[emailCol]) : null;
    const addr = addrCol !== undefined ? r[addrCol] : null;
    const contactStr = contactCol !== undefined ? r[contactCol] : null;
    const { name: contactName, phone } = parseContact(contactStr);

    // 거래처 매칭: 사업자번호 우선, 없으면 이름
    let client = biz ? bizIdx.get(`${co.id}::${biz}`) : null;
    if (!client) client = nameIdx.get(`${co.id}::${clientName}`);
    if (!client) continue;

    // 보강 정보 누적
    if (!enrichmentMap.has(client.id)) {
      enrichmentMap.set(client.id, {});
    }
    const e = enrichmentMap.get(client.id);
    if (!client.email && !e.email && email) e.email = email;
    if (!client.business_number && !e.business_number && biz) e.business_number = biz;
    if (!client.ceo_name && !e.ceo_name && ceo) e.ceo_name = ceo;
    if (!client.address && !e.address && addr) e.address = addr;
    if (!client.phone && !e.phone && phone) e.phone = phone;
    // 담당자명 → notes에 저장 (별도 컬럼 없으니)
    if (contactName && (!client.notes || !client.notes.includes(contactName))) {
      const existing = client.notes || '';
      const newNote = existing ? `${existing}\n담당자: ${contactName}${phone ? ' '+phone : ''}` : `담당자: ${contactName}${phone ? ' '+phone : ''}`;
      if (!e.notes && !existing.includes('담당자')) {
        e.notes = newNote;
      }
    }
    cnt++;
  }
  console.log(`  ${file.split('/').pop()}: ${cnt}건 처리`);
}

console.log(`\n보강 대상 거래처: ${enrichmentMap.size}개`);

// === 4. 일괄 업데이트 ===
let updated = 0;
let failed = 0;
for (const [clientId, updates] of enrichmentMap) {
  if (Object.keys(updates).length === 0) continue;
  updates.updated_at = new Date().toISOString();
  const { error } = await sb.from('client_companies').update(updates).eq('id', clientId);
  if (error) failed++;
  else updated++;
  if ((updated + failed) % 50 === 0) process.stdout.write(`  ${updated+failed}/${enrichmentMap.size} `);
}
console.log(`\n  ✅ ${updated}건 업데이트, ❌ ${failed}건 실패`);

// === 5. 최종 통계 ===
const { count: totalCl } = await sb.from('client_companies').select('*', { count: 'exact', head: true });
const { count: hasEmail } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).not('email', 'is', null);
const { count: hasCeo } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).not('ceo_name', 'is', null);
const { count: hasBiz } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).not('business_number', 'is', null);
const { count: hasPhone } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).not('phone', 'is', null);
const { count: hasAddr } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).not('address', 'is', null);
const { count: hasNotes } = await sb.from('client_companies').select('*', { count: 'exact', head: true }).not('notes', 'is', null);
console.log(`\n=== 최종 거래처 ${totalCl}개 통계 ===`);
console.log(`사업자번호: ${hasBiz}`);
console.log(`대표자: ${hasCeo}`);
console.log(`이메일: ${hasEmail}`);
console.log(`전화: ${hasPhone}`);
console.log(`주소: ${hasAddr}`);
console.log(`담당자 (notes): ${hasNotes}`);
