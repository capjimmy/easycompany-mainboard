import { ipcMain } from 'electron';
import { db } from '../database';

export function registerSubtaskHandlers(): void {
  // ========================================
  // 계약 세부작업 (Contract Subtasks)
  // ========================================

  // 계약별 세부작업 조회
  ipcMain.handle('subtasks:getByContract', async (_event, requesterId: string, contractId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const subtasks = await db.getContractSubtasks(contractId);
      return { success: true, subtasks };
    } catch (err: any) {
      return { success: false, error: err.message || '세부작업 조회 실패' };
    }
  });

  // 세부작업 생성
  ipcMain.handle('subtasks:create', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const { contractId, parentId, level, title, description, assigneeId, assigneeName, startDate, endDate } = data;

      // sort_order 결정: 같은 부모(또는 같은 contract의 최상위) 중 마지막 + 1
      const allSubtasks = await db.getContractSubtasks(contractId);
      const siblings = allSubtasks.filter((s: any) =>
        parentId ? s.parent_id === parentId : (!s.parent_id && s.level === 1)
      );
      const maxOrder = siblings.reduce((max: number, s: any) => Math.max(max, s.sort_order || 0), 0);

      const subtask = await db.addContractSubtask({
        contract_id: contractId,
        parent_id: parentId || null,
        level: level || 1,
        title,
        description: description || null,
        assignee_id: assigneeId || null,
        assignee_name: assigneeName || null,
        progress_rate: 0,
        sort_order: maxOrder + 1,
        status: 'pending',
        start_date: startDate || null,
        end_date: endDate || null,
      });

      return { success: true, subtask };
    } catch (err: any) {
      return { success: false, error: err.message || '세부작업 생성 실패' };
    }
  });

  // 세부작업 수정
  ipcMain.handle('subtasks:update', async (_event, requesterId: string, subtaskId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const updates: any = {};
      if (data.title !== undefined) updates.title = data.title;
      if (data.description !== undefined) updates.description = data.description;
      if (data.assignee_id !== undefined) updates.assignee_id = data.assignee_id;
      if (data.assignee_name !== undefined) updates.assignee_name = data.assignee_name;
      if (data.progress_rate !== undefined) updates.progress_rate = data.progress_rate;
      if (data.status !== undefined) updates.status = data.status;
      if (data.start_date !== undefined) updates.start_date = data.start_date;
      if (data.end_date !== undefined) updates.end_date = data.end_date;

      // 진행률에 따른 상태 자동 설정
      if (data.progress_rate !== undefined) {
        if (data.progress_rate >= 100) {
          updates.status = 'completed';
        } else if (data.progress_rate > 0) {
          updates.status = 'in_progress';
        } else {
          updates.status = 'pending';
        }
      }

      const subtask = await db.updateContractSubtask(subtaskId, updates);

      // 부모 작업의 진행률을 자식 평균으로 재계산
      if (subtask && subtask.parent_id) {
        await recalculateParentProgress(subtask.parent_id, subtask.contract_id);
      }

      // 최상위 작업들의 평균으로 계약 전체 진행률 재계산
      if (subtask) {
        await recalculateContractProgress(subtask.contract_id);
      }

      return { success: true, subtask };
    } catch (err: any) {
      return { success: false, error: err.message || '세부작업 수정 실패' };
    }
  });

  // 세부작업 삭제
  ipcMain.handle('subtasks:delete', async (_event, requesterId: string, subtaskId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      // 삭제 전에 contract_id와 parent_id 보존
      const allContracts = await db.getContracts();
      // subtask 정보를 먼저 가져오기 위해 모든 subtask 조회
      let contractId: string | null = null;
      let parentId: string | null = null;

      // 모든 계약의 subtask를 순회하여 해당 subtask 찾기
      for (const contract of allContracts) {
        const subtasks = await db.getContractSubtasks(contract.id);
        const found = subtasks.find((s: any) => s.id === subtaskId);
        if (found) {
          contractId = found.contract_id;
          parentId = found.parent_id;
          break;
        }
      }

      await db.deleteContractSubtask(subtaskId);

      // 부모 진행률 재계산
      if (parentId) {
        await recalculateParentProgress(parentId, contractId!);
      }

      // 계약 전체 진행률 재계산
      if (contractId) {
        await recalculateContractProgress(contractId);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '세부작업 삭제 실패' };
    }
  });

  // 세부작업 순서 변경
  ipcMain.handle('subtasks:reorder', async (_event, requesterId: string, contractId: string, items: any[]) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      // items: [{ id: string, sort_order: number }]
      for (const item of items) {
        await db.updateContractSubtask(item.id, { sort_order: item.sort_order });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '순서 변경 실패' };
    }
  });

  // ========== 헬퍼 함수 ==========

  // 부모 작업의 진행률을 자식 평균으로 재계산
  async function recalculateParentProgress(parentId: string, contractId: string): Promise<void> {
    const allSubtasks = await db.getContractSubtasks(contractId);
    const children = allSubtasks.filter((s: any) => s.parent_id === parentId);

    if (children.length === 0) return;

    const avgProgress = Math.round(
      children.reduce((sum: number, c: any) => sum + (c.progress_rate || 0), 0) / children.length
    );

    let status = 'pending';
    if (avgProgress >= 100) status = 'completed';
    else if (avgProgress > 0) status = 'in_progress';

    await db.updateContractSubtask(parentId, {
      progress_rate: avgProgress,
      status,
    });

    // 재귀적으로 상위 부모도 재계산
    const parent = allSubtasks.find((s: any) => s.id === parentId);
    if (parent && parent.parent_id) {
      await recalculateParentProgress(parent.parent_id, contractId);
    }
  }

  // 계약 전체 진행률을 최상위 작업 평균으로 재계산
  async function recalculateContractProgress(contractId: string): Promise<void> {
    const allSubtasks = await db.getContractSubtasks(contractId);
    const topLevel = allSubtasks.filter((s: any) => !s.parent_id && s.level === 1);

    if (topLevel.length === 0) return;

    const avgProgress = Math.round(
      topLevel.reduce((sum: number, s: any) => sum + (s.progress_rate || 0), 0) / topLevel.length
    );

    await db.updateContract(contractId, { progress_rate: avgProgress });
  }
}
