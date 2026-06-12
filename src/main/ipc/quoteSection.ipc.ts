import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerQuoteSectionHandlers(): void {
  // 견적서 섹션 조회
  ipcMain.handle('quoteSections:getByQuote', async (_event, requesterId: string, quoteId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const quote = await db.getQuoteById(quoteId);
    if (!quote) return { success: false, error: '권한이 없습니다.' };
    if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const sections = await db.getQuoteSectionsByQuoteId(quoteId);
      return { success: true, sections };
    } catch (err: any) {
      return { success: false, error: err.message || '조회 실패' };
    }
  });

  // 견적서 섹션 저장 (전체 교체)
  ipcMain.handle('quoteSections:saveAll', async (_event, requesterId: string, quoteId: string, sectionsData: any[]) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const quote = await db.getQuoteById(quoteId);
    if (!quote) return { success: false, error: '권한이 없습니다.' };
    if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      // 기존 섹션 모두 삭제
      await db.deleteQuoteSectionsByQuoteId(quoteId);

      // 새 섹션 삽입 (계층 구조 유지)
      const idMap = new Map<string, string>(); // tempId -> realId

      for (const section of sectionsData) {
        const realId = uuidv4();
        idMap.set(section.id || section.tempId, realId);

        const parentId = section.parent_id ? (idMap.get(section.parent_id) || section.parent_id) : null;

        await db.addQuoteSection({
          id: realId,
          quote_id: quoteId,
          parent_id: parentId,
          level: section.level || 1,
          title: section.title || '',
          description: section.description || null,
          amount: section.amount || 0,
          sort_order: section.sort_order || 0,
        });
      }

      const sections = await db.getQuoteSectionsByQuoteId(quoteId);
      return { success: true, sections };
    } catch (err: any) {
      return { success: false, error: err.message || '저장 실패' };
    }
  });

  // 단일 섹션 추가
  ipcMain.handle('quoteSections:add', async (_event, requesterId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const quote = await db.getQuoteById(data.quoteId);
    if (!quote) return { success: false, error: '권한이 없습니다.' };
    if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const allSections = await db.getQuoteSectionsByQuoteId(data.quoteId);
      const siblings = allSections.filter((s: any) =>
        data.parentId ? s.parent_id === data.parentId : (!s.parent_id && s.level === 1)
      );
      const maxOrder = siblings.reduce((max: number, s: any) => Math.max(max, s.sort_order || 0), 0);

      const section = await db.addQuoteSection({
        id: uuidv4(),
        quote_id: data.quoteId,
        parent_id: data.parentId || null,
        level: data.level || 1,
        title: data.title || '',
        description: data.description || null,
        amount: data.amount || 0,
        sort_order: maxOrder + 1,
      });

      return { success: true, section };
    } catch (err: any) {
      return { success: false, error: err.message || '추가 실패' };
    }
  });

  // 섹션 수정
  ipcMain.handle('quoteSections:update', async (_event, requesterId: string, sectionId: string, data: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const existingSection = await db.getQuoteSectionById(sectionId);
    if (!existingSection) return { success: false, error: '권한이 없습니다.' };
    const quote = await db.getQuoteById(existingSection.quote_id);
    if (!quote) return { success: false, error: '권한이 없습니다.' };
    if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      const updates: any = {};
      if (data.title !== undefined) updates.title = data.title;
      if (data.description !== undefined) updates.description = data.description;
      if (data.amount !== undefined) updates.amount = data.amount;
      if (data.sort_order !== undefined) updates.sort_order = data.sort_order;

      const section = await db.updateQuoteSection(sectionId, updates);
      return { success: true, section };
    } catch (err: any) {
      return { success: false, error: err.message || '수정 실패' };
    }
  });

  // 섹션 삭제
  ipcMain.handle('quoteSections:delete', async (_event, requesterId: string, sectionId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    const section = await db.getQuoteSectionById(sectionId);
    if (!section) return { success: false, error: '권한이 없습니다.' };
    const quote = await db.getQuoteById(section.quote_id);
    if (!quote) return { success: false, error: '권한이 없습니다.' };
    if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    try {
      await db.deleteQuoteSection(sectionId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '삭제 실패' };
    }
  });
}
