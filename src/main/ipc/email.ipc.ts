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

  // SMTP 연결 테스트 (관리자만)
  ipcMain.handle('email:testConnection', async (_event, config: any, requesterId?: string) => {
    if (requesterId) {
      const requester = await db.getUserById(requesterId);
      if (!requester || (requester.role !== 'super_admin' && requester.role !== 'company_admin')) {
        return { success: false, error: '관리자만 SMTP 연결 테스트를 할 수 있습니다.' };
      }
    }
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
        attachments: data.attachments,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '이메일 발송에 실패했습니다.' };
    }
  });

  // ========== 메일 승인 워크플로우 ==========

  // 승인 요청 생성 (직원 → 부서장)
  ipcMain.handle('email:requestApproval', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      // 부서장 찾기 - 같은 부서의 department_manager
      const deptId = requester.department_id;
      if (!deptId) {
        return { success: false, error: '소속 부서가 없습니다.' };
      }

      const allUsers = await db.getUsers();
      const approver = allUsers.find((u: any) =>
        u.department_id === deptId && u.role === 'department_manager'
      );

      if (!approver) {
        return { success: false, error: '부서장이 등록되어 있지 않습니다. 관리자에게 문의하세요.' };
      }

      const approval = await db.addEmailApproval({
        requester_id: requesterId,
        approver_id: approver.id,
        document_type: data.document_type,
        document_id: data.document_id,
        recipient_email: data.recipient_email,
        subject: data.subject,
        body: data.body,
        attachments: data.attachments || [],
        status: 'pending',
      });

      return { success: true, approval };
    } catch (err: any) {
      return { success: false, error: err.message || '승인 요청에 실패했습니다.' };
    }
  });

  // 승인 목록 조회
  ipcMain.handle('email:getApprovals', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      let queryFilters: any = {};

      if (requester.role === 'employee') {
        // 직원은 본인이 요청한 것만
        queryFilters.requester_id = requesterId;
      } else if (requester.role === 'department_manager') {
        // 부서장은 본인이 승인할 것 + 본인 요청한 것
        if (filters?.mode === 'my_requests') {
          queryFilters.requester_id = requesterId;
        } else {
          queryFilters.approver_id = requesterId;
        }
      }
      // super_admin, company_admin은 필터 없이 전체 조회

      if (filters?.status) {
        queryFilters.status = filters.status;
      }

      const approvals = await db.getEmailApprovals(queryFilters);

      // 요청자/승인자 이름 매핑
      const allUsers = await db.getUsers();
      const userMap = new Map(allUsers.map((u: any) => [u.id, u]));

      const enriched = approvals.map((a: any) => ({
        ...a,
        requester_name: (userMap.get(a.requester_id) as any)?.name || '알 수 없음',
        approver_name: (userMap.get(a.approver_id) as any)?.name || '알 수 없음',
      }));

      return { success: true, approvals: enriched };
    } catch (err: any) {
      return { success: false, error: err.message || '승인 목록 조회에 실패했습니다.' };
    }
  });

  // 승인/반려 처리 (부서장)
  ipcMain.handle('email:processApproval', async (_event, requesterId: string, approvalId: string, action: 'approved' | 'rejected', reason?: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    if (requester.role !== 'department_manager' && requester.role !== 'company_admin' && requester.role !== 'super_admin') {
      return { success: false, error: '승인 권한이 없습니다.' };
    }

    try {
      // 지정된 승인자인지 확인 (super_admin/company_admin은 모든 승인 가능)
      const existingApprovals = await db.getEmailApprovals({ status: 'pending' });
      const targetApproval = existingApprovals.find((a: any) => a.id === approvalId);
      if (!targetApproval) {
        return { success: false, error: '승인 요청을 찾을 수 없습니다.' };
      }
      if (requester.role === 'department_manager' && targetApproval.approver_id !== requesterId) {
        return { success: false, error: '본인에게 지정된 승인 요청만 처리할 수 있습니다.' };
      }

      const approval = await db.updateEmailApproval(approvalId, {
        status: action,
        rejection_reason: action === 'rejected' ? (reason || '') : null,
        reviewed_at: new Date().toISOString(),
      });

      // 승인된 경우 자동 발송
      if (action === 'approved' && approval) {
        const host = await db.getSetting('smtp_host');
        const port = await db.getSetting('smtp_port');
        const secure = await db.getSetting('smtp_secure');
        const user = await db.getSetting('smtp_user');
        const pass = await db.getSetting('smtp_pass');

        if (host && user && pass) {
          await initEmailTransporter({
            host,
            port: port || 587,
            secure: secure || false,
            user,
            pass,
          });

          await sendQuoteEmail({
            to: approval.recipient_email,
            subject: approval.subject,
            body: approval.body,
            attachments: approval.attachments || [],
          });
        }
      }

      return { success: true, approval };
    } catch (err: any) {
      return { success: false, error: err.message || '승인 처리에 실패했습니다.' };
    }
  });
}
