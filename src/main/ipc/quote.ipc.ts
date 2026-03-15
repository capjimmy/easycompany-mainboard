import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { QuoteStatus } from '../../shared/types';

export function registerQuoteHandlers(): void {
  // ========================================
  // 견적서 CRUD
  // ========================================

  // 견적서 목록 조회
  ipcMain.handle('quotes:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let quotes = await db.getQuotes();

    // 슈퍼관리자가 아니면 자기 회사의 견적서만 조회
    if (requester.role !== 'super_admin' && requester.company_id) {
      quotes = quotes.filter((q: any) => q.company_id === requester.company_id);
    }

    // 부서 관리자는 자기 부서 또는 본인이 작성한 견적서만 조회
    if (requester.role === 'department_manager' && requester.department_id) {
      quotes = quotes.filter((q: any) => q.created_by === requester.id);
    }

    // 필터 적용
    if (filters) {
      if (filters.status) {
        quotes = quotes.filter((q: any) => q.status === filters.status);
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        quotes = quotes.filter((q: any) =>
          q.quote_number?.toLowerCase().includes(search) ||
          q.recipient_company?.toLowerCase().includes(search) ||
          q.service_name?.toLowerCase().includes(search)
        );
      }
      if (filters.startDate && filters.endDate) {
        quotes = quotes.filter((q: any) => {
          const quoteDate = new Date(q.quote_date);
          return quoteDate >= new Date(filters.startDate) && quoteDate <= new Date(filters.endDate);
        });
      }
    }

    // 최신순 정렬
    quotes.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { success: true, quotes };
  });

  // 견적서 상세 조회
  ipcMain.handle('quotes:getById', async (_event, requesterId: string, quoteId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const quote = await db.getQuoteById(quoteId);
    if (!quote) {
      return { success: false, error: '견적서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 상세 항목 조회
    const laborItems = await db.getQuoteLaborItemsByQuoteId(quoteId);
    const expenseItems = await db.getQuoteExpenseItemsByQuoteId(quoteId);

    return {
      success: true,
      quote: {
        ...quote,
        labor_items: laborItems,
        expense_items: expenseItems,
      },
    };
  });

  // 견적서 생성
  ipcMain.handle('quotes:create', async (_event, requesterId: string, quoteData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const companyId = quoteData.company_id || requester.company_id;
    if (!companyId) {
      return { success: false, error: '회사 정보가 없습니다.' };
    }

    // 회사 정보 조회
    const company = await db.getCompanyById(companyId);
    if (!company) {
      return { success: false, error: '회사를 찾을 수 없습니다.' };
    }

    // 견적번호 생성
    const quoteNumber = await db.generateQuoteNumber(companyId, 'Q');

    const quoteId = uuidv4();
    const now = new Date().toISOString();

    // 금액 계산
    const laborItems = quoteData.labor_items || [];
    const expenseItems = quoteData.expense_items || [];

    let laborTotal = 0;
    let expenseTotal = 0;

    // 인건비 소계 계산 (DB 저장은 견적서 생성 후)
    const preparedLaborItems = [];
    for (const item of laborItems) {
      const subtotal = (item.quantity || 0) * (item.participation_rate || 1) * (item.months || 0) * (item.unit_price || 0);
      laborTotal += subtotal;

      preparedLaborItems.push({
        id: uuidv4(),
        quote_id: quoteId,
        grade_id: item.grade_id,
        grade_name: item.grade_name,
        quantity: item.quantity || 0,
        participation_rate: item.participation_rate || 1,
        months: item.months || 0,
        unit_price: item.unit_price || 0,
        subtotal: subtotal,
      });
    }

    // 경비 소계 계산 (DB 저장은 견적서 생성 후)
    const preparedExpenseItems = [];
    for (const item of expenseItems) {
      let amount = item.amount || 0;

      // 비율 계산인 경우
      if (item.calculation_type === 'percentage' && item.rate) {
        amount = Math.round(laborTotal * item.rate);
      }

      expenseTotal += amount;

      preparedExpenseItems.push({
        id: uuidv4(),
        quote_id: quoteId,
        category_id: item.category_id,
        category_name: item.category_name,
        amount: amount,
        note: item.note || null,
      });
    }

    const totalAmount = laborTotal + expenseTotal;
    const vatRate = quoteData.vat_rate || 0.1;
    const vatAmount = Math.round(totalAmount * vatRate);
    const grandTotal = totalAmount + vatAmount;

    const newQuote = {
      id: quoteId,
      company_id: companyId,
      quote_number: quoteNumber,

      // 수신처 정보
      recipient_company: quoteData.recipient_company || '',
      recipient_contact: quoteData.recipient_contact || null,
      recipient_phone: quoteData.recipient_phone || null,
      recipient_email: quoteData.recipient_email || null,
      recipient_department: quoteData.recipient_department || null,
      recipient_address: quoteData.recipient_address || null,
      project_period_months: quoteData.project_period_months || null,

      title: quoteData.title || '',
      service_name: quoteData.service_name || '',

      // 금액
      labor_total: laborTotal,
      expense_total: expenseTotal,
      total_amount: totalAmount,
      vat_amount: vatAmount,
      grand_total: grandTotal,

      // 상태
      status: 'draft' as QuoteStatus,
      quote_date: quoteData.quote_date || now.split('T')[0],
      valid_until: quoteData.valid_until || null,

      // 작성자
      created_by: requesterId,
      created_by_name: requester.name,

      // 회사 정보 스냅샷
      company_name: company.name,
      company_business_number: company.business_number || null,
      company_representative: null,
      company_address: company.address || null,
      company_phone: company.phone || null,

      notes: quoteData.notes || null,
      source_file_path: quoteData.source_file_path || null,

      created_at: now,
      updated_at: now,
    };

    // 견적서를 먼저 저장 (FK 제약: quote_labor_items, quote_expense_items가 quote_id를 참조)
    await db.addQuote(newQuote);

    // 인건비 항목 저장 (견적서 생성 후)
    for (const laborItem of preparedLaborItems) {
      await db.addQuoteLaborItem(laborItem);
    }

    // 경비 항목 저장 (견적서 생성 후)
    for (const expenseItem of preparedExpenseItems) {
      await db.addQuoteExpenseItem(expenseItem);
    }

    return { success: true, quoteId, quoteNumber };
  });

  // 견적서 수정
  ipcMain.handle('quotes:update', async (_event, requesterId: string, quoteId: string, quoteData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const quote = await db.getQuoteById(quoteId);
    if (!quote) {
      return { success: false, error: '견적서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
      return { success: false, error: '견적서를 수정할 권한이 없습니다.' };
    }

    // 제출 이후 상태에서는 수정 불가
    if (['submitted', 'approved', 'converted'].includes(quote.status)) {
      return { success: false, error: '제출된 견적서는 수정할 수 없습니다.' };
    }

    // 기존 항목 삭제
    await db.deleteQuoteLaborItemsByQuoteId(quoteId);
    await db.deleteQuoteExpenseItemsByQuoteId(quoteId);

    // 금액 재계산
    const laborItems = quoteData.labor_items || [];
    const expenseItems = quoteData.expense_items || [];

    let laborTotal = 0;
    let expenseTotal = 0;

    // 인건비 항목 저장
    for (const item of laborItems) {
      const subtotal = (item.quantity || 0) * (item.participation_rate || 1) * (item.months || 0) * (item.unit_price || 0);
      laborTotal += subtotal;

      const laborItem = {
        id: uuidv4(),
        quote_id: quoteId,
        grade_id: item.grade_id,
        grade_name: item.grade_name,
        quantity: item.quantity || 0,
        participation_rate: item.participation_rate || 1,
        months: item.months || 0,
        unit_price: item.unit_price || 0,
        subtotal: subtotal,
      };
      await db.addQuoteLaborItem(laborItem);
    }

    // 경비 항목 저장
    for (const item of expenseItems) {
      let amount = item.amount || 0;

      if (item.calculation_type === 'percentage' && item.rate) {
        amount = Math.round(laborTotal * item.rate);
      }

      expenseTotal += amount;

      const expenseItem = {
        id: uuidv4(),
        quote_id: quoteId,
        category_id: item.category_id,
        category_name: item.category_name,
        amount: amount,
        note: item.note || null,
      };
      await db.addQuoteExpenseItem(expenseItem);
    }

    const totalAmount = laborTotal + expenseTotal;
    const vatRate = quoteData.vat_rate || 0.1;
    const vatAmount = Math.round(totalAmount * vatRate);
    const grandTotal = totalAmount + vatAmount;

    const updates: any = {
      recipient_company: quoteData.recipient_company,
      recipient_contact: quoteData.recipient_contact,
      recipient_phone: quoteData.recipient_phone,
      recipient_email: quoteData.recipient_email,
      recipient_department: quoteData.recipient_department,
      recipient_address: quoteData.recipient_address,
      project_period_months: quoteData.project_period_months,
      title: quoteData.title,
      service_name: quoteData.service_name,
      labor_total: laborTotal,
      expense_total: expenseTotal,
      total_amount: totalAmount,
      vat_amount: vatAmount,
      grand_total: grandTotal,
      quote_date: quoteData.quote_date,
      valid_until: quoteData.valid_until,
      notes: quoteData.notes,
    };

    await db.updateQuote(quoteId, updates);

    // 금액 변경 이력 자동 기록
    const amountChanged =
      quote.labor_total !== laborTotal ||
      quote.expense_total !== expenseTotal ||
      quote.grand_total !== grandTotal;

    if (amountChanged) {
      try {
        await db.addQuoteAmountHistory({
          id: uuidv4(),
          quote_id: quoteId,
          changed_by: requesterId,
          changed_by_name: requester.name,
          previous_labor_total: quote.labor_total || 0,
          new_labor_total: laborTotal,
          previous_expense_total: quote.expense_total || 0,
          new_expense_total: expenseTotal,
          previous_total: quote.grand_total || 0,
          new_total: grandTotal,
          change_reason: quoteData.change_reason || null,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to save quote amount history:', err);
      }
    }

    return { success: true };
  });

  // 견적서 삭제
  ipcMain.handle('quotes:delete', async (_event, requesterId: string, quoteId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const quote = await db.getQuoteById(quoteId);
    if (!quote) {
      return { success: false, error: '견적서를 찾을 수 없습니다.' };
    }

    // 권한 확인: 슈퍼관리자, 회사관리자, 또는 작성자만 삭제 가능
    if (requester.role !== 'super_admin') {
      if (requester.role !== 'company_admin' && quote.created_by !== requesterId) {
        return { success: false, error: '견적서를 삭제할 권한이 없습니다.' };
      }
      if (requester.company_id !== quote.company_id) {
        return { success: false, error: '견적서를 삭제할 권한이 없습니다.' };
      }
    }

    // 계약 전환된 견적서는 삭제 불가
    if (quote.status === 'converted') {
      return { success: false, error: '계약 전환된 견적서는 삭제할 수 없습니다.' };
    }

    await db.deleteQuote(quoteId);

    return { success: true };
  });

  // 견적서 상태 변경
  ipcMain.handle('quotes:updateStatus', async (_event, requesterId: string, quoteId: string, status: QuoteStatus) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const quote = await db.getQuoteById(quoteId);
    if (!quote) {
      return { success: false, error: '견적서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
      return { success: false, error: '견적서 상태를 변경할 권한이 없습니다.' };
    }

    // 상태 전이 규칙 확인
    const validTransitions: Record<string, string[]> = {
      draft: ['submitted'],
      submitted: ['negotiating', 'approved', 'rejected'],
      negotiating: ['approved', 'rejected'],
      approved: ['converted'],
      rejected: ['draft'],
      converted: [],
    };

    if (!validTransitions[quote.status]?.includes(status)) {
      return { success: false, error: `${quote.status} 상태에서 ${status} 상태로 변경할 수 없습니다.` };
    }

    await db.updateQuote(quoteId, { status });

    return { success: true };
  });

  // 견적서 복제
  ipcMain.handle('quotes:duplicate', async (_event, requesterId: string, quoteId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const quote = await db.getQuoteById(quoteId);
    if (!quote) {
      return { success: false, error: '견적서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 기존 항목 조회
    const laborItems = await db.getQuoteLaborItemsByQuoteId(quoteId);
    const expenseItems = await db.getQuoteExpenseItemsByQuoteId(quoteId);

    // 새 견적번호 생성
    const newQuoteNumber = await db.generateQuoteNumber(quote.company_id, 'Q');
    const newQuoteId = uuidv4();
    const now = new Date().toISOString();

    // 새 견적서 생성
    const newQuote = {
      ...quote,
      id: newQuoteId,
      quote_number: newQuoteNumber,
      status: 'draft' as QuoteStatus,
      quote_date: now.split('T')[0],
      created_by: requesterId,
      created_by_name: requester.name,
      created_at: now,
      updated_at: now,
      converted_contract_id: null,
    };

    await db.addQuote(newQuote);

    // 항목 복제
    for (const item of laborItems) {
      await db.addQuoteLaborItem({
        ...item,
        id: uuidv4(),
        quote_id: newQuoteId,
      });
    }

    for (const item of expenseItems) {
      await db.addQuoteExpenseItem({
        ...item,
        id: uuidv4(),
        quote_id: newQuoteId,
      });
    }

    return { success: true, quoteId: newQuoteId, quoteNumber: newQuoteNumber };
  });

  // 견적서 → 계약 전환
  ipcMain.handle('quotes:convertToContract', async (_event, requesterId: string, quoteId: string, contractData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const quote = await db.getQuoteById(quoteId);
    if (!quote) {
      return { success: false, error: '견적서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 승인된 견적서만 전환 가능
    if (quote.status !== 'approved') {
      return { success: false, error: '승인된 견적서만 계약으로 전환할 수 있습니다.' };
    }

    // 계약번호 생성
    const contractNumber = await db.generateContractNumber(quote.company_id, 'C');
    const contractId = uuidv4();
    const now = new Date().toISOString();

    const newContract = {
      id: contractId,
      company_id: quote.company_id,
      contract_number: contractNumber,
      contract_code: contractData.contract_code || null,

      // 발주기관 정보 (견적서의 수신처)
      client_business_number: contractData.client_business_number || null,
      client_company: quote.recipient_company,
      client_contact_name: quote.recipient_contact || null,
      client_contact_phone: quote.recipient_phone || null,
      client_contact_email: quote.recipient_email || null,

      // 계약 기본 정보
      contract_type: contractData.contract_type || 'service',
      service_name: quote.service_name,
      description: contractData.description || null,

      // 계약 기간
      contract_start_date: contractData.contract_start_date || now.split('T')[0],
      contract_end_date: contractData.contract_end_date || null,

      // 금액 정보
      contract_amount: quote.total_amount,
      vat_amount: quote.vat_amount,
      total_amount: quote.grand_total,

      // 진행 상황
      progress: 'contract_signed',
      progress_note: null,

      // 입금 관련
      received_amount: 0,
      remaining_amount: quote.grand_total,

      // 기성 관련
      progress_billing_rate: 0,
      progress_billing_amount: 0,

      // 담당자
      manager_id: requesterId,
      manager_name: requester.name,

      // 원본 견적서
      source_quote_id: quoteId,

      notes: contractData.notes || null,

      created_by: requesterId,
      created_at: now,
      updated_at: now,
    };

    await db.addContract(newContract);

    // 견적서 상태 업데이트
    await db.updateQuote(quoteId, {
      status: 'converted',
      converted_contract_id: contractId,
    });

    // 계약 생성 이력 추가
    await db.addContractHistory({
      id: uuidv4(),
      contract_id: contractId,
      change_type: 'created',
      change_description: '견적서에서 계약 전환됨',
      previous_value: null,
      new_value: `견적번호: ${quote.quote_number}`,
      changed_by: requesterId,
      changed_by_name: requester.name,
      changed_at: now,
    });

    return { success: true, contractId, contractNumber };
  });

  // ========================================
  // 추천 견적 (유사 거래처 기반)
  // ========================================

  // 거래처 기반 유사 견적 조회
  ipcMain.handle('quotes:getRecommendations', async (_event, requesterId: string, searchParams: {
    clientCompany?: string;
    serviceName?: string;
  }) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let quotes = await db.getQuotes();

    // 회사 필터
    if (requester.role !== 'super_admin' && requester.company_id) {
      quotes = quotes.filter((q: any) => q.company_id === requester.company_id);
    }

    // 거래처명으로 검색 (부분 일치)
    if (searchParams.clientCompany && searchParams.clientCompany.trim()) {
      const searchTerm = searchParams.clientCompany.toLowerCase().trim();
      quotes = quotes.filter((q: any) =>
        q.recipient_company?.toLowerCase().includes(searchTerm)
      );
    }

    // 용역명으로 검색 (부분 일치)
    if (searchParams.serviceName && searchParams.serviceName.trim()) {
      const searchTerm = searchParams.serviceName.toLowerCase().trim();
      quotes = quotes.filter((q: any) =>
        q.service_name?.toLowerCase().includes(searchTerm)
      );
    }

    // 최신순 정렬 후 최대 10개
    quotes.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const recommendations = quotes.slice(0, 10);

    // 통계 계산
    const stats = {
      count: recommendations.length,
      avgLaborTotal: 0,
      avgExpenseTotal: 0,
      avgGrandTotal: 0,
      minGrandTotal: 0,
      maxGrandTotal: 0,
    };

    if (recommendations.length > 0) {
      const laborTotals = recommendations.map((q: any) => q.labor_total || 0);
      const expenseTotals = recommendations.map((q: any) => q.expense_total || 0);
      const grandTotals = recommendations.map((q: any) => q.grand_total || 0);

      stats.avgLaborTotal = Math.round(laborTotals.reduce((a: number, b: number) => a + b, 0) / recommendations.length);
      stats.avgExpenseTotal = Math.round(expenseTotals.reduce((a: number, b: number) => a + b, 0) / recommendations.length);
      stats.avgGrandTotal = Math.round(grandTotals.reduce((a: number, b: number) => a + b, 0) / recommendations.length);
      stats.minGrandTotal = Math.min(...grandTotals);
      stats.maxGrandTotal = Math.max(...grandTotals);
    }

    // 추천 목록 (필요한 정보만)
    const items = recommendations.map((q: any) => ({
      id: q.id,
      quote_number: q.quote_number,
      recipient_company: q.recipient_company,
      service_name: q.service_name,
      labor_total: q.labor_total,
      expense_total: q.expense_total,
      grand_total: q.grand_total,
      quote_date: q.quote_date,
      status: q.status,
    }));

    return { success: true, recommendations: items, stats };
  });

  // 거래처 자동완성 목록
  ipcMain.handle('quotes:getClientCompanies', async (_event, requesterId: string, search?: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let quotes = await db.getQuotes();
    let contracts = await db.getContracts();

    // 회사 필터
    if (requester.role !== 'super_admin' && requester.company_id) {
      quotes = quotes.filter((q: any) => q.company_id === requester.company_id);
      contracts = contracts.filter((c: any) => c.company_id === requester.company_id);
    }

    // 고유 거래처명 추출
    const companySet = new Set<string>();
    quotes.forEach((q: any) => {
      if (q.recipient_company) companySet.add(q.recipient_company);
    });
    contracts.forEach((c: any) => {
      if (c.client_company) companySet.add(c.client_company);
    });

    let companies = Array.from(companySet);

    // 검색 필터
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      companies = companies.filter(c => c.toLowerCase().includes(searchTerm));
    }

    // 가나다순 정렬
    companies.sort();

    return { success: true, companies: companies.slice(0, 20) };
  });

  // ========================================
  // 견적서 금액 변경 이력 조회
  // ========================================
  ipcMain.handle('quotes:getAmountHistories', async (_event, requesterId: string, quoteId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const quote = await db.getQuoteById(quoteId);
    if (!quote) {
      return { success: false, error: '견적서를 찾을 수 없습니다.' };
    }

    if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const histories = await db.getQuoteAmountHistories(quoteId);
    return { success: true, histories };
  });
}
