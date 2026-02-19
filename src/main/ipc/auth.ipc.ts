import { ipcMain } from 'electron';
import { db } from '../database';
import * as bcrypt from 'bcryptjs';

export function registerAuthHandlers(): void {
  // 로그인
  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    const user = db.getUserByUsername(username);

    if (!user || !user.is_active) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return { success: false, error: '비밀번호가 일치하지 않습니다.' };
    }

    // 마지막 로그인 시간 업데이트
    db.updateUser(user.id, { last_login: new Date().toISOString() });

    // 권한 정보 가져오기
    const permissions = db.getPermissionsByUserId(user.id);

    // 회사 정보 가져오기
    const company = user.company_id ? db.getCompanyById(user.company_id) : null;

    // 부서 정보 가져오기
    const department = user.department_id ? db.getDepartmentById(user.department_id) : null;

    // 비밀번호 해시 제외하고 반환
    const { password_hash, ...userWithoutPassword } = user;

    return {
      success: true,
      user: {
        ...userWithoutPassword,
        company_name: company?.name || null,
        department_name: department?.name || null,
        permissions: permissions.reduce((acc: any, p: any) => {
          acc[p.menu_key] = {
            view: !!p.can_view,
            create: !!p.can_create,
            edit: !!p.can_edit,
            delete: !!p.can_delete,
          };
          return acc;
        }, {}),
      },
    };
  });

  // 로그아웃
  ipcMain.handle('auth:logout', async () => {
    return { success: true };
  });

  // 비밀번호 변경
  ipcMain.handle('auth:changePassword', async (_event, userId: string, oldPassword: string, newPassword: string) => {
    const user = db.getUserById(userId);

    if (!user) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }

    const isValid = bcrypt.compareSync(oldPassword, user.password_hash);
    if (!isValid) {
      return { success: false, error: '현재 비밀번호가 일치하지 않습니다.' };
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.updateUser(userId, { password_hash: newHash });

    return { success: true };
  });

  // 현재 사용자 정보 가져오기
  ipcMain.handle('auth:getCurrentUser', async (_event, userId: string) => {
    const user = db.getUserById(userId);

    if (!user || !user.is_active) {
      return null;
    }

    // 권한 정보 가져오기
    const permissions = db.getPermissionsByUserId(userId);

    // 회사 정보 가져오기
    const company = user.company_id ? db.getCompanyById(user.company_id) : null;

    // 부서 정보 가져오기
    const department = user.department_id ? db.getDepartmentById(user.department_id) : null;

    // 비밀번호 해시 제외
    const { password_hash, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      company_name: company?.name || null,
      department_name: department?.name || null,
      permissions: permissions.reduce((acc: any, p: any) => {
        acc[p.menu_key] = {
          view: !!p.can_view,
          create: !!p.can_create,
          edit: !!p.can_edit,
          delete: !!p.can_delete,
        };
        return acc;
      }, {}),
    };
  });
}
