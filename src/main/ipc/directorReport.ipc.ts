import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import ExcelJS from 'exceljs';
import path from 'path';
import { db } from '../database';

// 회사 코드 결정 (이름 기반)
function detectCompanyCode(name?: string): 'CERI' | 'EASY' | 'OTHER' {
  if (!name) return 'OTHER';
  if (name.includes('건설경제') || name.includes('건설환경')) return 'CERI';
  if (name.includes('이지')) return 'EASY';
  return 'OTHER';
}

// 회사별 사업부 그룹 정의 (실제 데이터의 부서명 반영)
function getDeptGroups(code: string): string[] {
  if (code === 'CERI') return ['개발사업부', '건설사업부', '학술사업부', '외주용역'];
  if (code === 'EASY') return ['인증사업부', '교육환경본부', '건축계획본부', '외주용역'];
  return ['전체', '외주용역'];
}

// 회사별 부서명 → 그룹 매핑
function classifyDepartmentByCode(code: string, deptName?: string): string {
  const n = (deptName || '').toLowerCase();
  if (code === 'CERI') {
    if (n.includes('개발')) return '개발사업부';
    if (n.includes('건설')) return '건설사업부';
    if (n.includes('학술')) return '학술사업부';
  } else if (code === 'EASY') {
    if (n.includes('친환경') || n.includes('인증')) return '인증사업부';
    if (n.includes('교육환경')) return '교육환경본부';
    if (n.includes('건축계획')) return '건축계획본부';
  }
  return deptName || '기타';
}

interface MonthSection {
  group: string;
  count: number;
  amount: number;
  rows: { client: string; service: string; amount: number }[];
}

interface MonthData {
  month: number;
  contracts: { totalCount: number; totalAmount: number; sections: MonthSection[] };
  sales: { totalCount: number; totalAmount: number; sections: MonthSection[] };
  profit: {
    totalSales: number;
    received: number;
    expense: number;
    profitVsSales: number;
    profitVsReceived: number;
    receivedByGroup: { group: string; amount: number }[];
  };
}

