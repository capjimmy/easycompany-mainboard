import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

const ADMIN_ROLES = ['super_admin', 'company_admin'];

export function registerSpaceHandlers(): void {
  ipcMain.handle('spaces:getAll', async (_e, requesterId: string, filters?: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      let companyId: string | null = requester.company_id;
      if (requester.role === 'super_admin') {
        companyId = filters?.company_id || null;
      }
      const list = await (db as any).getSpaces(companyId);
      return { success: true, data: list };
    } catch (error: any) {
      return { success: false, error: error.message || '조회 실패' };
    }
  });

  ipcMain.handle('spaces:create', async (_e, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      if (!ADMIN_ROLES.includes(requester.role)) return { success: false, error: '등록 권한이 없습니다.' };
      const record = {
        id: uuidv4(),
        company_id: data.company_id || requester.company_id,
        name: data.name || '',
        location: data.location || '',
        capacity: data.capacity ?? 0,
        description: data.description || '',
        is_active: data.is_active !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const result = await (db as any).addSpace(record);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message || '등록 실패' };
    }
  });

  ipcMain.handle('spaces:update', async (_e, requesterId: string, id: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      if (!ADMIN_ROLES.includes(requester.role)) return { success: false, error: '수정 권한이 없습니다.' };
      const result = await (db as any).updateSpace(id, data);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message || '수정 실패' };
    }
  });

  ipcMain.handle('spaces:delete', async (_e, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      if (!ADMIN_ROLES.includes(requester.role)) return { success: false, error: '삭제 권한이 없습니다.' };
      // 회사 격리: super_admin은 모두, company_admin은 자기 회사 또는 공통(NULL) 공간만 삭제 가능
      if (requester.role !== 'super_admin') {
        const target = await (db as any).getSpaceById(id);
        if (!target) return { success: false, error: '대상 공간을 찾을 수 없습니다.' };
        if (target.company_id && target.company_id !== requester.company_id) {
          return { success: false, error: '다른 회사 공간은 삭제할 수 없습니다.' };
        }
      }
      await (db as any).deleteSpace(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || '삭제 실패' };
    }
  });
}
