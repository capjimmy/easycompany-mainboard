import { ipcMain, dialog } from 'electron';
import { db } from '../database';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

// 한글 초성 → 영문 매핑
const KOREAN_INITIAL_MAP: Record<number, string> = {
  0: 'g',   // ㄱ
  1: 'gg',  // ㄲ
  2: 'n',   // ㄴ
  3: 'd',   // ㄷ
  4: 'dd',  // ㄸ
  5: 'r',   // ㄹ
  6: 'm',   // ㅁ
  7: 'b',   // ㅂ
  8: 'bb',  // ㅃ
  9: 's',   // ㅅ
  10: 'ss', // ㅆ
  11: '',   // ㅇ (skip)
  12: 'j',  // ㅈ
  13: 'jj', // ㅉ
  14: 'ch', // ㅊ
  15: 'k',  // ㅋ
  16: 't',  // ㅌ
  17: 'p',  // ㅍ
  18: 'h',  // ㅎ
};

/**
 * 한글 이름을 영문 이니셜로 변환
 * 예: 박민수 → bms (ㅂ→b, ㅁ→m, ㅅ→s)
 */
function koreanNameToInitials(name: string): string {
  let initials = '';
  for (const char of name) {
    const code = char.charCodeAt(0);
    // 한글 음절 범위: 0xAC00 ~ 0xD7A3
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const syllableIndex = code - 0xAC00;
      const initialIndex = Math.floor(syllableIndex / (21 * 28));
      const mapped = KOREAN_INITIAL_MAP[initialIndex];
      if (mapped !== undefined) {
        initials += mapped;
      }
    }
  }
  return initials;
}

/**
 * 유저네임 자동 생성: 한글이름 이니셜 + 입사년도
 * 중복 시 _1, _2 등 접미사 추가
 */
async function generateUniqueUsername(name: string, hireYear: string): Promise<string> {
  const initials = koreanNameToInitials(name);
  if (!initials) {
    // 한글이 아닌 경우 이름을 소문자로 사용
    const fallback = name.replace(/\s/g, '').toLowerCase();
    return `${fallback}${hireYear}`;
  }

  const baseUsername = `${initials}${hireYear}`;

  // 중복 확인
  const existing = await db.getUserByUsername(baseUsername);
  if (!existing) {
    return baseUsername;
  }

  // 중복이면 _1, _2... 시도
  let suffix = 1;
  while (true) {
    const candidate = `${baseUsername}_${suffix}`;
    const dup = await db.getUserByUsername(candidate);
    if (!dup) {
      return candidate;
    }
    suffix++;
    if (suffix > 100) break; // 안전장치
  }

  return `${baseUsername}_${Date.now()}`;
}

// 직원명부 확장 필드 목록
const EMPLOYEE_FIELDS = [
  'employee_number', 'rank', 'position', 'phone', 'direct_phone', 'hire_date', 'resignation_date',
  'birth_date', 'address',
  'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
  'bank_name', 'bank_account',
  'education', 'certifications', 'career_history', 'extra_info',
];

// 권한 체크 헬퍼 함수
function canManageUsers(role: string): boolean {
  return ['super_admin', 'company_admin'].includes(role);
}

function canManageRole(requesterRole: string, targetRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    super_admin: 4,
    company_admin: 3,
    department_manager: 2,
    employee: 1,
  };

  return (roleHierarchy[requesterRole] || 0) > (roleHierarchy[targetRole] || 0);
}

