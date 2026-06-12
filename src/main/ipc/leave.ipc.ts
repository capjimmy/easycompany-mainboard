import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: '연차',
  half_am: '오전반차',
  half_pm: '오후반차',
  sick: '병가',
  special: '특별휴가',
  business_trip: '출장',
  remote: '재택근무',
};

/**
 * 입사일 기준 연차 자동 계산
 * - 1년 미만: 근무 월 수당 1일 (최대 11일)
 * - 1년 이상: 15일
 * - 이후 2년마다 +1일 (최대 25일)
 */
export function calculateAnnualLeave(hireDateStr: string, referenceDateStr?: string): number {
  const hireDate = new Date(hireDateStr);
  const referenceDate = referenceDateStr ? new Date(referenceDateStr) : new Date();

  if (isNaN(hireDate.getTime())) return 0;

  // 근속 년수 계산
  const diffMs = referenceDate.getTime() - hireDate.getTime();
  if (diffMs < 0) return 0;

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.floor(diffMs / msPerDay);
  const totalMonths = Math.floor(totalDays / 30.44); // 평균 월 일수
  const totalYears = Math.floor(totalDays / 365.25);

  if (totalYears < 1) {
    // 1년 미만: 근무 월수당 1일 (최대 11일)
    return Math.min(totalMonths, 11);
  }

  // 1년 이상: 15일 기본
  // 매 2년마다 +1일 (최대 25일)
  const extraYears = Math.max(0, totalYears - 1);
  const bonusDays = Math.floor(extraYears / 2);
  return Math.min(15 + bonusDays, 25);
}

