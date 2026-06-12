import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

async function pageAll(table, cols) {
  const all = []; let f = 0;
  while (true) {
    const { data } = await sb.from(table).select(cols).order('id').range(f, f + 999);
    if (!data?.length) break;
    all.push(...data); if (data.length < 1000) break; f += 1000;
  }
  return all;
}

// 1. 계약
console.log('━━━ 1. 계약 (contracts) ━━━');
const contracts = await pageAll('contracts', 'id, contract_number, service_name, client_company, total_amount, received_amount, progress_rate, contract_date, contract_end_date, company_id');
console.log('총: ' + contracts.length);

const neg = contracts.filter(c => Number(c.total_amount) < 0);
console.log(`🔴 음수 계약금액: ${neg.length}건 (환불성 가능)`);
neg.slice(0, 3).forEach(c => console.log(`   ${c.contract_number} / ${(c.service_name || '').slice(0, 40)} / ${c.total_amount}`));

const over = contracts.filter(c => {
  const t = Number(c.total_amount), r = Number(c.received_amount);
  return t > 0 && r > t;
});
console.log(`🔴 수금률 100% 초과: ${over.length}건`);
over.slice(0, 3).forEach(c => console.log(`   ${c.contract_number} / 계약:${c.total_amount} / 수금:${c.received_amount}`));

const progOver = contracts.filter(c => Number(c.progress_rate) > 100);
console.log(`🟡 진행률 100% 초과: ${progOver.length}건`);

const cliPattern = /(참조|제목|발신|TEL|합계금액|단가표|발주기관발주부서)/;
const placeHolder = contracts.filter(c => cliPattern.test(c.client_company || ''));
console.log(`🟡 의심 발주처(잔재성): ${placeHolder.length}건`);
placeHolder.slice(0, 10).forEach(c => console.log(`   ${c.contract_number} / ${c.client_company}`));

const numMap = new Map();
contracts.forEach(c => { if (c.contract_number) numMap.set(c.contract_number, (numMap.get(c.contract_number) || 0) + 1); });
const dupNums = [...numMap].filter(([k, v]) => v > 1);
console.log(`🟡 계약번호 중복: ${dupNums.length}쌍`);
dupNums.slice(0, 5).forEach(([k, v]) => console.log(`   ${k} = ${v}건`));

const minYr = 2000;
const maxYr = new Date().getFullYear() + 1;
const badDate = contracts.filter(c => {
  if (!c.contract_date) return false;
  const y = parseInt(c.contract_date.slice(0, 4));
  return y < minYr || y > maxYr;
});
console.log(`🟡 비정상 계약일자: ${badDate.length}건`);
badDate.slice(0, 5).forEach(c => console.log(`   ${c.contract_number} / ${c.contract_date}`));

// 2. 거래처
console.log('\n━━━ 2. 거래처 (client_companies) ━━━');
const clients = await pageAll('client_companies', 'id, name, business_number, ceo_name, company_id, client_type');
console.log('총: ' + clients.length);

const cliBadPattern = /(참조|제목|발신|TEL|합계금액|단가표|발주기관|발주부서|발주날짜|첨부|특이사항|반려|회수|확인요청|검토중|제목없음)/;
const trashCli = clients.filter(c => cliBadPattern.test(c.name || ''));
console.log(`🔴 의심 거래처(잔재성): ${trashCli.length}건`);
trashCli.slice(0, 15).forEach(c => console.log(`   ${c.name}`));

const badBiz = clients.filter(c => c.business_number && !/^[0-9]{3}-[0-9]{2}-[0-9]{5}$/.test(c.business_number.trim()));
console.log(`🟡 사업자번호 형식 오류: ${badBiz.length}건`);
badBiz.slice(0, 5).forEach(c => console.log(`   ${c.name} / ${c.business_number}`));

const shortNames = clients.filter(c => (c.name || '').trim().length > 0 && (c.name || '').trim().length <= 2);
console.log(`🟡 너무 짧은 거래처명: ${shortNames.length}건`);
shortNames.slice(0, 10).forEach(c => console.log(`   "${c.name}"`));

const bizMap = new Map();
clients.forEach(c => {
  if (!c.business_number) return;
  const k = c.business_number.replace(/\D/g, '');
  if (k.length >= 10) {
    if (!bizMap.has(k)) bizMap.set(k, []);
    bizMap.get(k).push(c.name);
  }
});
const dupBiz = [...bizMap].filter(([k, v]) => v.length > 1);
console.log(`🟡 사업자번호 중복: ${dupBiz.length}쌍`);
dupBiz.slice(0, 5).forEach(([k, v]) => console.log(`   biz:${k} → ${v.join(' | ')}`));

// 3. 사용자
console.log('\n━━━ 3. 사용자 (users) ━━━');
const users = await pageAll('users', 'id, username, name, email, hire_date, birth_date, role, is_active, company_id, employee_number');
console.log('총: ' + users.length);

