import { ipcMain, shell, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../database';
import { generatePdf } from '../services/pdfGenerator';

export function registerPdfHandlers(): void {
  // PDF 생성 (견적서)
  ipcMain.handle('pdf:generateQuote', async (_event, requesterId: string, quoteId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    try {
      const quote = await db.getQuoteById(quoteId);
      if (!quote) return { success: false, error: '견적서를 찾을 수 없습니다.' };

      // 인건비/경비 항목 가져오기
      const laborItems = await db.getQuoteLaborItemsByQuoteId(quoteId);
      const expenseItems = await db.getQuoteExpenseItemsByQuoteId(quoteId);

      // 회사 정보 가져오기
      const companyId = quote.company_id || requester.company_id;
      let companyInfo: any = {};
      if (companyId) {
        const company = await db.getCompanyById(companyId);
        if (company) {
          companyInfo = {
            company_name: company.name || '',
            company_representative: company.representative || '',
            company_business_number: company.business_number || '',
            company_address: company.address || '',
            company_phone: company.phone || '',
          };
        }
      }

      const pdfData = {
        quote_number: quote.quote_number,
        recipient_company: quote.recipient_company,
        recipient_contact: quote.recipient_contact,
        recipient_phone: quote.recipient_phone,
        recipient_email: quote.recipient_email,
        recipient_department: quote.recipient_department,
        recipient_address: quote.recipient_address,
        service_name: quote.service_name,
        title: quote.title,
        quote_date: quote.quote_date,
        valid_until: quote.valid_until,
        project_period_months: quote.project_period_months,
        labor_items: laborItems || [],
        expense_items: expenseItems || [],
        labor_total: quote.labor_total,
        expense_total: quote.expense_total,
        total_amount: quote.total_amount,
        vat_amount: quote.vat_amount,
        grand_total: quote.grand_total,
        notes: quote.notes,
        ...companyInfo,
      };

      return await generatePdf('quote', pdfData);
    } catch (err: any) {
      return { success: false, error: err.message || 'PDF 생성에 실패했습니다.' };
    }
  });

  // PDF 생성 (계약서)
  ipcMain.handle('pdf:generateContract', async (_event, requesterId: string, contractId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    try {
      const contract = await db.getContractById(contractId);
      if (!contract) return { success: false, error: '계약서를 찾을 수 없습니다.' };

      const companyId = contract.company_id || requester.company_id;
      let companyInfo: any = {};
      if (companyId) {
        const company = await db.getCompanyById(companyId);
        if (company) {
          companyInfo = {
            company_name: company.name || '',
            company_representative: company.representative || '',
            company_business_number: company.business_number || '',
            company_address: company.address || '',
            company_phone: company.phone || '',
          };
        }
      }

      const pdfData = {
        contract_number: contract.contract_number,
        client_company: contract.client_company,
        client_business_number: contract.client_business_number,
        client_contact_name: contract.client_contact_name,
        client_contact_phone: contract.client_contact_phone,
        client_contact_email: contract.client_contact_email,
        service_name: contract.service_name,
        contract_type: contract.contract_type,
        service_category: contract.service_category,
        description: contract.description,
        contract_date: contract.contract_date,
        contract_start_date: contract.contract_start_date,
        contract_end_date: contract.contract_end_date,
        contract_amount: contract.contract_amount,
        vat_amount: contract.vat_amount,
        total_amount: contract.total_amount,
        manager_name: contract.manager_name,
        notes: contract.notes,
        ...companyInfo,
      };

      return await generatePdf('contract', pdfData);
    } catch (err: any) {
      return { success: false, error: err.message || 'PDF 생성에 실패했습니다.' };
    }
  });

  // PDF 파일 열기
  ipcMain.handle('pdf:open', async (_event, filePath: string) => {
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // PDF 다른이름으로 저장
  ipcMain.handle('pdf:saveAs', async (_event, sourcePath: string, defaultName: string) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'PDF 저장',
        defaultPath: defaultName,
        filters: [{ name: 'PDF 파일', extensions: ['pdf'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'canceled' };
      }

      fs.copyFileSync(sourcePath, result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 거래처 담당자 검색 (이메일 전송시 수신자 검색용)
  ipcMain.handle('pdf:searchContacts', async (_event, requesterId: string, clientName: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    try {
      // 거래처 이름으로 검색하여 담당자 목록 반환
      const allClients = await db.getClientCompanies();
      const matchedClients = allClients.filter((c: any) =>
        c.name?.toLowerCase().includes((clientName || '').toLowerCase())
      );

      const allContacts = await db.getClientContacts();
      const contacts: any[] = [];
      for (const client of matchedClients) {
        const clientContacts = allContacts.filter((ct: any) => ct.client_id === client.id);
        for (const contact of clientContacts) {
          contacts.push({
            ...contact,
            client_name: client.name,
          });
        }
      }

      return { success: true, contacts };
    } catch (err: any) {
      return { success: false, error: err.message, contacts: [] };
    }
  });
}
