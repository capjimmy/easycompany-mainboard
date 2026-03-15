import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

// 권한 체크 헬퍼 함수
function canManageDepartments(role: string): boolean {
  return ['super_admin', 'company_admin'].includes(role);
}

export function registerDepartmentHandlers(): void {
  // 부서 목록 조회
  ipcMain.handle('departments:getAll', async (_event, requesterId: string, companyId?: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let departments = await db.getDepartments();

    if (requester.role === 'super_admin') {
      // 슈퍼관리자는 모든 부서 조회 가능 (또는 특정 회사 필터)
      if (companyId) {
        departments = departments.filter((d: any) => d.company_id === companyId);
      }
    } else if (requester.role === 'company_admin') {
      // 회사 관리자는 자기 회사 부서만 조회 가능
      departments = departments.filter((d: any) => d.company_id === requester.company_id);
    } else {
      // 부서 관리자, 사원은 자기 회사 부서만 조회 가능
      departments = departments.filter((d: any) => d.company_id === requester.company_id);
    }

    // 회사 정보 추가
    const departmentsWithCompany = [];
    for (const d of departments) {
      const company = await db.getCompanyById(d.company_id);
      departmentsWithCompany.push({
        ...d,
        company_name: company?.name || null,
      });
    }

    return { success: true, departments: departmentsWithCompany };
  });

  // 부서 상세 조회
  ipcMain.handle('departments:getById', async (_event, requesterId: string, departmentId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const department = await db.getDepartmentById(departmentId);
    if (!department) {
      return { success: false, error: '부서를 찾을 수 없습니다.' };
    }

    // 회사 관리자 이하는 자기 회사 부서만 조회 가능
    if (requester.role !== 'super_admin' && department.company_id !== requester.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const company = await db.getCompanyById(department.company_id);

    return {
      success: true,
      department: {
        ...department,
        company_name: company?.name || null,
      },
    };
  });

  // 부서 생성
  ipcMain.handle('departments:create', async (_event, requesterId: string, departmentData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || !canManageDepartments(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 회사 관리자는 자기 회사에만 부서 생성 가능
    if (requester.role === 'company_admin' && departmentData.company_id !== requester.company_id) {
      return { success: false, error: '다른 회사에 부서를 생성할 수 없습니다.' };
    }

    // 회사 존재 여부 확인
    const company = await db.getCompanyById(departmentData.company_id);
    if (!company) {
      return { success: false, error: '회사를 찾을 수 없습니다.' };
    }

    // 같은 회사 내 중복 부서명 확인
    const existingDepartments = await db.getDepartmentsByCompanyId(departmentData.company_id);
    const duplicate = existingDepartments.find((d: any) => d.name === departmentData.name);
    if (duplicate) {
      return { success: false, error: '이미 존재하는 부서명입니다.' };
    }

    const departmentId = uuidv4();
    const newDepartment = {
      id: departmentId,
      company_id: departmentData.company_id,
      name: departmentData.name,
      description: departmentData.description || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.addDepartment(newDepartment);

    return { success: true, departmentId };
  });

  // 부서 수정
  ipcMain.handle('departments:update', async (_event, requesterId: string, departmentId: string, departmentData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || !canManageDepartments(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const department = await db.getDepartmentById(departmentId);
    if (!department) {
      return { success: false, error: '부서를 찾을 수 없습니다.' };
    }

    // 회사 관리자는 자기 회사 부서만 수정 가능
    if (requester.role === 'company_admin' && department.company_id !== requester.company_id) {
      return { success: false, error: '다른 회사 부서를 수정할 수 없습니다.' };
    }

    // 같은 회사 내 중복 부서명 확인 (자기 자신 제외)
    if (departmentData.name && departmentData.name !== department.name) {
      const existingDepartments = await db.getDepartmentsByCompanyId(department.company_id);
      const duplicate = existingDepartments.find((d: any) => d.name === departmentData.name && d.id !== departmentId);
      if (duplicate) {
        return { success: false, error: '이미 존재하는 부서명입니다.' };
      }
    }

    const updates: any = {};
    if (departmentData.name) {
      updates.name = departmentData.name;
    }
    if (departmentData.description !== undefined) {
      updates.description = departmentData.description;
    }

    if (Object.keys(updates).length > 0) {
      await db.updateDepartment(departmentId, updates);
    }

    return { success: true };
  });

  // 부서 삭제
  ipcMain.handle('departments:delete', async (_event, requesterId: string, departmentId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || !canManageDepartments(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const department = await db.getDepartmentById(departmentId);
    if (!department) {
      return { success: false, error: '부서를 찾을 수 없습니다.' };
    }

    // 회사 관리자는 자기 회사 부서만 삭제 가능
    if (requester.role === 'company_admin' && department.company_id !== requester.company_id) {
      return { success: false, error: '다른 회사 부서를 삭제할 수 없습니다.' };
    }

    // 해당 부서에 소속된 사용자가 있는지 확인
    const allUsers = await db.getUsers();
    const usersInDepartment = allUsers.filter((u: any) => u.department_id === departmentId);
    if (usersInDepartment.length > 0) {
      return { success: false, error: `해당 부서에 ${usersInDepartment.length}명의 사용자가 있습니다. 먼저 사용자를 다른 부서로 이동해주세요.` };
    }

    await db.deleteDepartment(departmentId);

    return { success: true };
  });

  // 부서별 사용자 목록 조회
  ipcMain.handle('departments:getUsers', async (_event, requesterId: string, departmentId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const department = await db.getDepartmentById(departmentId);
    if (!department) {
      return { success: false, error: '부서를 찾을 수 없습니다.' };
    }

    // 회사 관리자 이하는 자기 회사 부서만 조회 가능
    if (requester.role !== 'super_admin' && department.company_id !== requester.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const allUsers = await db.getUsers();
    const users = allUsers.filter((u: any) => u.department_id === departmentId);
    const usersWithoutPassword = users.map((u: any) => {
      const { password_hash, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });

    return { success: true, users: usersWithoutPassword };
  });
}
