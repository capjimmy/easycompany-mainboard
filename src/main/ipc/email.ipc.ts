import { ipcMain } from 'electron';
import { db } from '../database';
import { initEmailTransporter, testEmailConnection, sendQuoteEmail } from '../services/emailService';

export function registerEmailHandlers(): void {
  // SMTP 설정 저장
  ipcMain.handle('email:saveConfig', async (_event, requesterId: string, config: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '관리자만 이메일 설정을 변경할 수 있습니다.' };
    }

    try {
      await db.setSetting('smtp_host', config.host || '');
      await db.setSetting('smtp_port', config.port || 587);
      await db.setSetting('smtp_secure', config.secure || false);
      await db.setSetting('smtp_user', config.user || '');
      await db.setSetting('smtp_pass', config.pass || '');

      // 트랜스포터 초기화
      if (config.host && config.user && config.pass) {
        await initEmailTransporter({
          host: config.host,
          port: config.port || 587,
          secure: config.secure || false,
          user: config.user,
          pass: config.pass,
        });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '이메일 설정 저장에 실패했습니다.' };
    }
  });

  // SMTP 설정 조회
  ipcMain.handle('email:getConfig', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const host = await db.getSetting('smtp_host');
      const port = await db.getSetting('smtp_port');
      const secure = await db.getSetting('smtp_secure');
      const user = await db.getSetting('smtp_user');
      const pass = await db.getSetting('smtp_pass');

      return {
        success: true,
        config: {
          host: host || '',
          port: port || 587,
          secure: secure || false,
          user: user || '',
          pass: pass ? '••••••••' : '', // 비밀번호는 마스킹
          hasPassword: !!pass,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // SMTP 연결 테스트
  ipcMain.handle('email:testConnection', async (_event, config: any) => {
    try {
      // 비밀번호가 마스킹된 경우 저장된 비밀번호 사용
      let pass = config.pass;
      if (pass === '••••••••' || !pass) {
        pass = await db.getSetting('smtp_pass');
      }

      const result = await testEmailConnection({
        host: config.host,
        port: config.port || 587,
        secure: config.secure || false,
        user: config.user,
        pass: pass || '',
      });
      return result;
    } catch (err: any) {
      return { success: false, error: err.message || 'SMTP 연결 테스트에 실패했습니다.' };
    }
  });

  // 견적서 이메일 발송
  ipcMain.handle('email:sendQuote', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      // 트랜스포터가 없으면 설정에서 초기화 시도
      const host = await db.getSetting('smtp_host');
      const port = await db.getSetting('smtp_port');
      const secure = await db.getSetting('smtp_secure');
      const user = await db.getSetting('smtp_user');
      const pass = await db.getSetting('smtp_pass');

      if (!host || !user || !pass) {
        return { success: false, error: '이메일 설정이 되어있지 않습니다. 설정에서 SMTP 정보를 입력해주세요.' };
      }

      await initEmailTransporter({
        host,
        port: port || 587,
        secure: secure || false,
        user,
        pass,
      });

      await sendQuoteEmail({
        to: data.to,
        subject: data.subject,
        body: data.body,
        attachmentPath: data.attachmentPath,
        attachmentName: data.attachmentName,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '이메일 발송에 실패했습니다.' };
    }
  });
}
