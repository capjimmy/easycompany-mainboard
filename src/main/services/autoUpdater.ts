import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';

export function initAutoUpdater(mainWindow: BrowserWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info);
  });
  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update-not-available');
  });
  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update-download-progress', progress);
  });
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded');
  });
  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update-error', err.message);
  });

  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (err: any) {
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
}
