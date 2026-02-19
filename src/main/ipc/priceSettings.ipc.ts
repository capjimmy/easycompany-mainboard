import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerPriceSettingsHandlers(): void {
  // ========================================
  // 인건비 등급 (Labor Grades)
  // ========================================

  // 회사별 인건비 등급 조회
  ipcMain.handle('laborGrades:getByCompany', async (_event, requesterId: string, companyId: string) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 슈퍼관리자 또는 해당 회사 사용자만 조회 가능
    if (requester.role !== 'super_admin' && requester.company_id !== companyId) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const grades = db.getLaborGradesByCompanyId(companyId);
    // sort_order로 정렬
    grades.sort((a: any, b: any) => a.sort_order - b.sort_order);

    return { success: true, laborGrades: grades };
  });

  // 인건비 등급 생성 (회사관리자 이상)
  ipcMain.handle('laborGrades:create', async (_event, requesterId: string, gradeData: any) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const companyId = gradeData.company_id;

    // 슈퍼관리자 또는 해당 회사의 회사관리자만 생성 가능
    if (requester.role !== 'super_admin') {
      if (requester.role !== 'company_admin' || requester.company_id !== companyId) {
        return { success: false, error: '인건비 등급을 생성할 권한이 없습니다.' };
      }
    }

    // 중복 이름 확인
    const existingGrades = db.getLaborGradesByCompanyId(companyId);
    const duplicate = existingGrades.find((g: any) => g.name === gradeData.name);
    if (duplicate) {
      return { success: false, error: '이미 존재하는 등급명입니다.' };
    }

    // 새 등급의 sort_order 결정 (마지막에 추가)
    const maxSortOrder = existingGrades.reduce((max: number, g: any) => Math.max(max, g.sort_order), 0);

    const newGrade = {
      id: uuidv4(),
      company_id: companyId,
      name: gradeData.name,
      monthly_rate: gradeData.monthly_rate || 0,
      daily_rate: gradeData.daily_rate || null,
      description: gradeData.description || null,
      sort_order: maxSortOrder + 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.addLaborGrade(newGrade);

    return { success: true, laborGrade: newGrade };
  });

  // 인건비 등급 수정
  ipcMain.handle('laborGrades:update', async (_event, requesterId: string, gradeId: string, gradeData: any) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const grade = db.getLaborGradeById(gradeId);
    if (!grade) {
      return { success: false, error: '인건비 등급을 찾을 수 없습니다.' };
    }

    // 슈퍼관리자 또는 해당 회사의 회사관리자만 수정 가능
    if (requester.role !== 'super_admin') {
      if (requester.role !== 'company_admin' || requester.company_id !== grade.company_id) {
        return { success: false, error: '인건비 등급을 수정할 권한이 없습니다.' };
      }
    }

    // 이름 중복 확인 (자기 자신 제외)
    if (gradeData.name && gradeData.name !== grade.name) {
      const existingGrades = db.getLaborGradesByCompanyId(grade.company_id);
      const duplicate = existingGrades.find((g: any) => g.name === gradeData.name && g.id !== gradeId);
      if (duplicate) {
        return { success: false, error: '이미 존재하는 등급명입니다.' };
      }
    }

    const updates: any = {};
    if (gradeData.name !== undefined) updates.name = gradeData.name;
    if (gradeData.monthly_rate !== undefined) updates.monthly_rate = gradeData.monthly_rate;
    if (gradeData.daily_rate !== undefined) updates.daily_rate = gradeData.daily_rate;
    if (gradeData.description !== undefined) updates.description = gradeData.description;

    if (Object.keys(updates).length > 0) {
      db.updateLaborGrade(gradeId, updates);
    }

    return { success: true };
  });

  // 인건비 등급 삭제 (소프트 삭제)
  ipcMain.handle('laborGrades:delete', async (_event, requesterId: string, gradeId: string) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const grade = db.getLaborGradeById(gradeId);
    if (!grade) {
      return { success: false, error: '인건비 등급을 찾을 수 없습니다.' };
    }

    // 슈퍼관리자 또는 해당 회사의 회사관리자만 삭제 가능
    if (requester.role !== 'super_admin') {
      if (requester.role !== 'company_admin' || requester.company_id !== grade.company_id) {
        return { success: false, error: '인건비 등급을 삭제할 권한이 없습니다.' };
      }
    }

    db.deleteLaborGrade(gradeId);

    return { success: true };
  });

  // 인건비 등급 순서 변경
  ipcMain.handle('laborGrades:reorder', async (_event, requesterId: string, companyId: string, orderedIds: string[]) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 슈퍼관리자 또는 해당 회사의 회사관리자만 변경 가능
    if (requester.role !== 'super_admin') {
      if (requester.role !== 'company_admin' || requester.company_id !== companyId) {
        return { success: false, error: '순서를 변경할 권한이 없습니다.' };
      }
    }

    orderedIds.forEach((id, index) => {
      db.updateLaborGrade(id, { sort_order: index + 1 });
    });

    return { success: true };
  });

  // ========================================
  // 경비 항목 (Expense Categories)
  // ========================================

  // 회사별 경비 항목 조회
  ipcMain.handle('expenseCategories:getByCompany', async (_event, requesterId: string, companyId: string) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 슈퍼관리자 또는 해당 회사 사용자만 조회 가능
    if (requester.role !== 'super_admin' && requester.company_id !== companyId) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const categories = db.getExpenseCategoriesByCompanyId(companyId);
    // sort_order로 정렬
    categories.sort((a: any, b: any) => a.sort_order - b.sort_order);

    return { success: true, expenseCategories: categories };
  });

  // 경비 항목 생성
  ipcMain.handle('expenseCategories:create', async (_event, requesterId: string, categoryData: any) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const companyId = categoryData.company_id;

    // 슈퍼관리자 또는 해당 회사의 회사관리자만 생성 가능
    if (requester.role !== 'super_admin') {
      if (requester.role !== 'company_admin' || requester.company_id !== companyId) {
        return { success: false, error: '경비 항목을 생성할 권한이 없습니다.' };
      }
    }

    // 중복 이름 확인
    const existingCategories = db.getExpenseCategoriesByCompanyId(companyId);
    const duplicate = existingCategories.find((c: any) => c.name === categoryData.name);
    if (duplicate) {
      return { success: false, error: '이미 존재하는 항목명입니다.' };
    }

    // 새 항목의 sort_order 결정
    const maxSortOrder = existingCategories.reduce((max: number, c: any) => Math.max(max, c.sort_order), 0);

    const newCategory = {
      id: uuidv4(),
      company_id: companyId,
      name: categoryData.name,
      calculation_type: categoryData.calculation_type || 'manual',
      base_field: categoryData.base_field || null,
      default_rate: categoryData.default_rate || null,
      is_active: true,
      sort_order: maxSortOrder + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.addExpenseCategory(newCategory);

    return { success: true, expenseCategory: newCategory };
  });

  // 경비 항목 수정
  ipcMain.handle('expenseCategories:update', async (_event, requesterId: string, categoryId: string, categoryData: any) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const category = db.getExpenseCategoryById(categoryId);
    if (!category) {
      return { success: false, error: '경비 항목을 찾을 수 없습니다.' };
    }

    // 슈퍼관리자 또는 해당 회사의 회사관리자만 수정 가능
    if (requester.role !== 'super_admin') {
      if (requester.role !== 'company_admin' || requester.company_id !== category.company_id) {
        return { success: false, error: '경비 항목을 수정할 권한이 없습니다.' };
      }
    }

    // 이름 중복 확인 (자기 자신 제외)
    if (categoryData.name && categoryData.name !== category.name) {
      const existingCategories = db.getExpenseCategoriesByCompanyId(category.company_id);
      const duplicate = existingCategories.find((c: any) => c.name === categoryData.name && c.id !== categoryId);
      if (duplicate) {
        return { success: false, error: '이미 존재하는 항목명입니다.' };
      }
    }

    const updates: any = {};
    if (categoryData.name !== undefined) updates.name = categoryData.name;
    if (categoryData.calculation_type !== undefined) updates.calculation_type = categoryData.calculation_type;
    if (categoryData.base_field !== undefined) updates.base_field = categoryData.base_field;
    if (categoryData.default_rate !== undefined) updates.default_rate = categoryData.default_rate;

    if (Object.keys(updates).length > 0) {
      db.updateExpenseCategory(categoryId, updates);
    }

    return { success: true };
  });

  // 경비 항목 삭제
  ipcMain.handle('expenseCategories:delete', async (_event, requesterId: string, categoryId: string) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const category = db.getExpenseCategoryById(categoryId);
    if (!category) {
      return { success: false, error: '경비 항목을 찾을 수 없습니다.' };
    }

    // 슈퍼관리자 또는 해당 회사의 회사관리자만 삭제 가능
    if (requester.role !== 'super_admin') {
      if (requester.role !== 'company_admin' || requester.company_id !== category.company_id) {
        return { success: false, error: '경비 항목을 삭제할 권한이 없습니다.' };
      }
    }

    db.deleteExpenseCategory(categoryId);

    return { success: true };
  });

  // 경비 항목 순서 변경
  ipcMain.handle('expenseCategories:reorder', async (_event, requesterId: string, companyId: string, orderedIds: string[]) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 슈퍼관리자 또는 해당 회사의 회사관리자만 변경 가능
    if (requester.role !== 'super_admin') {
      if (requester.role !== 'company_admin' || requester.company_id !== companyId) {
        return { success: false, error: '순서를 변경할 권한이 없습니다.' };
      }
    }

    orderedIds.forEach((id, index) => {
      db.updateExpenseCategory(id, { sort_order: index + 1 });
    });

    return { success: true };
  });
}
