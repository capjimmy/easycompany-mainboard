import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerReceivableHandlers(): void {
  // ========================================
  // 미수금 CRUD
  // ========================================

  // 미수금 목록 조회
  ipcMain.handle('receivables:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    let companyId = requester.company_id;
    if (requester.role === 'super_admin' && filters?.company_id) {
      companyId = filters.company_id;
    }

    let receivables = await db.getReceivables(companyId || undefined);

    // 상태 필터
    if (filters?.status) {
      receivables = receivables.filter((r: any) => r.status === filters.status);
    }

    // 검색 필터
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      receivables = receivables.filter((r: any) =>
        r.receivable_number?.toLowerCase().includes(search) ||
        r.client_company_name?.toLowerCase().includes(search) ||
        r.description?.toLowerCase().includes(search) ||
        r.contract_number?.toLowerCase().includes(search)
      );
    }

    return { success: true, receivables };
  });

  // 미수금 생성
  ipcMain.handle('receivables:create', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    let companyId = data.company_id || requester.company_id;
    if (!companyId && requester.role === 'super_admin') {
      const companies = await db.getCompanies();
      if (companies.length > 0) companyId = companies[0].id;
    }

    const receivable = {
      id: uuidv4(),
      company_id: companyId,
      contract_id: data.contract_id || null,
      client_company_id: data.client_company_id || null,
      receivable_number: data.receivable_number || '',
      description: data.description || '',
      original_amount: data.original_amount || 0,
      received_amount: data.received_amount || 0,
      outstanding_amount: data.outstanding_amount ?? ((data.original_amount || 0) - (data.received_amount || 0)),
      issue_date: data.issue_date || new Date().toISOString().split('T')[0],
      due_date: data.due_date || null,
      status: data.status || 'outstanding',
      client_company_name: data.client_company_name || '',
      contract_number: data.contract_number || '',
      service_name: data.service_name || '',
      notes: data.notes || '',
      created_by: requesterId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.addReceivable(receivable);
    return { success: true, receivableId: receivable.id };
  });

  // 미수금 수정
  ipcMain.handle('receivables:update', async (_event, requesterId: string, id: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const existing = await db.getReceivableById(id);
    if (!existing) return { success: false, error: '미수금 정보를 찾을 수 없습니다.' };

    if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const updates = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const result = await db.updateReceivable(id, updates);
    return result ? { success: true } : { success: false, error: '수정에 실패했습니다.' };
  });

  // 미수금 삭제
  ipcMain.handle('receivables:delete', async (_event, requesterId: string, id: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const existing = await db.getReceivableById(id);
    if (!existing) return { success: false, error: '미수금 정보를 찾을 수 없습니다.' };

    if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    await db.deleteReceivable(id);
    return { success: true };
  });

  // 계약에서 미수금 동기화
  ipcMain.handle('receivables:syncFromContracts', async (_event, requesterId: string, companyId?: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const targetCompanyId = companyId || requester.company_id;
    if (!targetCompanyId) return { success: false, error: '회사 정보가 없습니다.' };

    // Get all contracts with remaining amounts
    const contracts = await db.getContracts();
    const companyContracts = contracts.filter((c: any) =>
      c.company_id === targetCompanyId && (c.remaining_amount > 0 || (c.contract_amount - (c.received_amount || 0)) > 0)
    );

    // Get existing receivables to avoid duplicates
    const existingReceivables = await db.getReceivables(targetCompanyId);
    const existingContractIds = new Set(existingReceivables.map((r: any) => r.contract_id));

    let created = 0;
    for (const contract of companyContracts) {
      if (existingContractIds.has(contract.id)) continue;

      const remainingAmount = contract.remaining_amount ?? (contract.contract_amount - (contract.received_amount || 0));
      if (remainingAmount <= 0) continue;

      const receivable = {
        id: uuidv4(),
        company_id: targetCompanyId,
        contract_id: contract.id,
        client_company_id: contract.client_company_id || null,
        receivable_number: `AR-${contract.contract_number || ''}`,
        description: contract.service_name || '',
        original_amount: contract.contract_amount || 0,
        received_amount: contract.received_amount || 0,
        outstanding_amount: remainingAmount,
        issue_date: contract.contract_start_date || new Date().toISOString().split('T')[0],
        due_date: contract.contract_end_date || null,
        status: 'outstanding',
        client_company_name: contract.client_company || '',
        contract_number: contract.contract_number || '',
        service_name: contract.service_name || '',
        notes: '계약에서 자동 동기화',
        created_by: requesterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.addReceivable(receivable);
      created++;
    }

    return { success: true, created };
  });
}
