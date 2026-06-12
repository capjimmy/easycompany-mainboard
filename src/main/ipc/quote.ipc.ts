import { ipcMain, dialog, app, shell } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { initOCRClient, getOCRClient } from '../services/ocrService';
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

    // 슈퍼관리자가 아니면 자기 회사의 견적서만 DB에서 직접 조회 (N+1 방지)
    let quotes: any[];
    if (requester.role !== 'super_admin' && requester.company_id) {
      quotes = await db.getQuotesByCompanyId(requester.company_id);
    } else if (requester.role === 'super_admin' && filters?.company_id) {
      // 총괄관리자의 회사 전환 필터: 해당 회사만 직접 조회
      quotes = await db.getQuotesByCompanyId(filters.company_id);
    } else {
      // 슈퍼관리자 + 회사 필터 없음: 전체 조회
      quotes = await db.getQuotes();
    }

    // 부서 관리자는 자기 회사 + 자기 부서원이 작성한 견적서 + 멤버로 배정된 견적서 조회
    if (requester.role === 'department_manager' && requester.department_id) {
      const allUsers = await db.getUsers();
      const deptUserIds = new Set(
        allUsers
          .filter((u: any) => u.department_id === requester.department_id && u.company_id === requester.company_id)
          .map((u: any) => u.id)
      );
      const deptMemberQuotes = await db.getQuotesByMemberId(requesterId);
      const deptMemberQuoteIds = new Set(deptMemberQuotes.map((m: any) => m.quote_id));
      quotes = quotes.filter((q: any) => deptUserIds.has(q.created_by) || deptMemberQuoteIds.has(q.id));
    }

    // 사원은 본인이 작성한 견적서 + 멤버로 배정된 견적서 조회
    if (requester.role === 'employee') {
      const memberQuotes = await db.getQuotesByMemberId(requesterId);
      const memberQuoteIds = new Set(memberQuotes.map((m: any) => m.quote_id));
      quotes = quotes.filter((q: any) => q.created_by === requester.id || memberQuoteIds.has(q.id));
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
    // 멤버 조회
    const members = await db.getQuoteMembers(quoteId);

    return {
      success: true,
      quote: {
        ...quote,
        labor_items: laborItems,
        expense_items: expenseItems,
        members,
      },
    };
  });

  // 견적서 생성
  ipcMain.handle('quotes:create', async (_event, requesterId: string, quoteData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // company_id는 항상 요청자의 소속 회사 사용 (super_admin만 지정 가능)
    const companyId = requester.role === 'super_admin' && quoteData.company_id
      ? quoteData.company_id
      : requester.company_id;
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
    const preparedLaborItems: any[] = [];
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
    const preparedExpenseItems: any[] = [];
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
        calculation_type: item.calculation_type || 'manual',
        rate: item.rate || null,
        amount: amount,
        note: item.note || null,
      });
    }

    const sectionTotal = quoteData.section_total || 0;
    const totalAmount = laborTotal + expenseTotal + sectionTotal;
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
      section_total: sectionTotal,
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

    // 멤버 저장 (작성자를 메인으로 포함)
    const quoteMembersToSave: any[] = [];
    quoteMembersToSave.push({
      quote_id: quoteId,
      user_id: requesterId,
      user_name: requester.name,
      role: 'main',
      assigned_by: requesterId,
    });
    if (quoteData.members && Array.isArray(quoteData.members)) {
      for (const m of quoteData.members) {
        if (m.user_id !== requesterId) {
          quoteMembersToSave.push({
            quote_id: quoteId,
            user_id: m.user_id,
            user_name: m.user_name || '',
            role: 'member',
            assigned_by: requesterId,
          });
        }
      }
    }
    await db.setQuoteMembers(quoteId, quoteMembersToSave);

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
        calculation_type: item.calculation_type || 'manual',
        rate: item.rate || null,
        amount: amount,
        note: item.note || null,
      };
      await db.addQuoteExpenseItem(expenseItem);
    }

    const sectionTotal = quoteData.section_total || 0;
    const totalAmount = laborTotal + expenseTotal + sectionTotal;
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
      section_total: sectionTotal,
      total_amount: totalAmount,
      vat_amount: vatAmount,
      grand_total: grandTotal,
      quote_date: quoteData.quote_date,
      valid_until: quoteData.valid_until,
      notes: quoteData.notes,
    };

    await db.updateQuote(quoteId, updates);

    // 멤버 업데이트 (members 배열이 전달된 경우)
    if (quoteData.members !== undefined && Array.isArray(quoteData.members)) {
      const mainCreatorId = quote.created_by;
      const mainCreatorName = quote.created_by_name;
      const quoteMembersToSave: any[] = [];
      quoteMembersToSave.push({
        quote_id: quoteId,
        user_id: mainCreatorId,
        user_name: mainCreatorName,
        role: 'main',
        assigned_by: requesterId,
      });
      for (const m of quoteData.members) {
        if (m.user_id !== mainCreatorId) {
          quoteMembersToSave.push({
            quote_id: quoteId,
            user_id: m.user_id,
            user_name: m.user_name || '',
            role: 'member',
            assigned_by: requesterId,
          });
        }
      }
      await db.setQuoteMembers(quoteId, quoteMembersToSave);
    }

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

    // 역할 체크: 관리자/팀장만 전환 가능 (BUG #5)
    if (!['super_admin', 'company_admin', 'department_manager'].includes(requester.role)) {
      return { success: false, error: '계약 전환은 관리자/팀장만 가능합니다.' };
    }

    const quote = await db.getQuoteById(quoteId);
    if (!quote) {
      return { success: false, error: '견적서를 찾을 수 없습니다.' };
    }

    if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    if (quote.status !== 'approved') {
      return { success: false, error: '승인된 견적서만 계약으로 전환할 수 있습니다.' };
    }

    // 중복 전환 방지
    if (quote.converted_contract_id) {
      return {
        success: false,
        error: '이미 계약으로 전환된 견적서입니다.',
        existingContractId: quote.converted_contract_id,
      };
    }

    const contractNumber = await db.generateContractNumber(quote.company_id, 'C');
    const contractId = uuidv4();
    const now = new Date().toISOString();

    const newContract = {
      id: contractId,
      company_id: quote.company_id,
      contract_number: contractNumber,
      contract_code: contractData.contract_code || null,
      client_business_number: contractData.client_business_number || null,
      client_company: quote.recipient_company,
      client_contact_name: quote.recipient_contact || null,
      client_contact_phone: quote.recipient_phone || null,
      client_contact_email: quote.recipient_email || null,
      contract_type: contractData.contract_type || 'service',
      service_name: quote.service_name,
      description: contractData.description || null,
      contract_start_date: contractData.contract_start_date || now.split('T')[0],
      contract_end_date: contractData.contract_end_date || null,
      contract_amount: quote.total_amount,
      vat_amount: quote.vat_amount,
      total_amount: quote.grand_total,
      labor_total: quote.labor_total || 0,
      expense_total: quote.expense_total || 0,
      section_total: quote.section_total || 0,
      progress: 'contract_signed',
      progress_note: null,
      received_amount: 0,
      remaining_amount: quote.grand_total,
      progress_billing_rate: 0,
      progress_billing_amount: 0,
      manager_id: requesterId,
      manager_name: requester.name,
      source_quote_id: quoteId,
      notes: contractData.notes || null,
      created_by: requesterId,
      created_at: now,
      updated_at: now,
    };

    // 트랜잭션 안전성: 전체 try, 실패 시 cleanup (BUG #4)
    try {
      await db.addContract(newContract);

      // 인건비 복사
      const quoteLaborItems = await db.getQuoteLaborItemsByQuoteId(quoteId);
      if (quoteLaborItems.length > 0) {
        const contractLaborItems = quoteLaborItems.map((item: any) => ({
          id: uuidv4(),
          contract_id: contractId,
          grade_id: item.grade_id,
          grade_name: item.grade_name,
          quantity: item.quantity,
          participation_rate: item.participation_rate,
          months: item.months,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        }));
        await db.addContractLaborItems(contractLaborItems);
      }

      // 경비 복사
      const quoteExpenseItems = await db.getQuoteExpenseItemsByQuoteId(quoteId);
      if (quoteExpenseItems.length > 0) {
        const contractExpenseItems = quoteExpenseItems.map((item: any) => ({
          id: uuidv4(),
          contract_id: contractId,
          category_id: item.category_id,
          category_name: item.category_name,
          calculation_type: item.calculation_type || 'manual',
          rate: item.rate || null,
          amount: item.amount,
          note: item.note,
        }));
        await db.addContractExpenseItems(contractExpenseItems);
      }

      // 섹션 복사 — BUG #3 fix: description/content 폴백, amount 기본값 처리
      const quoteSections = await db.getQuoteSectionsByQuoteId(quoteId);
      if (quoteSections.length > 0) {
        const idMap: Record<string, string> = {};
        const sorted = [...quoteSections].sort((a: any, b: any) => (a.level || 1) - (b.level || 1));
        const contractSections = sorted.map((item: any) => {
          const newId = uuidv4();
          idMap[item.id] = newId;
          return {
            id: newId,
            contract_id: contractId,
            parent_id: item.parent_id ? (idMap[item.parent_id] || null) : null,
            level: item.level || 1,
            title: item.title,
            description: item.description || item.content || null,
            amount: item.amount || 0,
            sort_order: item.sort_order,
          };
        });
        await db.addContractSections(contractSections);
      }

      // 멤버 복사 (BUG #2)
      const quoteMembers = await db.getQuoteMembers(quoteId);
      if (quoteMembers && quoteMembers.length > 0) {
        for (const m of quoteMembers) {
          await db.addContractMember({
            id: uuidv4(),
            contract_id: contractId,
            user_id: m.user_id,
            user_name: m.user_name,
            role: m.role || null,
            assigned_by: requesterId,
          });
        }
      }

      // 견적서 상태 업데이트
      await db.updateQuote(quoteId, {
        status: 'converted',
        converted_contract_id: contractId,
      });

      // 계약 생성 이력
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
    } catch (err: any) {
      // 실패 시 롤백: 방금 만든 계약 삭제 (FK CASCADE로 자식 정리)
      try { await db.deleteContract(contractId); } catch { /* best effort */ }
      return { success: false, error: '계약 전환 실패: ' + (err?.message || '알 수 없는 오류') };
    }
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

  // ========================================
  // 견적서 양식 템플릿 관리
  // ========================================

  // 견적서 양식 템플릿 업로드
  ipcMain.handle('quotes:uploadTemplate', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '관리자만 견적서 양식을 업로드할 수 있습니다.' };
    }

    try {
      const result = await dialog.showOpenDialog({
        title: '견적서 양식 파일 선택',
        filters: [
          { name: '문서 파일', extensions: ['docx', 'xlsx', 'hwp'] },
          { name: '모든 파일', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'canceled' };
      }

      const srcPath = result.filePaths[0];
      const ext = path.extname(srcPath);
      const templateDir = path.join(app.getPath('userData'), 'quote_templates');

      if (!fs.existsSync(templateDir)) {
        fs.mkdirSync(templateDir, { recursive: true });
      }

      const destFilename = `quote_template${ext}`;
      const destPath = path.join(templateDir, destFilename);

      fs.copyFileSync(srcPath, destPath);

      // settings에 template_path 저장
      await db.setSetting('quote_template_path', destPath);

      return { success: true, templatePath: destPath, fileName: path.basename(srcPath) };
    } catch (err: any) {
      return { success: false, error: err.message || '견적서 양식 업로드에 실패했습니다.' };
    }
  });

  // 견적서 양식 템플릿 삭제
  ipcMain.handle('quotes:removeTemplate', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '관리자만 견적서 양식을 삭제할 수 있습니다.' };
    }

    try {
      const templatePath = await db.getSetting('quote_template_path');
      if (templatePath && fs.existsSync(templatePath)) {
        fs.unlinkSync(templatePath);
      }

      await db.setSetting('quote_template_path', null);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '견적서 양식 삭제에 실패했습니다.' };
    }
  });

  // ========================================
  // 견적서 출력 (AI 기반 문서 생성)
  // ========================================

  ipcMain.handle('quotes:generateDocument', async (_event, requesterId: string, quoteId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) return { success: false, error: '권한이 없습니다.' };

    try {
      // 견적서 데이터 조회
      const quote = await db.getQuoteById(quoteId);
      if (!quote) return { success: false, error: '견적서를 찾을 수 없습니다.' };

      // 권한 확인
      if (requester.role !== 'super_admin' && requester.company_id !== quote.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      // 상세 항목 조회
      const laborItems = await db.getQuoteLaborItemsByQuoteId(quoteId);
      const expenseItems = await db.getQuoteExpenseItemsByQuoteId(quoteId);

      // 섹션 조회
      let sections: any[] = [];
      try {
        sections = await db.getQuoteSectionsByQuoteId(quoteId);
      } catch { /* sections may not exist */ }

      // 회사 정보
      const company = await db.getCompanyById(quote.company_id);

      // 견적서 데이터 구성
      const quoteData = {
        quote_number: quote.quote_number,
        quote_date: quote.quote_date,
        valid_until: quote.valid_until,
        recipient_company: quote.recipient_company,
        recipient_contact: quote.recipient_contact,
        recipient_phone: quote.recipient_phone,
        recipient_email: quote.recipient_email,
        recipient_department: quote.recipient_department,
        recipient_address: quote.recipient_address,
        service_name: quote.service_name,
        title: quote.title,
        project_period_months: quote.project_period_months,
        labor_total: quote.labor_total,
        expense_total: quote.expense_total,
        section_total: quote.section_total,
        total_amount: quote.total_amount,
        vat_amount: quote.vat_amount,
        grand_total: quote.grand_total,
        notes: quote.notes,
        company_name: company?.name || quote.company_name || '건설경제연구원',
        company_address: company?.address || quote.company_address || '',
        company_phone: company?.phone || quote.company_phone || '',
        company_business_number: company?.business_number || quote.company_business_number || '',
        labor_items: laborItems.map((item: any) => ({
          grade_name: item.grade_name,
          quantity: item.quantity,
          participation_rate: item.participation_rate,
          months: item.months,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        })),
        expense_items: expenseItems.map((item: any) => ({
          category_name: item.category_name,
          calculation_type: item.calculation_type,
          rate: item.rate,
          amount: item.amount,
          note: item.note,
        })),
        sections: sections.map((s: any) => ({
          level: s.level,
          title: s.title,
          description: s.description,
          amount: s.amount,
        })),
      };

      // 템플릿 경로 확인
      const templatePath = await db.getSetting('quote_template_path');
      let generatedContent: string;

      if (templatePath && fs.existsSync(templatePath)) {
        // 템플릿 기반 AI 생성
        const apiKey = await db.getSetting('openai_api_key');
        if (!apiKey) {
          return { success: false, error: 'OpenAI API 키가 설정되어 있지 않습니다. 설정에서 API 키를 등록해주세요.' };
        }

        initOCRClient(apiKey);
        const client = getOCRClient();
        if (!client) {
          return { success: false, error: 'AI 클라이언트 초기화에 실패했습니다.' };
        }

        const ext = path.extname(templatePath).toLowerCase();
        let templateText = '';

        // 템플릿 텍스트 추출 (certificate.ipc.ts 패턴 재사용)
        if (ext === '.xlsx' || ext === '.xls') {
          const XLSX = require('xlsx');
          const workbook = XLSX.readFile(templatePath);
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ' | ', RS: '\n' });
            if (csv.trim()) templateText += `[시트: ${sheetName}]\n${csv}\n`;
          }
        } else if (ext === '.docx') {
          try {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(templatePath);
            const entry = zip.getEntry('word/document.xml');
            if (entry) {
              const xml = entry.getData().toString('utf8');
              templateText = xml
                .replace(/<w:p[^>]*>/g, '\n')
                .replace(/<w:tab\/>/g, '\t')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/\n{3,}/g, '\n\n').trim();
            }
          } catch { /* ignore */ }
        } else if (ext === '.hwp') {
          try {
            const buffer = fs.readFileSync(templatePath);
            const texts: string[] = [];
            let current = '';
            for (let i = 0; i < buffer.length - 1; i += 2) {
              const charCode = buffer[i] | (buffer[i + 1] << 8);
              if ((charCode >= 0x20 && charCode <= 0x7E) || (charCode >= 0xAC00 && charCode <= 0xD7AF) ||
                  (charCode >= 0x3131 && charCode <= 0x318E) || charCode === 0x0A || charCode === 0x0D) {
                current += String.fromCharCode(charCode);
              } else {
                if (current.length > 5) texts.push(current.trim());
                current = '';
              }
            }
            if (current.length > 5) texts.push(current.trim());
            templateText = texts.join('\n');
          } catch { /* ignore */ }
        }

        const prompt = `다음은 견적서 양식 템플릿입니다:\n\n${templateText}\n\n` +
          `이 양식에 다음 견적서 데이터를 채워서 완성된 견적서 텍스트를 생성해주세요:\n` +
          JSON.stringify(quoteData, null, 2) + '\n\n' +
          `양식의 구조와 형식을 최대한 유지하면서, 빈칸이나 플레이스홀더에 해당 정보를 채워넣어주세요.\n` +
          `금액은 천 단위 콤마를 포함하여 표시해주세요.\n` +
          `날짜는 한국어 형식(YYYY년 MM월 DD일)으로 표시해주세요.\n` +
          `인건비 항목, 경비 항목, 상세내역 섹션을 모두 포함해주세요.\n` +
          `완성된 견적서 텍스트만 출력해주세요.`;

        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 8000,
        });

        generatedContent = response.choices[0]?.message?.content || '';
      } else {
        // 기본 형식으로 생성
        generatedContent = generateDefaultQuoteDocument(quoteData);
      }

      // 저장 다이얼로그
      const saveResult = await dialog.showSaveDialog({
        title: '견적서 저장',
        defaultPath: `견적서_${quote.quote_number}_${quote.recipient_company || ''}.txt`,
        filters: [
          { name: '텍스트 파일', extensions: ['txt'] },
          { name: '모든 파일', extensions: ['*'] },
        ],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, error: 'canceled' };
      }

      fs.writeFileSync(saveResult.filePath, generatedContent, 'utf8');

      // 파일 열기
      shell.openPath(saveResult.filePath);

      return { success: true, filePath: saveResult.filePath, content: generatedContent };
    } catch (err: any) {
      return { success: false, error: err.message || '견적서 출력에 실패했습니다.' };
    }
  });

  // ========================================
  // 견적서 멤버 관리
  // ========================================

  // 멤버 조회
  ipcMain.handle('quotes:getMembers', async (_event, requesterId: string, quoteId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const members = await db.getQuoteMembers(quoteId);
    return { success: true, members };
  });

  // 멤버 설정
  ipcMain.handle('quotes:setMembers', async (_event, requesterId: string, quoteId: string, members: any[]) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const quote = await db.getQuoteById(quoteId);
    if (!quote) {
      return { success: false, error: '견적서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    const isAdmin = ['super_admin', 'company_admin'].includes(requester.role);
    const isDeptManager = requester.role === 'department_manager';
    const isCreator = quote.created_by === requesterId;
    if (!isAdmin && !isDeptManager && !isCreator) {
      return { success: false, error: '멤버를 설정할 권한이 없습니다.' };
    }

    // 작성자를 메인으로 항상 포함
    const membersToSave: any[] = [];
    membersToSave.push({
      quote_id: quoteId,
      user_id: quote.created_by,
      user_name: quote.created_by_name,
      role: 'main',
      assigned_by: requesterId,
    });
    for (const m of members) {
      if (m.user_id !== quote.created_by) {
        membersToSave.push({
          quote_id: quoteId,
          user_id: m.user_id,
          user_name: m.user_name || '',
          role: 'member',
          assigned_by: requesterId,
        });
      }
    }
    await db.setQuoteMembers(quoteId, membersToSave);

    return { success: true };
  });
}

