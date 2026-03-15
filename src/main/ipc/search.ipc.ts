import { ipcMain } from 'electron';
import { db } from '../database';

export function registerSearchHandlers(): void {
  // 통합 검색
  ipcMain.handle('search:global', async (
    _event,
    requesterId: string,
    query: string,
    options?: { types?: string[]; limit?: number }
  ) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    if (!query || query.trim().length === 0) {
      return { success: true, results: [] };
    }

    const search = query.toLowerCase().trim();
    const types = options?.types || ['contracts', 'quotes', 'outsourcings', 'files'];
    const limit = options?.limit || 50;
    const results: any[] = [];

    // 계약서 검색
    if (types.includes('contracts')) {
      let contracts = await db.getContracts();
      if (requester.role !== 'super_admin' && requester.company_id) {
        contracts = contracts.filter((c: any) => c.company_id === requester.company_id);
      }

      const matched = contracts.filter((c: any) =>
        c.contract_number?.toLowerCase().includes(search) ||
        c.client_company?.toLowerCase().includes(search) ||
        c.service_name?.toLowerCase().includes(search) ||
        c.description?.toLowerCase().includes(search) ||
        c.contract_code?.toLowerCase().includes(search) ||
        c.notes?.toLowerCase().includes(search)
      );

      matched.forEach((c: any) => {
        results.push({
          type: 'contract',
          id: c.id,
          title: c.service_name,
          subtitle: `${c.contract_number} | ${c.client_company}`,
          description: c.description || '',
          amount: c.total_amount,
          status: c.progress,
          date: c.contract_start_date,
          url: `/contracts/${c.id}`,
        });
      });
    }

    // 견적서 검색
    if (types.includes('quotes')) {
      let quotes = await db.getQuotes();
      if (requester.role !== 'super_admin' && requester.company_id) {
        quotes = quotes.filter((q: any) => q.company_id === requester.company_id);
      }

      const matched = quotes.filter((q: any) =>
        q.quote_number?.toLowerCase().includes(search) ||
        q.recipient_company?.toLowerCase().includes(search) ||
        q.service_name?.toLowerCase().includes(search) ||
        q.title?.toLowerCase().includes(search) ||
        q.notes?.toLowerCase().includes(search)
      );

      matched.forEach((q: any) => {
        results.push({
          type: 'quote',
          id: q.id,
          title: q.service_name || q.title,
          subtitle: `${q.quote_number} | ${q.recipient_company}`,
          description: q.notes || '',
          amount: q.grand_total,
          status: q.status,
          date: q.quote_date,
          url: `/quotes/${q.id}`,
        });
      });
    }

    // 외주 검색
    if (types.includes('outsourcings')) {
      let outsourcings = await db.getOutsourcings();
      if (requester.role !== 'super_admin' && requester.company_id) {
        outsourcings = outsourcings.filter((o: any) => o.company_id === requester.company_id);
      }

      const matched = outsourcings.filter((o: any) =>
        o.vendor_name?.toLowerCase().includes(search) ||
        o.service_description?.toLowerCase().includes(search) ||
        o.contract_number?.toLowerCase().includes(search) ||
        o.notes?.toLowerCase().includes(search)
      );

      matched.forEach((o: any) => {
        results.push({
          type: 'outsourcing',
          id: o.id,
          title: o.service_description,
          subtitle: `${o.contract_number} | ${o.vendor_name}`,
          description: o.notes || '',
          amount: o.total_amount,
          status: o.status,
          date: o.start_date,
          url: '/contracts/subcontract',
        });
      });
    }

    // 첨부 문서 검색
    if (types.includes('files')) {
      const attachedDocs = await db.getAttachedDocuments();
      const matched = attachedDocs.filter((d: any) =>
        d.file_name?.toLowerCase().includes(search) ||
        d.description?.toLowerCase().includes(search) ||
        d.category?.toLowerCase().includes(search)
      );

      matched.forEach((d: any) => {
        results.push({
          type: 'file',
          id: d.id,
          title: d.file_name,
          subtitle: `${d.category || '기타'} | ${d.parent_type === 'contract' ? '계약서' : '견적서'}`,
          description: d.description || d.file_path,
          amount: null,
          status: null,
          date: d.attached_at,
          url: d.parent_type === 'contract' ? `/contracts/${d.parent_id}` : `/quotes/${d.parent_id}`,
          filePath: d.file_path,
        });
      });
    }

    // 결과 정렬 (관련도 기준 - 제목 매칭 우선)
    results.sort((a, b) => {
      const aTitle = a.title?.toLowerCase().includes(search) ? 1 : 0;
      const bTitle = b.title?.toLowerCase().includes(search) ? 1 : 0;
      if (aTitle !== bTitle) return bTitle - aTitle;
      // 날짜 최신순
      return (b.date || '').localeCompare(a.date || '');
    });

    return { success: true, results: results.slice(0, limit), total: results.length };
  });
}
