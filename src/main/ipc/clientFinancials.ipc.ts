import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerClientFinancialsHandlers(): void {
  // Get client financials by client_company_id
  ipcMain.handle('clientFinancials:get', async (_event, requesterId: string, clientCompanyId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const financials = await db.getClientFinancials(clientCompanyId);
      return { success: true, financials };
    } catch (error: any) {
      return { success: false, error: error.message || '거래처 재무정보 조회에 실패했습니다.' };
    }
  });

  // Get all client financials by company
  ipcMain.handle('clientFinancials:getByCompany', async (_event, requesterId: string, companyId?: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      let targetCompanyId = companyId || requester.company_id;
      if (requester.role !== 'super_admin' && targetCompanyId !== requester.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const financials = await db.getClientFinancialsByCompany(targetCompanyId);
      return { success: true, financials };
    } catch (error: any) {
      return { success: false, error: error.message || '거래처 재무정보 목록 조회에 실패했습니다.' };
    }
  });

  // Upsert client financials
  ipcMain.handle('clientFinancials:upsert', async (_event, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      if (!data.client_company_id) {
        return { success: false, error: '거래처 ID가 필요합니다.' };
      }

      let companyId = data.company_id || requester.company_id;
      if (!companyId && requester.role === 'super_admin') {
        const companies = await db.getCompanies();
        if (companies.length > 0) companyId = companies[0].id;
      }

      const financialData = {
        id: data.id || uuidv4(),
        client_company_id: data.client_company_id,
        company_id: companyId,
        default_payment_terms: data.default_payment_terms || null,
        credit_limit: data.credit_limit || null,
        credit_rating: data.credit_rating || null,
        bank_name: data.bank_name || null,
        bank_account: data.bank_account || null,
        bank_holder: data.bank_holder || null,
        tax_type: data.tax_type || null,
        tax_email: data.tax_email || null,
        total_receivable: data.total_receivable || 0,
        total_payable: data.total_payable || 0,
        overdue_amount: data.overdue_amount || 0,
        notes: data.notes || '',
        updated_at: new Date().toISOString(),
      };

      const result = await db.upsertClientFinancials(financialData);
      return { success: true, financials: result };
    } catch (error: any) {
      return { success: false, error: error.message || '거래처 재무정보 저장에 실패했습니다.' };
    }
  });
}
