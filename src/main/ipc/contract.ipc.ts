import { ipcMain } from 'electron';
import { db } from '../database';
import { supabase } from '../database/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import type { ContractProgress } from '../../shared/types';

/**
 * Check if a user has access to a specific company via junction table.
 * Falls back to single company_id comparison if junction table is empty.
 */
async function hasCompanyAccess(userId: string, userCompanyId: string | null, targetCompanyId: string): Promise<boolean> {
  const userComps = await db.getUserCompanies(userId);
  if (userComps.length > 0) {
    return userComps.some((uc: any) => uc.company_id === targetCompanyId);
  }
  return userCompanyId === targetCompanyId;
}

/**
 * 계약의 received_amount를 contract_payments 합계로 재계산 (단일 소스)
 * - contract_payments가 실제 입금 기록의 유일한 소스
 * - tax_invoices, payment_conditions 등에서 중복 집계하지 않음
 */
export async function recalculateContractReceivedFromPayments(contractId: string): Promise<{ received: number; remaining: number }> {
  const payments = await db.getContractPaymentsByContractId(contractId);
  const totalReceived = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const contract = await db.getContractById(contractId);
  const totalAmount = contract?.total_amount || 0;
  const remaining = totalAmount - totalReceived;

  await db.updateContract(contractId, {
    received_amount: totalReceived,
    remaining_amount: remaining,
  });

  return { received: totalReceived, remaining };
}

