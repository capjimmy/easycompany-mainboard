import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerMonthlyDepositHandlers(): void {
  // 목록
  ipcMain.handle('monthlyDeposits:getAll', async (_event, requesterId: string, filters?: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      let companyId = requester.company_id;
      if (requester.role === 'super_admin' && filters?.company_id) {
        companyId = filters.company_id;
      }

      let deposits = await db.getMonthlyDeposits(companyId);

      // 월 필터 (YYYY-MM, payment_date 기준)
      if (filters?.month) {
        deposits = deposits.filter((d: any) => (d.payment_date || '').startsWith(filters.month));
      }
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        deposits = deposits.filter((d: any) =>
          d.client_name?.toLowerCase().includes(search) ||
          d.project_name?.toLowerCase().includes(search) ||
          d.deposit_bank?.toLowerCase().includes(search) ||
          d.notes?.toLowerCase().includes(search)
        );
      }

      return { success: true, data: deposits, deposits };
    } catch (error: any) {
      return { success: false, error: error.message || '월별입금현황 조회에 실패했습니다.' };
    }
  });

  // 등록
  ipcMain.handle('monthlyDeposits:create', async (_event, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      let companyId = data.company_id || requester.company_id;
      if (!companyId && requester.role === 'super_admin') {
        const companies = await db.getCompanies();
        if (companies.length > 0) companyId = companies[0].id;
      }

      const deposit = {
        id: uuidv4(),
        company_id: companyId,
        deposit_bank: data.deposit_bank || '',
        deposit_type: data.deposit_type || null,
        tax_invoice_date: data.tax_invoice_date || null,
        payment_date: data.payment_date || null,
        client_name: data.client_name || '',
        project_name: data.project_name || '',
        amount: Number(data.amount) || 0,
        vat_included: data.vat_included ?? true,
        department: data.department || null,
        notes: data.notes || '',
        created_by: requesterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await db.addMonthlyDeposit(deposit);
      return { success: true, deposit: result };
    } catch (error: any) {
      return { success: false, error: error.message || '월별입금 등록에 실패했습니다.' };
    }
  });

  // 수정
  ipcMain.handle('monthlyDeposits:update', async (_event, requesterId: string, id: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const existing = await db.getMonthlyDepositById(id);
      if (!existing) return { success: false, error: '월별입금 항목을 찾을 수 없습니다.' };

      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const result = await db.updateMonthlyDeposit(id, data);
      return result ? { success: true, deposit: result } : { success: false, error: '수정에 실패했습니다.' };
    } catch (error: any) {
      return { success: false, error: error.message || '월별입금 수정에 실패했습니다.' };
    }
  });

  // 삭제
  ipcMain.handle('monthlyDeposits:delete', async (_event, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const existing = await db.getMonthlyDepositById(id);
      if (!existing) return { success: false, error: '월별입금 항목을 찾을 수 없습니다.' };

      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      await db.deleteMonthlyDeposit(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || '월별입금 삭제에 실패했습니다.' };
    }
  });
}