export function registerLeaveHandlers(): void {
  // ========================================
  // 연차 자동 계산 조회
  // ========================================
  ipcMain.handle('leave:calculateAnnual', async (_event, userId: string) => {
    try {
      const user = await db.getUserById(userId);
      if (!user) return { success: false, error: '사용자를 찾을 수 없습니다.' };

      const overrideRaw = (user as any).annual_leave_override;
      const hasOverride = overrideRaw !== null && overrideRaw !== undefined && overrideRaw !== '';

      if (!user.hire_date && !hasOverride) {
        return { success: true, data: { total: 0, used: 0, remaining: 0, hire_date: null } };
      }

      const totalDays = hasOverride ? Number(overrideRaw) : calculateAnnualLeave(user.hire_date);

      // 올해 사용한 연차 조회
      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      const requests = await db.getLeaveRequests({ user_id: userId });
      const usedFromRequests = requests
        .filter((r: any) =>
          (r.status === 'approved' || r.status === 'dept_approved') &&
          r.start_date >= yearStart && r.start_date <= yearEnd &&
          (r.leave_type === 'annual' || r.leave_type === 'half_am' || r.leave_type === 'half_pm')
        )
        .reduce((sum: number, r: any) => sum + (r.days || 0), 0);

      // 관리자가 수동으로 추가한 사용 연차 (시스템 도입 전 사용분 등)
      const offsetRaw = (user as any).annual_leave_used_offset;
      const usedOffset = offsetRaw !== null && offsetRaw !== undefined && offsetRaw !== ''
        ? Number(offsetRaw) : 0;

      const usedDays = usedFromRequests + usedOffset;

      return {
        success: true,
        data: {
          total: totalDays,
          used: usedDays,
          used_from_requests: usedFromRequests,
          used_offset: usedOffset,
          remaining: Math.max(0, totalDays - usedDays),
          hire_date: user.hire_date,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 내 연차 신청 목록
  // ========================================
  ipcMain.handle('leave:getMyRequests', async (_event, requesterId: string) => {
    try {
      const requests = await db.getLeaveRequests({ user_id: requesterId });
      // 신청자 이름 첨부
      const enriched: any[] = [];
      for (const req of requests) {
        const user = await db.getUserById(req.user_id);
        const approver = req.approved_by ? await db.getUserById(req.approved_by) : null;
        const dept = user?.department_id ? await db.getDepartmentById(user.department_id) : null;
        enriched.push({
          ...req,
          user_name: user?.name || '(알 수 없음)',
          user_rank: user?.rank || '',
          user_department: dept?.name || '',
          approver_name: approver?.name || null,
        });
      }
      return { success: true, requests: enriched };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 회사 전체 연차 신청 목록 (관리자용)
  // department_manager도 자기 부서 신청 조회 가능
  // ========================================
  ipcMain.handle('leave:getAllRequests', async (_event, requesterId: string, filters?: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      // employee는 캘린더 용도(자기 부서)로만 조회 허용 - calendarMode 플래그
      const calendarMode = !!filters?.calendarMode;
      const allowedRoles = calendarMode
        ? ['super_admin', 'company_admin', 'department_manager', 'employee']
        : ['super_admin', 'company_admin', 'department_manager'];
      if (!allowedRoles.includes(requester.role)) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const queryFilters: any = {};
      if (requester.role !== 'super_admin' && requester.company_id) {
        queryFilters.company_id = requester.company_id;
      } else if (requester.role === 'super_admin' && filters?.company_id) {
        queryFilters.company_id = filters.company_id;
      }
      if (filters?.status) queryFilters.status = filters.status;

      let requests = await db.getLeaveRequests(queryFilters);

      // 역할별 부서 스코핑
      const allUsers = await db.getUsers();

      // employee는 강제로 자기 부서로 제한
      if (requester.role === 'employee') {
        if (!requester.department_id) {
          return { success: true, requests: [] };
        }
        const deptUserIds = allUsers
          .filter((u: any) => u.department_id === requester.department_id)
          .map((u: any) => u.id);
        requests = requests.filter((r: any) => deptUserIds.includes(r.user_id));
      } else if (requester.role === 'department_manager' && requester.department_id) {
        // department_manager는 자기 회사 전체 조회 가능 (캘린더 요구사항)
        // 단 비-캘린더 모드(승인용)는 기존대로 자기 부서만
        if (!calendarMode) {
          const deptUserIds = allUsers
            .filter((u: any) => u.department_id === requester.department_id)
            .map((u: any) => u.id);
          requests = requests.filter((r: any) => deptUserIds.includes(r.user_id));
        }
      } else if (
        (requester.role === 'company_admin' || requester.role === 'super_admin') &&
        filters?.department_id &&
        filters.department_id !== 'all'
      ) {
        const deptUserIds = allUsers
          .filter((u: any) => u.department_id === filters.department_id)
          .map((u: any) => u.id);
        requests = requests.filter((r: any) => deptUserIds.includes(r.user_id));
      }

      const enriched: any[] = [];
      for (const req of requests) {
        const user = await db.getUserById(req.user_id);
        const approver = req.approved_by ? await db.getUserById(req.approved_by) : null;
        const deptApprover = req.dept_approved_by ? await db.getUserById(req.dept_approved_by) : null;
        const dept = user?.department_id ? await db.getDepartmentById(user.department_id) : null;
        enriched.push({
          ...req,
          user_name: user?.name || '(알 수 없음)',
          user_rank: user?.rank || '',
          user_department: dept?.name || '',
          department_id: user?.department_id || '',
          department_name: dept?.name || '',
          approver_name: approver?.name || null,
          dept_approver_name: deptApprover?.name || null,
        });
      }
      return { success: true, requests: enriched };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 연차 신청
  // ========================================
  ipcMain.handle('leave:create', async (_event, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '사용자를 찾을 수 없습니다.' };

      // 출장/재택은 자동 승인 (관리자 승인 불필요)
      const AUTO_APPROVE_TYPES = ['business_trip', 'remote'];
      const leaveType = data.leave_type || 'annual';
      const isAutoApprove = AUTO_APPROVE_TYPES.includes(leaveType);
      const nowIso = new Date().toISOString();

      const leaveRequest = {
        id: uuidv4(),
        user_id: requesterId,
        company_id: requester.company_id,
        leave_type: leaveType,
        start_date: data.start_date,
        end_date: data.end_date,
        days: data.days || 1,
        reason: data.reason || '',
        status: isAutoApprove ? 'approved' : 'pending',
        approved_by: isAutoApprove ? requesterId : null,
        approved_at: isAutoApprove ? nowIso : null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      await db.addLeaveRequest(leaveRequest);

      const typeLabel = LEAVE_TYPE_LABELS[leaveType] || leaveType;
      const allUsers = await db.getUsers();

      // 알림 전송: 자동승인이면 정보성 알림만, 승인 필요면 결재 요청 알림
      const deptManagers = allUsers.filter((u: any) =>
        u.is_active &&
        u.role === 'department_manager' &&
        u.department_id === requester.department_id &&
        u.id !== requesterId
      );
      const admins = allUsers.filter((u: any) =>
        u.is_active &&
        (u.role === 'company_admin' || u.role === 'super_admin') &&
        (u.company_id === requester.company_id || u.role === 'super_admin')
      );

      const notifyTargets = [...deptManagers, ...admins];
      const notifTitle = isAutoApprove ? `${typeLabel} 등록` : '연차 신청';
      const notifMessage = isAutoApprove
        ? `${requester.name}(${requester.rank || ''})님이 ${typeLabel}를 등록했습니다. (${data.start_date} ~ ${data.end_date}, ${data.days}일)`
        : `${requester.name}(${requester.rank || ''})님이 ${typeLabel}를 신청했습니다. (${data.start_date} ~ ${data.end_date}, ${data.days}일)`;

      for (const target of notifyTargets) {
        await db.addNotification({
          id: uuidv4(),
          user_id: target.id,
          type: isAutoApprove ? 'leave_info' : 'leave_request',
          title: notifTitle,
          message: notifMessage,
          link: '/hr/leave-admin',
          related_id: leaveRequest.id,
          created_by: requesterId,
          created_at: nowIso,
        });
      }

      return { success: true, data: leaveRequest };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 연차 승인 (2단계)
  // Step 1: department_manager -> pending → dept_approved
  // Step 2: company_admin/super_admin -> dept_approved → approved
  // company_admin/super_admin은 pending에서 바로 approved도 가능 (직접 승인)
  // ========================================
  ipcMain.handle('leave:approve', async (_event, requesterId: string, leaveId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const allowedRoles = ['super_admin', 'company_admin', 'department_manager'];
      if (!allowedRoles.includes(requester.role)) {
        return { success: false, error: '승인 권한이 없습니다.' };
      }

      // 현재 신청 상태 확인
      const requests = await db.getLeaveRequests({});
      const leaveRequest = requests.find((r: any) => r.id === leaveId);
      if (!leaveRequest) {
        return { success: false, error: '신청을 찾을 수 없습니다.' };
      }

      // 회사 소속 확인
      if (requester.role !== 'super_admin' && leaveRequest.company_id !== requester.company_id) {
        return { success: false, error: '같은 회사의 신청만 승인할 수 있습니다.' };
      }

      // 부서 관리자는 같은 부서 신청만
      if (requester.role === 'department_manager') {
        const applicant = await db.getUserById(leaveRequest.user_id);
        if (!applicant || applicant.department_id !== requester.department_id) {
          return { success: false, error: '같은 부서의 신청만 승인할 수 있습니다.' };
        }
      }

      if (requester.role === 'department_manager') {
        // 부서 관리자: pending → dept_approved만 가능
        if (leaveRequest.status !== 'pending') {
          return { success: false, error: '대기 중인 신청만 승인할 수 있습니다.' };
        }

        const updated = await db.updateLeaveRequest(leaveId, {
          status: 'dept_approved',
          dept_approved_by: requesterId,
          dept_approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // 신청자에게 부서 승인 알림
        await db.addNotification({
          id: uuidv4(),
          user_id: updated.user_id,
          type: 'leave_approved',
          title: '연차 부서 승인',
          message: `${requester.name}(부서관리자)님이 연차 신청을 부서 승인했습니다. 최종 승인 대기 중입니다. (${updated.start_date} ~ ${updated.end_date})`,
          link: '/hr/leave',
          related_id: leaveId,
          created_by: requesterId,
          created_at: new Date().toISOString(),
        });

        // 회사 관리자에게 최종 승인 요청 알림
        const allUsers = await db.getUsers();
        const companyAdmins = allUsers.filter((u: any) =>
          u.is_active &&
          (u.role === 'company_admin' || u.role === 'super_admin') &&
          (u.company_id === leaveRequest.company_id || u.role === 'super_admin')
        );
        const applicant = await db.getUserById(updated.user_id);
        for (const admin of companyAdmins) {
          await db.addNotification({
            id: uuidv4(),
            user_id: admin.id,
            type: 'leave_request',
            title: '연차 최종 승인 요청',
            message: `${applicant?.name || ''}님의 연차가 부서 승인되었습니다. 최종 승인을 진행해주세요. (${updated.start_date} ~ ${updated.end_date})`,
            link: '/hr/leave-admin',
            related_id: leaveId,
            created_by: requesterId,
            created_at: new Date().toISOString(),
          });
        }

        return { success: true, data: updated };
      } else {
        // company_admin / super_admin: pending → approved 또는 dept_approved → approved
        if (leaveRequest.status !== 'pending' && leaveRequest.status !== 'dept_approved') {
          return { success: false, error: '승인 가능한 상태가 아닙니다.' };
        }

        const updated = await db.updateLeaveRequest(leaveId, {
          status: 'approved',
          approved_by: requesterId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // 신청자에게 최종 승인 알림
        await db.addNotification({
          id: uuidv4(),
          user_id: updated.user_id,
          type: 'leave_approved',
          title: '연차 최종 승인',
          message: `${requester.name}님이 연차 신청을 최종 승인했습니다. (${updated.start_date} ~ ${updated.end_date})`,
          link: '/hr/leave',
          related_id: leaveId,
          created_by: requesterId,
          created_at: new Date().toISOString(),
        });

        return { success: true, data: updated };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 연차 반려
  // department_manager: pending → rejected (부서 단계에서 반려, 회사관리자에게 가지 않음)
  // company_admin/super_admin: pending 또는 dept_approved → rejected
  // ========================================
  ipcMain.handle('leave:reject', async (_event, requesterId: string, leaveId: string, reason?: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const allowedRoles = ['super_admin', 'company_admin', 'department_manager'];
      if (!allowedRoles.includes(requester.role)) {
        return { success: false, error: '반려 권한이 없습니다.' };
      }

      // 현재 신청 상태 확인
      const requests = await db.getLeaveRequests({});
      const leaveRequest = requests.find((r: any) => r.id === leaveId);
      if (!leaveRequest) {
        return { success: false, error: '신청을 찾을 수 없습니다.' };
      }

      // 회사 소속 확인
      if (requester.role !== 'super_admin' && leaveRequest.company_id !== requester.company_id) {
        return { success: false, error: '같은 회사의 신청만 반려할 수 있습니다.' };
      }

      // 부서 관리자는 같은 부서 신청만
      if (requester.role === 'department_manager') {
        const applicant = await db.getUserById(leaveRequest.user_id);
        if (!applicant || applicant.department_id !== requester.department_id) {
          return { success: false, error: '같은 부서의 신청만 반려할 수 있습니다.' };
        }
      }

      if (requester.role === 'department_manager') {
        // 부서 관리자: pending 상태만 반려 가능
        if (leaveRequest.status !== 'pending') {
          return { success: false, error: '대기 중인 신청만 반려할 수 있습니다.' };
        }
      } else {
        // company_admin/super_admin: pending 또는 dept_approved 반려 가능
        if (leaveRequest.status !== 'pending' && leaveRequest.status !== 'dept_approved') {
          return { success: false, error: '반려 가능한 상태가 아닙니다.' };
        }
      }

      const updated = await db.updateLeaveRequest(leaveId, {
        status: 'rejected',
        approved_by: requesterId,
        approved_at: new Date().toISOString(),
        reject_reason: reason || '',
        updated_at: new Date().toISOString(),
      });

      // 신청자에게 반려 알림
      const rejectorLabel = requester.role === 'department_manager' ? '부서관리자' : '관리자';
      await db.addNotification({
        id: uuidv4(),
        user_id: updated.user_id,
        type: 'leave_rejected',
        title: '연차 반려',
        message: `${requester.name}(${rejectorLabel})님이 연차 신청을 반려했습니다.${reason ? ' 사유: ' + reason : ''} (${updated.start_date} ~ ${updated.end_date})`,
        link: '/hr/leave',
        related_id: leaveId,
        created_by: requesterId,
        created_at: new Date().toISOString(),
      });

      return { success: true, data: updated };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 연차 취소 (본인 - 승인 전/후 모두 가능)
  // 승인된 연차도 취소 가능 (calculateAnnual 시 cancelled 상태는 제외되므로 자동 환원)
  // ========================================
  ipcMain.handle('leave:cancel', async (_event, requesterId: string, leaveId: string) => {
    try {
      const requests = await db.getLeaveRequests({ user_id: requesterId });
      const target = requests.find((r: any) => r.id === leaveId);
      if (!target) return { success: false, error: '신청을 찾을 수 없습니다.' };
      if (target.status === 'rejected' || target.status === 'cancelled') {
        return { success: false, error: '이미 취소되거나 반려된 신청입니다.' };
      }

      const wasApproved = target.status === 'approved';
      const updated = await db.updateLeaveRequest(leaveId, {
        status: 'cancelled',
        reject_reason: wasApproved ? '본인 취소 (승인 후)' : '본인 취소',
        updated_at: new Date().toISOString(),
      });

      // 승인된 상태에서 취소 시 관리자에게 알림
      if (wasApproved) {
        const requester = await db.getUserById(requesterId);
        const allUsers = await db.getUsers();
        const admins = allUsers.filter((u: any) =>
          u.is_active &&
          (u.role === 'company_admin' || u.role === 'super_admin') &&
          (u.company_id === target.company_id || u.role === 'super_admin')
        );
        const typeLabel = LEAVE_TYPE_LABELS[target.leave_type] || target.leave_type;
        for (const admin of admins) {
          await db.addNotification({
            id: uuidv4(),
            user_id: admin.id,
            type: 'leave_cancelled',
            title: '승인된 연차 취소',
            message: `${requester?.name || ''}님이 승인된 ${typeLabel}를 취소했습니다. (${target.start_date} ~ ${target.end_date}, ${target.days}일)`,
            link: '/hr/leave-admin',
            related_id: leaveId,
            created_by: requesterId,
            created_at: new Date().toISOString(),
          });
        }
      }

      return { success: true, data: updated };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
