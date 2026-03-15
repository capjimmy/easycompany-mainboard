import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerNotificationHandlers(): void {
  // 알림 목록 조회
  ipcMain.handle('notifications:getAll', async (_event, requesterId: string) => {
    try {
      const notifications = await db.getNotificationsByUserId(requesterId);
      return { success: true, notifications };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 읽지 않은 알림 수
  ipcMain.handle('notifications:getUnreadCount', async (_event, requesterId: string) => {
    try {
      const count = await db.getUnreadNotificationCount(requesterId);
      return { success: true, count };
    } catch (err: any) {
      return { success: false, error: err.message, count: 0 };
    }
  });

  // 알림 읽음 처리
  ipcMain.handle('notifications:markRead', async (_event, _requesterId: string, notificationId: string) => {
    try {
      await db.markNotificationRead(notificationId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 모든 알림 읽음 처리
  ipcMain.handle('notifications:markAllRead', async (_event, requesterId: string) => {
    try {
      await db.markAllNotificationsRead(requesterId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
