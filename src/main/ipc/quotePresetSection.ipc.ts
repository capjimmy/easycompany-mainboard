import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerQuotePresetSectionHandlers(): void {
  // 회사별 사전 항목 조회
  ipcMain.handle('quotePresetSections:getByCompany', async (_event, requesterId: string, companyId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    if (requester.role !== 'super_admin' && requester.company_id !== companyId) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const sections = await db.getQuotePresetSectionsByCompanyId(companyId);
      return { success: true, sections };
    } catch (err: any) {
      return { success: false, error: err.message || '조회 실패' };
    }
  });

  // 사전 항목 생성 (department_manager, company_admin, super_admin)
  ipcMain.handle('quotePresetSections:create', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const allowedRoles = ['super_admin', 'company_admin', 'department_manager'];
    if (!allowedRoles.includes(requester.role)) {
      return { success: false, error: '사전 항목을 생성할 권한이 없습니다.' };
    }

    const companyId = data.company_id;
    if (requester.role !== 'super_admin' && requester.company_id !== companyId) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      // sort_order 결정
      const allSections = await db.getQuotePresetSectionsByCompanyId(companyId);
      const siblings = allSections.filter((s: any) =>
        data.parent_id ? s.parent_id === data.parent_id : (!s.parent_id && s.level === data.level)
      );
      const maxOrder = siblings.reduce((max: number, s: any) => Math.max(max, s.sort_order || 0), 0);

      const newSection = {
        id: uuidv4(),
        company_id: companyId,
        level: data.level || 1,
        title: data.title,
        parent_id: data.parent_id || null,
        sort_order: maxOrder + 1,
        is_active: true,
        default_amount: data.default_amount || null,
        created_by: requesterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const section = await db.addQuotePresetSection(newSection);
      return { success: true, section };
    } catch (err: any) {
      return { success: false, error: err.message || '생성 실패' };
    }
  });

  // 사전 항목 수정
  ipcMain.handle('quotePresetSections:update', async (_event, requesterId: string, sectionId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const allowedRoles = ['super_admin', 'company_admin', 'department_manager'];
    if (!allowedRoles.includes(requester.role)) {
      return { success: false, error: '사전 항목을 수정할 권한이 없습니다.' };
    }

    const existing = await db.getQuotePresetSectionById(sectionId);
    if (!existing) return { success: false, error: '항목을 찾을 수 없습니다.' };

    if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const updates: any = {};
      if (data.title !== undefined) updates.title = data.title;
      if (data.sort_order !== undefined) updates.sort_order = data.sort_order;
      if (data.default_amount !== undefined) updates.default_amount = data.default_amount;

      const section = await db.updateQuotePresetSection(sectionId, updates);
      return { success: true, section };
    } catch (err: any) {
      return { success: false, error: err.message || '수정 실패' };
    }
  });

  // 사전 항목 삭제 (소프트 삭제 + 하위 항목도 비활성화)
  ipcMain.handle('quotePresetSections:delete', async (_event, requesterId: string, sectionId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const allowedRoles = ['super_admin', 'company_admin', 'department_manager'];
    if (!allowedRoles.includes(requester.role)) {
      return { success: false, error: '사전 항목을 삭제할 권한이 없습니다.' };
    }

    const existing = await db.getQuotePresetSectionById(sectionId);
    if (!existing) return { success: false, error: '항목을 찾을 수 없습니다.' };

    if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      // 하위 항목도 함께 비활성화
      const allSections = await db.getQuotePresetSectionsByCompanyId(existing.company_id);
      const idsToDelete = new Set<string>();

      const collectChildren = (parentId: string) => {
        idsToDelete.add(parentId);
        allSections
          .filter((s: any) => s.parent_id === parentId)
          .forEach((s: any) => collectChildren(s.id));
      };
      collectChildren(sectionId);

      for (const id of idsToDelete) {
        await db.deleteQuotePresetSection(id);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '삭제 실패' };
    }
  });
}