export function registerContractHandlers(): void {
  // ========================================
  // 계약서 CRUD
  // ========================================

  // 계약서 목록 조회
  ipcMain.handle('contracts:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // DB 레벨에서 회사 필터링 (성능)
    let contracts: any[];
    if (requester.role === 'super_admin') {
      contracts = filters?.company_id
        ? await db.getContractsByCompanyId(filters.company_id)
        : await db.getContracts();
    } else {
      // 일반 사용자: 소속 회사 계약만
      const userComps = await db.getUserCompanies(requesterId);
      const userCompanyIds = userComps.map((uc: any) => uc.company_id);
      if (userCompanyIds.length === 0 && requester.company_id) {
        userCompanyIds.push(requester.company_id);
      }
      if (userCompanyIds.length === 1) {
        contracts = await db.getContractsByCompanyId(userCompanyIds[0]);
      } else if (userCompanyIds.length > 1) {
        const all = await Promise.all(userCompanyIds.map((cid: string) => db.getContractsByCompanyId(cid)));
        contracts = all.flat();
      } else {
        contracts = [];
      }
    }

    // 부서 관리자는 소속 부서들의 계약서만 조회 (멤버 포함, junction table 기반)
    if (requester.role === 'department_manager') {
      const userDepts = await db.getUserDepartments(requesterId);
      const userDeptIds = userDepts.map((ud: any) => ud.department_id);
      // Fall back to single department_id if junction table is empty
      const deptIdSet = new Set(userDeptIds.length > 0 ? userDeptIds : (requester.department_id ? [requester.department_id] : []));
      const deptMemberContracts = await db.getContractsByMemberId(requesterId);
      const deptMemberContractIds = new Set(deptMemberContracts.map((m: any) => m.contract_id));
      contracts = contracts.filter((c: any) => deptIdSet.has(c.department_id) || c.manager_id === requester.id || deptMemberContractIds.has(c.id));
    }

    // 사원은 본인이 담당자이거나, 멤버로 배정된 계약서만 조회
    if (requester.role === 'employee') {
      const memberContracts = await db.getContractsByMemberId(requesterId);
      const memberContractIds = new Set(memberContracts.map((m: any) => m.contract_id));
      contracts = contracts.filter((c: any) =>
        c.manager_id === requester.id || memberContractIds.has(c.id)
      );
    }

    // 필터 적용
    if (filters) {
      if (filters.progress) {
        contracts = contracts.filter((c: any) => c.progress === filters.progress);
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        contracts = contracts.filter((c: any) =>
          c.contract_number?.toLowerCase().includes(search) ||
          c.client_company?.toLowerCase().includes(search) ||
          c.service_name?.toLowerCase().includes(search)
        );
      }
      if (filters.startDate && filters.endDate) {
        contracts = contracts.filter((c: any) => {
          const startDate = new Date(c.contract_start_date);
          return startDate >= new Date(filters.startDate) && startDate <= new Date(filters.endDate);
        });
      }
      if (filters.year) {
        contracts = contracts.filter((c: any) => {
          const startDate = new Date(c.contract_start_date);
          return startDate.getFullYear() === filters.year;
        });
      }
      if (filters.month) {
        contracts = contracts.filter((c: any) => {
          const startDate = new Date(c.contract_start_date);
          return startDate.getMonth() + 1 === filters.month;
        });
      }
    }

    // 최신순 정렬
    contracts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { success: true, contracts };
  });

  // 계약서 상세 조회
  ipcMain.handle('contracts:getById', async (_event, requesterId: string, contractId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 입금 기록 조회
    const payments = await db.getContractPaymentsByContractId(contractId);
    // 변경 이력 조회
    const histories = await db.getContractHistoriesByContractId(contractId);
    // 커스텀 이벤트 조회
    const events = await db.getContractEventsByContractId(contractId);
    // 인건비/경비/상세내역 조회
    const laborItems = await db.getContractLaborItems(contractId);
    const expenseItems = await db.getContractExpenseItems(contractId);
    const sections = await db.getContractSections(contractId);
    // 멤버 조회
    const members = await db.getContractMembers(contractId);
    // 발주처(공동발주) + 발주처별 청구/수금/진행률 집계
    const clients = await db.getContractClientsByContractId(contractId);
    if (clients.length > 0) {
      const subtasks = await db.getContractSubtasks(contractId);
      // 청구메뉴(billings) 연동: 청구=billing_amount, 수금=paid_amount (+직접 수금기록 contract_payments도 합산)
      const { data: billings } = await supabase.from('billings').select('contract_client_id, billing_amount, paid_amount').eq('contract_id', contractId);
      for (const cl of clients as any[]) {
        const billed = (billings || []).filter((b: any) => b.contract_client_id === cl.id).reduce((s: number, b: any) => s + (Number(b.billing_amount) || 0), 0);
        const recvBill = (billings || []).filter((b: any) => b.contract_client_id === cl.id).reduce((s: number, b: any) => s + (Number(b.paid_amount) || 0), 0);
        const recvPay = (payments || []).filter((p: any) => p.contract_client_id === cl.id).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        const received = recvBill + recvPay;
        const cTasks = (subtasks || []).filter((t: any) => t.contract_client_id === cl.id);
        const progress = cTasks.length > 0 ? Math.round(cTasks.reduce((s: number, t: any) => s + (Number(t.progress_rate) || 0), 0) / cTasks.length) : 0;
        cl.billed_amount = billed;
        cl.received_amount = received;
        cl.remaining_amount = (Number(cl.total_amount) || 0) - received;
        cl.progress_rate = progress;                                   // 발주처별 작업진행률
        cl.collection_rate = cl.total_amount ? Math.round((received / cl.total_amount) * 100) : 0; // 수금률
      }
    }

    return {
      success: true,
      contract: {
        ...contract,
        payments,
        histories,
        events,
        laborItems,
        expenseItems,
        sections,
        members,
        clients,
      },
    };
  });

  // 계약서 생성
  ipcMain.handle('contracts:create', async (_event, requesterId: string, contractData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // company_id는 항상 요청자의 소속 회사 사용 (super_admin만 지정 가능)
    const companyId = requester.role === 'super_admin' && contractData.company_id
      ? contractData.company_id
      : requester.company_id;
    if (!companyId) {
      return { success: false, error: '회사 정보가 없습니다.' };
    }

    // 계약번호 생성
    const contractNumber = await db.generateContractNumber(companyId, 'C');
    const contractId = uuidv4();
    const now = new Date().toISOString();

    // 인건비/경비/상세내역에서 금액 계산
    const laborItems = contractData.laborItems || [];
    const expenseItems = contractData.expenseItems || [];
    const sectionItems = contractData.sectionItems || [];

    const laborTotal = laborItems.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
    const expenseTotal = expenseItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const sectionTotal = contractData.section_total || 0;

    // 발주처(공동발주)가 있으면 계약총액 = 발주처 금액 합
    const hasClients = Array.isArray(contractData.clients) && contractData.clients.length > 0;
    const clientsTotal = hasClients
      ? contractData.clients.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0)
      : 0;
    // 항목이 있으면 항목 합계 사용, 없으면 직접 입력 금액 사용
    const hasItems = laborItems.length > 0 || expenseItems.length > 0 || sectionItems.length > 0;
    const contractAmount = hasClients
      ? clientsTotal
      : (hasItems ? (laborTotal + expenseTotal + sectionTotal) : (contractData.contract_amount || 0));
    const vatRate = contractData.vat_rate || 0.1;
    const vatAmount = Math.round(contractAmount * vatRate);
    const totalAmount = contractAmount + vatAmount;

    const newContract = {
      id: contractId,
      company_id: companyId,
      contract_number: contractNumber,
      contract_code: contractData.contract_code || null,

      // 발주기관 정보
      client_business_number: contractData.client_business_number || null,
      client_company: contractData.client_company || '',
      client_contact_name: contractData.client_contact_name || null,
      client_contact_phone: contractData.client_contact_phone || null,
      client_contact_email: contractData.client_contact_email || null,

      // 계약 기본 정보
      contract_type: contractData.contract_type || 'service',
      service_category: contractData.service_category || null,
      service_name: contractData.service_name || '',
      description: contractData.description || null,

      // 계약 기간
      contract_start_date: contractData.contract_start_date || now.split('T')[0],
      contract_end_date: contractData.contract_end_date || null,
      contract_date: contractData.contract_date || null,

      // 금액 정보
      contract_amount: contractAmount,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      labor_total: laborTotal,
      expense_total: expenseTotal,
      section_total: sectionTotal,

      // 진행 상황
      progress: 'contract_signed' as ContractProgress,
      progress_note: null,

      // 입금 관련
      received_amount: 0,
      remaining_amount: totalAmount,

      // 기성 관련
      progress_billing_rate: 0,
      progress_billing_amount: 0,

      // 담당자
      manager_id: contractData.manager_id || requesterId,
      manager_name: contractData.manager_name || requester.name,
      department_id: contractData.department_id || null,
      progress_rate: contractData.progress_rate || 0,
      outsource_company: contractData.outsource_company || null,
      outsource_amount: contractData.outsource_amount || 0,

      // 원본 견적서
      source_quote_id: contractData.source_quote_id || null,

      notes: contractData.notes || null,

      // 추가기재 — 계약정보
      has_original_contract: contractData.has_original_contract ?? false,
      contract_seal_shapes: contractData.contract_seal_shapes || [],
      statement_submitted: contractData.statement_submitted ?? false,
      statement_submitted_date: contractData.statement_submitted_date || null,
      // 추가기재 — 금액정보
      contract_deposit_amount: contractData.contract_deposit_amount || 0,
      contract_deposit_rate: contractData.contract_deposit_rate ?? null,
      guarantee_esubmission: contractData.guarantee_esubmission || null,
      defect_guarantee_rate: contractData.defect_guarantee_rate ?? null,
      defect_liability_months: contractData.defect_liability_months ?? null,
      delay_penalty_rate: contractData.delay_penalty_rate ?? null,
      local_bond_applicable: contractData.local_bond_applicable ?? false,
      local_bond_amount: contractData.local_bond_amount || 0,
      stamp_tax_applicable: contractData.stamp_tax_applicable ?? false,
      stamp_tax_amount: contractData.stamp_tax_amount || 0,

      created_by: requesterId,
      created_at: now,
      updated_at: now,
    };

    await db.addContract(newContract);

    // 멤버 저장 (메인 담당자 포함)
    const membersToSave: any[] = [];
    // 메인 담당자를 항상 포함
    const mainManagerId = contractData.manager_id || requesterId;
    const mainManagerName = contractData.manager_name || requester.name;
    membersToSave.push({
      contract_id: contractId,
      user_id: mainManagerId,
      user_name: mainManagerName,
      role: 'main',
      assigned_by: requesterId,
    });
    // 추가 멤버
    if (contractData.members && Array.isArray(contractData.members)) {
      for (const m of contractData.members) {
        if (m.user_id !== mainManagerId) {
          membersToSave.push({
            contract_id: contractId,
            user_id: m.user_id,
            user_name: m.user_name || '',
            role: 'member',
            assigned_by: requesterId,
          });
        }
      }
    }
    await db.setContractMembers(contractId, membersToSave);

    // 인건비 항목 저장
    if (laborItems.length > 0) {
      const preparedLabor = laborItems.map((item: any) => ({
        id: uuidv4(),
        contract_id: contractId,
        grade_id: item.grade_id || null,
        grade_name: item.grade_name,
        quantity: item.quantity || 1,
        participation_rate: item.participation_rate || 1,
        months: item.months || 1,
        unit_price: item.unit_price || 0,
        subtotal: item.subtotal || 0,
      }));
      await db.addContractLaborItems(preparedLabor);
    }

    // 경비 항목 저장
    if (expenseItems.length > 0) {
      const preparedExpense = expenseItems.map((item: any) => ({
        id: uuidv4(),
        contract_id: contractId,
        category_id: item.category_id || null,
        category_name: item.category_name,
        calculation_type: item.calculation_type || 'manual',
        rate: item.rate || null,
        amount: item.amount || 0,
        note: item.note || null,
      }));
      await db.addContractExpenseItems(preparedExpense);
    }

    // 상세내역(섹션) 저장
    if (sectionItems.length > 0) {
      const idMap: Record<string, string> = {};
      const preparedSections = sectionItems.map((item: any) => {
        const newId = uuidv4();
        if (item.id) idMap[item.id] = newId;
        return {
          id: newId,
          contract_id: contractId,
          parent_id: item.parent_id ? (idMap[item.parent_id] || null) : null,
          level: item.level || 1,
          title: item.title,
          description: item.description || null,
          amount: item.amount || 0,
          sort_order: item.sort_order || 0,
        };
      });
      await db.addContractSections(preparedSections);
    }

    // 발주처(공동발주) 저장
    if (hasClients) {
      const preparedClients = contractData.clients.map((c: any, idx: number) => {
        const amt = Number(c.amount) || 0;
        const vat = Math.round(amt * vatRate);
        const tot = amt + vat;
        return {
          id: uuidv4(),
          contract_id: contractId,
          client_company: c.client_company || '',
          client_business_number: c.client_business_number || null,
          client_contact_name: c.client_contact_name || null,
          client_contact_phone: c.client_contact_phone || null,
          client_contact_email: c.client_contact_email || null,
          amount: amt,
          vat_amount: vat,
          total_amount: tot,
          billed_amount: 0,
          received_amount: 0,
          remaining_amount: tot,
          sort_order: idx,
        };
      });
      await db.addContractClients(preparedClients);
    }

    // 생성 이력 추가
    await db.addContractHistory({
      id: uuidv4(),
      contract_id: contractId,
      change_type: 'created',
      change_description: '계약서 생성',
      previous_value: null,
      new_value: null,
      changed_by: requesterId,
      changed_by_name: requester.name,
      changed_at: now,
    });

    return { success: true, contractId, contractNumber };
  });

  // 계약서 수정
  ipcMain.handle('contracts:update', async (_event, requesterId: string, contractId: string, contractData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '계약서를 수정할 권한이 없습니다.' };
    }

    const now = new Date().toISOString();
    const updates: any = {};
    const changes: string[] = [];

    // 수정 가능한 필드들
    const editableFields = [
      'contract_code', 'client_business_number', 'client_company', 'client_contact_name',
      'client_contact_phone', 'client_contact_email', 'contract_type', 'service_category',
      'service_name', 'description', 'contract_start_date', 'contract_end_date', 'contract_date',
      'department_id', 'manager_id', 'manager_name', 'progress_rate', 'progress_note',
      'progress_billing_rate', 'progress_billing_amount', 'outsource_company', 'outsource_amount', 'notes',
      // 추가기재 필드
      'has_original_contract', 'contract_seal_shapes', 'statement_submitted', 'statement_submitted_date',
      'contract_deposit_amount', 'contract_deposit_rate', 'guarantee_esubmission', 'defect_guarantee_rate',
      'defect_liability_months', 'delay_penalty_rate', 'local_bond_applicable', 'local_bond_amount',
      'stamp_tax_applicable', 'stamp_tax_amount',
    ];

    // 세부작업이 있으면 progress_rate 직접 수정 무시 (세부작업 기반 자동 계산 우선)
    const subtasks = await db.getContractSubtasks(contractId);
    const hasSubtasks = subtasks.length > 0;

    for (const field of editableFields) {
      if (field === 'progress_rate' && hasSubtasks) continue; // 세부작업 있으면 진행율 직접 수정 무시
      if (contractData[field] !== undefined && contractData[field] !== contract[field]) {
        updates[field] = contractData[field];
        changes.push(`${field}: ${contract[field]} → ${contractData[field]}`);
      }
    }

    // 인건비/경비/상세내역 항목 업데이트
    const laborItems = contractData.laborItems;
    const expenseItems = contractData.expenseItems;
    const sectionItems = contractData.sectionItems;

    if (laborItems !== undefined) {
      await db.deleteContractLaborItemsByContractId(contractId);
      if (laborItems.length > 0) {
        const preparedLabor = laborItems.map((item: any) => ({
          id: item.id || uuidv4(),
          contract_id: contractId,
          grade_id: item.grade_id || null,
          grade_name: item.grade_name,
          quantity: item.quantity || 1,
          participation_rate: item.participation_rate || 1,
          months: item.months || 1,
          unit_price: item.unit_price || 0,
          subtotal: item.subtotal || 0,
        }));
        await db.addContractLaborItems(preparedLabor);
      }
    }

    if (expenseItems !== undefined) {
      await db.deleteContractExpenseItemsByContractId(contractId);
      if (expenseItems.length > 0) {
        const preparedExpense = expenseItems.map((item: any) => ({
          id: item.id || uuidv4(),
          contract_id: contractId,
          category_id: item.category_id || null,
          category_name: item.category_name,
          calculation_type: item.calculation_type || 'manual',
          rate: item.rate || null,
          amount: item.amount || 0,
          note: item.note || null,
        }));
        await db.addContractExpenseItems(preparedExpense);
      }
    }

    if (sectionItems !== undefined) {
      await db.deleteContractSectionsByContractId(contractId);
      if (sectionItems.length > 0) {
        const idMap: Record<string, string> = {};
        const preparedSections = sectionItems.map((item: any) => {
          const newId = uuidv4();
          if (item.id) idMap[item.id] = newId;
          return {
            id: newId,
            contract_id: contractId,
            parent_id: item.parent_id ? (idMap[item.parent_id] || null) : null,
            level: item.level || 1,
            title: item.title,
            description: item.description || null,
            amount: item.amount || 0,
            sort_order: item.sort_order || 0,
          };
        });
        await db.addContractSections(preparedSections);
      }
    }

    // 발주처(공동발주) 업데이트 (clients 배열 전달 시 전체 교체)
    if (contractData.clients !== undefined && Array.isArray(contractData.clients)) {
      await db.deleteContractClientsByContractId(contractId);
      if (contractData.clients.length > 0) {
        const cVat = contractData.vat_rate || 0.1;
        const preparedClients = contractData.clients.map((c: any, idx: number) => {
          const amt = Number(c.amount) || 0;
          const vat = Math.round(amt * cVat);
          const tot = amt + vat;
          return {
            id: c.id || uuidv4(), contract_id: contractId, client_company: c.client_company || '',
            client_business_number: c.client_business_number || null, client_contact_name: c.client_contact_name || null,
            client_contact_phone: c.client_contact_phone || null, client_contact_email: c.client_contact_email || null,
            amount: amt, vat_amount: vat, total_amount: tot,
            billed_amount: Number(c.billed_amount) || 0, received_amount: Number(c.received_amount) || 0,
            remaining_amount: tot - (Number(c.received_amount) || 0), sort_order: idx,
          };
        });
        await db.addContractClients(preparedClients);
        // 계약 총액 = 발주처 합으로
        const cTotal = preparedClients.reduce((s: number, x: any) => s + (x.amount || 0), 0);
        const cVatTotal = preparedClients.reduce((s: number, x: any) => s + (x.vat_amount || 0), 0);
        updates.contract_amount = cTotal;
        updates.vat_amount = cVatTotal;
        updates.total_amount = cTotal + cVatTotal;
        updates.remaining_amount = (cTotal + cVatTotal) - (contract.received_amount || 0);
      }
    }

    // 금액 재계산 (항목 기반)
    const hasItemData = laborItems !== undefined || expenseItems !== undefined || sectionItems !== undefined;
    if (hasItemData) {
      const laborTotal = (laborItems || []).reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
      const expenseTotal = (expenseItems || []).reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
      const secTotal = contractData.section_total || 0;
      const newContractAmount = laborTotal + expenseTotal + secTotal;
      const newVatAmount = Math.round(newContractAmount * 0.1);
      const newTotalAmount = newContractAmount + newVatAmount;
      const newRemainingAmount = newTotalAmount - contract.received_amount;

      updates.contract_amount = newContractAmount;
      updates.vat_amount = newVatAmount;
      updates.total_amount = newTotalAmount;
      updates.remaining_amount = newRemainingAmount;
      updates.labor_total = laborTotal;
      updates.expense_total = expenseTotal;
      updates.section_total = secTotal;

      if (newContractAmount !== contract.contract_amount) {
        changes.push(`계약금액: ${(contract.contract_amount || 0).toLocaleString()} → ${newContractAmount.toLocaleString()}`);
      }
    } else if (contractData.contract_amount !== undefined && contractData.contract_amount !== contract.contract_amount) {
      // 항목 없이 직접 금액 입력
      const newContractAmount = contractData.contract_amount;
      const newVatAmount = Math.round(newContractAmount * 0.1);
      const newTotalAmount = newContractAmount + newVatAmount;
      const newRemainingAmount = newTotalAmount - contract.received_amount;

      updates.contract_amount = newContractAmount;
      updates.vat_amount = newVatAmount;
      updates.total_amount = newTotalAmount;
      updates.remaining_amount = newRemainingAmount;

      changes.push(`계약금액: ${(contract.contract_amount || 0).toLocaleString()} → ${newContractAmount.toLocaleString()}`);
    }

    // 멤버 업데이트 (members 배열이 전달된 경우)
    if (contractData.members !== undefined && Array.isArray(contractData.members)) {
      const mainManagerId = contractData.manager_id || contract.manager_id;
      const mainManagerName = contractData.manager_name || contract.manager_name;
      const membersToSave: any[] = [];
      membersToSave.push({
        contract_id: contractId,
        user_id: mainManagerId,
        user_name: mainManagerName,
        role: 'main',
        assigned_by: requesterId,
      });
      for (const m of contractData.members) {
        if (m.user_id !== mainManagerId) {
          membersToSave.push({
            contract_id: contractId,
            user_id: m.user_id,
            user_name: m.user_name || '',
            role: 'member',
            assigned_by: requesterId,
          });
        }
      }
      await db.setContractMembers(contractId, membersToSave);
    }

    if (Object.keys(updates).length > 0) {
      await db.updateContract(contractId, updates);

      // 변경 이력 추가
      await db.addContractHistory({
        id: uuidv4(),
        contract_id: contractId,
        change_type: 'updated',
        change_description: '계약서 수정',
        previous_value: null,
        new_value: changes.join(', '),
        changed_by: requesterId,
        changed_by_name: requester.name,
        changed_at: now,
      });
    }

    return { success: true };
  });

  // 계약서 삭제
  ipcMain.handle('contracts:delete', async (_event, requesterId: string, contractId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인: 슈퍼관리자 또는 회사관리자만 삭제 가능
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '계약서를 삭제할 권한이 없습니다.' };
    }

    if (requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '계약서를 삭제할 권한이 없습니다.' };
    }

    // 입금 내역이 있으면 삭제 불가
    const payments = await db.getContractPaymentsByContractId(contractId);
    if (payments.length > 0) {
      return { success: false, error: '입금 내역이 있는 계약은 삭제할 수 없습니다.' };
    }

    await db.deleteContract(contractId);

    return { success: true };
  });

  // 진행상황 변경
  ipcMain.handle('contracts:updateProgress', async (
    _event,
    requesterId: string,
    contractId: string,
    progress: ContractProgress,
    note?: string
  ) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const now = new Date().toISOString();
    const previousProgress = contract.progress;

    await db.updateContract(contractId, {
      progress,
      progress_note: note || null,
    });

    // 변경 이력 추가
    await db.addContractHistory({
      id: uuidv4(),
      contract_id: contractId,
      change_type: 'status_changed',
      change_description: `진행상황 변경: ${previousProgress} → ${progress}`,
      previous_value: previousProgress,
      new_value: progress,
      changed_by: requesterId,
      changed_by_name: requester.name,
      changed_at: now,
    });

    return { success: true };
  });

  // ========================================
  // 입금 관리
  // ========================================

  // 입금 등록
  ipcMain.handle('contracts:addPayment', async (
    _event,
    requesterId: string,
    contractId: string,
    paymentData: any
  ) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const now = new Date().toISOString();
    const paymentId = uuidv4();
    const amount = paymentData.amount || 0;

    const newPayment = {
      id: paymentId,
      contract_id: contractId,
      contract_client_id: paymentData.contract_client_id || null,
      payment_date: paymentData.payment_date || now.split('T')[0],
      amount: amount,
      payment_method: paymentData.payment_method || null,
      note: paymentData.note || null,
      created_by: requesterId,
      created_at: now,
    };

    await db.addContractPayment(newPayment);

    // 계약서 금액 재계산 (contract_payments 합계 기반 - 단일 소스)
    const oldReceivedAmount = contract.received_amount || 0;
    const { received: newReceivedAmount, remaining: newRemainingAmount } =
      await recalculateContractReceivedFromPayments(contractId);

    // 변경 이력 추가
    await db.addContractHistory({
      id: uuidv4(),
      contract_id: contractId,
      change_type: 'payment_received',
      change_description: `입금 등록: ${amount.toLocaleString()}원`,
      previous_value: `입금액: ${oldReceivedAmount.toLocaleString()}원`,
      new_value: `입금액: ${newReceivedAmount.toLocaleString()}원`,
      changed_by: requesterId,
      changed_by_name: requester.name,
      changed_at: now,
    });

    // ========================================
    // 수금 단계별 알림 (Collection Stage Notifications)
    // ========================================
    try {
      const totalAmt = contract.total_amount || 0;
      if (totalAmt > 0) {
        const oldRate = oldReceivedAmount / totalAmt;
        const newRate = newReceivedAmount / totalAmt;

        let notificationTitle = '';
        let notificationMessage = '';

        if (oldRate < 0.5 && newRate >= 0.5 && newRate < 0.8) {
          notificationTitle = '수금률 50% 도달';
          notificationMessage = `[${contract.contract_number}] ${contract.client_company} - ${contract.service_name}: 수금률이 50%에 도달했습니다. (수금액: ${newReceivedAmount.toLocaleString()}원 / 총액: ${totalAmt.toLocaleString()}원)`;
        } else if (oldRate < 0.8 && newRate >= 0.8 && newRate < 1.0) {
          notificationTitle = '수금률 80% 도달';
          notificationMessage = `[${contract.contract_number}] ${contract.client_company} - ${contract.service_name}: 수금률이 80%에 도달했습니다. (수금액: ${newReceivedAmount.toLocaleString()}원 / 총액: ${totalAmt.toLocaleString()}원)`;
        } else if (oldRate < 1.0 && newRate >= 1.0) {
          notificationTitle = '수금 완료';
          notificationMessage = `[${contract.contract_number}] ${contract.client_company} - ${contract.service_name}: 수금이 완료되었습니다. (총액: ${totalAmt.toLocaleString()}원)`;
        }

        if (notificationTitle) {
          // 알림 대상: 계약 담당자 + 해당 부서의 부서 관리자
          const notifyTargetIds = new Set<string>();

          // 계약 담당자
          if (contract.manager_id) {
            notifyTargetIds.add(contract.manager_id);
          }

          // 부서 관리자 찾기
          if (contract.department_id) {
            const allUsers = await db.getUsers();
            const deptManagers = allUsers.filter((u: any) =>
              u.is_active &&
              u.role === 'department_manager' &&
              u.department_id === contract.department_id
            );
            for (const mgr of deptManagers) {
              notifyTargetIds.add(mgr.id);
            }
          }

          // 알림 발송
          for (const targetId of notifyTargetIds) {
            await db.addNotification({
              id: uuidv4(),
              user_id: targetId,
              type: 'collection_milestone',
              title: notificationTitle,
              message: notificationMessage,
              link: `/contracts/${contractId}`,
              related_id: contractId,
              created_by: requesterId,
              created_at: now,
            });
          }
        }
      }

      // 연체 체크: 계약 종료일이 지났는데 미수금이 있는 경우
      if (contract.contract_end_date && newRemainingAmount > 0) {
        const endDate = new Date(contract.contract_end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        if (today > endDate) {
          const notifyTargetIds = new Set<string>();
          if (contract.manager_id) {
            notifyTargetIds.add(contract.manager_id);
          }
          if (contract.department_id) {
            const allUsers = await db.getUsers();
            const deptManagers = allUsers.filter((u: any) =>
              u.is_active &&
              u.role === 'department_manager' &&
              u.department_id === contract.department_id
            );
            for (const mgr of deptManagers) {
              notifyTargetIds.add(mgr.id);
            }
          }

          for (const targetId of notifyTargetIds) {
            await db.addNotification({
              id: uuidv4(),
              user_id: targetId,
              type: 'collection_overdue',
              title: '미수금 발생 (연체)',
              message: `[${contract.contract_number}] ${contract.client_company} - ${contract.service_name}: 계약 종료일(${contract.contract_end_date})이 경과하였으나 미수금 ${newRemainingAmount.toLocaleString()}원이 남아 있습니다.`,
              link: `/contracts/${contractId}`,
              related_id: contractId,
              created_by: requesterId,
              created_at: now,
            });
          }
        }
      }
    } catch (notifyErr) {
      console.error('Failed to send collection notification:', notifyErr);
      // 알림 실패는 입금 처리에 영향을 주지 않음
    }

    return { success: true, paymentId };
  });

  // 입금 수정
  ipcMain.handle('contracts:updatePayment', async (
    _event,
    requesterId: string,
    paymentId: string,
    paymentData: any
  ) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const payments = await db.getContractPayments();
    const payment = payments.find((p: any) => p.id === paymentId);
    if (!payment) {
      return { success: false, error: '입금 기록을 찾을 수 없습니다.' };
    }

    const contract = await db.getContractById(payment.contract_id);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const previousAmount = payment.amount;
    const newAmount = paymentData.amount !== undefined ? paymentData.amount : previousAmount;
    const amountDiff = newAmount - previousAmount;

    await db.updateContractPayment(paymentId, {
      payment_date: paymentData.payment_date || payment.payment_date,
      amount: newAmount,
      payment_method: paymentData.payment_method,
      note: paymentData.note,
    });

    // 금액이 변경되었으면 재계산 (contract_payments 합계 기반)
    if (amountDiff !== 0) {
      await recalculateContractReceivedFromPayments(payment.contract_id);
    }

    return { success: true };
  });

  // 입금 삭제
  ipcMain.handle('contracts:deletePayment', async (_event, requesterId: string, paymentId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const payments = await db.getContractPayments();
    const payment = payments.find((p: any) => p.id === paymentId);
    if (!payment) {
      return { success: false, error: '입금 기록을 찾을 수 없습니다.' };
    }

    const contract = await db.getContractById(payment.contract_id);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인: 회사관리자 이상
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '입금 기록을 삭제할 권한이 없습니다.' };
    }

    if (requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const amount = payment.amount;

    await db.deleteContractPayment(paymentId);

    // 계약서 금액 재계산 (contract_payments 합계 기반)
    await recalculateContractReceivedFromPayments(payment.contract_id);

    return { success: true };
  });

  // 입금 목록 조회
  ipcMain.handle('contracts:getPayments', async (_event, requesterId: string, contractId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    if (requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const payments = await db.getContractPaymentsByContractId(contractId);
    payments.sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

    return { success: true, payments };
  });

  // 변경 이력 조회
  ipcMain.handle('contracts:getHistories', async (_event, requesterId: string, contractId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    if (requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const histories = await db.getContractHistoriesByContractId(contractId);
    histories.sort((a: any, b: any) => new Date(b.created_at || b.changed_at).getTime() - new Date(a.created_at || a.changed_at).getTime());

    return { success: true, histories };
  });

  // 전체 변경 이력 조회 (일괄)
  ipcMain.handle('contracts:getAllHistories', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let contracts = await db.getContracts();
    if (requester.role !== 'super_admin' && requester.company_id) {
      contracts = contracts.filter((c: any) => c.company_id === requester.company_id);
    }

    const allHistories = await db.getContractHistories();
    const contractMap = new Map(contracts.map((c: any) => [c.id, c]));

    const enrichedHistories = allHistories
      .filter((h: any) => contractMap.has(h.contract_id))
      .map((h: any) => {
        const contract = contractMap.get(h.contract_id);
        return {
          ...h,
          contract_number: contract.contract_number,
          client_company: contract.client_company,
          service_name: contract.service_name,
        };
      });

    enrichedHistories.sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return { success: true, histories: enrichedHistories };
  });

  // 월별 현황
  ipcMain.handle('contracts:getMonthlyStats', async (
    _event,
    requesterId: string,
    year: number,
    filters?: { company_id?: string }
  ) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let contracts = await db.getContracts();

    // 회사 필터
    if (requester.role === 'super_admin') {
      // 슈퍼관리자: filters.company_id 있으면 그 회사만, 없으면 전체
      if (filters?.company_id) {
        contracts = contracts.filter((c: any) => c.company_id === filters.company_id);
      }
    } else if (requester.company_id) {
      contracts = contracts.filter((c: any) => c.company_id === requester.company_id);
    }

    // 날짜 추출: contract_date(실제 계약일) 우선, 없으면 contract_start_date
    // ⚠️ created_at은 절대 사용 안 함 — 마이그레이션 일자에 모두 몰려서 데이터 왜곡됨
    const getDate = (c: any): Date | null => {
      const raw = c.contract_date || c.contract_start_date;
      if (!raw) return null;
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    };

    // 연도 필터
    contracts = contracts.filter((c: any) => {
      const d = getDate(c);
      return d && d.getFullYear() === year;
    });

    // 월별 통계 계산
    const stats: any[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthContracts = contracts.filter((c: any) => {
        const d = getDate(c);
        return d && d.getMonth() + 1 === m;
      });

      stats.push({
        month: m,
        contractCount: monthContracts.length,
        totalAmount: monthContracts.reduce((sum: number, c: any) => sum + (c.total_amount || 0), 0),
        receivedAmount: monthContracts.reduce((sum: number, c: any) => sum + (c.received_amount || 0), 0),
        remainingAmount: monthContracts.reduce((sum: number, c: any) => sum + (c.remaining_amount || 0), 0),
        completedCount: monthContracts.filter((c: any) => c.progress === 'completed').length,
        inProgressCount: monthContracts.filter((c: any) => c.progress === 'in_progress').length,
      });
    }

    return { success: true, stats };
  });

  // ========================================
  // 추천 계약 (유사 거래처 기반)
  // ========================================

  // 거래처 기반 유사 계약 조회
  ipcMain.handle('contracts:getRecommendations', async (_event, requesterId: string, searchParams: {
    clientCompany?: string;
    serviceName?: string;
  }) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let contracts = await db.getContracts();

    // 회사 필터
    if (requester.role !== 'super_admin' && requester.company_id) {
      contracts = contracts.filter((c: any) => c.company_id === requester.company_id);
    }

    // 거래처명으로 검색 (부분 일치)
    if (searchParams.clientCompany && searchParams.clientCompany.trim()) {
      const searchTerm = searchParams.clientCompany.toLowerCase().trim();
      contracts = contracts.filter((c: any) =>
        c.client_company?.toLowerCase().includes(searchTerm)
      );
    }

    // 용역명으로 검색 (부분 일치)
    if (searchParams.serviceName && searchParams.serviceName.trim()) {
      const searchTerm = searchParams.serviceName.toLowerCase().trim();
      contracts = contracts.filter((c: any) =>
        c.service_name?.toLowerCase().includes(searchTerm)
      );
    }

    // 최신순 정렬 후 최대 10개
    contracts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const recommendations = contracts.slice(0, 10);

    // 통계 계산
    const stats = {
      count: recommendations.length,
      avgContractAmount: 0,
      avgTotalAmount: 0,
      minTotalAmount: 0,
      maxTotalAmount: 0,
    };

    if (recommendations.length > 0) {
      const contractAmounts = recommendations.map((c: any) => c.contract_amount || 0);
      const totalAmounts = recommendations.map((c: any) => c.total_amount || 0);

      stats.avgContractAmount = Math.round(contractAmounts.reduce((a: number, b: number) => a + b, 0) / recommendations.length);
      stats.avgTotalAmount = Math.round(totalAmounts.reduce((a: number, b: number) => a + b, 0) / recommendations.length);
      stats.minTotalAmount = Math.min(...totalAmounts);
      stats.maxTotalAmount = Math.max(...totalAmounts);
    }

    // 추천 목록 (필요한 정보만)
    const items = recommendations.map((c: any) => ({
      id: c.id,
      contract_number: c.contract_number,
      client_company: c.client_company,
      service_name: c.service_name,
      contract_amount: c.contract_amount,
      total_amount: c.total_amount,
      contract_start_date: c.contract_start_date,
      contract_end_date: c.contract_end_date,
      progress: c.progress,
    }));

    return { success: true, recommendations: items, stats };
  });

  // ========================================
  // 계약 커스텀 이벤트 관리
  // ========================================

  // 이벤트 등록
  ipcMain.handle('contracts:addEvent', async (
    _event,
    requesterId: string,
    contractId: string,
    eventData: any
  ) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    if (requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const now = new Date().toISOString();
    const eventId = uuidv4();

    const newEvent = {
      id: eventId,
      contract_id: contractId,
      event_title: eventData.event_title || '',
      event_date: eventData.event_date || now.split('T')[0],
      event_description: eventData.event_description || null,
      event_color: eventData.event_color || 'cyan',
      created_by: requesterId,
      created_at: now,
    };

    await db.addContractEvent(newEvent);
    return { success: true, eventId };
  });

  // 이벤트 수정
  ipcMain.handle('contracts:updateEvent', async (
    _event,
    requesterId: string,
    eventId: string,
    eventData: any
  ) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const allEvents = await db.getContractEvents();
    const existingEvent = allEvents.find((e: any) => e.id === eventId);
    if (!existingEvent) {
      return { success: false, error: '이벤트를 찾을 수 없습니다.' };
    }

    const contract = await db.getContractById(existingEvent.contract_id);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    if (requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '권한이 없습니다.' };
    }

    await db.updateContractEvent(eventId, {
      event_title: eventData.event_title ?? existingEvent.event_title,
      event_date: eventData.event_date ?? existingEvent.event_date,
      event_description: eventData.event_description,
      event_color: eventData.event_color ?? existingEvent.event_color,
    });

    return { success: true };
  });

  // 이벤트 삭제
  ipcMain.handle('contracts:deleteEvent', async (_event, requesterId: string, eventId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const allEvents = await db.getContractEvents();
    const existingEvent = allEvents.find((e: any) => e.id === eventId);
    if (!existingEvent) {
      return { success: false, error: '이벤트를 찾을 수 없습니다.' };
    }

    const contract = await db.getContractById(existingEvent.contract_id);
    if (contract && requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '권한이 없습니다.' };
    }

    await db.deleteContractEvent(eventId);
    return { success: true };
  });

  // 이벤트 목록 조회 (계약별)
  ipcMain.handle('contracts:getEvents', async (_event, requesterId: string, contractId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    if (requester.role !== 'super_admin' && !(await hasCompanyAccess(requesterId, requester.company_id, contract.company_id))) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const events = await db.getContractEventsByContractId(contractId);
    events.sort((a: any, b: any) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

    return { success: true, events };
  });

  // 전체 이벤트 조회 (캘린더/프로젝트현황판용)
  ipcMain.handle('contracts:getAllEvents', async (_event, requesterId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 계약 일괄 로드 (회사별 또는 전체)
    const allContracts =
      requester.role !== 'super_admin' && requester.company_id
        ? await db.getContractsByCompanyId(requester.company_id)
        : await db.getContracts();

    const contractMap = new Map<string, any>(allContracts.map((c: any) => [c.id, c]));

    let events = await db.getContractEvents();

    // 회사 필터: 권한 범위 내 계약 ID에 해당하는 이벤트만
    if (requester.role !== 'super_admin' && requester.company_id) {
      events = events.filter((e: any) => contractMap.has(e.contract_id));
    }

    // 계약 정보 조인 (Map lookup, no N+1)
    const enrichedEvents = events.map((e: any) => {
      const contract = contractMap.get(e.contract_id);
      return {
        ...e,
        contract_name: contract?.service_name || '',
        contract_number: contract?.contract_number || '',
      };
    });

    return { success: true, events: enrichedEvents };
  });

  // ========================================
  // 계약서 멤버 관리
  // ========================================

  // 멤버 조회
  ipcMain.handle('contracts:getMembers', async (_event, requesterId: string, contractId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const members = await db.getContractMembers(contractId);
    return { success: true, members };
  });

  // 멤버 설정 (관리자/부서관리자/메인담당자만)
  ipcMain.handle('contracts:setMembers', async (_event, requesterId: string, contractId: string, members: any[]) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = await db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인: 관리자, 부서관리자, 메인 담당자만 멤버 설정 가능
    const isAdmin = ['super_admin', 'company_admin'].includes(requester.role);
    const isDeptManager = requester.role === 'department_manager';
    const isMainManager = contract.manager_id === requesterId;
    if (!isAdmin && !isDeptManager && !isMainManager) {
      return { success: false, error: '멤버를 설정할 권한이 없습니다.' };
    }

    // 메인 담당자 항상 포함
    const membersToSave: any[] = [];
    membersToSave.push({
      contract_id: contractId,
      user_id: contract.manager_id,
      user_name: contract.manager_name,
      role: 'main',
      assigned_by: requesterId,
    });
    for (const m of members) {
      if (m.user_id !== contract.manager_id) {
        membersToSave.push({
          contract_id: contractId,
          user_id: m.user_id,
          user_name: m.user_name || '',
          role: 'member',
          assigned_by: requesterId,
        });
      }
    }
    await db.setContractMembers(contractId, membersToSave);

    return { success: true };
  });
}
