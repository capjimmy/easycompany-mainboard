import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

/**
 * 세금계산서가 paid 상태가 되면 대응하는 payment_receipt를 자동 생성
 * - 이미 동일 contract_id + 유사 금액 + 유사 날짜의 receipt가 있으면 스킵
 */
async function syncTaxInvoiceToPaymentReceipt(invoice: any, requesterId: string): Promise<void> {
  if (!invoice.contract_id) return; // contract 연결 없으면 스킵

  // 기존 payment_receipts 중 중복 체크
  const existingReceipts = await db.getPaymentReceipts(invoice.company_id);
  const isDuplicate = existingReceipts.some((r: any) => {
    if (r.contract_id !== invoice.contract_id) return false;
    // 금액이 동일하면 중복으로 판단
    const amountMatch = Math.abs((r.amount || 0) - (invoice.total_amount || 0)) < 1;
    // tax_invoice_id가 있으면 정확한 매칭
    if (r.tax_invoice_id === invoice.id) return true;
    // description에 세금계산서 번호 포함 여부
    if (r.description?.includes(invoice.invoice_number)) return true;
    return amountMatch;
  });

  if (isDuplicate) return;

  const receipt = {
    id: uuidv4(),
    company_id: invoice.company_id,
    billing_id: invoice.billing_id || null,
    receivable_id: null,
    contract_id: invoice.contract_id,
    tax_invoice_id: invoice.id,
    receipt_number: `TI-${invoice.invoice_number || invoice.id.slice(0, 8)}`,
    amount: invoice.total_amount || 0,
    payment_date: invoice.payment_date || invoice.issue_date || new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    description: `세금계산서 ${invoice.invoice_number || ''} - ${invoice.item_description || ''}`.trim(),
    notes: '세금계산서 paid 자동 동기화',
    created_by: requesterId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await db.addPaymentReceipt(receipt);
}

export function registerTaxInvoiceHandlers(): void {
  // Get all tax invoices
  ipcMain.handle('taxInvoices:getAll', async (_event, requesterId: string, filters?: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      let companyId = requester.company_id;
      if (requester.role === 'super_admin') {
        // 슈퍼관리자: 회사 필터 있으면 해당 회사, 없으면 모든 회사
        companyId = filters?.company_id || null;
      }

      let invoices = companyId
        ? await db.getTaxInvoices(companyId)
        : await db.getAllTaxInvoices();

      // Filter by direction
      if (filters?.direction) {
        invoices = invoices.filter((inv: any) => inv.direction === filters.direction);
      }
      // Filter by status
      if (filters?.status) {
        invoices = invoices.filter((inv: any) => inv.status === filters.status);
      }
      // Filter by date range
      if (filters?.startDate) {
        invoices = invoices.filter((inv: any) => inv.issue_date >= filters.startDate);
      }
      if (filters?.endDate) {
        invoices = invoices.filter((inv: any) => inv.issue_date <= filters.endDate);
      }
      // Search
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        invoices = invoices.filter((inv: any) =>
          inv.invoice_number?.toLowerCase().includes(search) ||
          inv.supplier_name?.toLowerCase().includes(search) ||
          inv.buyer_name?.toLowerCase().includes(search) ||
          inv.item_description?.toLowerCase().includes(search)
        );
      }

      // 계약/외주/거래처 이름 배치 조인 (N+1 방지)
      const contractIds = [...new Set(invoices.map((i: any) => i.contract_id).filter(Boolean))];
      const clientIds = [...new Set(invoices.map((i: any) => i.client_company_id).filter(Boolean))];

      const contractMap = new Map<string, any>();
      const clientMap = new Map<string, any>();

      // 배치로 계약 로드
      if (contractIds.length > 0) {
        const allContracts = await db.getContracts();
        allContracts.forEach((c: any) => contractMap.set(c.id, c));
      }

      // 배치로 거래처 로드
      if (clientIds.length > 0) {
        const allClients = await db.getClientCompanies();
        allClients.forEach((c: any) => clientMap.set(c.id, c));
      }

      const enriched = invoices.map((inv: any) => {
        const row: any = { ...inv, client_name: inv.buyer_name || '' };
        if (inv.contract_id) {
          const contract = contractMap.get(inv.contract_id);
          if (contract) {
            row.contract_name = contract.service_name || contract.contract_number || '';
            if (!row.client_name && contract.client_company) row.client_name = contract.client_company;
          }
        }
        if (inv.client_company_id && !row.client_name) {
          const client = clientMap.get(inv.client_company_id);
          if (client) row.client_name = client.name;
        }
        return row;
      });

      return { success: true, invoices: enriched };
    } catch (error: any) {
      return { success: false, error: error.message || '세금계산서 조회에 실패했습니다.' };
    }
  });

  // Create tax invoice
  ipcMain.handle('taxInvoices:create', async (_event, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      let companyId = data.company_id || requester.company_id;
      if (!companyId && requester.role === 'super_admin') {
        const companies = await db.getCompanies();
        if (companies.length > 0) companyId = companies[0].id;
      }

      const invoice = {
        id: uuidv4(),
        company_id: companyId,
        billing_id: data.billing_id || null,
        payable_id: data.payable_id || null,
        contract_id: data.contract_id || null,
        outsourcing_id: data.outsourcing_id || null,
        client_company_id: data.client_company_id || null,
        invoice_number: data.invoice_number || '',
        direction: data.direction || 'issued',
        supply_amount: data.supply_amount || 0,
        vat_amount: data.vat_amount ?? Math.round((data.supply_amount || 0) * 0.1),
        total_amount: data.total_amount || (data.supply_amount || 0) + (data.vat_amount ?? Math.round((data.supply_amount || 0) * 0.1)),
        supplier_name: data.supplier_name || '',
        supplier_business_number: data.supplier_business_number || '',
        supplier_representative: data.supplier_representative || '',
        buyer_name: data.buyer_name || '',
        buyer_business_number: data.buyer_business_number || '',
        buyer_representative: data.buyer_representative || '',
        buyer_email: data.buyer_email || '',
        issue_date: data.issue_date || new Date().toISOString().split('T')[0],
        status: data.status || 'draft',
        item_description: data.item_description || '',
        notes: data.notes || '',
        created_by: requesterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await db.addTaxInvoice(invoice);
      return { success: true, invoice: result };
    } catch (error: any) {
      return { success: false, error: error.message || '세금계산서 생성에 실패했습니다.' };
    }
  });

  // Update tax invoice
  ipcMain.handle('taxInvoices:update', async (_event, requesterId: string, id: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const existing = await db.getTaxInvoiceById(id);
      if (!existing) return { success: false, error: '세금계산서를 찾을 수 없습니다.' };

      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const result = await db.updateTaxInvoice(id, data);

      // 상태가 paid로 변경되면 payment_receipt 자동 생성
      if (data.status === 'paid' && existing.status !== 'paid') {
        try {
          await syncTaxInvoiceToPaymentReceipt(result || { ...existing, ...data }, requesterId);
        } catch (syncErr) {
          console.error('Failed to sync tax invoice to payment receipt:', syncErr);
          // 동기화 실패는 세금계산서 업데이트에 영향을 주지 않음
        }
      }

      return result ? { success: true, invoice: result } : { success: false, error: '수정에 실패했습니다.' };
    } catch (error: any) {
      return { success: false, error: error.message || '세금계산서 수정에 실패했습니다.' };
    }
  });

  // Delete tax invoice
  ipcMain.handle('taxInvoices:delete', async (_event, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const existing = await db.getTaxInvoiceById(id);
      if (!existing) return { success: false, error: '세금계산서를 찾을 수 없습니다.' };

      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      await db.deleteTaxInvoice(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || '세금계산서 삭제에 실패했습니다.' };
    }
  });
}