const futureHire = users.filter(u => u.hire_date && u.hire_date > '2026-12-31');
console.log(`🟡 미래 입사일: ${futureHire.length}건`);

const empMap = new Map();
users.forEach(u => { if (u.employee_number) empMap.set(u.employee_number, (empMap.get(u.employee_number) || 0) + 1); });
const dupEmp = [...empMap].filter(([k, v]) => v > 1);
console.log(`🟡 사번 중복: ${dupEmp.length}쌍`);
dupEmp.slice(0, 3).forEach(([k, v]) => console.log(`   ${k} = ${v}건`));

const badEmail = users.filter(u => u.email && !/@/.test(u.email));
console.log(`🟡 이메일 형식 오류: ${badEmail.length}건`);

// 4. 세금계산서
console.log('\n━━━ 4. 세금계산서 (tax_invoices) ━━━');
const ti = await pageAll('tax_invoices', 'id, invoice_number, supplier_name, buyer_name, supply_amount, vat_amount, total_amount, issue_date, direction');
console.log('총: ' + ti.length);

const totalMismatch = ti.filter(t => {
  const s = Number(t.supply_amount) || 0, v = Number(t.vat_amount) || 0, tot = Number(t.total_amount) || 0;
  return tot > 0 && Math.abs((s + v) - tot) > 1;
});
console.log(`🔴 합계 ≠ 공급+VAT: ${totalMismatch.length}건`);
totalMismatch.slice(0, 5).forEach(t => console.log(`   ${t.invoice_number} / 공급:${t.supply_amount} + VAT:${t.vat_amount} ≠ 합계:${t.total_amount}`));

const futureTi = ti.filter(t => t.issue_date && t.issue_date > '2027-01-01');
console.log(`🟡 미래 발행일: ${futureTi.length}건`);

const negTi = ti.filter(t => Number(t.total_amount) < 0);
console.log(`🟡 음수 세금계산서: ${negTi.length}건`);

const selfTi = ti.filter(t => t.supplier_name && t.buyer_name && t.supplier_name === t.buyer_name);
console.log(`🟡 공급자=수취자 동일: ${selfTi.length}건`);

// 5. 외주
console.log('\n━━━ 5. 외주 (outsourcings) ━━━');
const os = await pageAll('outsourcings', 'id, vendor_name, outsource_company, service_description, outsourcing_amount, total_amount, contract_id');
console.log('총: ' + os.length);
const trashOs = os.filter(o => {
  const v = (o.vendor_name || o.outsource_company || '').trim();
  return v.includes('참조') || v === '외주';
});
console.log(`🟡 의심 외주명: ${trashOs.length}건`);
trashOs.slice(0, 5).forEach(o => console.log(`   ${o.vendor_name || o.outsource_company}`));

// 6. 운행일지
console.log('\n━━━ 6. 운행일지 (vehicle_logs) ━━━');
const vl = await pageAll('vehicle_logs', 'id, vehicle_id, driver_name, log_date, start_km, end_km, distance_km');
console.log('총: ' + vl.length);
const kmBad = vl.filter(l => l.start_km != null && l.end_km != null && Number(l.end_km) < Number(l.start_km));
console.log(`🔴 end_km < start_km: ${kmBad.length}건`);

// 7. 연차
console.log('\n━━━ 7. 연차 (leave_requests) ━━━');
const lr = await pageAll('leave_requests', 'id, user_id, leave_type, start_date, end_date, days, status');
console.log('총: ' + lr.length);
const lrBad = lr.filter(l => l.start_date && l.end_date && l.start_date > l.end_date);
console.log(`🔴 시작일 > 종료일: ${lrBad.length}건`);
const lrNeg = lr.filter(l => Number(l.days) < 0);
console.log(`🟡 음수 일수: ${lrNeg.length}건`);

// 8. 부서
console.log('\n━━━ 8. 부서 (departments) ━━━');
const { data: deps } = await sb.from('departments').select('id, name, company_id, manager_id');
console.log('총: ' + deps?.length);
const noManager = (deps || []).filter(d => !d.manager_id);
console.log(`🟡 부서장 없는 부서: ${noManager.length}건`);
noManager.forEach(d => console.log(`   ${d.name}`));

// 9. 입금
console.log('\n━━━ 9. 입금 (payment_receipts) ━━━');
const pr = await pageAll('payment_receipts', 'id, contract_id, amount, payment_date, received_date');
console.log('총: ' + pr.length);
const prNeg = pr.filter(r => Number(r.amount) < 0);
console.log(`🟡 음수 입금: ${prNeg.length}건`);
const prFuture = pr.filter(r => {
  const d = r.received_date || r.payment_date;
  return d && d > '2027-01-01';
});
console.log(`🟡 미래 입금일: ${prFuture.length}건`);
