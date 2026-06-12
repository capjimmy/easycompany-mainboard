import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerExpenseSettlementHandlers(): void {
  // Get all expense settlements
  ipcMain.handle('expenses:getAll', async (_event, requesterId: string, filters?: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      let companyId = requester.company_id;
      if (requester.role === 'super_admin' && filters?.company_id) {
        companyId = filters.company_id;
      }

      let settlements = await db.getExpenseSettlements(companyId);

      // Filter by status
      if (filters?.status) {
        settlements = settlements.filter((s: any) => s.status === filters.status);
      }
      // Filter by requester (for non-admin users to see only their own)
      if (filters?.requested_by) {
        settlements = settlements.filter((s: any) => s.requested_by === filters.requested_by);
      }
      // Search
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        settlements = settlements.filter((s: any) =>
          s.settlement_number?.toLowerCase().includes(search) ||
          s.title?.toLowerCase().includes(search) ||
          s.requester_name?.toLowerCase().includes(search)
        );
      }

      return { success: true, settlements };
    } catch (error: any) {
      return { success: false, error: error.message || '경비정산 조회에 실패했습니다.' };
    }
  });

  // Create expense settlement
  ipcMain.handle('expenses:create', async (_event, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      let companyId = data.company_id || requester.company_id;
      if (!companyId && requester.role === 'super_admin') {
        const companies = await db.getCompanies();
        if (companies.length > 0) companyId = companies[0].id;
      }

      const settlement = {
        id: uuidv4(),
        company_id: companyId,
        settlement_number: data.settlement_number || '',
        title: data.title || '',
        requested_by: data.requested_by || requesterId,
        requester_name: data.requester_name || requester.name || '',
        department_id: data.department_id || requester.department_id || null,
        total_amount: data.total_amount || 0,
        status: data.status || 'draft',
        settlement_date: data.settlement_date || new Date().toISOString().split('T')[0],
        approved_by: null,
        approved_at: null,
        notes: data.notes || '',
        created_by: requesterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await db.addExpenseSettlement(settlement);

      // Create items if provided
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          await db.addExpenseSettlementItem({
            id: uuidv4(),
            settlement_id: result.id,
            expense_date: item.expense_date || settlement.settlement_date,
            category_name: item.category_name || item.category || '',
            description: item.description || '',
            amount: Number(item.amount) || 0,
            supply_amount: Number(item.supply_amount) || 0,
            vat_amount: Number(item.vat_amount) || 0,
            vat_included: !!item.vat_included,
            receipt_attached: item.receipt_attached ?? false,
            receipt_path: item.receipt_path || null,
            notes: item.notes || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      return { success: true, settlement: result };
    } catch (error: any) {
      return { success: false, error: error.message || '경비정산 생성에 실패했습니다.' };
    }
  });

  // Update expense settlement
  ipcMain.handle('expenses:update', async (_event, requesterId: string, id: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const existing = await db.getExpenseSettlementById(id);
      if (!existing) return { success: false, error: '경비정산을 찾을 수 없습니다.' };

      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const { items, ...updateData } = data;
      const result = await db.updateExpenseSettlement(id, updateData);

      // Update items if provided
      if (items && Array.isArray(items)) {
        // Delete existing items and re-create
        await db.deleteExpenseSettlementItems(id);
        for (const item of items) {
          await db.addExpenseSettlementItem({
            id: item.id || uuidv4(),
            settlement_id: id,
            expense_date: item.expense_date || '',
            category_name: item.category_name || item.category || '',
            description: item.description || '',
            amount: Number(item.amount) || 0,
            supply_amount: Number(item.supply_amount) || 0,
            vat_amount: Number(item.vat_amount) || 0,
            vat_included: !!item.vat_included,
            receipt_attached: item.receipt_attached ?? false,
            receipt_path: item.receipt_path || null,
            notes: item.notes || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      return result ? { success: true, settlement: result } : { success: false, error: '수정에 실패했습니다.' };
    } catch (error: any) {
      return { success: false, error: error.message || '경비정산 수정에 실패했습니다.' };
    }
  });

  // Delete expense settlement
  ipcMain.handle('expenses:delete', async (_event, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const existing = await db.getExpenseSettlementById(id);
      if (!existing) return { success: false, error: '경비정산을 찾을 수 없습니다.' };

      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      // Delete items first, then settlement
      await db.deleteExpenseSettlementItems(id);
      await db.deleteExpenseSettlement(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || '경비정산 삭제에 실패했습니다.' };
    }
  });

  // Get settlement items
  ipcMain.handle('expenses:getItems', async (_event, requesterId: string, settlementId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const items = await db.getExpenseSettlementItems(settlementId);
      return { success: true, items };
    } catch (error: any) {
      return { success: false, error: error.message || '경비항목 조회에 실패했습니다.' };
    }
  });

  // Approve expense settlement
  ipcMain.handle('expenses:approve', async (_event, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      // Only super_admin/company_admin can approve
      if (!['super_admin', 'company_admin'].includes(requester.role)) {
        return { success: false, error: '승인 권한이 없습니다.' };
      }

      const existing = await db.getExpenseSettlementById(id);
      if (!existing) return { success: false, error: '경비정산을 찾을 수 없습니다.' };

      // 회사 격리: super_admin은 전체, company_admin은 자기 회사 정산만 승인 가능
      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '다른 회사 경비정산은 승인할 수 없습니다.' };
      }

      const result = await db.updateExpenseSettlement(id, {
        status: 'approved',
        approved_by: requesterId,
        approved_at: new Date().toISOString(),
      });

      return result ? { success: true, settlement: result } : { success: false, error: '승인 처리에 실패했습니다.' };
    } catch (error: any) {
      return { success: false, error: error.message || '승인 처리에 실패했습니다.' };
    }
  });

  // Reject expense settlement
  ipcMain.handle('expenses:reject', async (_event, requesterId: string, id: string, reason?: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      if (!['super_admin', 'company_admin'].includes(requester.role)) {
        return { success: false, error: '반려 권한이 없습니다.' };
      }

      const existing = await db.getExpenseSettlementById(id);
      if (!existing) return { success: false, error: '경비정산을 찾을 수 없습니다.' };

      // 회사 격리
      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '다른 회사 경비정산은 반려할 수 없습니다.' };
      }

      const result = await db.updateExpenseSettlement(id, {
        status: 'rejected',
        approved_by: requesterId,
        approved_at: new Date().toISOString(),
        notes: reason ? `${existing.notes ? existing.notes + '\n' : ''}[반려사유] ${reason}` : existing.notes,
      });

      return result ? { success: true, settlement: result } : { success: false, error: '반려 처리에 실패했습니다.' };
    } catch (error: any) {
      return { success: false, error: error.message || '반려 처리에 실패했습니다.' };
    }
  });
}