async function collectReportData(companyId: string, companyName: string, year: number) {
  // 데이터 로드
  const contracts = await db.getContractsByCompanyId(companyId);
  // tax_invoices (매출 = issued)
  const taxInvoices = await db.getTaxInvoices(companyId);
  // 경비
  const expensesAll = await db.getExpenseSettlements(companyId);
  // 외주
  const outsourcings = await db.getOutsourcingsByCompanyId(companyId);
  // 입금 (payment_receipts)
  const receipts = await db.getPaymentReceipts(companyId);
  // 부서
  const departments = await db.getDepartmentsByCompanyId(companyId);
  const deptById: Record<string, any> = {};
  departments.forEach((d: any) => { deptById[d.id] = d; });

  const code = detectCompanyCode(companyName);
  const groups = getDeptGroups(code);

  // 회사별 부서 분류 헬퍼 (클로저로 code 캡처)
  const classify = (deptName?: string) => classifyDepartmentByCode(code, deptName);

  // contract_id가 NULL인 세금계산서/입금의 부서 매핑용 — client_name → 같은 거래처의 계약 중 가장 최근
  // contracts.client_company가 같은 행을 모아서 부서 추론
  const clientToDeptId = new Map<string, string>();
  for (const c of contracts as any[]) {
    if (!c.client_company || !c.department_id) continue;
    const key = c.client_company.trim();
    // 가장 최근 계약의 부서 사용
    if (!clientToDeptId.has(key)) clientToDeptId.set(key, c.department_id);
  }
  const findDeptByClientName = (clientName?: string): string | null => {
    if (!clientName) return null;
    return clientToDeptId.get(clientName.trim()) || null;
  };

  const data: MonthData[] = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`;
    const isInMonth = (s?: string | null) => typeof s === 'string' && s.startsWith(ym);

    // ===== 계약: contract_date 기준 (⚠️ created_at은 마이그레이션 데이터 왜곡 방지) =====
    const monthContracts = contracts.filter((c: any) => {
      const d = c.contract_date || c.contract_start_date;
      return typeof d === 'string' && d.startsWith(ym);
    });
    // 외주 (외주용역 그룹)
    const monthOutsourcings = outsourcings.filter((o: any) => {
      const d = o.start_date || o.created_at;
      return typeof d === 'string' && d.startsWith(ym);
    });
    const contractSections: MonthSection[] = groups.map((g) => {
      if (g === '외주용역') {
        return {
          group: g,
          count: monthOutsourcings.length,
          amount: monthOutsourcings.reduce((s: number, o: any) =>
            s + (Number(o.outsourcing_amount) || Number(o.outsource_amount) || 0), 0),
          rows: monthOutsourcings.map((o: any) => ({
            client: o.vendor_name || o.outsource_company || '',
            service: o.service_description || '',
            amount: Number(o.outsourcing_amount) || Number(o.outsource_amount) || 0,
          })),
        };
      }
      const filtered = monthContracts.filter((c: any) => {
        const dept = deptById[c.department_id];
        return classify(dept?.name) === g;
      });
      return {
        group: g,
        count: filtered.length,
        amount: filtered.reduce((s: number, c: any) => s + (Number(c.total_amount) || 0), 0),
        rows: filtered.map((c: any) => ({
          client: c.client_company || '',
          service: c.service_name || '',
          amount: Number(c.total_amount) || 0,
        })),
      };
    });
    const totalContractCount = contractSections.reduce((s, sec) => s + sec.count, 0);
    const totalContractAmount = contractSections.reduce((s, sec) => s + sec.amount, 0);

    // ===== 매출: 세금계산서 발행분 기준 =====
    const monthInvoices = taxInvoices.filter((inv: any) =>
      inv.direction === 'issued' && isInMonth(inv.issue_date)
    );
    // 세금계산서의 부서 추론: contract_id 우선, 없으면 client_name으로 fallback
    const invoiceToGroup = (inv: any): string => {
      let deptId: string | null = null;
      if (inv.contract_id) {
        const contract = contracts.find((c: any) => c.id === inv.contract_id);
        deptId = contract?.department_id || null;
      }
      if (!deptId) {
        deptId = findDeptByClientName(inv.client_name || inv.buyer_name);
      }
      const dept = deptId ? deptById[deptId] : null;
      return classify(dept?.name);
    };
    const salesSections: MonthSection[] = groups.map((g) => {
      if (g === '외주용역') {
        return { group: g, count: 0, amount: 0, rows: [] };
      }
      const filtered = monthInvoices.filter((inv: any) => invoiceToGroup(inv) === g);
      return {
        group: g,
        count: filtered.length,
        amount: filtered.reduce((s: number, i: any) => s + (Number(i.total_amount) || 0), 0),
        rows: filtered.map((i: any) => ({
          client: i.client_name || i.buyer_name || '',
          service: i.item_description || '',
          amount: Number(i.total_amount) || 0,
        })),
      };
    });
    const totalSalesCount = salesSections.reduce((s, sec) => s + sec.count, 0);
    const totalSalesAmount = salesSections.reduce((s, sec) => s + sec.amount, 0);

    // ===== 순이익현황 =====
    const monthReceipts = receipts.filter((r: any) => {
      const d = r.received_date || r.payment_date || r.created_at;
      return typeof d === 'string' && d.startsWith(ym);
    });
    const totalReceived = monthReceipts.reduce((s: number, r: any) =>
      s + (Number(r.amount) || Number(r.payment_amount) || 0), 0);
    const monthExpenses = expensesAll.filter((e: any) =>
      (e.settlement_date || '').startsWith(ym) &&
      (e.status === 'approved' || e.status === 'paid')
    );
    const totalExpense = monthExpenses.reduce((s: number, e: any) => s + (Number(e.total_amount) || 0), 0);

    // 사업부서별 수금액 (계약과 동일 그룹핑) + contract_id NULL fallback
    const receiptToGroup = (r: any): string => {
      let deptId: string | null = null;
      if (r.contract_id) {
        const contract = contracts.find((c: any) => c.id === r.contract_id);
        deptId = contract?.department_id || null;
      }
      if (!deptId) {
        deptId = findDeptByClientName(r.client_name || r.payer_name);
      }
      const dept = deptId ? deptById[deptId] : null;
      return classify(dept?.name);
    };
    const receivedByGroup = groups.map((g) => {
      if (g === '외주용역') {
        return { group: g, amount: 0 };
      }
      const filtered = monthReceipts.filter((r: any) => receiptToGroup(r) === g);
      return {
        group: g,
        amount: filtered.reduce((s: number, r: any) =>
          s + (Number(r.amount) || Number(r.payment_amount) || 0), 0),
      };
    });

    data.push({
      month: m,
      contracts: { totalCount: totalContractCount, totalAmount: totalContractAmount, sections: contractSections },
      sales: { totalCount: totalSalesCount, totalAmount: totalSalesAmount, sections: salesSections },
      profit: {
        totalSales: totalSalesAmount,
        received: totalReceived,
        expense: totalExpense,
        profitVsSales: totalSalesAmount - totalExpense,
        profitVsReceived: totalReceived - totalExpense,
        receivedByGroup,
      },
    });
  }

  return { code, groups, monthly: data };
}

// ====== Excel 생성 ======
function buildWorkbook(reportData: any, companyName: string, year: number): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = '건설경제연구원 ERP';
  wb.created = new Date();

  const { code, groups, monthly } = reportData;
  const TITLE_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F2FF' } };
  const HEADER_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
  const GROUP_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  const border: any = {
    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' },
  };
  const num = (v: number) => Number(v) || 0;

  for (const md of monthly as any[]) {
    const sheet = wb.addWorksheet(`${md.month}월`, { properties: { defaultColWidth: 15 } });
    sheet.columns = [
      { width: 14 }, { width: 14 }, { width: 10 }, { width: 16 }, { width: 24 }, { width: 32 },
    ];
    let r = 1;
    // 헤더
    sheet.mergeCells(r, 1, r, 6);
    sheet.getCell(r, 1).value = `월말 회계 보고서 — ${companyName} 경영관리실 (${year}년 ${md.month}월)`;
    sheet.getCell(r, 1).font = { bold: true, size: 14 };
    sheet.getCell(r, 1).alignment = { horizontal: 'center' };
    sheet.getCell(r, 1).fill = TITLE_FILL;
    r += 2;

    // ====== 1. 계약/매출 현황 ======
    sheet.mergeCells(r, 1, r, 6);
    sheet.getCell(r, 1).value = `1. ${md.month}월 계약현황 및 매출현황`;
    sheet.getCell(r, 1).font = { bold: true, size: 12 };
    sheet.getCell(r, 1).fill = HEADER_FILL;
    r += 1;

    // 1) 계약현황
    sheet.getCell(r, 1).value = '1) 계약현황';
    sheet.getCell(r, 1).font = { bold: true };
    r += 1;
    sheet.getCell(r, 1).value = '① 총계약건수:';
    sheet.getCell(r, 2).value = md.contracts.totalCount;
    r += 1;
    sheet.getCell(r, 1).value = '② 총계약금액:';
    sheet.getCell(r, 2).value = md.contracts.totalAmount;
    sheet.getCell(r, 2).numFmt = '#,##0';
    r += 1;

    // 계약 표 헤더
    ['사업부', '용역종류', '건수', '계약금액', '업체명', '용역명'].forEach((h, i) => {
      const c = sheet.getCell(r, i + 1);
      c.value = h; c.font = { bold: true }; c.fill = HEADER_FILL; c.border = border;
      c.alignment = { horizontal: 'center' };
    });
    r += 1;

    // 사업부별 행
    for (const sec of md.contracts.sections as MonthSection[]) {
      // 그룹 헤더 행
      sheet.getCell(r, 1).value = sec.group;
      sheet.getCell(r, 1).fill = GROUP_FILL;
      sheet.getCell(r, 1).font = { bold: true };
      sheet.getCell(r, 3).value = sec.count;
      sheet.getCell(r, 4).value = sec.amount;
      sheet.getCell(r, 4).numFmt = '#,##0';
      [1, 2, 3, 4, 5, 6].forEach((c) => { sheet.getCell(r, c).border = border; });
      r += 1;
      // 세부 행
      for (const row of sec.rows) {
        sheet.getCell(r, 4).value = row.amount; sheet.getCell(r, 4).numFmt = '#,##0';
        sheet.getCell(r, 5).value = row.client;
        sheet.getCell(r, 6).value = row.service;
        [1, 2, 3, 4, 5, 6].forEach((c) => { sheet.getCell(r, c).border = border; });
        r += 1;
      }
    }

    r += 1;
    // 2) 매출현황
    sheet.getCell(r, 1).value = '2) 매출현황';
    sheet.getCell(r, 1).font = { bold: true };
    r += 1;
    sheet.getCell(r, 1).value = '① 총매출건수:';
    sheet.getCell(r, 2).value = md.sales.totalCount;
    r += 1;
    sheet.getCell(r, 1).value = '② 총매출금액:';
    sheet.getCell(r, 2).value = md.sales.totalAmount;
    sheet.getCell(r, 2).numFmt = '#,##0';
    r += 1;

    ['사업부', '용역종류', '건수', '매출금액', '업체명', '용역명'].forEach((h, i) => {
      const c = sheet.getCell(r, i + 1);
      c.value = h; c.font = { bold: true }; c.fill = HEADER_FILL; c.border = border;
      c.alignment = { horizontal: 'center' };
    });
    r += 1;

    for (const sec of md.sales.sections as MonthSection[]) {
      sheet.getCell(r, 1).value = sec.group;
      sheet.getCell(r, 1).fill = GROUP_FILL;
      sheet.getCell(r, 1).font = { bold: true };
      sheet.getCell(r, 3).value = sec.count;
      sheet.getCell(r, 4).value = sec.amount;
      sheet.getCell(r, 4).numFmt = '#,##0';
      [1, 2, 3, 4, 5, 6].forEach((c) => { sheet.getCell(r, c).border = border; });
      r += 1;
      for (const row of sec.rows) {
        sheet.getCell(r, 4).value = row.amount; sheet.getCell(r, 4).numFmt = '#,##0';
        sheet.getCell(r, 5).value = row.client;
        sheet.getCell(r, 6).value = row.service;
        [1, 2, 3, 4, 5, 6].forEach((c) => { sheet.getCell(r, c).border = border; });
        r += 1;
      }
    }

    r += 1;
    // ====== 2. 순이익현황 ======
    sheet.mergeCells(r, 1, r, 6);
    sheet.getCell(r, 1).value = `2. ${md.month}월 순이익현황`;
    sheet.getCell(r, 1).font = { bold: true, size: 12 };
    sheet.getCell(r, 1).fill = HEADER_FILL;
    r += 1;
    ['총매출금액', `${md.month}월 수금액`, '경비', '매출대비 순이익', '수금대비 순이익', '총수금액'].forEach((h, i) => {
      const c = sheet.getCell(r, i + 1);
      c.value = h; c.font = { bold: true }; c.fill = HEADER_FILL; c.border = border;
      c.alignment = { horizontal: 'center' };
    });
    r += 1;
    const totalGroupReceived = md.profit.receivedByGroup.reduce((s: number, g: any) => s + (g.amount || 0), 0);
    [num(md.profit.totalSales), num(md.profit.received), num(md.profit.expense),
      num(md.profit.profitVsSales), num(md.profit.profitVsReceived), totalGroupReceived].forEach((v, i) => {
      const c = sheet.getCell(r, i + 1);
      c.value = v; c.numFmt = '#,##0'; c.border = border;
    });
    r += 2;

    // 사업부서 수금액
    sheet.getCell(r, 1).value = '사업부서 수금액';
    sheet.getCell(r, 1).font = { bold: true }; sheet.getCell(r, 1).fill = HEADER_FILL;
    sheet.getCell(r, 1).border = border;
    sheet.getCell(r, 2).value = '수금액';
    sheet.getCell(r, 2).font = { bold: true }; sheet.getCell(r, 2).fill = HEADER_FILL;
    sheet.getCell(r, 2).border = border;
    r += 1;
    for (const g of md.profit.receivedByGroup as any[]) {
      sheet.getCell(r, 1).value = g.group;
      sheet.getCell(r, 2).value = num(g.amount); sheet.getCell(r, 2).numFmt = '#,##0';
      sheet.getCell(r, 1).border = border; sheet.getCell(r, 2).border = border;
      r += 1;
    }
  }

  // ====== 총매출현황 시트 ======
  const sum = wb.addWorksheet('총매출현황', { properties: { defaultColWidth: 13 } });
  sum.columns = [
    { width: 8 }, { width: 10 }, { width: 14 }, { width: 10 }, { width: 14 },
    { width: 10 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 10 }, { width: 14 },
  ];
  let rr = 1;
  sum.mergeCells(rr, 1, rr, 11);
  sum.getCell(rr, 1).value = `3. ${year}년 계약현황 / 매출현황 — ${companyName}`;
  sum.getCell(rr, 1).font = { bold: true, size: 14 };
  sum.getCell(rr, 1).fill = TITLE_FILL;
  sum.getCell(rr, 1).alignment = { horizontal: 'center' };
  rr += 2;

  // 1) 계약현황 매트릭스
  sum.getCell(rr, 1).value = '1) 계약현황';
  sum.getCell(rr, 1).font = { bold: true };
  rr += 1;
  // 헤더 (2줄)
  sum.getCell(rr, 1).value = '월';
  let colIdx = 2;
  for (const g of groups) {
    sum.mergeCells(rr, colIdx, rr, colIdx + 1);
    sum.getCell(rr, colIdx).value = g; sum.getCell(rr, colIdx).font = { bold: true };
    sum.getCell(rr, colIdx).alignment = { horizontal: 'center' }; sum.getCell(rr, colIdx).fill = HEADER_FILL;
    colIdx += 2;
  }
  sum.mergeCells(rr, colIdx, rr, colIdx + 1);
  sum.getCell(rr, colIdx).value = '합계'; sum.getCell(rr, colIdx).font = { bold: true };
  sum.getCell(rr, colIdx).alignment = { horizontal: 'center' }; sum.getCell(rr, colIdx).fill = HEADER_FILL;
  rr += 1;
  colIdx = 2;
  for (const g of groups) {
    sum.getCell(rr, colIdx).value = '건수'; sum.getCell(rr, colIdx + 1).value = '금액';
    sum.getCell(rr, colIdx).fill = HEADER_FILL; sum.getCell(rr, colIdx + 1).fill = HEADER_FILL;
    colIdx += 2;
  }
  sum.getCell(rr, colIdx).value = '총건수'; sum.getCell(rr, colIdx + 1).value = '총금액';
  sum.getCell(rr, colIdx).fill = HEADER_FILL; sum.getCell(rr, colIdx + 1).fill = HEADER_FILL;
  rr += 1;

  let yearTotalContractCount = 0;
  let yearTotalContractAmount = 0;
  for (const md of monthly as any[]) {
    sum.getCell(rr, 1).value = `${md.month}월`;
    let c = 2;
    let mc = 0, ma = 0;
    for (const g of groups) {
      const sec = md.contracts.sections.find((s: any) => s.group === g);
      const ct = sec?.count || 0; const am = sec?.amount || 0;
      mc += ct; ma += am;
      sum.getCell(rr, c).value = ct;
      sum.getCell(rr, c + 1).value = am; sum.getCell(rr, c + 1).numFmt = '#,##0';
      c += 2;
    }
    sum.getCell(rr, c).value = mc;
    sum.getCell(rr, c + 1).value = ma; sum.getCell(rr, c + 1).numFmt = '#,##0';
    yearTotalContractCount += mc; yearTotalContractAmount += ma;
    rr += 1;
  }
  // 연합계
  sum.getCell(rr, 1).value = '합계'; sum.getCell(rr, 1).font = { bold: true };
  sum.getCell(rr, 1).fill = HEADER_FILL;
  let c = 2;
  for (const g of groups) {
    const cntFmla = `SUM(${getCol(c)}${rr - 12}:${getCol(c)}${rr - 1})`;
    const amtFmla = `SUM(${getCol(c + 1)}${rr - 12}:${getCol(c + 1)}${rr - 1})`;
    sum.getCell(rr, c).value = { formula: cntFmla } as any;
    sum.getCell(rr, c + 1).value = { formula: amtFmla } as any; sum.getCell(rr, c + 1).numFmt = '#,##0';
    c += 2;
  }
  sum.getCell(rr, c).value = yearTotalContractCount;
  sum.getCell(rr, c + 1).value = yearTotalContractAmount; sum.getCell(rr, c + 1).numFmt = '#,##0';
  rr += 2;

  // 2) 매출현황 매트릭스
  sum.getCell(rr, 1).value = '2) 매출현황';
  sum.getCell(rr, 1).font = { bold: true };
  rr += 1;
  // 헤더 동일 구조 재사용
  sum.getCell(rr, 1).value = '월'; let cc = 2;
  for (const g of groups) {
    sum.mergeCells(rr, cc, rr, cc + 1);
    sum.getCell(rr, cc).value = g; sum.getCell(rr, cc).font = { bold: true };
    sum.getCell(rr, cc).alignment = { horizontal: 'center' }; sum.getCell(rr, cc).fill = HEADER_FILL;
    cc += 2;
  }
  sum.mergeCells(rr, cc, rr, cc + 1);
  sum.getCell(rr, cc).value = '합계'; sum.getCell(rr, cc).font = { bold: true };
  sum.getCell(rr, cc).alignment = { horizontal: 'center' }; sum.getCell(rr, cc).fill = HEADER_FILL;
  rr += 1;
  cc = 2;
  for (const g of groups) {
    sum.getCell(rr, cc).value = '건수'; sum.getCell(rr, cc + 1).value = '금액';
    sum.getCell(rr, cc).fill = HEADER_FILL; sum.getCell(rr, cc + 1).fill = HEADER_FILL;
    cc += 2;
  }
  sum.getCell(rr, cc).value = '총건수'; sum.getCell(rr, cc + 1).value = '총금액';
  sum.getCell(rr, cc).fill = HEADER_FILL; sum.getCell(rr, cc + 1).fill = HEADER_FILL;
  rr += 1;

  let ytSC = 0, ytSA = 0;
  for (const md of monthly as any[]) {
    sum.getCell(rr, 1).value = `${md.month}월`;
    let cx = 2; let mc = 0, ma = 0;
    for (const g of groups) {
      const sec = md.sales.sections.find((s: any) => s.group === g);
      const ct = sec?.count || 0; const am = sec?.amount || 0;
      mc += ct; ma += am;
      sum.getCell(rr, cx).value = ct;
      sum.getCell(rr, cx + 1).value = am; sum.getCell(rr, cx + 1).numFmt = '#,##0';
      cx += 2;
    }
    sum.getCell(rr, cx).value = mc;
    sum.getCell(rr, cx + 1).value = ma; sum.getCell(rr, cx + 1).numFmt = '#,##0';
    ytSC += mc; ytSA += ma;
    rr += 1;
  }
  sum.getCell(rr, 1).value = '합계'; sum.getCell(rr, 1).font = { bold: true };
  sum.getCell(rr, 1).fill = HEADER_FILL;
  let cx = 2;
  for (const g of groups) {
    sum.getCell(rr, cx).value = { formula: `SUM(${getCol(cx)}${rr - 12}:${getCol(cx)}${rr - 1})` } as any;
    sum.getCell(rr, cx + 1).value = { formula: `SUM(${getCol(cx + 1)}${rr - 12}:${getCol(cx + 1)}${rr - 1})` } as any;
    sum.getCell(rr, cx + 1).numFmt = '#,##0';
    cx += 2;
  }
  sum.getCell(rr, cx).value = ytSC;
  sum.getCell(rr, cx + 1).value = ytSA; sum.getCell(rr, cx + 1).numFmt = '#,##0';
  rr += 2;

  // 4. 순이익현황
  sum.getCell(rr, 1).value = `4. ${year}년 총 순이익현황`;
  sum.getCell(rr, 1).font = { bold: true, size: 12 };
  sum.getCell(rr, 1).fill = HEADER_FILL;
  rr += 1;
  ['월', '총매출금액', '수금액', '경비', '매출대비 순이익', '수금대비 순이익'].forEach((h, i) => {
    const c2 = sum.getCell(rr, i + 1);
    c2.value = h; c2.font = { bold: true }; c2.fill = HEADER_FILL; c2.alignment = { horizontal: 'center' };
  });
  rr += 1;
  for (const md of monthly as any[]) {
    sum.getCell(rr, 1).value = `${md.month}월`;
    sum.getCell(rr, 2).value = md.profit.totalSales; sum.getCell(rr, 2).numFmt = '#,##0';
    sum.getCell(rr, 3).value = md.profit.received; sum.getCell(rr, 3).numFmt = '#,##0';
    sum.getCell(rr, 4).value = md.profit.expense; sum.getCell(rr, 4).numFmt = '#,##0';
    sum.getCell(rr, 5).value = md.profit.profitVsSales; sum.getCell(rr, 5).numFmt = '#,##0';
    sum.getCell(rr, 6).value = md.profit.profitVsReceived; sum.getCell(rr, 6).numFmt = '#,##0';
    rr += 1;
  }
  return wb;
}

function getCol(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function registerDirectorReportHandlers() {
  // 데이터만 조회 (페이지 미리보기용)
  ipcMain.handle('reports:getDirectorReportData', async (_e, requesterId: string, params: { companyId: string; year: number }) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester || !['super_admin', 'company_admin'].includes(requester.role)) {
        return { success: false, error: '권한이 없습니다.' };
      }
      const co = await db.getCompanyById(params.companyId);
      if (!co) return { success: false, error: '회사를 찾을 수 없습니다.' };
      const data = await collectReportData(params.companyId, co.name, params.year);
      return { success: true, data, companyName: co.name };
    } catch (err: any) {
      console.error('getDirectorReportData error:', err);
      return { success: false, error: err?.message || '데이터 조회 실패' };
    }
  });

  // 엑셀 추출
  ipcMain.handle('reports:generateDirectorReport', async (_e, requesterId: string, params: { companyId: string; year: number }) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester || !['super_admin', 'company_admin'].includes(requester.role)) {
        return { success: false, error: '권한이 없습니다.' };
      }
      const co = await db.getCompanyById(params.companyId);
      if (!co) return { success: false, error: '회사를 찾을 수 없습니다.' };

      const data = await collectReportData(params.companyId, co.name, params.year);
      const wb = buildWorkbook(data, co.name, params.year);

      // 저장 다이얼로그
      const focused = BrowserWindow.getFocusedWindow();
      const defaultName = `${co.name}_${params.year}년_원장님보고서.xlsx`;
      const result = await dialog.showSaveDialog(focused!, {
        title: '원장님 보고서 저장',
        defaultPath: defaultName,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return { success: false, error: '저장이 취소되었습니다.' };

      await wb.xlsx.writeFile(result.filePath);
      // 저장 후 폴더 자동 열기
      shell.showItemInFolder(result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (err: any) {
      console.error('generateDirectorReport error:', err);
      return { success: false, error: err?.message || '엑셀 생성 실패' };
    }
  });
}
