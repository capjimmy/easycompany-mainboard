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

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://silvsqcwearelrumtqqm.supabase.co';
const UPDATE_FEED_URL = `${SUPABASE_URL}/functions/v1/get-update-feed`;

export function initAutoUpdater(mainWindow: BrowserWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;

  // 동적 feed URL 사용 — Edge Function이 인증 확인 후 signed URL 발급
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: UPDATE_FEED_URL,
    useMultipleRangeRequest: false,
  } as any);

  console.log('[AutoUpdater] 초기화 - 현재 버전:', app.getVersion(), '| Feed:', UPDATE_FEED_URL);

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

  // 데스크탑: service_role 키를 헤더로 보냄 (이미 빌드에 박혀있음 — 추가 노출 없음)
  // Edge Function이 SUPABASE_SERVICE_ROLE_KEY 또는 사용자 JWT 둘 다 받음
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
  (autoUpdater as any).requestHeaders = {
    Authorization: `Bearer ${SERVICE_ROLE}`,
    apikey: ANON_KEY,
    'x-app-source': 'desktop',
  };

  // 앱 시작 시 자동으로 업데이트 확인 (인증 헤더 이미 부착됨)
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[AutoUpdater] 페이지 로드 완료 - 업데이트 확인 시작');
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[AutoUpdater] 자동 확인 실패:', err.message);
    });
  });

  // 옛 IPC 호환 (renderer가 호출하면 단순 체크)
  ipcMain.handle('update:configure', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
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
