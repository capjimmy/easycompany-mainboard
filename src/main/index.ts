import { app, BrowserWindow } from 'electron';
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
    title: 'EasyCompany - 업무 효율화 솔루션',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    show: false,
  });

  // 개발 모드에서는 DevTools 열기
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // HTML 파일 로드
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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

  // 3. 메인 윈도우 생성
  createMainWindow();

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