export function registerUserHandlers(): void {
  // 모든 사용자 조회 (관리자용)
  ipcMain.handle('users:getAll', async (_event, requesterId: string) => {
    // 요청자 권한 확인
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let users = await db.getUsers();

    if (requester.role === 'super_admin') {
      // 슈퍼관리자는 모든 사용자 조회 가능
    } else if (requester.role === 'company_admin') {
      // 회사 관리자는 자기 회사 사용자만 조회 가능
      users = users.filter((u: any) => u.company_id === requester.company_id);
    } else if (requester.role === 'department_manager') {
      // 부서 관리자는 자기 부서 사용자만 조회 가능
      users = users.filter((u: any) => u.department_id === requester.department_id);
    } else {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 회사/부서 정보 추가 및 비밀번호 해시 제거
    const usersWithInfo = [];
    for (const u of users) {
      const company = u.company_id ? await db.getCompanyById(u.company_id) : null;
      const department = u.department_id ? await db.getDepartmentById(u.department_id) : null;
      const { password_hash, ...userWithoutPassword } = u;

      // 권한 데이터 로드
      const userPerms = await db.getPermissionsByUserId(u.id);
      const permissions: Record<string, any> = {};
      for (const perm of userPerms) {
        permissions[perm.menu_key] = {
          view: !!perm.can_view,
          create: !!perm.can_create,
          edit: !!perm.can_edit,
          delete: !!perm.can_delete,
        };
      }

      const result: any = {
        ...userWithoutPassword,
        company_name: company?.name || null,
        department_name: department?.name || null,
        permissions,
      };

      // 비관리자에게는 민감 필드 제외
      if (!['super_admin', 'company_admin'].includes(requester.role)) {
        delete result.bank_name;
        delete result.bank_account;
      }

      usersWithInfo.push(result);
    }

    return { success: true, users: usersWithInfo };
  });

  // 사용자 생성
  ipcMain.handle('users:create', async (_event, requesterId: string, userData: any) => {
    // 요청자 권한 확인
    const requester = await db.getUserById(requesterId);
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

    // username이 없으면 자동 생성
    let username = userData.username;
    if (!username && userData.name) {
      const hireYear = userData.hire_date
        ? userData.hire_date.substring(0, 4)
        : new Date().getFullYear().toString();
      username = await generateUniqueUsername(userData.name, hireYear);
    }

    if (!username) {
      return { success: false, error: '사용자명(username)을 입력하거나 이름을 입력해주세요.' };
    }

    // 중복 username 확인
    const existing = await db.getUserByUsername(username);
    if (existing) {
      return { success: false, error: '이미 존재하는 사용자명입니다.' };
    }

    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync(userData.password || 'password123', 10);

    const newUser: any = {
      id: userId,
      company_id: userData.company_id || null,
      department_id: userData.department_id || null,
      username: username,
      password_hash: passwordHash,
      name: userData.name,
      email: userData.email || null,
      role: userData.role || 'employee',
      is_active: true,
      last_login: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 직원명부 확장 필드 추가
    for (const field of EMPLOYEE_FIELDS) {
      if (userData[field] !== undefined) {
        newUser[field] = userData[field];
      }
    }

    await db.addUser(newUser);

    return { success: true, userId };
  });

  // 사용자 수정
  ipcMain.handle('users:update', async (_event, requesterId: string, userId: string, userData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 본인 프로필 수정 (전화번호, 이메일만 허용)
    const isSelfUpdate = requesterId === userId;
    if (!isSelfUpdate && !canManageUsers(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 대상 사용자 확인
    const target = await db.getUserById(userId);
    if (!target) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }

    // 본인 수정인 경우 phone, direct_phone, email만 허용
    if (isSelfUpdate && !canManageUsers(requester.role)) {
      const selfUpdates: any = {};
      if (userData.phone !== undefined) selfUpdates.phone = userData.phone;
      if (userData.direct_phone !== undefined) selfUpdates.direct_phone = userData.direct_phone;
      if (userData.email !== undefined) selfUpdates.email = userData.email;

      if (Object.keys(selfUpdates).length > 0) {
        selfUpdates.updated_at = new Date().toISOString();
        await db.updateUser(userId, selfUpdates);
      }
      return { success: true };
    }

    // 회사 관리자는 자기 회사 사용자만 수정 가능
    if (requester.role === 'company_admin' && target.company_id !== requester.company_id) {
      return { success: false, error: '다른 회사 사용자를 수정할 수 없습니다.' };
    }

    // 자신보다 높은 역할 수정 불가
    if (!canManageRole(requester.role, target.role) && !isSelfUpdate) {
      return { success: false, error: '해당 사용자를 수정할 권한이 없습니다.' };
    }

    const updates: any = {};

    // 아이디(username) 변경
    if (userData.username && userData.username !== target.username) {
      // 중복 확인
      const existing = await db.getUserByUsername(userData.username);
      if (existing && existing.id !== userId) {
        return { success: false, error: '이미 존재하는 사용자명입니다.' };
      }
      updates.username = userData.username;
    }

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
        // 회사 관리자는 department_manager, employee만 설정 가능
        if (['department_manager', 'employee'].includes(userData.role)) {
          updates.role = userData.role;
        }
      }
    }
    if (userData.is_active !== undefined) {
      updates.is_active = userData.is_active;
    }

    // 접근 폴더 업데이트
    if (userData.accessible_folders !== undefined) {
      updates.accessible_folders = userData.accessible_folders;
    }

    // 직원명부 확장 필드 업데이트
    for (const field of EMPLOYEE_FIELDS) {
      if (userData[field] !== undefined) {
        updates[field] = userData[field];
      }
    }

    // 부서 변경 시 접근 폴더 리셋 (새 부서 기본값으로)
    if (userData.department_id !== undefined && userData.department_id !== target.department_id) {
      const newDept = userData.department_id ? await db.getDepartmentById(userData.department_id) : null;
      if (newDept && newDept.default_folders && newDept.default_folders.length > 0) {
        updates.accessible_folders = newDept.default_folders;
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      await db.updateUser(userId, updates);
    }

    return { success: true };
  });

  // 사용자 삭제
  ipcMain.handle('users:delete', async (_event, requesterId: string, userId: string) => {
    // 요청자 권한 확인
    const requester = await db.getUserById(requesterId);
    if (!requester || !canManageUsers(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 대상 사용자 확인
    const target = await db.getUserById(userId);
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
    await db.deletePermissionsByUserId(userId);
    await db.deleteUser(userId);

    return { success: true };
  });

  // 사용자 권한 설정 (회사 관리자가 담당)
  ipcMain.handle('users:setPermissions', async (_event, requesterId: string, userId: string, permissions: any) => {
    // 요청자 권한 확인
    const requester = await db.getUserById(requesterId);
    if (!requester || !canManageUsers(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 대상 사용자 확인
    const target = await db.getUserById(userId);
    if (!target) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }

    // 회사 관리자는 자기 회사 사용자만 권한 설정 가능
    if (requester.role === 'company_admin' && target.company_id !== requester.company_id) {
      return { success: false, error: '다른 회사 사용자 권한을 설정할 수 없습니다.' };
    }

    // 기존 권한 삭제
    await db.deletePermissionsByUserId(userId);

    // 새 권한 추가
    for (const [menuKey, perms] of Object.entries(permissions) as any) {
      await db.addMenuPermission({
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
    const requester = await db.getUserById(requesterId);
    if (!requester || !canManageUsers(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 대상 사용자 확인
    const target = await db.getUserById(userId);
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
    await db.updateUser(userId, { password_hash: passwordHash });

    return { success: true };
  });

  // 유저네임 자동 생성 미리보기
  ipcMain.handle('users:generateUsername', async (_event, name: string, hireYear: string) => {
    try {
      if (!name) {
        return { success: false, error: '이름을 입력해주세요.' };
      }
      const year = hireYear || new Date().getFullYear().toString();
      const username = await generateUniqueUsername(name, year);
      return { success: true, username };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 직원명부 JSON 가져오기 (일괄 계정 생성/업데이트)
  ipcMain.handle('users:importEmployees', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || !['super_admin', 'company_admin'].includes(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const result = await dialog.showOpenDialog({
      title: '직원명부 JSON 파일 선택',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, error: '파일이 선택되지 않았습니다.' };
    }

    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8');
      const data = JSON.parse(content);

      const employees = Array.isArray(data) ? data : data.employees || [];
      if (employees.length === 0) {
        return { success: false, error: '직원 데이터가 없습니다.' };
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;

      const companies = await db.getCompanies();
      const companyId = requester.company_id || companies[0]?.id || null;

      for (const emp of employees) {
        if (!emp.name) {
          skipped++;
          continue;
        }

        // 이름으로 기존 사용자 검색
        const allUsers = await db.getUsers();
        const existingUsers = allUsers.filter((u: any) => u.name === emp.name);

        if (existingUsers.length > 0) {
          // 기존 사용자 데이터 병합 (업데이트)
          const existing = existingUsers[0];
          const updates: any = {};

          for (const field of EMPLOYEE_FIELDS) {
            if (emp[field] !== undefined && emp[field] !== null && emp[field] !== '') {
              updates[field] = emp[field];
            }
          }
          if (emp.email) updates.email = emp.email;
          if (emp.department_id) updates.department_id = emp.department_id;

          if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date().toISOString();
            await db.updateUser(existing.id, updates);
            updated++;
          } else {
            skipped++;
          }
        } else {
          // 새 계정 생성
          const username = emp.username || emp.employee_number || emp.name.replace(/\s/g, '').toLowerCase();

          // username 중복 확인
          if (await db.getUserByUsername(username)) {
            skipped++;
            continue;
          }

          const initialPassword = emp.employee_number || '1234';
          const passwordHash = bcrypt.hashSync(initialPassword, 10);

          const newUser: any = {
            id: uuidv4(),
            company_id: emp.company_id || companyId,
            department_id: emp.department_id || null,
            username,
            password_hash: passwordHash,
            name: emp.name,
            email: emp.email || null,
            role: emp.role || 'employee',
            is_active: true,
            last_login: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          for (const field of EMPLOYEE_FIELDS) {
            if (emp[field] !== undefined) {
              newUser[field] = emp[field];
            }
          }

          await db.addUser(newUser);
          created++;
        }
      }

      return {
        success: true,
        data: { total: employees.length, created, updated, skipped },
      };
    } catch (err: any) {
      return { success: false, error: `파일 처리 오류: ${err.message}` };
    }
  });
}
