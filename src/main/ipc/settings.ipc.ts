import { ipcMain, dialog } from 'electron';
import { db, clearDatabase, getDataPath, setDataPath, exportData, importData } from '../database';

export function registerSettingsHandlers(): void {
  // 데이터베이스 초기화 (개발용)
  ipcMain.handle('settings:clearDatabase', async (_event, requesterId: string) => {
    const requester = db.getUserById(requesterId);
    if (!requester || requester.role !== 'super_admin') {
      return { success: false, error: '슈퍼관리자만 데이터베이스를 초기화할 수 있습니다.' };
    }

    clearDatabase();
    return { success: true, message: '데이터베이스가 초기화되었습니다.' };
  });
  // 설정 값 가져오기
  ipcMain.handle('settings:get', async (_event, key: string) => {
    return db.getSetting(key);
  });

  // 설정 값 저장하기
  ipcMain.handle('settings:set', async (_event, key: string, value: any) => {
    db.setSetting(key, value);
    return { success: true };
  });

  // 모든 설정 가져오기
  ipcMain.handle('settings:getAll', async () => {
    return db.getSettings();
  });

  // 테마 설정
  ipcMain.handle('settings:getTheme', async () => {
    return db.getSetting('theme') || 'light';
  });

  ipcMain.handle('settings:setTheme', async (_event, theme: 'light' | 'dark' | 'system') => {
    db.setSetting('theme', theme);
    return { success: true };
  });

  // 데이터 경로 가져오기
  ipcMain.handle('settings:getDataPath', async () => {
    return { success: true, path: getDataPath() };
  });

  // 데이터 경로 설정
  ipcMain.handle('settings:setDataPath', async (_event, requesterId: string, newPath: string) => {
    const requester = db.getUserById(requesterId);
    if (!requester || (requester.role !== 'super_admin' && requester.role !== 'company_admin')) {
      return { success: false, error: '관리자만 데이터 경로를 변경할 수 있습니다.' };
    }

    return setDataPath(newPath);
  });

  // 폴더 선택 다이얼로그
  ipcMain.handle('settings:selectDataFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '데이터 저장 폴더 선택',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, path: result.filePaths[0] };
  });

  // 데이터 내보내기
  ipcMain.handle('settings:exportData', async (_event, requesterId: string) => {
    const requester = db.getUserById(requesterId);
    if (!requester || (requester.role !== 'super_admin' && requester.role !== 'company_admin')) {
      return { success: false, error: '관리자만 데이터를 내보낼 수 있습니다.' };
    }

    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '백업 저장 위치 선택',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return exportData(result.filePaths[0]);
  });

  // 데이터 가져오기
  ipcMain.handle('settings:importData', async (_event, requesterId: string) => {
    const requester = db.getUserById(requesterId);
    if (!requester || requester.role !== 'super_admin') {
      return { success: false, error: '슈퍼관리자만 데이터를 가져올 수 있습니다.' };
    }

    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: '백업 파일 선택',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return importData(result.filePaths[0]);
  });
}
