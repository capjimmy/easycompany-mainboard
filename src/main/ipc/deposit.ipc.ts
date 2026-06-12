import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerDepositHandlers(): void {
  // ========================================
  // 보증금 CRUD
  // ========================================

  // 보증금 목록 조회
  ipcMain.handle('deposits:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    let companyId = requester.company_id;
    if (requester.role === 'super_admin' && filters?.company_id) {
      companyId = filters.company_id;
    }

    let deposits = await db.getDeposits(companyId || undefined);

    if (filters?.status) {
      deposits = deposits.filter((d: any) => d.status === filters.status);
    }
    if (filters?.deposit_type) {
      deposits = deposits.filter((d: any) => d.deposit_type === filters.deposit_type);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      deposits = deposits.filter((d: any) =>
        d.deposit_number?.toLowerCase().includes(search) ||
        d.counterparty_name?.toLowerCase().includes(search) ||
        d.description?.toLowerCase().includes(search) ||
        d.contract_number?.toLowerCase().includes(search)
      );
    }

    return { success: true, deposits };
  });

  // 보증금 생성
  ipcMain.handle('deposits:create', async (_event, requesterId: string, data: any) => {
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
      contract_id: data.contract_id || null,
      deposit_number: data.deposit_number || '',
      deposit_type: data.deposit_type || 'received',
      counterparty_name: data.counterparty_name || '',
      description: data.description || '',
      amount: data.amount || 0,
      deposit_date: data.deposit_date || new Date().toISOString().split('T')[0],
      return_date: data.return_date || null,
      return_due_date: data.return_due_date || null,
      status: data.status || 'active',
      contract_number: data.contract_number || '',
      service_name: data.service_name || '',
      notes: data.notes || '',
      created_by: requesterId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.addDeposit(deposit);
    return { success: true, depositId: deposit.id };
  });

  // 보증금 수정
  ipcMain.handle('deposits:update', async (_event, requesterId: string, id: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const existing = await db.getDepositById(id);
    if (!existing) return { success: false, error: '보증금 정보를 찾을 수 없습니다.' };

    if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const result = await db.updateDeposit(id, updates);
    return result ? { success: true } : { success: false, error: '수정에 실패했습니다.' };
  });

  // 보증금 삭제
  ipcMain.handle('deposits:delete', async (_event, requesterId: string, id: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const existing = await db.getDepositById(id);
    if (!existing) return { success: false, error: '보증금 정보를 찾을 수 없습니다.' };

    if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    await db.deleteDeposit(id);
    return { success: true };
  });
}
