import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import { app } from 'electron';
import { db } from '../database/supabaseDb';

// 버전 비교: a < b이면 true
function isVersionBelow(current: string, minimum: string): boolean {
  const cur = current.split('.').map(Number);
  const min = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((cur[i] || 0) < (min[i] || 0)) return true;
    if ((cur[i] || 0) > (min[i] || 0)) return false;
  }
  return false;
}

export function initAutoUpdater(mainWindow: BrowserWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;

  console.log('[AutoUpdater] 초기화 - 현재 버전:', app.getVersion());

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] 업데이트 발견:', info.version);
    mainWindow.webContents.send('update-available', info);
  });
  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] 최신 버전입니다:', info.version);
    mainWindow.webContents.send('update-not-available');
  });
  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update-download-progress', progress);
  });
  autoUpdater.on('update-downloaded', () => {
    console.log('[AutoUpdater] 다운로드 완료');
    mainWindow.webContents.send('update-downloaded');
  });
  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] 에러:', err.message);
    mainWindow.webContents.send('update-error', err.message);
  });

  // 앱 시작 시 자동으로 업데이트 확인
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[AutoUpdater] 페이지 로드 완료 - 업데이트 확인 시작');
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[AutoUpdater] 자동 확인 실패:', err.message);
    });
  });

  ipcMain.handle('update:check', async () => {
    try {
      console.log('[AutoUpdater] 수동 업데이트 확인');
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (err: any) {
      console.error('[AutoUpdater] 확인 실패:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall();
  });

  // 강제 업데이트 확인: Supabase settings에서 min_app_version 조회
  ipcMain.handle('update:checkForceUpdate', async () => {
    try {
      const minVersion = await db.getSetting('min_app_version');
      const currentVersion = app.getVersion();
      if (minVersion && isVersionBelow(currentVersion, minVersion)) {
        return { forceUpdate: true, minVersion, currentVersion };
      }
      return { forceUpdate: false, currentVersion };
    } catch (err: any) {
      console.error('[AutoUpdater] 강제 업데이트 확인 실패:', err.message);
      return { forceUpdate: false, currentVersion: app.getVersion() };
    }
  });

  // 관리자가 최소 버전 설정
  ipcMain.handle('update:setMinVersion', async (_, version: string) => {
    try {
      await db.setSetting('min_app_version', version);
      console.log('[AutoUpdater] 최소 버전 설정:', version);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 현재 최소 버전 조회
  ipcMain.handle('update:getMinVersion', async () => {
    try {
      const minVersion = await db.getSetting('min_app_version');
      return { success: true, minVersion: minVersion || null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
