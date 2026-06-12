import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerPayableHandlers(): void {
  // ========================================
  // 미지급금 CRUD
  // ========================================

  // 미지급금 목록 조회
  ipcMain.handle('payables:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    let companyId = requester.company_id;
    if (requester.role === 'super_admin' && filters?.company_id) {
      companyId = filters.company_id;
    }

    let payables = await db.getPayables(companyId || undefined);

    if (filters?.status) {
      payables = payables.filter((p: any) => p.status === filters.status);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      payables = payables.filter((p: any) =>
        p.payable_number?.toLowerCase().includes(search) ||
        p.vendor_name?.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search) ||
        p.contract_number?.toLowerCase().includes(search)
      );
    }

    return { success: true, payables };
  });

  // 미지급금 생성
  ipcMain.handle('payables:create', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    let companyId = data.company_id || requester.company_id;
    if (!companyId && requester.role === 'super_admin') {
      const companies = await db.getCompanies();
      if (companies.length > 0) companyId = companies[0].id;
    }

    const payable = {
      id: uuidv4(),
      company_id: companyId,
      outsourcing_id: data.outsourcing_id || null,
      contract_id: data.contract_id || null,
      vendor_name: data.vendor_name || '',
      payable_number: data.payable_number || '',
      description: data.description || '',
      original_amount: data.original_amount || 0,
      paid_amount: data.paid_amount || 0,
      outstanding_amount: data.outstanding_amount ?? ((data.original_amount || 0) - (data.paid_amount || 0)),
      issue_date: data.issue_date || new Date().toISOString().split('T')[0],
      due_date: data.due_date || null,
      status: data.status || 'outstanding',
      contract_number: data.contract_number || '',
      service_name: data.service_name || '',
      notes: data.notes || '',
      created_by: requesterId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.addPayable(payable);
    return { success: true, payableId: payable.id };
  });

  // 미지급금 수정
  ipcMain.handle('payables:update', async (_event, requesterId: string, id: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const existing = await db.getPayableById(id);
    if (!existing) return { success: false, error: '미지급금 정보를 찾을 수 없습니다.' };

    if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const result = await db.updatePayable(id, updates);
    return result ? { success: true } : { success: false, error: '수정에 실패했습니다.' };
  });

  // 미지급금 삭제
  ipcMain.handle('payables:delete', async (_event, requesterId: string, id: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const existing = await db.getPayableById(id);
    if (!existing) return { success: false, error: '미지급금 정보를 찾을 수 없습니다.' };

    if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    await db.deletePayable(id);
    return { success: true };
  });

  // 외주에서 미지급금 동기화
  ipcMain.handle('payables:syncFromOutsourcings', async (_event, requesterId: string, companyId?: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const targetCompanyId = companyId || requester.company_id;
    if (!targetCompanyId) return { success: false, error: '회사 정보가 없습니다.' };

    // Get all outsourcings with remaining amounts
    const outsourcings = await db.getOutsourcings();
    const companyOutsourcings = outsourcings.filter((o: any) =>
      o.company_id === targetCompanyId && (o.remaining_amount > 0 || (o.total_amount - (o.paid_amount || 0)) > 0)
    );

    // Get existing payables to avoid duplicates
    const existingPayables = await db.getPayables(targetCompanyId);
    const existingOutsourcingIds = new Set(existingPayables.map((p: any) => p.outsourcing_id));

    let created = 0;
    for (const outsourcing of companyOutsourcings) {
      if (existingOutsourcingIds.has(outsourcing.id)) continue;

      const remainingAmount = outsourcing.remaining_amount ?? (outsourcing.total_amount - (outsourcing.paid_amount || 0));
      if (remainingAmount <= 0) continue;

      const payable = {
        id: uuidv4(),
        company_id: targetCompanyId,
        outsourcing_id: outsourcing.id,
        contract_id: outsourcing.contract_id || null,
        vendor_name: outsourcing.vendor_name || '',
        payable_number: `AP-${outsourcing.contract_number || ''}`,
        description: outsourcing.service_description || '',
        original_amount: outsourcing.total_amount || 0,
        paid_amount: outsourcing.paid_amount || 0,
        outstanding_amount: remainingAmount,
        issue_date: outsourcing.start_date || new Date().toISOString().split('T')[0],
        due_date: outsourcing.end_date || null,
        status: 'outstanding',
        contract_number: outsourcing.contract_number || '',
        service_name: outsourcing.service_description || '',
        notes: '외주에서 자동 동기화',
        created_by: requesterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.addPayable(payable);
      created++;
    }

    return { success: true, created };
  });
}
