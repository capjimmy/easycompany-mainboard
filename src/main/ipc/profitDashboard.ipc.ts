import { ipcMain } from 'electron';
import { db } from '../database';
import { supabase } from '../database/supabaseClient';

// 페이지네이션 헬퍼
async function fetchAll(table: string, select = '*', range = 999): Promise<any[]> {
  const arr: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + range);
    if (error) throw error;
    if (!data?.length) break;
    arr.push(...data);
    if (data.length <= range) break;
    from += range + 1;
  }
  return arr;
}

export function registerProfitDashboardHandlers(): void {
  /**
   * 순이익 계산:
   *   순이익 = 매출(현금주의: payment_receipts) - 매입(외주+경비+지출결의서매입+매입세금계산서) - 인건비(자동) - 일반관리비(수동)
   *
   * input: { year, month?, companyId? }
   * - year: 연도 (필수)
   * - month: 1~12 (선택 — 없으면 연간)
   * - companyId: super_admin이 회사 선택 시
   */
  ipcMain.handle('profit:getData', async (_event, requesterId: string, filters: any = {}) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const year: number = filters.year || new Date().getFullYear();
      const month: number | null = filters.month || null;
      const targetCompanyId: string | null = filters.companyId
        || (requester.role !== 'super_admin' ? requester.company_id : null);

      // 기간 필터
      const startDate = month
        ? `${year}-${String(month).padStart(2, '0')}-01`
        : `${year}-01-01`;
      const endDate = month
        ? `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
        : `${year}-12-31`;

      const inRange = (d?: string | null) => {
        if (!d) return false;
        const s = d.slice(0, 10);
        return s >= startDate && s <= endDate;
      };
      const inCompany = (cid?: string | null) => !targetCompanyId || cid === targetCompanyId;

      // 1) 매출 = payment_receipts.amount
      const receipts = await fetchAll('payment_receipts',
        'id, company_id, contract_id, amount, received_date, payment_date');
      const revenueRows = receipts.filter((r: any) =>
        inCompany(r.company_id) && inRange(r.received_date || r.payment_date));
      const totalRevenue = revenueRows.reduce((s, r) => s + Number(r.amount || 0), 0);

      // 2) 매입 = outsourcings + expense_settlements + expense_requests(승인분, 매입타입) + 매입세금계산서
      const outsourcings = await fetchAll('outsourcings',
        'id, company_id, contract_id, total_amount, outsourcing_amount, outsource_amount, created_at, start_date');
      const expensePurchase = outsourcings.filter((o: any) =>
        inCompany(o.company_id) && inRange(o.start_date || o.created_at));
      const totalOutsourcing = expensePurchase.reduce((s, o) =>
        s + Number(o.total_amount || o.outsourcing_amount || o.outsource_amount || 0), 0);

      const settlements = await fetchAll('expense_settlements',
        'id, company_id, total_amount, settlement_date, created_at');
      const settlementRows = settlements.filter((s: any) =>
        inCompany(s.company_id) && inRange(s.settlement_date || s.created_at));
      const totalSettlement = settlementRows.reduce((s, x) => s + Number(x.total_amount || 0), 0);

      const expReqs = await fetchAll('expense_requests',
        'id, company_id, department_id, amount, supply_amount, vat_amount, expense_type, status, request_date, created_at');
      const approvedExpReqs = expReqs.filter((r: any) =>
        inCompany(r.company_id) && r.status === 'approved' && inRange(r.request_date || r.created_at));
      const totalExpensePurchase = approvedExpReqs
        .filter((r: any) => r.expense_type === 'purchase')
        .reduce((s, r) => s + Number(r.supply_amount || 0) + Number(r.vat_amount || 0), 0);
      const totalExpenseGeneral = approvedExpReqs
        .filter((r: any) => r.expense_type !== 'purchase')
        .reduce((s, r) => s + Number(r.amount || 0), 0);

      // 매입 세금계산서 (direction='received')
      const taxInvs = await fetchAll('tax_invoices',
        'id, company_id, direction, total_amount, supply_amount, vat_amount, issue_date');
      const purchaseInvs = taxInvs.filter((t: any) =>
        inCompany(t.company_id) && t.direction === 'received' && inRange(t.issue_date));
      const totalPurchaseInvoice = purchaseInvs.reduce((s, t) =>
        s + Number(t.total_amount || (Number(t.supply_amount || 0) + Number(t.vat_amount || 0))), 0);

      const totalExpense = totalOutsourcing + totalSettlement + totalExpensePurchase + totalExpenseGeneral + totalPurchaseInvoice;

      // 3) 인건비 = 활성 직원 × 월급 (super_admin만 user_salaries 사용, 그 외엔 0)
      const users = await fetchAll('users', 'id, name, position, company_id, department_id, is_active');
      const activeUsers = users.filter((u: any) => u.is_active && inCompany(u.company_id));
      const salaryByUser: Record<string, number> = {};
      if (requester.role === 'super_admin') {
        // user_salaries는 super_admin만 접근 가능 (RLS + IPC 이중 보호)
        const { data: salaries } = await supabase.from('user_salaries').select('user_id, monthly_salary');
        for (const s of salaries || []) {
          salaryByUser[s.user_id] = Number(s.monthly_salary || 0);
        }
      }
      const monthlyLaborTotal = activeUsers.reduce((s, u) => {
        return s + (salaryByUser[u.id] || 0);
      }, 0);
      // 기간이 1개월이면 monthlyLaborTotal, 연간이면 12배
      const monthsCount = month ? 1 : 12;
      const totalLabor = monthlyLaborTotal * monthsCount;

      // 4) 일반관리비 (수동 입력 — settings 테이블 키: overhead_{year}_{month?})
      let totalOverhead = 0;
      if (month) {
        const v = await db.getSetting(`overhead_${year}_${String(month).padStart(2, '0')}`);
        totalOverhead = Number(v || 0);
      } else {
        for (let m = 1; m <= 12; m++) {
          const v = await db.getSetting(`overhead_${year}_${String(m).padStart(2, '0')}`);
          totalOverhead += Number(v || 0);
        }
      }

      // 5) 순이익
      const netProfit = totalRevenue - totalExpense - totalLabor - totalOverhead;
      const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // 6) 회사별 분리 (super_admin이고 targetCompanyId 미지정 시)
      const byCompany: any[] = [];
      if (!targetCompanyId && requester.role === 'super_admin') {
        const { data: companies } = await supabase.from('companies').select('id, name');
        for (const c of companies || []) {
          const cRev = receipts.filter((r: any) => r.company_id === c.id && inRange(r.received_date || r.payment_date))
            .reduce((s, r) => s + Number(r.amount || 0), 0);
          const cOut = outsourcings.filter((o: any) => o.company_id === c.id && inRange(o.start_date || o.created_at))
            .reduce((s, o) => s + Number(o.total_amount || o.outsourcing_amount || o.outsource_amount || 0), 0);
          const cExp = expReqs.filter((r: any) => r.company_id === c.id && r.status === 'approved' && inRange(r.request_date || r.created_at))
            .reduce((s, r) => s + (r.expense_type === 'purchase'
              ? Number(r.supply_amount || 0) + Number(r.vat_amount || 0)
              : Number(r.amount || 0)), 0);
          const cLabor = activeUsers.filter((u: any) => u.company_id === c.id)
            .reduce((s, u) => s + (salaryByUser[u.id] || 0), 0) * monthsCount;
          byCompany.push({
            company_id: c.id,
            company_name: c.name,
            revenue: cRev,
            expense: cOut + cExp,
            labor: cLabor,
            netProfit: cRev - cOut - cExp - cLabor,
          });
        }
      }

      // 7) 부서별 분리
      const { data: depts } = await supabase.from('departments').select('id, name, company_id');
      const deptMap: Record<string, any> = {};
      for (const d of depts || []) {
        if (!targetCompanyId || d.company_id === targetCompanyId) {
          deptMap[d.id] = { dept_id: d.id, dept_name: d.name, revenue: 0, expense: 0, labor: 0 };
        }
      }
      // 부서별 매출: contracts → payment_receipts 매핑
      const contracts = await fetchAll('contracts', 'id, company_id, department_id, manager_id');
      const contractDept: Record<string, string | null> = {};
      const userDept: Record<string, string | null> = {};
      for (const u of users) userDept[u.id] = u.department_id;
      for (const c of contracts) {
        contractDept[c.id] = c.department_id || userDept[c.manager_id] || null;
      }
      for (const r of revenueRows) {
        const dId = r.contract_id ? contractDept[r.contract_id] : null;
        if (dId && deptMap[dId]) deptMap[dId].revenue += Number(r.amount || 0);
      }
      // 부서별 매입(외주)
      for (const o of expensePurchase) {
        const dId = o.contract_id ? contractDept[o.contract_id] : null;
        if (dId && deptMap[dId]) deptMap[dId].expense += Number(o.total_amount || o.outsourcing_amount || o.outsource_amount || 0);
      }
      // 부서별 지출결의서
      for (const r of approvedExpReqs) {
        if (r.department_id && deptMap[r.department_id]) {
          deptMap[r.department_id].expense += r.expense_type === 'purchase'
            ? Number(r.supply_amount || 0) + Number(r.vat_amount || 0)
            : Number(r.amount || 0);
        }
      }
      // 부서별 인건비
      for (const u of activeUsers) {
        if (u.department_id && deptMap[u.department_id]) {
          deptMap[u.department_id].labor += (salaryByUser[u.id] || 0) * monthsCount;
        }
      }
      const byDepartment = Object.values(deptMap)
        .map((d: any) => ({ ...d, netProfit: d.revenue - d.expense - d.labor }))
        .sort((a, b) => b.netProfit - a.netProfit);

      // 8) 월별 추이 (연간 조회일 때만)
      const monthlyTrend: any[] = [];
      if (!month) {
        for (let m = 1; m <= 12; m++) {
          const mStart = `${year}-${String(m).padStart(2, '0')}-01`;
          const mEnd = `${year}-${String(m).padStart(2, '0')}-${new Date(year, m, 0).getDate()}`;
          const inM = (d?: string | null) => d && d.slice(0, 10) >= mStart && d.slice(0, 10) <= mEnd;
          const mRev = receipts.filter((r: any) => inCompany(r.company_id) && inM(r.received_date || r.payment_date))
            .reduce((s, r) => s + Number(r.amount || 0), 0);
          const mOut = outsourcings.filter((o: any) => inCompany(o.company_id) && inM(o.start_date || o.created_at))
            .reduce((s, o) => s + Number(o.total_amount || o.outsourcing_amount || o.outsource_amount || 0), 0);
          const mExp = expReqs.filter((r: any) => inCompany(r.company_id) && r.status === 'approved' && inM(r.request_date || r.created_at))
            .reduce((s, r) => s + (r.expense_type === 'purchase'
              ? Number(r.supply_amount || 0) + Number(r.vat_amount || 0)
              : Number(r.amount || 0)), 0);
          const mLabor = monthlyLaborTotal;
          const ovKey = `overhead_${year}_${String(m).padStart(2, '0')}`;
          const mOv = Number((await db.getSetting(ovKey)) || 0);
          monthlyTrend.push({
            month: m,
            revenue: mRev,
            expense: mOut + mExp,
            labor: mLabor,
            overhead: mOv,
            netProfit: mRev - mOut - mExp - mLabor - mOv,
          });
        }
      }

      return {
        success: true,
        data: {
          period: { year, month, startDate, endDate },
          summary: {
            revenue: totalRevenue,
            expense: totalExpense,
            expenseBreakdown: {
              outsourcing: totalOutsourcing,
              settlement: totalSettlement,
              expenseRequestPurchase: totalExpensePurchase,
              expenseRequestGeneral: totalExpenseGeneral,
              purchaseInvoice: totalPurchaseInvoice,
            },
            labor: totalLabor,
            overhead: totalOverhead,
            netProfit,
            margin,
          },
          byCompany,
          byDepartment,
          monthlyTrend,
        },
      };
    } catch (err: any) {
      console.error('[profit:getData] error:', err);
      return { success: false, error: err?.message || '조회 실패' };
    }
  });

  // 일반관리비 수동 입력 (관리자만)
  ipcMain.handle('profit:setOverhead', async (_event, requesterId: string, year: number, month: number, amount: number) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester || !['super_admin', 'company_admin'].includes(requester.role)) {
        return { success: false, error: '권한 없음' };
      }
      const key = `overhead_${year}_${String(month).padStart(2, '0')}`;
      await db.setSetting(key, amount);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || '저장 실패' };
    }
  });

  // 일반관리비 조회 (12개월 일괄)
  ipcMain.handle('profit:getOverhead', async (_event, _requesterId: string, year: number) => {
    try {
      const result: any = {};
      for (let m = 1; m <= 12; m++) {
        const key = `overhead_${year}_${String(m).padStart(2, '0')}`;
        result[m] = Number((await db.getSetting(key)) || 0);
      }
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || '조회 실패' };
    }
  });
}
