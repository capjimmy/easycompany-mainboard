import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerCertificateHandlers(): void {
  // 증명서 목록 조회
  ipcMain.handle('certificates:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      let certificates = await db.getCertificates();

      // 역할 기반 필터링
      if (requester.role === 'super_admin') {
        // 슈퍼관리자는 전체 조회
      } else if (requester.role === 'company_admin') {
        // 회사 관리자는 같은 회사만
        certificates = certificates.filter((c: any) => c.company_id === requester.company_id);
      } else if (requester.role === 'department_manager') {
        // 부서 관리자는 같은 회사만
        certificates = certificates.filter((c: any) => c.company_id === requester.company_id);
      } else {
        // 일반 사원은 본인 것만
        certificates = certificates.filter((c: any) => c.user_id === requester.id);
      }

      // 필터 적용
      if (filters) {
        if (filters.status) {
          certificates = certificates.filter((c: any) => c.status === filters.status);
        }
        if (filters.certificate_type) {
          certificates = certificates.filter((c: any) => c.certificate_type === filters.certificate_type);
        }
        if (filters.user_id) {
          certificates = certificates.filter((c: any) => c.user_id === filters.user_id);
        }
      }

      // 최신순 정렬
      certificates.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { success: true, certificates };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 목록 조회에 실패했습니다.' };
    }
  });

  // 증명서 신청
  ipcMain.handle('certificates:create', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const now = new Date().toISOString();
      const issueNumber = `CERT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const certificate = {
        id: uuidv4(),
        company_id: requester.company_id,
        user_id: requester.id,
        user_name: requester.name,
        certificate_type: data.certificate_type,
        issue_number: issueNumber,
        issue_date: now.split('T')[0],
        purpose: data.purpose || null,
        status: 'pending',
        approved_by: null,
        approved_by_name: null,
        approved_at: null,
        content: data.content || null,
        created_at: now,
      };

      await db.addCertificate(certificate);

      return { success: true, certificateId: certificate.id, issueNumber };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 신청에 실패했습니다.' };
    }
  });

  // 증명서 승인
  ipcMain.handle('certificates:approve', async (_event, requesterId: string, certificateId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 관리자만 승인 가능
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '관리자만 증명서를 승인할 수 있습니다.' };
    }

    try {
      const now = new Date().toISOString();
      await db.updateCertificate(certificateId, {
        status: 'approved',
        approved_by: requester.id,
        approved_by_name: requester.name,
        approved_at: now,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 승인에 실패했습니다.' };
    }
  });

  // 증명서 반려
  ipcMain.handle('certificates:reject', async (_event, requesterId: string, certificateId: string, reason?: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 관리자만 반려 가능
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '관리자만 증명서를 반려할 수 있습니다.' };
    }

    try {
      const now = new Date().toISOString();
      await db.updateCertificate(certificateId, {
        status: 'rejected',
        approved_by: requester.id,
        approved_by_name: requester.name,
        approved_at: now,
        content: reason ? { reject_reason: reason } : undefined,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '증명서 반려에 실패했습니다.' };
    }
  });
}
