import { ipcMain } from 'electron';
import { db } from '../database';

export function registerMenuManualHandlers(): void {
  // 회사별 매뉴얼 목록
  ipcMain.handle('menuManuals:getAll', async (_event, requesterId: string, companyId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      const manuals = await db.getMenuManuals(companyId);
      return { success: true, manuals };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 특정 메뉴 매뉴얼 조회
  ipcMain.handle('menuManuals:get', async (_event, requesterId: string, companyId: string, menuKey: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      const manual = await db.getMenuManual(companyId, menuKey);
      return { success: true, manual };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 매뉴얼 저장 (upsert)
  ipcMain.handle('menuManuals:save', async (_event, requesterId: string, data: {
    company_id: string;
    menu_key: string;
    title: string;
    content: string;
    updated_by: string;
  }) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester || !['super_admin', 'company_admin'].includes(requester.role)) {
        return { success: false, error: '권한이 없습니다.' };
      }
      const manual = await db.upsertMenuManual({
        ...data,
        updated_at: new Date().toISOString(),
      });
      return { success: true, manual };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 매뉴얼 삭제
  ipcMain.handle('menuManuals:delete', async (_event, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester || !['super_admin', 'company_admin'].includes(requester.role)) {
        return { success: false, error: '권한이 없습니다.' };
      }
      await db.deleteMenuManual(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
