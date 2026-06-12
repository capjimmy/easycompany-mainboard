import { ipcMain, dialog } from 'electron';
import { db } from '../database';
import { supabase } from '../database/supabaseClient';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// 비밀번호 기본값
const DEFAULT_RESET_PASSWORD = '000000';
import * as fs from 'fs';

// 한글 초성 → 영문 1글자 매핑 (각 음절당 1글자)
const KOREAN_INITIAL_MAP: Record<number, string | null> = {
  0: 'g',   // ㄱ
  1: 'g',   // ㄲ
  2: 'n',   // ㄴ
  3: 'd',   // ㄷ
  4: 'd',   // ㄸ
  5: 'r',   // ㄹ
  6: 'm',   // ㅁ
  7: 'b',   // ㅂ
  8: 'b',   // ㅃ
  9: 's',   // ㅅ
  10: 's',  // ㅆ
  11: null,  // ㅇ → 모음 첫글자 사용
  12: 'j',  // ㅈ
  13: 'j',  // ㅉ
  14: 'c',  // ㅊ
  15: 'k',  // ㅋ
  16: 't',  // ㅌ
  17: 'p',  // ㅍ
  18: 'h',  // ㅎ
};

// 한글 모음 → 영문 1글자 매핑 (ㅇ 초성일 때 사용)
const KOREAN_VOWEL_MAP: Record<number, string> = {
  0: 'a',   // ㅏ
  1: 'e',   // ㅐ
  2: 'y',   // ㅑ
  3: 'y',   // ㅒ
  4: 'e',   // ㅓ
  5: 'e',   // ㅔ
  6: 'y',   // ㅕ
  7: 'y',   // ㅖ
  8: 'o',   // ㅗ
  9: 'w',   // ㅘ
  10: 'w',  // ㅙ
  11: 'o',  // ㅚ
  12: 'y',  // ㅛ
  13: 'u',  // ㅜ
  14: 'w',  // ㅝ
  15: 'w',  // ㅞ
  16: 'u',  // ㅟ
  17: 'y',  // ㅠ
  18: 'e',  // ㅡ
  19: 'e',  // ㅢ
  20: 'i',  // ㅣ
};

/**
 * 한글 이름을 영문 이니셜로 변환 (음절당 1글자)
 * 영문 로마자 표기 기준 첫 글자만 추출
 * 예: 임철희 → lch (Lim-Cheol-Hee), 이세연 → lsy (Lee-Se-Yeon)
 */
