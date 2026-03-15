import { ipcMain, dialog } from 'electron';
import { db } from '../database';
import { initOCRClient, processImageWithOCR } from '../services/ocrService';

export function registerOCRHandlers(): void {
  // OCR 이미지 처리
  ipcMain.handle('ocr:processImage', async (_event, requesterId: string, filePath: string, docType: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      // API 키 확인 및 클라이언트 초기화
      const apiKey = await db.getSetting('openai_api_key');
      if (!apiKey) {
        return { success: false, error: 'OpenAI API 키가 설정되어 있지 않습니다. 설정에서 API 키를 등록해주세요.' };
      }

      initOCRClient(apiKey);

      // 파일 경로가 없으면 파일 선택 다이얼로그 표시
      let targetPath = filePath;
      if (!targetPath) {
        const result = await dialog.showOpenDialog({
          title: '문서 스캔 - 파일 선택',
          filters: [
            { name: '이미지/PDF', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'] },
            { name: '모든 파일', extensions: ['*'] },
          ],
          properties: ['openFile'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, error: 'canceled' };
        }
        targetPath = result.filePaths[0];
      }

      const ocrResult = await processImageWithOCR(targetPath, docType);
      return ocrResult;
    } catch (err: any) {
      return { success: false, error: err.message || 'OCR 처리에 실패했습니다.' };
    }
  });

  // OCR 설정 조회 (OpenAI API 키 상태)
  ipcMain.handle('ocr:getConfig', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const apiKey = await db.getSetting('openai_api_key');
      return {
        success: true,
        config: {
          hasApiKey: !!apiKey,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // OCR 설정 저장 (OpenAI API 키는 AI 설정에서 공유)
  ipcMain.handle('ocr:saveConfig', async (_event, requesterId: string, config: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '관리자만 설정을 변경할 수 있습니다.' };
    }

    try {
      if (config.apiKey) {
        await db.setSetting('openai_api_key', config.apiKey);
        initOCRClient(config.apiKey);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
