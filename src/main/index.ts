import { app, BrowserWindow, ipcMain, screen, session } from 'electron';
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
import { registerExecutiveOutsourcingHandlers } from './ipc/executiveOutsourcing.ipc';
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
import { registerPdfHandlers } from './ipc/pdf.ipc';
import { registerQuoteSectionHandlers } from './ipc/quoteSection.ipc';
import { registerQuotePresetSectionHandlers } from './ipc/quotePresetSection.ipc';
import { registerProfitDashboardHandlers } from './ipc/profitDashboard.ipc';
import { registerTemplatesHandlers } from './ipc/templates.ipc';
import { registerMenuManualHandlers } from './ipc/menuManual.ipc';
import { registerReceivableHandlers } from './ipc/receivable.ipc';
import { registerBillingHandlers } from './ipc/billing.ipc';
import { registerPayableHandlers } from './ipc/payable.ipc';
import { registerDepositHandlers } from './ipc/deposit.ipc';
import { registerTaxInvoiceHandlers } from './ipc/taxInvoice.ipc';
import { registerExpenseSettlementHandlers } from './ipc/expenseSettlement.ipc';
import { registerExpenseRequestHandlers } from './ipc/expenseRequest.ipc';
import { registerVehicleHandlers } from './ipc/vehicle.ipc';
import { registerSpaceHandlers } from './ipc/space.ipc';
import { registerProvisionalPaymentHandlers } from './ipc/provisionalPayment.ipc';
import { registerMonthlyDepositHandlers } from './ipc/monthlyDeposit.ipc';
import { registerClientFinancialsHandlers } from './ipc/clientFinancials.ipc';
import { registerContractMeetingNoteHandlers } from './ipc/contractMeetingNote.ipc';
import { registerDirectorReportHandlers } from './ipc/directorReport.ipc';
import { initAutoUpdater } from './services/autoUpdater';
import { db } from './database';

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
  // 모니터 해상도 기반 창 크기 설정
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // 화면의 85% 크기로 설정, 최소/최대 제한
  const windowWidth = Math.max(1200, Math.min(Math.round(screenWidth * 0.85), screenWidth));
  const windowHeight = Math.max(700, Math.min(Math.round(screenHeight * 0.85), screenHeight));

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: Math.min(1200, screenWidth),
    minHeight: Math.min(700, screenHeight),
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
  // 0. CSP (Content Security Policy) 설정
  // Electron 앱은 React/Ant Design 위해 unsafe-inline/eval 필요. https는 외부 API용.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https://*.supabase.co https://api.openai.com https://*.googleapis.com"
        ]
      }
    });
  });

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
  registerExecutiveOutsourcingHandlers();
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
  registerPdfHandlers();
  registerQuoteSectionHandlers();
  registerQuotePresetSectionHandlers();
  registerProfitDashboardHandlers();
  registerTemplatesHandlers();
  registerMenuManualHandlers();
  registerReceivableHandlers();
  registerBillingHandlers();
  registerPayableHandlers();
  registerDepositHandlers();
  registerTaxInvoiceHandlers();
  registerExpenseSettlementHandlers();
  registerExpenseRequestHandlers();
  registerVehicleHandlers();
  registerSpaceHandlers();
  registerProvisionalPaymentHandlers();
  registerMonthlyDepositHandlers();
  registerClientFinancialsHandlers();
  registerContractMeetingNoteHandlers();
  registerDirectorReportHandlers();

  // 2.5. 기본 설정값 초기화 (OpenAI API 키는 설정 화면에서 등록)

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