function koreanNameToInitials(name: string): string {
  let initials = '';
  let isFirst = true;
  for (const char of name) {
    const code = char.charCodeAt(0);
    // 한글 음절 범위: 0xAC00 ~ 0xD7A3
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const syllableIndex = code - 0xAC00;
      const initialIndex = Math.floor(syllableIndex / (21 * 28));
      const mapped = KOREAN_INITIAL_MAP[initialIndex];
      if (mapped !== null && mapped !== undefined) {
        initials += mapped;
      } else if (mapped === null) {
        // ㅇ 초성: 로마자 표기 기준
        const vowelIndex = Math.floor((syllableIndex % (21 * 28)) / 28);
        // 첫 음절 ㅇ+ㅣ → 'l' (이/임 → Lee/Lim 관례)
        if (isFirst && vowelIndex === 20) {
          initials += 'l';
        } else {
          initials += KOREAN_VOWEL_MAP[vowelIndex] || 'o';
        }
      }
      isFirst = false;
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
  'annual_leave_override',
  'annual_leave_used_offset',
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

  // super_admin can manage other super_admins
  if (requesterRole === 'super_admin') return true;
  return (roleHierarchy[requesterRole] || 0) > (roleHierarchy[targetRole] || 0);
}

export function registerUserHandlers(): void {
  // 모든 사용자 조회 (관리자용)
  ipcMain.handle('users:getAll', async (_event, requesterId: string, options?: any) => {
    // 요청자 권한 확인
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // scope: 'company'이면 부서관리자/사원도 같은 회사 전체 사용자 조회 가능 (캘린더 생일 등)
    const companyScope = options?.scope === 'company';

    let users = await db.getUsers();

    // Load requester's affiliated companies/departments from junction tables
    const requesterComps = await db.getUserCompanies(requesterId);
    const requesterDepts = await db.getUserDepartments(requesterId);
    const requesterCompanyIds = new Set(
      requesterComps.length > 0
        ? requesterComps.map((uc: any) => uc.company_id)
        : (requester.company_id ? [requester.company_id] : [])
    );
    const requesterDeptIds = new Set(
      requesterDepts.length > 0
        ? requesterDepts.map((ud: any) => ud.department_id)
        : (requester.department_id ? [requester.department_id] : [])
    );

    if (requester.role === 'super_admin') {
      // 슈퍼관리자는 모든 사용자 조회 가능
    } else if (requester.role === 'company_admin') {
      // 회사 관리자는 소속 회사들의 사용자 조회 가능 (junction table 기반)
      users = users.filter((u: any) => requesterCompanyIds.has(u.company_id));
    } else if (requester.role === 'department_manager') {
      if (companyScope) {
        // 캘린더 등: 같은 회사 전체 사용자 조회
        users = users.filter((u: any) => requesterCompanyIds.has(u.company_id));
      } else {
        // 기본: 소속 부서들의 사용자 조회 가능
        users = users.filter((u: any) => requesterDeptIds.has(u.department_id));
      }
    } else if (requester.role === 'employee') {
      if (companyScope) {
        // 캘린더 등: 같은 부서 사용자만 (사원은 부서 범위까지만)
        users = users.filter((u: any) => requesterDeptIds.has(u.department_id) && requesterCompanyIds.has(u.company_id));
      } else {
        // 기본: 자기 부서 사용자만 조회 가능
        users = users.filter((u: any) => requesterDeptIds.has(u.department_id) && requesterCompanyIds.has(u.company_id));
      }
    } else {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 회사/부서/권한 정보 일괄 로드 (단일 쿼리 5개 - N+1 완전 제거)
    const [allCompanies, allDepts, allPermsRows, allUserCompaniesRows, allUserDeptsRows] = await Promise.all([
      db.getCompanies(),
      db.getDepartments(),
      db.getAllPermissions(),
      db.getAllUserCompanies(),
      db.getAllUserDepartments(),
    ]);
    const companyMap = new Map<string, any>(allCompanies.map((c: any) => [c.id, c]));
    const deptMap = new Map<string, any>(allDepts.map((d: any) => [d.id, d]));

    // user_id 별로 그룹핑 (선형 시간)
    const permsMap = new Map<string, any[]>();
    for (const p of allPermsRows) {
      const arr = permsMap.get(p.user_id);
      if (arr) arr.push(p);
      else permsMap.set(p.user_id, [p]);
    }
    const userCompaniesMap = new Map<string, any[]>();
    for (const uc of allUserCompaniesRows) {
      const arr = userCompaniesMap.get(uc.user_id);
      if (arr) arr.push(uc);
      else userCompaniesMap.set(uc.user_id, [uc]);
    }
    const userDeptsMap = new Map<string, any[]>();
    for (const ud of allUserDeptsRows) {
      const arr = userDeptsMap.get(ud.user_id);
      if (arr) arr.push(ud);
      else userDeptsMap.set(ud.user_id, [ud]);
    }

    const usersWithInfo: any[] = [];
    for (const u of users) {
      const company = u.company_id ? companyMap.get(u.company_id) : null;
      const department = u.department_id ? deptMap.get(u.department_id) : null;
      const { password_hash, ...userWithoutPassword } = u;

      // 권한 데이터 로드
      const userPerms = permsMap.get(u.id) || [];
      const permissions: Record<string, any> = {};
      for (const perm of userPerms) {
        permissions[perm.menu_key] = {
          view: !!perm.can_view,
          create: !!perm.can_create,
          edit: !!perm.can_edit,
          delete: !!perm.can_delete,
        };
      }

      // Junction table data: all companies/departments this user belongs to
      const userComps = userCompaniesMap.get(u.id) || [];
      const userDpts = userDeptsMap.get(u.id) || [];
      const companyNames = userComps
        .map((uc: any) => companyMap.get(uc.company_id)?.name)
        .filter(Boolean);
      const departmentNames = userDpts
        .map((ud: any) => deptMap.get(ud.department_id)?.name)
        .filter(Boolean);

      const result: any = {
        ...userWithoutPassword,
        company_name: company?.name || null,
        department_name: department?.name || null,
        company_ids: userComps.map((uc: any) => uc.company_id),
        department_ids: userDpts.map((ud: any) => ud.department_id),
        company_names: companyNames,
        department_names: departmentNames,
        permissions,
      };

      // 급여 관련 정보(은행/계좌)는 super_admin 전용 — 회사관리자도 차단
      if (requester.role !== 'super_admin') {
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

    // Populate junction tables for multi-company/department support
    if (userData.company_ids && Array.isArray(userData.company_ids) && userData.company_ids.length > 0) {
      await db.setUserCompanies(userId, userData.company_ids, userData.company_id || userData.company_ids[0]);
    } else if (userData.company_id) {
      await db.setUserCompanies(userId, [userData.company_id], userData.company_id);
    }

    if (userData.department_ids && Array.isArray(userData.department_ids) && userData.department_ids.length > 0) {
      await db.setUserDepartments(userId, userData.department_ids, userData.department_id || userData.department_ids[0]);
    } else if (userData.department_id) {
      await db.setUserDepartments(userId, [userData.department_id], userData.department_id);
    }

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
    if (userData.company_id !== undefined) {
      updates.company_id = userData.company_id;
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

    // username 변경 시 Supabase Auth의 email도 동기화 (로그인 시 username@easy.local 매핑이므로)
    if (updates.username && target.auth_user_id) {
      const newEmail = `${updates.username}@easy.local`;
      try {
        await supabase.auth.admin.updateUserById(target.auth_user_id, { email: newEmail, email_confirm: true } as any);
        // users 테이블의 email도 같이 갱신
        await db.updateUser(userId, { email: newEmail });
      } catch (e: any) {
        console.error('[users:update] Auth email sync 실패:', e?.message);
        return { success: false, error: '아이디 변경 실패 (Auth 동기화): ' + (e?.message || '알 수 없는 오류') };
      }
    }

    // Sync junction tables when company_ids/department_ids arrays are provided
    if (userData.company_ids && Array.isArray(userData.company_ids)) {
      const primaryCid = updates.company_id || target.company_id;
      await db.setUserCompanies(userId, userData.company_ids, primaryCid);
    }
    if (userData.department_ids && Array.isArray(userData.department_ids)) {
      const primaryDid = updates.department_id || target.department_id;
      await db.setUserDepartments(userId, userData.department_ids, primaryDid);
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

    // 슈퍼관리자는 슈퍼관리자만 삭제 가능
    if (target.role === 'super_admin' && requester.role !== 'super_admin') {
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

    // 관련 데이터 정리 후 삭제 (DB 먼저, 그 다음 Auth)
    try {
      await db.deletePermissionsByUserId(userId);
      await db.setUserCompanies(userId, []);
      await db.setUserDepartments(userId, []);
      // 본인 소유 보조 데이터 정리 (notifications) — 직원 보존성과 무관한 데이터만
      try { await supabase.from('notifications').delete().eq('user_id', userId); } catch { /* 무시 */ }
      await db.deleteUser(userId);
      // Supabase Auth 사용자도 삭제 (실패해도 진행)
      if (target.auth_user_id) {
        try { await supabase.auth.admin.deleteUser(target.auth_user_id); }
        catch (e: any) { console.error('[users:delete] Auth 삭제 실패 (무시):', e?.message); }
      }
      return { success: true };
    } catch (err: any) {
      // FK 제약 등 에러 시 soft delete로 전환 (관련 데이터가 있으면 비활성화)
      try {
        await db.updateUser(userId, { is_active: false, updated_at: new Date().toISOString() });
        // Auth 측도 비활성화 (사용자가 다시 로그인 못 하게 ban_duration 설정)
        if (target.auth_user_id) {
          try { await supabase.auth.admin.updateUserById(target.auth_user_id, { ban_duration: '876000h' } as any); }
          catch (e: any) { console.error('[users:delete] Auth ban 실패:', e?.message); }
        }
        return { success: true, warning: '관련 데이터(계약/견적 등)가 있어 완전 삭제 대신 비활성화 처리되었습니다. 목록에서 사라지려면 비활성 사용자 필터링이 적용됩니다.' };
      } catch (e2: any) {
        return { success: false, error: err?.message || '사용자 삭제에 실패했습니다.' };
      }
    }
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

  // 사용자별 메뉴 순서 저장 (본인만 가능)
  ipcMain.handle('users:updateMenuOrder', async (_event, requesterId: string, menuOrder: string[] | null) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      // 본인 데이터만 수정 가능 — menu_order는 사용자 본인 UI 설정
      await db.updateUser(requesterId, { menu_order: menuOrder } as any);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || '메뉴 순서 저장 실패' };
    }
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

    const finalPassword = newPassword || DEFAULT_RESET_PASSWORD;
    const passwordHash = bcrypt.hashSync(finalPassword, 10);

    // Supabase Auth 비밀번호도 동기화 (Auth가 실제 로그인 게이트)
    if (target.auth_user_id) {
      try {
        await supabase.auth.admin.updateUserById(target.auth_user_id, { password: finalPassword });
      } catch (e: any) {
        console.error('[users:resetPassword] Auth 비밀번호 동기화 실패:', e?.message);
        return { success: false, error: '비밀번호 초기화 실패 (Auth 동기화): ' + (e?.message || '알 수 없는 오류') };
      }
    }
    // 레거시 password_hash도 갱신 (호환성 유지)
    await db.updateUser(userId, { password_hash: passwordHash, updated_at: new Date().toISOString() });

    return { success: true, newPassword: finalPassword };
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

  // ========== 복수 회사/부서 소속 (junction table) ==========

  // 사용자의 소속 회사 목록 조회
  ipcMain.handle('users:getUserCompanies', async (_event, requesterId: string, userId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };
    const rows = await db.getUserCompanies(userId);
    return { success: true, data: rows };
  });

  // 사용자의 소속 부서 목록 조회
  ipcMain.handle('users:getUserDepartments', async (_event, requesterId: string, userId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };
    const rows = await db.getUserDepartments(userId);
    return { success: true, data: rows };
  });

  // 사용자의 소속 회사 설정 (delete all + insert)
  ipcMain.handle('users:setUserCompanies', async (_event, requesterId: string, userId: string, companyIds: string[], primaryCompanyId?: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || !canManageUsers(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }
    try {
      await db.setUserCompanies(userId, companyIds, primaryCompanyId);
      // Sync primary company_id to users table for backward compatibility
      if (primaryCompanyId) {
        await db.updateUser(userId, { company_id: primaryCompanyId, updated_at: new Date().toISOString() });
      } else if (companyIds.length > 0) {
        await db.updateUser(userId, { company_id: companyIds[0], updated_at: new Date().toISOString() });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || '회사 소속 설정 실패' };
    }
  });

  // 사용자의 소속 부서 설정 (delete all + insert)
  ipcMain.handle('users:setUserDepartments', async (_event, requesterId: string, userId: string, departmentIds: string[], primaryDepartmentId?: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || !canManageUsers(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }
    try {
      await db.setUserDepartments(userId, departmentIds, primaryDepartmentId);
      // Sync primary department_id to users table for backward compatibility
      if (primaryDepartmentId) {
        await db.updateUser(userId, { department_id: primaryDepartmentId, updated_at: new Date().toISOString() });
      } else if (departmentIds.length > 0) {
        await db.updateUser(userId, { department_id: departmentIds[0], updated_at: new Date().toISOString() });
      } else {
        await db.updateUser(userId, { department_id: null, updated_at: new Date().toISOString() });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || '부서 소속 설정 실패' };
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

      // 모든 사용자 일괄 로드 (N+1 방지)
      const allUsers = await db.getUsers();

      for (const emp of employees) {
        if (!emp.name) {
          skipped++;
          continue;
        }

        // 이름으로 기존 사용자 검색
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

  // ========================================
  // 직원 월급 (user_salaries) — super_admin 전용
  // ⚠️ 매우 민감한 데이터. 모든 IPC에서 role 재검증 필수.
  // ========================================

  // 단일 직원 월급 조회 (super_admin만)
  ipcMain.handle('userSalary:get', async (_e, requesterId: string, userId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || requester.role !== 'super_admin') {
      return { success: false, error: '권한 없음 (슈퍼관리자 전용)' };
    }
    try {
      const { data, error } = await supabase
        .from('user_salaries')
        .select('user_id, monthly_salary, effective_from, effective_to, notes, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err?.message || '조회 실패' };
    }
  });

  // 전체 직원 월급 목록 (super_admin만) — 순이익 대시보드 등에서 사용
  ipcMain.handle('userSalary:getAll', async (_e, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || requester.role !== 'super_admin') {
      return { success: false, error: '권한 없음 (슈퍼관리자 전용)' };
    }
    try {
      const { data, error } = await supabase
        .from('user_salaries')
        .select('user_id, monthly_salary');
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: any) {
      return { success: false, error: err?.message || '조회 실패' };
    }
  });

  // 월급 설정/갱신 (upsert, super_admin만)
  ipcMain.handle('userSalary:set', async (_e, requesterId: string, userId: string, monthlySalary: number, notes?: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || requester.role !== 'super_admin') {
      return { success: false, error: '권한 없음 (슈퍼관리자 전용)' };
    }
    if (!userId || monthlySalary == null) {
      return { success: false, error: '입력 누락' };
    }
    try {
      // 기존 row 있으면 update, 없으면 insert
      const { data: existing } = await supabase
        .from('user_salaries')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      const now = new Date().toISOString();
      if (existing?.id) {
        const { error } = await supabase
          .from('user_salaries')
          .update({
            monthly_salary: Number(monthlySalary),
            notes: notes || null,
            updated_by: requesterId,
            updated_at: now,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_salaries').insert({
          user_id: userId,
          monthly_salary: Number(monthlySalary),
          notes: notes || null,
          updated_by: requesterId,
          updated_at: now,
        });
        if (error) throw error;
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || '저장 실패' };
    }
  });

  // 삭제 (super_admin만)
  ipcMain.handle('userSalary:delete', async (_e, requesterId: string, userId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || requester.role !== 'super_admin') {
      return { success: false, error: '권한 없음 (슈퍼관리자 전용)' };
    }
    try {
      const { error } = await supabase.from('user_salaries').delete().eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || '삭제 실패' };
    }
  });
}
