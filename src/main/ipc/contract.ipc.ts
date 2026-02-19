import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { ContractProgress } from '../../shared/types';

export function registerContractHandlers(): void {
  // ========================================
  // 계약서 CRUD
  // ========================================

  // 계약서 목록 조회
  ipcMain.handle('contracts:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let contracts = db.getContracts();

    // 슈퍼관리자가 아니면 자기 회사의 계약서만 조회
    if (requester.role !== 'super_admin' && requester.company_id) {
      contracts = contracts.filter((c: any) => c.company_id === requester.company_id);
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
    }

    // 최신순 정렬
    contracts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { success: true, contracts };
  });

  // 계약서 상세 조회
  ipcMain.handle('contracts:getById', async (_event, requesterId: string, contractId: string) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && requester.company_id !== contract.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 입금 기록 조회
    const payments = db.getContractPaymentsByContractId(contractId);
    // 변경 이력 조회
    const histories = db.getContractHistoriesByContractId(contractId);

    return {
      success: true,
      contract: {
        ...contract,
        payments,
        histories,
      },
    };
  });

  // 계약서 생성
  ipcMain.handle('contracts:create', async (_event, requesterId: string, contractData: any) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const companyId = contractData.company_id || requester.company_id;
    if (!companyId) {
      return { success: false, error: '회사 정보가 없습니다.' };
    }

    // 계약번호 생성
    const contractNumber = db.generateContractNumber(companyId, 'C');
    const contractId = uuidv4();
    const now = new Date().toISOString();

    // 금액 계산
    const contractAmount = contractData.contract_amount || 0;
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
      service_name: contractData.service_name || '',
      description: contractData.description || null,

      // 계약 기간
      contract_start_date: contractData.contract_start_date || now.split('T')[0],
      contract_end_date: contractData.contract_end_date || null,

      // 금액 정보
      contract_amount: contractAmount,
      vat_amount: vatAmount,
      total_amount: totalAmount,

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

      // 원본 견적서
      source_quote_id: contractData.source_quote_id || null,

      notes: contractData.notes || null,

      created_by: requesterId,
      created_at: now,
      updated_at: now,
    };

    db.addContract(newContract);

    // 생성 이력 추가
    db.addContractHistory({
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
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && requester.company_id !== contract.company_id) {
      return { success: false, error: '계약서를 수정할 권한이 없습니다.' };
    }

    const now = new Date().toISOString();
    const updates: any = {};
    const changes: string[] = [];

    // 수정 가능한 필드들
    const editableFields = [
      'contract_code', 'client_business_number', 'client_company', 'client_contact_name',
      'client_contact_phone', 'client_contact_email', 'contract_type', 'service_name',
      'description', 'contract_start_date', 'contract_end_date', 'notes',
    ];

    for (const field of editableFields) {
      if (contractData[field] !== undefined && contractData[field] !== contract[field]) {
        updates[field] = contractData[field];
        changes.push(`${field}: ${contract[field]} → ${contractData[field]}`);
      }
    }

    // 금액 변경 (별도 처리)
    if (contractData.contract_amount !== undefined && contractData.contract_amount !== contract.contract_amount) {
      const newContractAmount = contractData.contract_amount;
      const newVatAmount = Math.round(newContractAmount * 0.1);
      const newTotalAmount = newContractAmount + newVatAmount;
      const newRemainingAmount = newTotalAmount - contract.received_amount;

      updates.contract_amount = newContractAmount;
      updates.vat_amount = newVatAmount;
      updates.total_amount = newTotalAmount;
      updates.remaining_amount = newRemainingAmount;

      changes.push(`계약금액: ${contract.contract_amount.toLocaleString()} → ${newContractAmount.toLocaleString()}`);
    }

    if (Object.keys(updates).length > 0) {
      db.updateContract(contractId, updates);

      // 변경 이력 추가
      db.addContractHistory({
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
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인: 슈퍼관리자 또는 회사관리자만 삭제 가능
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '계약서를 삭제할 권한이 없습니다.' };
    }

    if (requester.role !== 'super_admin' && requester.company_id !== contract.company_id) {
      return { success: false, error: '계약서를 삭제할 권한이 없습니다.' };
    }

    // 입금 내역이 있으면 삭제 불가
    const payments = db.getContractPaymentsByContractId(contractId);
    if (payments.length > 0) {
      return { success: false, error: '입금 내역이 있는 계약은 삭제할 수 없습니다.' };
    }

    db.deleteContract(contractId);

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
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && requester.company_id !== contract.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const now = new Date().toISOString();
    const previousProgress = contract.progress;

    db.updateContract(contractId, {
      progress,
      progress_note: note || null,
    });

    // 변경 이력 추가
    db.addContractHistory({
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
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && requester.company_id !== contract.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const now = new Date().toISOString();
    const paymentId = uuidv4();
    const amount = paymentData.amount || 0;

    const newPayment = {
      id: paymentId,
      contract_id: contractId,
      payment_date: paymentData.payment_date || now.split('T')[0],
      amount: amount,
      payment_method: paymentData.payment_method || null,
      note: paymentData.note || null,
      created_by: requesterId,
      created_at: now,
    };

    db.addContractPayment(newPayment);

    // 계약서 금액 업데이트
    const newReceivedAmount = contract.received_amount + amount;
    const newRemainingAmount = contract.total_amount - newReceivedAmount;

    db.updateContract(contractId, {
      received_amount: newReceivedAmount,
      remaining_amount: newRemainingAmount,
    });

    // 변경 이력 추가
    db.addContractHistory({
      id: uuidv4(),
      contract_id: contractId,
      change_type: 'payment_received',
      change_description: `입금 등록: ${amount.toLocaleString()}원`,
      previous_value: `입금액: ${contract.received_amount.toLocaleString()}원`,
      new_value: `입금액: ${newReceivedAmount.toLocaleString()}원`,
      changed_by: requesterId,
      changed_by_name: requester.name,
      changed_at: now,
    });

    return { success: true, paymentId };
  });

  // 입금 수정
  ipcMain.handle('contracts:updatePayment', async (
    _event,
    requesterId: string,
    paymentId: string,
    paymentData: any
  ) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const payments = db.getContractPayments();
    const payment = payments.find((p: any) => p.id === paymentId);
    if (!payment) {
      return { success: false, error: '입금 기록을 찾을 수 없습니다.' };
    }

    const contract = db.getContractById(payment.contract_id);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인
    if (requester.role !== 'super_admin' && requester.company_id !== contract.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const previousAmount = payment.amount;
    const newAmount = paymentData.amount !== undefined ? paymentData.amount : previousAmount;
    const amountDiff = newAmount - previousAmount;

    db.updateContractPayment(paymentId, {
      payment_date: paymentData.payment_date || payment.payment_date,
      amount: newAmount,
      payment_method: paymentData.payment_method,
      note: paymentData.note,
    });

    // 금액이 변경되었으면 계약서 업데이트
    if (amountDiff !== 0) {
      const newReceivedAmount = contract.received_amount + amountDiff;
      const newRemainingAmount = contract.total_amount - newReceivedAmount;

      db.updateContract(payment.contract_id, {
        received_amount: newReceivedAmount,
        remaining_amount: newRemainingAmount,
      });
    }

    return { success: true };
  });

  // 입금 삭제
  ipcMain.handle('contracts:deletePayment', async (_event, requesterId: string, paymentId: string) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const payments = db.getContractPayments();
    const payment = payments.find((p: any) => p.id === paymentId);
    if (!payment) {
      return { success: false, error: '입금 기록을 찾을 수 없습니다.' };
    }

    const contract = db.getContractById(payment.contract_id);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    // 권한 확인: 회사관리자 이상
    if (requester.role !== 'super_admin' && requester.role !== 'company_admin') {
      return { success: false, error: '입금 기록을 삭제할 권한이 없습니다.' };
    }

    if (requester.role !== 'super_admin' && requester.company_id !== contract.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const amount = payment.amount;

    db.deleteContractPayment(paymentId);

    // 계약서 금액 업데이트
    const newReceivedAmount = contract.received_amount - amount;
    const newRemainingAmount = contract.total_amount - newReceivedAmount;

    db.updateContract(payment.contract_id, {
      received_amount: newReceivedAmount,
      remaining_amount: newRemainingAmount,
    });

    return { success: true };
  });

  // 입금 목록 조회
  ipcMain.handle('contracts:getPayments', async (_event, requesterId: string, contractId: string) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    if (requester.role !== 'super_admin' && requester.company_id !== contract.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const payments = db.getContractPaymentsByContractId(contractId);
    payments.sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

    return { success: true, payments };
  });

  // 변경 이력 조회
  ipcMain.handle('contracts:getHistories', async (_event, requesterId: string, contractId: string) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const contract = db.getContractById(contractId);
    if (!contract) {
      return { success: false, error: '계약서를 찾을 수 없습니다.' };
    }

    if (requester.role !== 'super_admin' && requester.company_id !== contract.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const histories = db.getContractHistoriesByContractId(contractId);
    histories.sort((a: any, b: any) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

    return { success: true, histories };
  });

  // 월별 현황
  ipcMain.handle('contracts:getMonthlyStats', async (
    _event,
    requesterId: string,
    year: number,
    month?: number
  ) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let contracts = db.getContracts();

    // 회사 필터
    if (requester.role !== 'super_admin' && requester.company_id) {
      contracts = contracts.filter((c: any) => c.company_id === requester.company_id);
    }

    // 연도/월 필터
    contracts = contracts.filter((c: any) => {
      const startDate = new Date(c.contract_start_date);
      if (startDate.getFullYear() !== year) return false;
      if (month !== undefined && startDate.getMonth() + 1 !== month) return false;
      return true;
    });

    // 통계 계산
    const stats = {
      total_count: contracts.length,
      total_amount: contracts.reduce((sum: number, c: any) => sum + c.total_amount, 0),
      received_amount: contracts.reduce((sum: number, c: any) => sum + c.received_amount, 0),
      remaining_amount: contracts.reduce((sum: number, c: any) => sum + c.remaining_amount, 0),
      by_progress: {} as Record<string, { count: number; amount: number }>,
      by_month: [] as Array<{ month: number; count: number; amount: number }>,
    };

    // 진행상황별 통계
    for (const contract of contracts) {
      const progress = contract.progress;
      if (!stats.by_progress[progress]) {
        stats.by_progress[progress] = { count: 0, amount: 0 };
      }
      stats.by_progress[progress].count++;
      stats.by_progress[progress].amount += contract.total_amount;
    }

    // 월별 통계
    if (month === undefined) {
      for (let m = 1; m <= 12; m++) {
        const monthContracts = contracts.filter((c: any) => {
          const startDate = new Date(c.contract_start_date);
          return startDate.getMonth() + 1 === m;
        });
        stats.by_month.push({
          month: m,
          count: monthContracts.length,
          amount: monthContracts.reduce((sum: number, c: any) => sum + c.total_amount, 0),
        });
      }
    }

    return { success: true, stats, contracts };
  });

  // ========================================
  // 추천 계약 (유사 거래처 기반)
  // ========================================

  // 거래처 기반 유사 계약 조회
  ipcMain.handle('contracts:getRecommendations', async (_event, requesterId: string, searchParams: {
    clientCompany?: string;
    serviceName?: string;
  }) => {
    const requester = db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let contracts = db.getContracts();

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
}
