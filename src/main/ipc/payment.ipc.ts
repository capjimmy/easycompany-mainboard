import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { recalculateContractReceivedFromPayments } from './contract.ipc';

export function registerPaymentConditionHandlers(): void {
  // ========================================
  // 대금조건 (착수금/중도금/잔금) CRUD
  // ========================================

  // 계약별 대금조건 조회
  ipcMain.handle('payments:getByContract', async (_event, requesterId: string, contractId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    if (requester.role !== 'super_admin' && requester.company_id !== contract.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const conditions = await db.getPaymentConditions(contractId);
    return { success: true, conditions };
  });

  // 대금조건 생성
  ipcMain.handle('payments:create', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(data.contract_id);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    if (requester.role !== 'super_admin' && requester.company_id !== contract.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const now = new Date().toISOString();
    const conditionId = uuidv4();

    // sort_order 자동 결정
    const existing = await db.getPaymentConditions(data.contract_id);
    const maxOrder = existing.length > 0 ? Math.max(...existing.map((c: any) => c.sort_order || 0)) : -1;

    const newCondition = {
      id: conditionId,
      contract_id: data.contract_id,
      condition_type: data.condition_type || 'interim',
      title: data.title || '',
      amount: data.amount || 0,
      percentage: data.percentage || 0,
      due_date: data.due_date || null,
      paid_date: data.paid_date || null,
      paid_amount: data.paid_amount || 0,
      status: data.status || 'pending',
      sort_order: data.sort_order ?? (maxOrder + 1),
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
    };

    await db.addPaymentCondition(newCondition);

    return { success: true, conditionId };
  });

  // 대금조건 수정 (입금 처리 포함)
  ipcMain.handle('payments:update', async (_event, requesterId: string, paymentId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    if (!data.contract_id) {
      return { success: false, error: '계약 ID가 필요합니다.' };
    }

    // 계약 소유권 확인
    const contract = await db.getContractById(data.contract_id);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }
    if (requester.role !== 'super_admin' && requester.company_id !== contract.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 해당 계약의 대금조건에서 찾기
    const allConditions = await db.getPaymentConditions(data.contract_id);
    const condition = allConditions.find((c: any) => c.id === paymentId);
    if (!condition) {
      return { success: false, error: '대금조건을 찾을 수 없습니다.' };
    }

    const updates: any = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.amount !== undefined) updates.amount = data.amount;
    if (data.percentage !== undefined) updates.percentage = data.percentage;
    if (data.due_date !== undefined) updates.due_date = data.due_date;
    if (data.paid_date !== undefined) updates.paid_date = data.paid_date;
    if (data.paid_amount !== undefined) updates.paid_amount = data.paid_amount;
    if (data.status !== undefined) updates.status = data.status;
    if (data.condition_type !== undefined) updates.condition_type = data.condition_type;
    if (data.sort_order !== undefined) updates.sort_order = data.sort_order;
    if (data.notes !== undefined) updates.notes = data.notes;

    await db.updatePaymentCondition(paymentId, updates);

    // 입금 완료로 변경된 경우, 계약의 received_amount 업데이트
    if (data.contract_id && (data.status === 'paid' || data.paid_amount !== undefined)) {
      await recalculateContractReceivedAmount(data.contract_id);
    }

    return { success: true };
  });

  // 대금조건 삭제
  ipcMain.handle('payments:delete', async (_event, requesterId: string, paymentId: string, contractId?: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 관리자 이상만 삭제 가능
    if (requester.role === 'employee') {
      return { success: false, error: '삭제 권한이 없습니다.' };
    }

    // contractId 없으면 paymentId로 lookup해서 계약 ID 확보
    let resolvedContractId = contractId;
    if (!resolvedContractId) {
      const cond = await (db as any).getPaymentConditionById(paymentId);
      if (!cond) return { success: false, error: '대상 대금조건을 찾을 수 없습니다.' };
      resolvedContractId = cond.contract_id;
    }

    // 계약 소유권 확인 (super_admin은 통과)
    if (resolvedContractId && requester.role !== 'super_admin') {
      const contract = await db.getContractById(resolvedContractId);
      if (!contract) {
        return { success: false, error: '연결된 계약을 찾을 수 없습니다.' };
      }
      if (requester.company_id !== contract.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }
    }

    await db.deletePaymentCondition(paymentId);

    // 계약 금액 재계산
    if (resolvedContractId) {
      await recalculateContractReceivedAmount(resolvedContractId);
    }

    return { success: true };
  });
}

// 계약의 received_amount를 contract_payments 합계로 재계산 (단일 소스)
// 대금조건(payment_conditions)의 paid_amount 변경 시에도 contract_payments 기반으로 재계산
async function recalculateContractReceivedAmount(contractId: string) {
  try {
    await recalculateContractReceivedFromPayments(contractId);
  } catch (err) {
    console.error('Failed to recalculate contract received amount:', err);
  }
}
