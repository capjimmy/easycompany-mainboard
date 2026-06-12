/**
 * 건설경제연구원 신규 엑셀 데이터 임포트 (2026-04-27)
 *
 * 입력 파일:
 *  - temp_1776209192677.-302837503(학술).xlsx                       → 학술사업부
 *  - temp_1776209192677.-302837503_건설경제연구원_건설사업부_260421.xlsx → 건설사업부
 *
 * 시트 구조 (공통):
 *  - 프로젝트정보 (Sheet 1)
 *  - 외주업체정보 (Sheet 2)
 *  - 거래처정보 (Sheet 3)
 *
 * 동작:
 *  1) 프로젝트정보 → contracts (회사+부서 자동매핑)
 *  2) 거래처정보   → client_companies (upsert by name+company)
 *  3) 외주업체정보 → outsourcings (vendor only, contract_id 미연결)
 *  4) 기존 데이터 삭제 ❌ (별도 스크립트가 처리)
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

// === Helpers ===
function excelSerialToISO(s) {
  if (s == null || s === '') return null;
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (isNaN(Number(s))) return null;
  const n = Number(s);
  if (n < 30000 || n > 70000) return null;
  const d = new Date(Math.floor(n - 25569) * 86400 * 1000);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function normBiz(s) {
  if (!s) return null;
  const clean = String(s).replace(/\D/g, '');
  if (clean.length !== 10) return String(s).trim() || null;
  return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5)}`;
}

function clean(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === '-' || s === '없음') return null;
  return s;
}

function toInt(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : Math.round(n);
}

// === 1. 회사/부서 매핑 ===
console.log('=== 회사/부서 매핑 로드 ===');
const { data: companies } = await sb.from('companies').select('id, name');
const companyMap = new Map(companies.map(c => [c.name, c]));
const { data: departments } = await sb.from('departments').select('id, name, company_id');
const deptMap = new Map();
departments.forEach(d => deptMap.set(`${d.company_id}::${d.name}`, d));

// "(사)건설경제연구원" or "건설경제연구원" → 건설경제연구원
function resolveCompany(name) {
  if (!name) return null;
  const n = String(name).replace(/^\(사\)/, '').trim();
  return companyMap.get(n) || companyMap.get('건설경제연구원') || null;
}

const KERI = companyMap.get('건설경제연구원');
if (!KERI) {
  console.error('❌ 건설경제연구원 회사를 찾을 수 없음');
  process.exit(1);
}
console.log(`  건설경제연구원 ID: ${KERI.id}`);

// === 2. 기존 client_companies 캐시 ===
async function fetchAll(t, c) {
  const all = [];
  let from = 0;
  while (true) {
    const { data } = await sb.from(t).select(c).order('id').range(from, from + 999);
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

const existingClients = await fetchAll('client_companies', 'id, company_id, name, business_number');
const clientByName = new Map();
const clientByBiz = new Map();
existingClients.forEach(c => {
  if (c.name) clientByName.set(`${c.company_id}::${c.name.trim()}`, c);
  if (c.business_number) clientByBiz.set(`${c.company_id}::${c.business_number}`, c);
});
console.log(`  기존 client_companies: ${existingClients.length}건`);

// === 3. Excel 파싱 ===
function parseSheet(ws) {
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
}

const allContracts = [];
const newClients = [];
const allOutsourcings = [];

const fileStats = [];

for (const filePath of FILES) {
  const fileLabel = filePath.split('/').pop();
  console.log(`\n=== 파일: ${fileLabel} ===`);
  const wb = xlsx.readFile(filePath);

  const stats = { file: fileLabel, projects: 0, clients: 0, outsource: 0, errors: [] };

  // --- 프로젝트정보 ---
  const projSheet = wb.Sheets['프로젝트정보'];
  if (projSheet) {
    const rows = parseSheet(projSheet);
    // Row 0: title, Row 1: header, Row 2+: data
    const dataRows = rows.slice(2).filter(r => r && r.some(c => c != null && c !== ''));
    stats.projects = dataRows.length;
    console.log(`  프로젝트정보 행: ${dataRows.length}`);

    if (dataRows.length > 0) {
      console.log(`  [디버그] 첫 행: ${JSON.stringify(dataRows[0]).slice(0, 300)}`);
    }

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      try {
        const companyName = clean(r[1]);
        const deptName = clean(r[2]);
        const projectName = clean(r[3]);
        const location = clean(r[4]);
        const progressKo = clean(r[5]);
        const clientName = clean(r[6]);
        const manager = clean(r[7]);
        const quoteNumber = clean(r[8]);
        const quoteDate = excelSerialToISO(r[9]);
        const contractNumber = clean(r[10]);
        const contractDate = excelSerialToISO(r[11]);
        const startDate = excelSerialToISO(r[12]);
        const endDateRaw = r[13];
        const endDate = excelSerialToISO(endDateRaw);
        const supply = toInt(r[14]);
        const vat = toInt(r[15]);
        const total = toInt(r[16]);
        const folderPath = clean(r[23]);
        const remarks = clean(r[24]);

        if (!projectName && !contractNumber) continue;

        const co = resolveCompany(companyName) || KERI;
        const deptKey = `${co.id}::${deptName}`;
        const dept = deptName ? deptMap.get(deptKey) : null;

        const progressMap = {
          진행: 'in_progress',
          완료: 'completed',
          중단: 'cancelled',
          보류: 'on_hold',
        };
        const progress = progressMap[progressKo] || 'in_progress';

        // upsert client by name (under KERI company namespace)
        let clientCompanyId = null;
        if (clientName) {
          const key = `${co.id}::${clientName}`;
          let found = clientByName.get(key);
          if (!found) {
            const newId = crypto.randomUUID();
            const cnew = {
              id: newId,
              company_id: co.id,
              name: clientName,
              is_active: true,
              client_type: 'both',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            newClients.push(cnew);
            found = { id: newId, company_id: co.id, name: clientName };
            clientByName.set(key, found);
          }
          clientCompanyId = found.id;
        }

        // collect outsource workers from this row (cols 25..44, pairs of name/type)
        const outsourceVendors = [];
        for (let c = 25; c <= 44; c += 2) {
          const task = clean(r[c]);
          const worker = clean(r[c + 1]);
          // worker col holds employee name when 담당자, vendor name when 외주
          // "작업자N(담당자/외주)" → in 학술 file, sample: r[26]="정현암", r[27]="외주"
          // Actually the column header indicates "작업자N(담당자/외주)" so r[c]=task name,
          // r[c+1]=person/vendor identifier (single column not paired). Adjust.
        }

        // contract_number 보정
        let cn = contractNumber;
        if (!cn) cn = `KERI-${(allContracts.length + 1).toString().padStart(4, '0')}`;
        // ensure unique within batch
        while (allContracts.some(x => x.contract_number === cn)) cn += '-D';

        const totalAmount = total || (supply + vat) || 0;
        const supplyAmount = supply || (totalAmount ? Math.round(totalAmount / 1.1) : 0);
        const vatAmount = vat || (totalAmount ? totalAmount - supplyAmount : 0);

        allContracts.push({
          id: crypto.randomUUID(),
          company_id: co.id,
          department_id: dept?.id || null,
          contract_number: cn,
          client_company: clientName || '',
          service_name: projectName || '',
          description: location ? `현장위치: ${location}` : null,
          contract_type: '용역',
          contract_date: contractDate || null,
          contract_start_date: startDate || null,
          contract_end_date: typeof endDateRaw === 'string' && !endDate ? null : (endDate || null),
          contract_amount: supplyAmount,
          vat_amount: vatAmount,
          total_amount: totalAmount,
          received_amount: 0,
          remaining_amount: totalAmount,
          progress,
          progress_note: progressKo || null,
          manager_name: manager || null,
          notes: [
            quoteNumber ? `견적번호: ${quoteNumber}` : '',
            quoteDate ? `견적일자: ${quoteDate}` : '',
            typeof endDateRaw === 'string' && !endDate ? `준공일: ${endDateRaw}` : '',
            folderPath ? `폴더: ${folderPath}` : '',
            remarks ? `특이사항: ${remarks}` : '',
          ].filter(Boolean).join(' | ') || null,
          source_file_path: fileLabel,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        stats.errors.push(`프로젝트 행 ${i + 3}: ${e.message}`);
      }
    }
  }

  // --- 거래처정보 ---
  const clientSheet = wb.Sheets['거래처정보'];
  if (clientSheet) {
    const rows = parseSheet(clientSheet);
    const dataRows = rows.slice(2).filter(r => r && r[1]); // need 거래처명 (col 1)
    stats.clients = dataRows.length;
    console.log(`  거래처정보 행: ${dataRows.length}`);

    if (dataRows.length > 0) {
      console.log(`  [디버그] 첫 거래처: ${JSON.stringify(dataRows[0]).slice(0, 250)}`);
    }

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      try {
        const name = clean(r[1]);
        if (!name) continue;
        const biz = normBiz(clean(r[2]));
        const ceo = clean(r[3]);
        const industry = clean(r[4]);
        const subIndustry = clean(r[5]);
        const address = clean(r[6]);
        // contact1 (cols 7-11)
        const c1Name = clean(r[7]);
        const c1Title = clean(r[8]);
        const c1Phone = clean(r[9]);
        const c1Email = clean(r[10]);
        const c1Note = clean(r[11]);

        const key = `${KERI.id}::${name}`;
        const existing = clientByName.get(key);

        const update = {
          business_number: biz,
          ceo_name: ceo,
          industry: [industry, subIndustry].filter(Boolean).join(' / ') || null,
          address,
          phone: c1Phone,
          email: c1Email,
          notes: [
            c1Name ? `담당: ${c1Name}` : '',
            c1Title ? `직위: ${c1Title}` : '',
            c1Note ? `비고: ${c1Note}` : '',
          ].filter(Boolean).join(' / ') || null,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          // queue update by id
          await sb.from('client_companies').update(update).eq('id', existing.id);
        } else {
          const id = crypto.randomUUID();
          newClients.push({
            id,
            company_id: KERI.id,
            name,
            ...update,
            is_active: true,
            client_type: 'both',
            created_at: new Date().toISOString(),
          });
          clientByName.set(key, { id, company_id: KERI.id, name });
        }
      } catch (e) {
        stats.errors.push(`거래처 행 ${i + 3}: ${e.message}`);
      }
    }
  }

  // --- 외주업체정보 ---
  const osSheet = wb.Sheets['외주업체정보'];
  if (osSheet) {
    const rows = parseSheet(osSheet);
    const dataRows = rows.slice(2).filter(r => r && r[1]);
    stats.outsource = dataRows.length;
    console.log(`  외주업체정보 행: ${dataRows.length}`);

    if (dataRows.length > 0) {
      console.log(`  [디버그] 첫 외주: ${JSON.stringify(dataRows[0]).slice(0, 250)}`);
    }

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
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

        // outsourcings table actual columns:
        //   id, company_id, contract_id, outsource_company, outsource_amount,
        //   vendor_type, service_description, start_date, end_date, status,
        //   notes, show_on_calendar, vat_included
        allOutsourcings.push({
          id: crypto.randomUUID(),
          company_id: KERI.id,
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
        stats.errors.push(`외주 행 ${i + 3}: ${e.message}`);
      }
    }
  }

  fileStats.push(stats);
}

// === 4. INSERT ===
console.log(`\n=== 신규 client_companies 등록: ${newClients.length}건 ===`);
let clOk = 0, clFail = 0;
for (let i = 0; i < newClients.length; i += 100) {
  const batch = newClients.slice(i, i + 100);
  const { error } = await sb.from('client_companies').insert(batch);
  if (error) {
    for (const c of batch) {
      const { error: e2 } = await sb.from('client_companies').insert(c);
      if (e2) {
        clFail++;
        console.log(`  ❌ ${c.name}: ${e2.message}`);
      } else clOk++;
    }
  } else clOk += batch.length;
}
console.log(`  ✅ ${clOk}건 등록, ❌ ${clFail}건 실패`);

console.log(`\n=== contracts 등록: ${allContracts.length}건 ===`);
let cOk = 0, cFail = 0;
const cFailReasons = new Map();
for (let i = 0; i < allContracts.length; i += 100) {
  const batch = allContracts.slice(i, i + 100);
  const { error } = await sb.from('contracts').insert(batch);
  if (error) {
    for (const r of batch) {
      const { error: e2 } = await sb.from('contracts').insert(r);
      if (e2) {
        cFail++;
        const k = e2.message.slice(0, 100);
        cFailReasons.set(k, (cFailReasons.get(k) || 0) + 1);
      } else cOk++;
    }
  } else cOk += batch.length;
  process.stdout.write(`${cOk + cFail}/${allContracts.length} `);
}
console.log(`\n  ✅ ${cOk}건 등록, ❌ ${cFail}건 실패`);
if (cFail > 0) {
  console.log('  실패 사유:');
  for (const [k, v] of cFailReasons) console.log(`    [${v}] ${k}`);
}

console.log(`\n=== outsourcings 등록: ${allOutsourcings.length}건 ===`);
let oOk = 0, oFail = 0;
const oFailReasons = new Map();
for (let i = 0; i < allOutsourcings.length; i += 100) {
  const batch = allOutsourcings.slice(i, i + 100);
  const { error } = await sb.from('outsourcings').insert(batch);
  if (error) {
    for (const r of batch) {
      const { error: e2 } = await sb.from('outsourcings').insert(r);
      if (e2) {
        oFail++;
        const k = e2.message.slice(0, 100);
        oFailReasons.set(k, (oFailReasons.get(k) || 0) + 1);
      } else oOk++;
    }
  } else oOk += batch.length;
}
console.log(`  ✅ ${oOk}건 등록, ❌ ${oFail}건 실패`);
if (oFail > 0) {
  console.log('  실패 사유:');
  for (const [k, v] of oFailReasons) console.log(`    [${v}] ${k}`);
}

// === 5. 요약 ===
console.log('\n========== 최종 요약 ==========');
for (const s of fileStats) {
  console.log(`📂 ${s.file}`);
  console.log(`   프로젝트: ${s.projects}, 거래처: ${s.clients}, 외주: ${s.outsource}`);
  if (s.errors.length) {
    console.log(`   에러 ${s.errors.length}건:`);
    s.errors.slice(0, 5).forEach(e => console.log(`     - ${e}`));
  }
}
console.log(`\n총합: contracts ${cOk}/${allContracts.length}, clients ${clOk}/${newClients.length}, outsourcings ${oOk}/${allOutsourcings.length}`);
