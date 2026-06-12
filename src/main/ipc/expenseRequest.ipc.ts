import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

const APPROVER_ROLES = ['super_admin', 'company_admin'];

export function registerExpenseRequestHandlers(): void {
  ipcMain.handle('expenseRequests:getAll', async (_e, requesterId: string, filters?: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      let companyId = requester.company_id;
      if (requester.role === 'super_admin' && filters?.company_id) {
        companyId = filters.company_id;
      }

      let list = await db.getExpenseRequests(companyId);

      // 사용자 정보를 가져와서 requester_name, department 정보 보강
      const allUsers = await db.getUsers();
      const userMap = new Map<string, any>();
      (allUsers || []).forEach((u: any) => userMap.set(u.id, u));

      // 부서 목록 가져오기
      const allDepts = await db.getDepartments();
      const deptMap = new Map<string, any>();
      (allDepts || []).forEach((d: any) => deptMap.set(d.id, d));

      // 각 결의서에 신청자 정보 보강 (DB 컬럼: user_id, department_id, description)
      list = list.map((r: any) => {
        const reqUser = userMap.get(r.user_id);
        return {
          ...r,
          // 화면 호환용 별칭
          requester_id: r.user_id,
          requester_name: reqUser?.name || '',
          requester_department_id: r.department_id || reqUser?.department_id || null,
          requester_department_name: (r.department_id || reqUser?.department_id)
            ? (deptMap.get(r.department_id || reqUser?.department_id)?.name || '')
            : '',
          // title/reason 분리 (description은 "title - reason" 형식으로 저장됨)
          title: (r.description || '').split(' - ')[0] || '',
          reason: (r.description || '').split(' - ').slice(1).join(' - ') || '',
        };
      });

      // 권한별 필터링 (실제 컬럼: user_id, department_id)
      if (!APPROVER_ROLES.includes(requester.role)) {
        if (requester.role === 'department_manager' && requester.department_id) {
          const deptUserIds = new Set(
            (allUsers || [])
              .filter((u: any) => u.department_id === requester.department_id)
              .map((u: any) => u.id)
          );
          deptUserIds.add(requesterId);
          list = list.filter((r: any) => deptUserIds.has(r.user_id));
        } else {
          list = list.filter((r: any) => r.user_id === requesterId);
        }
      }
      if (filters?.status) {
        list = list.filter((r: any) => r.status === filters.status);
      }
      if (filters?.department_id) {
        list = list.filter((r: any) => (r.department_id || r.requester_department_id) === filters.department_id);
      }

      return { success: true, data: list };
    } catch (error: any) {
      return { success: false, error: error.message || '조회 실패' };
    }
  });

  ipcMain.handle('expenseRequests:create', async (_e, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const record: any = {
        id: uuidv4(),
        company_id: data.company_id || requester.company_id,
        user_id: requesterId,
        department_id: data.department_id || requester.department_id || null,
        request_date: new Date().toISOString().slice(0, 10),
        category: data.category || '',
        amount: data.amount || 0,
        description: data.title ? `${data.title}${data.reason ? ' - ' + data.reason : ''}` : (data.reason || ''),
        attachment_path: data.attachment_path || null,
        status: 'pending',
        approver_id: null,
        approved_at: null,
        reject_reason: null,
        notes: data.notes || null,
        // 회의록 반영: 매입/일반경비 구분 + 거래처/공급가/부가세
        expense_type: data.expense_type || 'general',
        supplier_name: data.supplier_name || null,
        supplier_business_number: data.supplier_business_number || null,
        supply_amount: data.supply_amount || 0,
        vat_amount: data.vat_amount || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const result = await db.addExpenseRequest(record);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message || '등록 실패' };
    }
  });

  ipcMain.handle('expenseRequests:approve', async (_e, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      if (!APPROVER_ROLES.includes(requester.role)) {
        return { success: false, error: '승인 권한이 없습니다.' };
      }
      const existing = await db.getExpenseRequestById(id);
      if (!existing) return { success: false, error: '결의서를 찾을 수 없습니다.' };

      // 회사 격리
      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '다른 회사 지출결의서는 승인할 수 없습니다.' };
      }

      // expense_settlements 자동 등록 (실제 DB 컬럼 정합)
      const descText = existing.description || '';
      const titleFromDesc = descText.split(' - ')[0] || '경비';
      try {
        const settlement: any = {
          id: uuidv4(),
          company_id: existing.company_id,
          user_id: existing.user_id,
          settlement_number: `EXP-${Date.now()}`,
          title: titleFromDesc,
          total_amount: existing.amount || 0,
          status: 'approved',
          settlement_date: new Date().toISOString().split('T')[0],
          approver_id: requesterId,
          approved_at: new Date().toISOString(),
          notes: `[지출결의서 자동등록]\n${descText}`,
          created_by: requesterId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const created = await db.addExpenseSettlement(settlement);
        const settlementId = created?.id || settlement.id;

        await db.addExpenseSettlementItem({
          id: uuidv4(),
          settlement_id: settlementId,
          expense_date: settlement.settlement_date,
          category_name: existing.category || '',
          description: descText,
          amount: existing.amount || 0,
          receipt_attached: false,
          receipt_path: null,
          vat_included: !!existing.vat_amount,
          vat_amount: existing.vat_amount || 0,
          supply_amount: existing.supply_amount || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('expense settlement 자동 등록 실패:', err);
      }

      const updated = await db.updateExpenseRequest(id, {
        status: 'approved',
        approver_id: requesterId,
        approved_at: new Date().toISOString(),
      });
      return { success: true, data: updated };
    } catch (error: any) {
      return { success: false, error: error.message || '승인 실패' };
    }
  });

  ipcMain.handle('expenseRequests:reject', async (_e, requesterId: string, id: string, reason?: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      if (!APPROVER_ROLES.includes(requester.role)) {
        return { success: false, error: '반려 권한이 없습니다.' };
      }
      const existing = await db.getExpenseRequestById(id);
      if (!existing) return { success: false, error: '결의서를 찾을 수 없습니다.' };
      // 회사 격리
      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '다른 회사 지출결의서는 반려할 수 없습니다.' };
      }
      const updated = await db.updateExpenseRequest(id, {
        status: 'rejected',
        approver_id: requesterId,
        approved_at: new Date().toISOString(),
        reject_reason: reason || '',
      });
      return { success: true, data: updated };
    } catch (error: any) {
      return { success: false, error: error.message || '반려 실패' };
    }
  });

  ipcMain.handle('expenseRequests:delete', async (_e, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      const existing = await db.getExpenseRequestById(id);
      if (!existing) return { success: false, error: '결의서를 찾을 수 없습니다.' };
      // 본인 또는 관리자만 삭제 가능
      if (existing.requester_id !== requesterId && !APPROVER_ROLES.includes(requester.role)) {
        return { success: false, error: '삭제 권한이 없습니다.' };
      }
      // 회사 격리 (관리자 삭제 시)
      if (APPROVER_ROLES.includes(requester.role) && requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '다른 회사 지출결의서는 삭제할 수 없습니다.' };
      }
      await db.deleteExpenseRequest(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || '삭제 실패' };
    }
  });
}