// 기본 견적서 문서 형식 생성
function generateDefaultQuoteDocument(data: any): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═══════════════════════════════════════════════════');
  lines.push('                     견  적  서');
  lines.push('═══════════════════════════════════════════════════');
  lines.push('');

  // 기본 정보
  lines.push(`  견적번호: ${data.quote_number}`);
  if (data.quote_date) {
    const d = new Date(data.quote_date);
    lines.push(`  견적일자: ${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`);
  }
  if (data.valid_until) {
    const d = new Date(data.valid_until);
    lines.push(`  유효기한: ${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`);
  }
  lines.push('');

  // 수신처 정보
  lines.push('─────────────────────────────────────────────────');
  lines.push('  [수신처]');
  lines.push(`  회사명: ${data.recipient_company || ''}`);
  if (data.recipient_department) lines.push(`  부  서: ${data.recipient_department}`);
  if (data.recipient_contact) lines.push(`  담당자: ${data.recipient_contact}`);
  if (data.recipient_phone) lines.push(`  연락처: ${data.recipient_phone}`);
  if (data.recipient_email) lines.push(`  이메일: ${data.recipient_email}`);
  if (data.recipient_address) lines.push(`  주  소: ${data.recipient_address}`);
  lines.push('');

  // 용역 정보
  lines.push('─────────────────────────────────────────────────');
  lines.push(`  용역명: ${data.service_name || ''}`);
  if (data.title) lines.push(`  제  목: ${data.title}`);
  if (data.project_period_months) lines.push(`  사업기간: ${data.project_period_months}개월`);
  lines.push('');

  // 금액 요약
  lines.push('─────────────────────────────────────────────────');
  lines.push('  [금액 요약]');
  lines.push(`  인건비 합계:    ${(data.labor_total || 0).toLocaleString()}원`);
  lines.push(`  경비 합계:      ${(data.expense_total || 0).toLocaleString()}원`);
  if (data.section_total) {
    lines.push(`  상세내역 합계:  ${data.section_total.toLocaleString()}원`);
  }
  lines.push(`  ─────────────────────────────────`);
  lines.push(`  소  계:         ${(data.total_amount || 0).toLocaleString()}원`);
  lines.push(`  부가세(VAT):    ${(data.vat_amount || 0).toLocaleString()}원`);
  lines.push(`  ═════════════════════════════════`);
  lines.push(`  총  액:         ${(data.grand_total || 0).toLocaleString()}원`);
  lines.push('');

  // 인건비 항목
  if (data.labor_items && data.labor_items.length > 0) {
    lines.push('─────────────────────────────────────────────────');
    lines.push('  [인건비 내역]');
    lines.push('  등급명         | 인원 | 참여율 | 개월 |    단가    |    소계');
    lines.push('  ─────────────────────────────────────────────');
    for (const item of data.labor_items) {
      const gradeName = (item.grade_name || '').padEnd(12);
      const qty = String(item.quantity || 0).padStart(3);
      const rate = String(((item.participation_rate || 1) * 100).toFixed(0) + '%').padStart(5);
      const months = String(item.months || 0).padStart(4);
      const unitPrice = (item.unit_price || 0).toLocaleString().padStart(10);
      const subtotal = (item.subtotal || 0).toLocaleString().padStart(12);
      lines.push(`  ${gradeName} | ${qty} | ${rate} | ${months} | ${unitPrice} | ${subtotal}`);
    }
    lines.push(`  인건비 합계: ${(data.labor_total || 0).toLocaleString()}원`);
    lines.push('');
  }

  // 경비 항목
  if (data.expense_items && data.expense_items.length > 0) {
    lines.push('─────────────────────────────────────────────────');
    lines.push('  [경비 내역]');
    lines.push('  항목명              | 계산방식  |      금액     | 비고');
    lines.push('  ─────────────────────────────────────────────');
    for (const item of data.expense_items) {
      const name = (item.category_name || '').padEnd(18);
      const calcType = item.calculation_type === 'percentage'
        ? `비율(${((item.rate || 0) * 100).toFixed(0)}%)`
        : item.calculation_type === 'fixed' ? '고정' : '수동';
      const amount = (item.amount || 0).toLocaleString().padStart(13);
      const note = item.note || '';
      lines.push(`  ${name} | ${calcType.padEnd(8)} | ${amount} | ${note}`);
    }
    lines.push(`  경비 합계: ${(data.expense_total || 0).toLocaleString()}원`);
    lines.push('');
  }

  // 상세내역 섹션
  if (data.sections && data.sections.length > 0) {
    lines.push('─────────────────────────────────────────────────');
    lines.push('  [상세내역]');
    for (const s of data.sections) {
      const indent = '  '.repeat(s.level || 1);
      const amountStr = s.amount ? ` - ${s.amount.toLocaleString()}원` : '';
      lines.push(`  ${indent}${s.title}${amountStr}`);
      if (s.description) {
        lines.push(`  ${indent}  ${s.description}`);
      }
    }
    lines.push('');
  }

  // 비고
  if (data.notes) {
    lines.push('─────────────────────────────────────────────────');
    lines.push('  [비고]');
    lines.push(`  ${data.notes}`);
    lines.push('');
  }

  // 발신처 정보
  lines.push('═══════════════════════════════════════════════════');
  lines.push('');
  lines.push(`                ${data.company_name || ''}`);
  if (data.company_address) lines.push(`                ${data.company_address}`);
  if (data.company_phone) lines.push(`                TEL: ${data.company_phone}`);
  if (data.company_business_number) lines.push(`                사업자등록번호: ${data.company_business_number}`);
  lines.push('');

  return lines.join('\n');
}
