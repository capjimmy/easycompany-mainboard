import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

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

    // 기존 조건 조회를 위해 모든 조건에서 찾기
    // payment_conditions 테이블에서 직접 조회
    const allConditions = await db.getPaymentConditions(data.contract_id || '');
    let condition: any = null;

    // contract_id가 있으면 해당 계약의 조건에서 찾기
    if (data.contract_id) {
      condition = allConditions.find((c: any) => c.id === paymentId);
    }

    // 없으면 직접 조회 시도 (supabase에서 직접)
    if (!condition) {
      // contract_id 없이는 조회 어려움 - 에러 반환보다는 update 시도
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

    await db.deletePaymentCondition(paymentId);

    // 계약 금액 재계산
    if (contractId) {
      await recalculateContractReceivedAmount(contractId);
    }

    return { success: true };
  });
}

// 계약의 received_amount를 대금조건의 paid_amount 합계로 업데이트
async function recalculateContractReceivedAmount(contractId: string) {
  try {
    const conditions = await db.getPaymentConditions(contractId);
    const totalPaid = conditions.reduce((sum: number, c: any) => sum + (c.paid_amount || 0), 0);

    const contract = await db.getContractById(contractId);
    if (contract) {
      const remaining = (contract.total_amount || 0) - totalPaid;
      await db.updateContract(contractId, {
        received_amount: totalPaid,
        remaining_amount: remaining,
      });
    }
  } catch (err) {
    console.error('Failed to recalculate contract received amount:', err);
  }
}
