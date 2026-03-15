import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerCompanyHandlers(): void {
  // 회사 목록 조회
  ipcMain.handle('companies:getAll', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let companies = await db.getCompanies();

    if (requester.role === 'super_admin') {
      // 슈퍼관리자는 모든 회사 조회 가능
    } else {
      // 그 외 사용자는 자기 회사만 조회 가능
      companies = companies.filter((c: any) => c.id === requester.company_id);
    }

    return { success: true, companies };
  });

  // 회사 상세 조회
  ipcMain.handle('companies:getById', async (_event, requesterId: string, companyId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const company = await db.getCompanyById(companyId);
    if (!company) {
      return { success: false, error: '회사를 찾을 수 없습니다.' };
    }

    // 슈퍼관리자 외에는 자기 회사만 조회 가능
    if (requester.role !== 'super_admin' && requester.company_id !== companyId) {
      return { success: false, error: '권한이 없습니다.' };
    }

    return { success: true, company };
  });

  // 회사 생성 (슈퍼관리자 전용)
  ipcMain.handle('companies:create', async (_event, requesterId: string, companyData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || requester.role !== 'super_admin') {
      return { success: false, error: '슈퍼관리자만 회사를 생성할 수 있습니다.' };
    }

    // 중복 회사명 확인
    const companies = await db.getCompanies();
    const duplicate = companies.find((c: any) => c.name === companyData.name);
    if (duplicate) {
      return { success: false, error: '이미 존재하는 회사명입니다.' };
    }

    const companyId = uuidv4();
    const newCompany = {
      id: companyId,
      name: companyData.name,
      business_number: companyData.business_number || null,
      address: companyData.address || null,
      phone: companyData.phone || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.addCompany(newCompany);

    return { success: true, companyId };
  });

  // 회사 수정
  ipcMain.handle('companies:update', async (_event, requesterId: string, companyId: string, companyData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const company = await db.getCompanyById(companyId);
    if (!company) {
      return { success: false, error: '회사를 찾을 수 없습니다.' };
    }

    // 슈퍼관리자 또는 해당 회사의 회사관리자만 수정 가능
    if (requester.role !== 'super_admin') {
      if (requester.role !== 'company_admin' || requester.company_id !== companyId) {
        return { success: false, error: '회사를 수정할 권한이 없습니다.' };
      }
    }

    // 회사명 중복 확인 (자기 자신 제외)
    if (companyData.name && companyData.name !== company.name) {
      const companies = await db.getCompanies();
      const duplicate = companies.find((c: any) => c.name === companyData.name && c.id !== companyId);
      if (duplicate) {
        return { success: false, error: '이미 존재하는 회사명입니다.' };
      }
    }

    const updates: any = {};
    if (companyData.name) updates.name = companyData.name;
    if (companyData.business_number !== undefined) updates.business_number = companyData.business_number;
    if (companyData.address !== undefined) updates.address = companyData.address;
    if (companyData.phone !== undefined) updates.phone = companyData.phone;

    if (Object.keys(updates).length > 0) {
      await db.updateCompany(companyId, updates);
    }

    return { success: true };
  });

  // 회사 삭제 (슈퍼관리자 전용)
  ipcMain.handle('companies:delete', async (_event, requesterId: string, companyId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester || requester.role !== 'super_admin') {
      return { success: false, error: '슈퍼관리자만 회사를 삭제할 수 있습니다.' };
    }

    const company = await db.getCompanyById(companyId);
    if (!company) {
      return { success: false, error: '회사를 찾을 수 없습니다.' };
    }

    // 해당 회사에 소속된 사용자가 있는지 확인
    const allUsers = await db.getUsers();
    const usersInCompany = allUsers.filter((u: any) => u.company_id === companyId);
    if (usersInCompany.length > 0) {
      return {
        success: false,
        error: `해당 회사에 ${usersInCompany.length}명의 사용자가 있습니다. 먼저 사용자를 삭제하거나 다른 회사로 이동해주세요.`
      };
    }

    // 해당 회사의 부서 삭제
    const departments = await db.getDepartmentsByCompanyId(companyId);
    for (const dept of departments) {
      await db.deleteDepartment(dept.id);
    }

    await db.deleteCompany(companyId);

    return { success: true };
  });

  // 회사별 사용자 목록 조회
  ipcMain.handle('companies:getUsers', async (_event, requesterId: string, companyId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const company = await db.getCompanyById(companyId);
    if (!company) {
      return { success: false, error: '회사를 찾을 수 없습니다.' };
    }

    // 슈퍼관리자 또는 해당 회사 관리자만 조회 가능
    if (requester.role !== 'super_admin') {
      if (requester.company_id !== companyId) {
        return { success: false, error: '권한이 없습니다.' };
      }
    }

    const allUsers = await db.getUsers();
    const users = allUsers.filter((u: any) => u.company_id === companyId);
    const usersWithoutPassword = [];
    for (const u of users) {
      const { password_hash, ...userWithoutPassword } = u;
      const department = u.department_id ? await db.getDepartmentById(u.department_id) : null;
      usersWithoutPassword.push({
        ...userWithoutPassword,
        department_name: department?.name || null,
      });
    }

    return { success: true, users: usersWithoutPassword };
  });

  // 회사별 부서 목록 조회
  ipcMain.handle('companies:getDepartments', async (_event, requesterId: string, companyId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const company = await db.getCompanyById(companyId);
    if (!company) {
      return { success: false, error: '회사를 찾을 수 없습니다.' };
    }

    // 슈퍼관리자 또는 해당 회사 사용자만 조회 가능
    if (requester.role !== 'super_admin' && requester.company_id !== companyId) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const departments = await db.getDepartmentsByCompanyId(companyId);

    return { success: true, departments };
  });
}
