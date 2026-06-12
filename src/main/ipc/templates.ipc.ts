import { ipcMain, dialog, app } from 'electron';
import { db } from '../database';
import { supabase } from '../database/supabaseClient';
import * as fs from 'fs';
import * as path from 'path';

const BUCKET = 'templates';

export function registerTemplatesHandlers(): void {
  // 양식 목록 (모든 인증 사용자 가능)
  ipcMain.handle('templates:list', async () => {
    try {
      // 4개 카테고리 폴더 각각 list
      const categories = ['excel', 'hwpx', 'word', 'reports'];
      const all: any[] = [];
      for (const cat of categories) {
        const { data, error } = await supabase.storage.from(BUCKET).list(cat, {
          limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' },
        });
        if (error) continue;
        for (const f of data || []) {
          if (!f.name) continue;
          all.push({
            name: f.name,
            fullPath: `${cat}/${f.name}`,
            category: cat,
            size: (f.metadata as any)?.size || 0,
            updated_at: f.updated_at || f.created_at,
          });
        }
      }
      return { success: true, data: all };
    } catch (e: any) {
      return { success: false, error: e?.message || '조회 실패' };
    }
  });

  // 업로드 (super_admin / company_admin만)
  ipcMain.handle('templates:upload', async (_e, requesterId: string, category: string, filename: string, bytes: number[]) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester || !['super_admin', 'company_admin'].includes(requester.role)) {
        return { success: false, error: '권한 없음' };
      }
      const buf = Buffer.from(bytes);
      const fullPath = `${category}/${filename}`;
      const { error } = await supabase.storage.from(BUCKET).upload(fullPath, buf, {
        upsert: true,
        contentType: 'application/octet-stream',
      });
      if (error) return { success: false, error: error.message };
      return { success: true, fullPath };
    } catch (e: any) {
      return { success: false, error: e?.message || '업로드 실패' };
    }
  });

  // 다운로드 (인증된 사용자는 모두 가능, 데스크탑은 service_role)
  ipcMain.handle('templates:download', async (_e, requesterId: string, fullPath: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한 없음' };

      const { data: blob, error } = await supabase.storage.from(BUCKET).download(fullPath);
      if (error || !blob) return { success: false, error: error?.message || '다운로드 실패' };

      // 사용자에게 저장 위치 묻기
      const filename = fullPath.split('/').pop() || 'template';
      const downloadsDir = app.getPath('downloads');
      const defaultPath = path.join(downloadsDir, filename);

      const result = await dialog.showSaveDialog({
        title: '양식 저장',
        defaultPath,
      });
      if (result.canceled || !result.filePath) return { success: false, error: '사용자 취소' };

      const arrayBuffer = await blob.arrayBuffer();
      fs.writeFileSync(result.filePath, Buffer.from(arrayBuffer));
      return { success: true, savedTo: result.filePath };
    } catch (e: any) {
      return { success: false, error: e?.message || '다운로드 오류' };
    }
  });

  // 삭제 (super_admin / company_admin만)
  ipcMain.handle('templates:delete', async (_e, requesterId: string, fullPath: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester || !['super_admin', 'company_admin'].includes(requester.role)) {
        return { success: false, error: '권한 없음' };
      }
      const { error } = await supabase.storage.from(BUCKET).remove([fullPath]);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || '삭제 실패' };
    }
  });
}
