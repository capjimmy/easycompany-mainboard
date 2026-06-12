import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerBillingHandlers(): void {
  // ========================================
  // 청구 CRUD
  // ========================================

  // 청구 목록 조회
  ipcMain.handle('billings:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    let companyId = requester.company_id;
    if (requester.role === 'super_admin' && filters?.company_id) {
      companyId = filters.company_id;
    }

    let billings = await db.getBillings(companyId || undefined);

    if (filters?.status) {
      billings = billings.filter((b: any) => b.status === filters.status);
    }
    if (filters?.receivable_id) {
      billings = billings.filter((b: any) => b.receivable_id === filters.receivable_id);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      billings = billings.filter((b: any) =>
        b.billing_number?.toLowerCase().includes(search) ||
        b.client_company_name?.toLowerCase().includes(search) ||
        b.description?.toLowerCase().includes(search)
      );
    }

    return { success: true, billings };
  });

  // 청구 생성
  ipcMain.handle('billings:create', async (_event, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      let companyId = data.company_id || requester.company_id;
      if (!companyId && requester.role === 'super_admin') {
        const companies = await db.getCompanies();
        if (companies.length > 0) companyId = companies[0].id;
      }
      if (!companyId) {
        return { success: false, error: '회사 정보를 확인할 수 없습니다. 슈퍼관리자는 회사를 먼저 선택해주세요.' };
      }

      // 필수값 검증
      if (!data.billing_amount || Number(data.billing_amount) <= 0) {
        return { success: false, error: '청구금액을 입력해주세요.' };
      }

      const billing = {
        id: uuidv4(),
        company_id: companyId,
        receivable_id: data.receivable_id || null,
        contract_id: data.contract_id || null,
        client_company_id: data.client_company_id || null,
        billing_number: data.billing_number || '',
        description: data.description || '',
        billing_amount: Number(data.billing_amount) || 0,
        paid_amount: Number(data.paid_amount) || 0,
        remaining_amount: data.remaining_amount ?? ((Number(data.billing_amount) || 0) - (Number(data.paid_amount) || 0)),
        billing_date: data.billing_date || new Date().toISOString().split('T')[0],
        due_date: data.due_date || null,
        status: data.status || 'pending',
        client_company_name: data.client_company_name || '',
        contract_number: data.contract_number || '',
        service_name: data.service_name || '',
        notes: data.notes || '',
        created_by: requesterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.addBilling(billing);
      return { success: true, billingId: billing.id };
    } catch (err: any) {
      const msg = err?.message || err?.details || (typeof err === 'string' ? err : JSON.stringify(err));
      console.error('billings:create error:', err);
      return { success: false, error: `청구 등록 실패: ${msg}` };
    }
  });

  // 청구 수정
  ipcMain.handle('billings:update', async (_event, requesterId: string, id: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const existing = await db.getBillingById(id);
      if (!existing) return { success: false, error: '청구 정보를 찾을 수 없습니다.' };

      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const updates = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      const result = await db.updateBilling(id, updates);
      return result ? { success: true } : { success: false, error: '수정에 실패했습니다.' };
    } catch (err: any) {
      const msg = err?.message || err?.details || (typeof err === 'string' ? err : JSON.stringify(err));
      console.error('billings:update error:', err);
      return { success: false, error: `청구 수정 실패: ${msg}` };
    }
  });

  // 청구 삭제
  ipcMain.handle('billings:delete', async (_event, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const existing = await db.getBillingById(id);
      if (!existing) return { success: false, error: '청구 정보를 찾을 수 없습니다.' };

      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      await db.deleteBilling(id);
      return { success: true };
    } catch (err: any) {
      const msg = err?.message || err?.details || (typeof err === 'string' ? err : JSON.stringify(err));
      console.error('billings:delete error:', err);
      return { success: false, error: `청구 삭제 실패: ${msg}` };
    }
  });

  // ========================================
  // 입금 CRUD
  // ========================================

  // 입금 목록 조회
  ipcMain.handle('paymentReceipts:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    let companyId = requester.company_id;
    if (requester.role === 'super_admin' && filters?.company_id) {
      companyId = filters.company_id;
    }

    let receipts = await db.getPaymentReceipts(companyId || undefined);

    if (filters?.billing_id) {
      receipts = receipts.filter((r: any) => r.billing_id === filters.billing_id);
    }
    if (filters?.receivable_id) {
      receipts = receipts.filter((r: any) => r.receivable_id === filters.receivable_id);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      receipts = receipts.filter((r: any) =>
        r.receipt_number?.toLowerCase().includes(search) ||
        r.description?.toLowerCase().includes(search)
      );
    }

    return { success: true, paymentReceipts: receipts };
  });

  // 입금 생성 (+ 청구/미수금 금액 업데이트)
  ipcMain.handle('paymentReceipts:create', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    let companyId = data.company_id || requester.company_id;
    if (!companyId && requester.role === 'super_admin') {
      const companies = await db.getCompanies();
      if (companies.length > 0) companyId = companies[0].id;
    }

    const receipt = {
      id: uuidv4(),
      company_id: companyId,
      billing_id: data.billing_id || null,
      receivable_id: data.receivable_id || null,
      contract_id: data.contract_id || null,
      receipt_number: data.receipt_number || '',
      amount: data.amount || 0,
      payment_date: data.payment_date || new Date().toISOString().split('T')[0],
      payment_method: data.payment_method || 'bank_transfer',
      description: data.description || '',
      notes: data.notes || '',
      created_by: requesterId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.addPaymentReceipt(receipt);

    // 청구 금액 업데이트
    if (data.billing_id) {
      const billing = await db.getBillingById(data.billing_id);
      if (billing) {
        const newPaidAmount = (billing.paid_amount || 0) + (data.amount || 0);
        const newRemainingAmount = (billing.billing_amount || 0) - newPaidAmount;
        const newStatus = newRemainingAmount <= 0 ? 'paid' : 'partial';
        await db.updateBilling(data.billing_id, {
          paid_amount: newPaidAmount,
          remaining_amount: Math.max(0, newRemainingAmount),
          status: newStatus,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // 미수금 금액 업데이트
    if (data.receivable_id) {
      const receivable = await db.getReceivableById(data.receivable_id);
      if (receivable) {
        const newReceivedAmount = (receivable.received_amount || 0) + (data.amount || 0);
        const newOutstandingAmount = (receivable.original_amount || 0) - newReceivedAmount;
        const newStatus = newOutstandingAmount <= 0 ? 'collected' : 'outstanding';
        await db.updateReceivable(data.receivable_id, {
          received_amount: newReceivedAmount,
          outstanding_amount: Math.max(0, newOutstandingAmount),
          status: newStatus,
          updated_at: new Date().toISOString(),
        });
      }
    }

    return { success: true, receiptId: receipt.id };
  });
}
