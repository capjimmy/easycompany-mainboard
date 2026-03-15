import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { initDatabase } from './database';
import { registerAuthHandlers } from './ipc/auth.ipc';
import { registerUserHandlers } from './ipc/user.ipc';
import { registerCompanyHandlers } from './ipc/company.ipc';
import { registerDepartmentHandlers } from './ipc/department.ipc';
import { registerSettingsHandlers } from './ipc/settings.ipc';
import { registerPriceSettingsHandlers } from './ipc/priceSettings.ipc';
import { registerQuoteHandlers } from './ipc/quote.ipc';
import { registerContractHandlers } from './ipc/contract.ipc';
import { registerDocumentTemplateHandlers } from './ipc/documentTemplate.ipc';
import { registerFileExplorerHandlers } from './ipc/fileExplorer.ipc';
import { registerOutsourcingHandlers } from './ipc/outsourcing.ipc';
import { registerSearchHandlers } from './ipc/search.ipc';
import { registerAISearchHandlers } from './ipc/aiSearch.ipc';
import { registerClientHandlers } from './ipc/client.ipc';
import { registerMessengerHandlers, setupMessengerRealtime } from './ipc/messenger.ipc';
import { registerNotificationHandlers } from './ipc/notification.ipc';
import { registerLeaveHandlers } from './ipc/leave.ipc';
import { registerMeetingHandlers } from './ipc/meeting.ipc';
import { registerSubtaskHandlers } from './ipc/subtask.ipc';
import { registerPaymentConditionHandlers } from './ipc/payment.ipc';
import { registerEmailHandlers } from './ipc/email.ipc';
import { registerOCRHandlers } from './ipc/ocr.ipc';
import { registerCertificateHandlers } from './ipc/certificate.ipc';
import { registerFolderScanIPC } from './ipc/folderScan.ipc';
import { registerExportIPC } from './ipc/export.ipc';
import { registerLinkingHandlers } from './ipc/linking.ipc';
import { initAutoUpdater } from './services/autoUpdater';

let mainWindow: BrowserWindow | null = null;

// 단일 인스턴스 보장
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: '건설경제연구원',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    show: false,
  });

  // 개발 모드에서는 DevTools 열기
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // HTML 파일 로드
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 창 제어 IPC 핸들러
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());
ipcMain.handle('app:getVersion', () => app.getVersion());

app.whenReady().then(() => {
  // 1. 데이터베이스 초기화
  initDatabase();

  // 2. IPC 핸들러 등록
  registerAuthHandlers();
  registerUserHandlers();
  registerCompanyHandlers();
  registerDepartmentHandlers();
  registerSettingsHandlers();
  registerPriceSettingsHandlers();
  registerQuoteHandlers();
  registerContractHandlers();
  registerDocumentTemplateHandlers();
  registerFileExplorerHandlers();
  registerOutsourcingHandlers();
  registerSearchHandlers();
  registerAISearchHandlers();
  registerClientHandlers();
  registerMessengerHandlers();
  registerNotificationHandlers();
  registerLeaveHandlers();
  registerMeetingHandlers();
  registerSubtaskHandlers();
  registerPaymentConditionHandlers();
  registerEmailHandlers();
  registerOCRHandlers();
  registerCertificateHandlers();
  registerFolderScanIPC();
  registerExportIPC();
  registerLinkingHandlers();

  // 3. 메신저 Realtime 구독
  setupMessengerRealtime(() => mainWindow);

  // 4. 메인 윈도우 생성
  createMainWindow();

  // 5. 자동 업데이트 초기화
  if (mainWindow) {
    initAutoUpdater(mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // electron-store는 자동 저장되므로 별도 close 불필요
});
