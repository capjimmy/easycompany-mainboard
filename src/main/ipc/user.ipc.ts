import { ipcMain } from 'electron';
import { db } from '../database';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// 권한 체크 헬퍼 함수
function canManageUsers(role: string): boolean {
  return ['super_admin', 'company_admin'].includes(role);
}

function canManageRole(requesterRole: string, targetRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    super_admin: 4,
    company_admin: 3,
    department_admin: 2,
    employee: 1,
  };

  return (roleHierarchy[requesterRole] || 0) > (roleHierarchy[targetRole] || 0);
}

export function registerUserHandlers(): void {
  // 모든 사용자 조회 (관리자용)
  ipcMain.handle('users:getAll', async (_event, requesterId: string) => {
    // 요청자 권한 확인
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let users = db.getUsers();

    if (requester.role === 'super_admin') {
      // 슈퍼관리자는 모든 사용자 조회 가능
    } else if (requester.role === 'company_admin') {
      // 회사 관리자는 자기 회사 사용자만 조회 가능
      users = users.filter((u: any) => u.company_id === requester.company_id);
    } else if (requester.role === 'department_admin') {
      // 부서 관리자는 자기 부서 사용자만 조회 가능
      users = users.filter((u: any) => u.department_id === requester.department_id);
    } else {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 회사/부서 정보 추가 및 비밀번호 해시 제거
    const usersWithInfo = users.map((u: any) => {
      const company = u.company_id ? db.getCompanyById(u.company_id) : null;
      const department = u.department_id ? db.getDepartmentById(u.department_id) : null;
      const { password_hash, ...userWithoutPassword } = u;
      return {
        ...userWithoutPassword,
        company_name: company?.name || null,
        department_name: department?.name || null,
      };
    });

    return { success: true, users: usersWithInfo };
  });

  // 사용자 생성
  ipcMain.handle('users:create', async (_event, requesterId: string, userData: any) => {
    // 요청자 권한 확인
    const requester = db.getUserById(requesterId);
    if (!requester || !canManageUsers(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 회사 관리자는 자기 회사에만 사용자 생성 가능
    if (requester.role === 'company_admin') {
      if (userData.company_id !== requester.company_id) {
        return { success: false, error: '다른 회사에 사용자를 생성할 수 없습니다.' };
      }
      // 회사 관리자는 super_admin, company_admin 역할 부여 불가
      if (['super_admin', 'company_admin'].includes(userData.role)) {
        return { success: false, error: '해당 역할은 부여할 수 없습니다.' };
      }
    }

    // 슈퍼관리자만 슈퍼관리자/회사관리자 생성 가능
    if (requester.role !== 'super_admin' && userData.role === 'super_admin') {
      return { success: false, error: '슈퍼관리자는 생성할 수 없습니다.' };
    }

    // 중복 username 확인
    const existing = db.getUserByUsername(userData.username);
    if (existing) {
      return { success: false, error: '이미 존재하는 사용자명입니다.' };
    }

    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync(userData.password || 'password123', 10);

    const newUser = {
      id: userId,
      company_id: userData.company_id || null,
      department_id: userData.department_id || null,
      username: userData.username,
      password_hash: passwordHash,
      name: userData.name,
      email: userData.email || null,
      role: userData.role || 'employee',
      is_active: true,
      last_login: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.addUser(newUser);

    return { success: true, userId };
  });

  // 사용자 수정
  ipcMain.handle('users:update', async (_event, requesterId: string, userId: string, userData: any) => {
    // 요청자 권한 확인
    const requester = db.getUserById(requesterId);
    if (!requester || !canManageUsers(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 대상 사용자 확인
    const target = db.getUserById(userId);
    if (!target) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }

    // 회사 관리자는 자기 회사 사용자만 수정 가능
    if (requester.role === 'company_admin' && target.company_id !== requester.company_id) {
      return { success: false, error: '다른 회사 사용자를 수정할 수 없습니다.' };
    }

    // 자신보다 높은 역할 수정 불가
    if (!canManageRole(requester.role, target.role) && requesterId !== userId) {
      return { success: false, error: '해당 사용자를 수정할 권한이 없습니다.' };
    }

    const updates: any = {};

    if (userData.name) {
      updates.name = userData.name;
    }
    if (userData.email !== undefined) {
      updates.email = userData.email;
    }
    if (userData.department_id !== undefined) {
      updates.department_id = userData.department_id;
    }
    if (userData.role) {
      // 역할 변경 권한 체크
      if (requester.role === 'super_admin') {
        updates.role = userData.role;
      } else if (requester.role === 'company_admin') {
        // 회사 관리자는 department_admin, employee만 설정 가능
        if (['department_admin', 'employee'].includes(userData.role)) {
          updates.role = userData.role;
        }
      }
    }
    if (userData.is_active !== undefined) {
      updates.is_active = userData.is_active;
    }

    if (Object.keys(updates).length > 0) {
      db.updateUser(userId, updates);
    }

    return { success: true };
  });

  // 사용자 삭제
  ipcMain.handle('users:delete', async (_event, requesterId: string, userId: string) => {
    // 요청자 권한 확인
    const requester = db.getUserById(requesterId);
    if (!requester || !canManageUsers(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 대상 사용자 확인
    const target = db.getUserById(userId);
    if (!target) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }

    // 자기 자신 삭제 불가
    if (requesterId === userId) {
      return { success: false, error: '자기 자신은 삭제할 수 없습니다.' };
    }

    // 슈퍼관리자 삭제 불가
    if (target.role === 'super_admin') {
      return { success: false, error: '슈퍼관리자는 삭제할 수 없습니다.' };
    }

    // 회사 관리자는 자기 회사 사용자만 삭제 가능
    if (requester.role === 'company_admin') {
      if (target.company_id !== requester.company_id) {
        return { success: false, error: '다른 회사 사용자를 삭제할 수 없습니다.' };
      }
      // 회사 관리자는 다른 회사 관리자 삭제 불가
      if (target.role === 'company_admin') {
        return { success: false, error: '회사 관리자는 삭제할 수 없습니다.' };
      }
    }

    // 권한도 함께 삭제
    db.deletePermissionsByUserId(userId);
    db.deleteUser(userId);

    return { success: true };
  });

  // 사용자 권한 설정 (회사 관리자가 담당)
  ipcMain.handle('users:setPermissions', async (_event, requesterId: string, userId: string, permissions: any) => {
    // 요청자 권한 확인
    const requester = db.getUserById(requesterId);
    if (!requester || !canManageUsers(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 대상 사용자 확인
    const target = db.getUserById(userId);
    if (!target) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }

    // 회사 관리자는 자기 회사 사용자만 권한 설정 가능
    if (requester.role === 'company_admin' && target.company_id !== requester.company_id) {
      return { success: false, error: '다른 회사 사용자 권한을 설정할 수 없습니다.' };
    }

    // 기존 권한 삭제
    db.deletePermissionsByUserId(userId);

    // 새 권한 추가
    for (const [menuKey, perms] of Object.entries(permissions) as any) {
      db.addMenuPermission({
        id: uuidv4(),
        user_id: userId,
        menu_key: menuKey,
        can_view: perms.view ? 1 : 0,
        can_create: perms.create ? 1 : 0,
        can_edit: perms.edit ? 1 : 0,
        can_delete: perms.delete ? 1 : 0,
        created_at: new Date().toISOString(),
      });
    }

    return { success: true };
  });

  // 비밀번호 초기화 (관리자용)
  ipcMain.handle('users:resetPassword', async (_event, requesterId: string, userId: string, newPassword: string) => {
    // 요청자 권한 확인
    const requester = db.getUserById(requesterId);
    if (!requester || !canManageUsers(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 대상 사용자 확인
    const target = db.getUserById(userId);
    if (!target) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }

    // 회사 관리자는 자기 회사 사용자만 비밀번호 초기화 가능
    if (requester.role === 'company_admin' && target.company_id !== requester.company_id) {
      return { success: false, error: '다른 회사 사용자 비밀번호를 초기화할 수 없습니다.' };
    }

    // 슈퍼관리자 비밀번호는 슈퍼관리자만 초기화 가능
    if (target.role === 'super_admin' && requester.role !== 'super_admin') {
      return { success: false, error: '슈퍼관리자 비밀번호는 초기화할 수 없습니다.' };
    }

    const passwordHash = bcrypt.hashSync(newPassword || 'password123', 10);
    db.updateUser(userId, { password_hash: passwordHash });

    return { success: true };
  });
}
