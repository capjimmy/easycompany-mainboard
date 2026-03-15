import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerOutsourcingHandlers(): void {
  // Get all outsourcings
  ipcMain.handle('outsourcings:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    let outsourcings = await db.getOutsourcings();

    // Company filter
    if (requester.role !== 'super_admin' && requester.company_id) {
      outsourcings = outsourcings.filter((o: any) => o.company_id === requester.company_id);
    }

    // Additional filters
    if (filters?.contract_id) {
      outsourcings = outsourcings.filter((o: any) => o.contract_id === filters.contract_id);
    }
    if (filters?.status) {
      outsourcings = outsourcings.filter((o: any) => o.status === filters.status);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      outsourcings = outsourcings.filter((o: any) =>
        o.vendor_name?.toLowerCase().includes(search) ||
        o.service_description?.toLowerCase().includes(search) ||
        o.contract_number?.toLowerCase().includes(search)
      );
    }

    // Sort by created_at desc
    outsourcings.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { success: true, outsourcings };
  });

  // Get by ID
  ipcMain.handle('outsourcings:getById', async (_event, requesterId: string, id: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const outsourcing = await db.getOutsourcingById(id);
    if (!outsourcing) return { success: false, error: '외주 정보를 찾을 수 없습니다.' };

    if (requester.role !== 'super_admin' && requester.company_id !== outsourcing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    return { success: true, outsourcing };
  });

  // Create
  ipcMain.handle('outsourcings:create', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    // Determine company_id
    let companyId = data.company_id || requester.company_id;
    if (!companyId && requester.role === 'super_admin') {
      const companies = await db.getCompanies();
      if (companies.length > 0) companyId = companies[0].id;
    }

    // Get contract info for contract_number
    let contractNumber = '';
    if (data.contract_id) {
      const contract = await db.getContractById(data.contract_id);
      if (contract) contractNumber = contract.contract_number;
    }

    const outsourcing = {
      id: uuidv4(),
      company_id: companyId,
      contract_id: data.contract_id,
      contract_number: contractNumber,
      vendor_name: data.vendor_name,
      vendor_business_number: data.vendor_business_number || '',
      vendor_contact_name: data.vendor_contact_name || '',
      vendor_contact_phone: data.vendor_contact_phone || '',
      vendor_contact_email: data.vendor_contact_email || '',
      service_description: data.service_description,
      outsourcing_amount: data.outsourcing_amount || 0,
      vat_amount: data.vat_amount || Math.round((data.outsourcing_amount || 0) * 0.1),
      total_amount: data.total_amount || (data.outsourcing_amount || 0) + Math.round((data.outsourcing_amount || 0) * 0.1),
      paid_amount: data.paid_amount || 0,
      remaining_amount: data.remaining_amount || ((data.outsourcing_amount || 0) + Math.round((data.outsourcing_amount || 0) * 0.1) - (data.paid_amount || 0)),
      start_date: data.start_date,
      end_date: data.end_date || null,
      status: data.status || 'pending',
      notes: data.notes || '',
      created_by: requesterId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.addOutsourcing(outsourcing);
    return { success: true, outsourcingId: outsourcing.id };
  });

  // Update
  ipcMain.handle('outsourcings:update', async (_event, requesterId: string, id: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const existing = await db.getOutsourcingById(id);
    if (!existing) return { success: false, error: '외주 정보를 찾을 수 없습니다.' };

    if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // Update contract_number if contract changed
    let contractNumber = existing.contract_number;
    if (data.contract_id && data.contract_id !== existing.contract_id) {
      const contract = await db.getContractById(data.contract_id);
      if (contract) contractNumber = contract.contract_number;
    }

    const updates = {
      ...data,
      contract_number: contractNumber,
    };

    const result = await db.updateOutsourcing(id, updates);
    return result ? { success: true } : { success: false, error: '수정에 실패했습니다.' };
  });

  // Delete
  ipcMain.handle('outsourcings:delete', async (_event, requesterId: string, id: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const existing = await db.getOutsourcingById(id);
    if (!existing) return { success: false, error: '외주 정보를 찾을 수 없습니다.' };

    if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    await db.deleteOutsourcing(id);
    return { success: true };
  });
}
