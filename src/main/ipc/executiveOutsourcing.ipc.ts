import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

/**
 * 경영진 전용 외주관리 (executive_outsourcings).
 * 일반 외주관리(outsourcings)와 형식 동일, 데이터만 분리. 메뉴는 경영진(super_admin) 전용.
 */
export function registerExecutiveOutsourcingHandlers(): void {
  ipcMain.handle('executiveOutsourcings:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    let rows = await db.getExecutiveOutsourcings();

    if (requester.role !== 'super_admin' && requester.company_id) {
      rows = rows.filter((o: any) => o.company_id === requester.company_id);
    }
    if (requester.role === 'super_admin' && filters?.company_id) {
      rows = rows.filter((o: any) => o.company_id === filters.company_id);
    }
    if (filters?.status) rows = rows.filter((o: any) => o.status === filters.status);
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      rows = rows.filter((o: any) =>
        o.vendor_name?.toLowerCase().includes(s) ||
        o.service_description?.toLowerCase().includes(s) ||
        o.contract_number?.toLowerCase().includes(s)
      );
    }

    // 계약 service_name 보강 (없으면 manual_service_name 폴백)
    const allContracts = await db.getContracts();
    const contractMap: Record<string, any> = {};
    for (const c of allContracts) contractMap[c.id] = c;
    rows = rows.map((o: any) => {
      const contract = contractMap[o.contract_id];
      return {
        ...o,
        service_name: contract?.service_name || o.manual_service_name || '',
        client_company: contract?.client_company || '',
      };
    });

    rows.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { success: true, outsourcings: rows, data: rows };
  });

  ipcMain.handle('executiveOutsourcings:create', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    let companyId = data.company_id || requester.company_id;
    if (!companyId && requester.role === 'super_admin') {
      const companies = await db.getCompanies();
      if (companies.length > 0) companyId = companies[0].id;
    }

    let contractNumber = '';
    if (data.contract_id) {
      const contract = await db.getContractById(data.contract_id);
      if (contract) {
        contractNumber = contract.contract_number;
        if (contract.company_id) companyId = contract.company_id;
      }
    }

    const row = {
      id: uuidv4(),
      company_id: companyId,
      contract_id: data.contract_id || null,
      contract_number: contractNumber,
      manual_service_name: data.manual_service_name || null,
      vendor_name: data.vendor_name,
      vendor_type: data.vendor_type || 'company',
      vendor_business_number: data.vendor_business_number || '',
      vendor_contact_name: data.vendor_contact_name || '',
      vendor_contact_phone: data.vendor_contact_phone || '',
      vendor_contact_email: data.vendor_contact_email || '',
      service_description: data.service_description,
      outsourcing_amount: data.outsourcing_amount || 0,
      vat_amount: data.vat_amount ?? Math.round((data.outsourcing_amount || 0) * 0.1),
      total_amount: data.total_amount || (data.outsourcing_amount || 0) + (data.vat_amount ?? Math.round((data.outsourcing_amount || 0) * 0.1)),
      paid_amount: data.paid_amount || 0,
      remaining_amount: data.remaining_amount || ((data.outsourcing_amount || 0) + (data.vat_amount ?? Math.round((data.outsourcing_amount || 0) * 0.1)) - (data.paid_amount || 0)),
      start_date: data.start_date,
      end_date: data.end_date || null,
      status: data.status || 'pending',
      notes: data.notes || '',
      show_on_calendar: data.show_on_calendar ?? false,
      vat_included: data.vat_included ?? true,
      created_by: requesterId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.addExecutiveOutsourcing(row);
    return { success: true, outsourcingId: row.id };
  });

  ipcMain.handle('executiveOutsourcings:update', async (_event, requesterId: string, id: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const existing = await db.getExecutiveOutsourcingById(id);
    if (!existing) return { success: false, error: '외주 정보를 찾을 수 없습니다.' };
    if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let contractNumber = existing.contract_number;
    if (data.contract_id && data.contract_id !== existing.contract_id) {
      const contract = await db.getContractById(data.contract_id);
      if (contract) contractNumber = contract.contract_number;
    } else if (Object.prototype.hasOwnProperty.call(data, 'contract_id') && !data.contract_id) {
      contractNumber = '';
    }

    const result = await db.updateExecutiveOutsourcing(id, { ...data, contract_number: contractNumber });
    return result ? { success: true } : { success: false, error: '수정에 실패했습니다.' };
  });

  ipcMain.handle('executiveOutsourcings:delete', async (_event, requesterId: string, id: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const existing = await db.getExecutiveOutsourcingById(id);
    if (!existing) return { success: false, error: '외주 정보를 찾을 수 없습니다.' };
    if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    await db.deleteExecutiveOutsourcing(id);
    return { success: true };
  });
}
