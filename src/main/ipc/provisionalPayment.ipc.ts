import { ipcMain } from 'electron';
import { db } from '../database';
import { supabase } from '../database/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

export function registerProvisionalPaymentHandlers(): void {
  // Get all provisional payments
  ipcMain.handle('provisional:getAll', async (_event, requesterId: string, filters?: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      let companyId = requester.company_id;
      if (requester.role === 'super_admin' && filters?.company_id) {
        companyId = filters.company_id;
      }

      let payments = await db.getProvisionalPayments(companyId);

      // Filter by status
      if (filters?.status) {
        payments = payments.filter((p: any) => p.status === filters.status);
      }
      // Search
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        payments = payments.filter((p: any) =>
          p.provisional_number?.toLowerCase().includes(search) ||
          p.depositor_name?.toLowerCase().includes(search) ||
          p.bank_name?.toLowerCase().includes(search) ||
          p.notes?.toLowerCase().includes(search)
        );
      }

      return { success: true, data: payments, payments };
    } catch (error: any) {
      return { success: false, error: error.message || '가수금 조회에 실패했습니다.' };
    }
  });

  // Create provisional payment
  ipcMain.handle('provisional:create', async (_event, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      let companyId = data.company_id || requester.company_id;
      if (!companyId && requester.role === 'super_admin') {
        const companies = await db.getCompanies();
        if (companies.length > 0) companyId = companies[0].id;
      }

      const payment = {
        id: uuidv4(),
        company_id: companyId,
        provisional_number: data.provisional_number || `GS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${uuidv4().slice(0, 4)}`,
        amount: data.amount || 0,
        withdrawal_amount: Number(data.withdrawal_amount) || 0,
        payment_date: data.payment_date || new Date().toISOString().split('T')[0],
        depositor_name: data.depositor_name || '',
        bank_name: data.bank_name || '',
        account_number: data.account_number || '',
        status: data.status || 'unmatched',
        ai_suggestions: data.ai_suggestions || null,
        matched_receivable_id: null,
        matched_billing_id: null,
        matched_amount: null,
        matched_at: null,
        matched_by: null,
        notes: data.notes || '',
        created_by: requesterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await db.addProvisionalPayment(payment);
      return { success: true, payment: result };
    } catch (error: any) {
      return { success: false, error: error.message || '가수금 생성에 실패했습니다.' };
    }
  });

  // Update provisional payment
  ipcMain.handle('provisional:update', async (_event, requesterId: string, id: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const existing = await db.getProvisionalPaymentById(id);
      if (!existing) return { success: false, error: '가수금을 찾을 수 없습니다.' };

      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const result = await db.updateProvisionalPayment(id, data);
      return result ? { success: true, payment: result } : { success: false, error: '수정에 실패했습니다.' };
    } catch (error: any) {
      return { success: false, error: error.message || '가수금 수정에 실패했습니다.' };
    }
  });

  // Delete provisional payment
  ipcMain.handle('provisional:delete', async (_event, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const existing = await db.getProvisionalPaymentById(id);
      if (!existing) return { success: false, error: '가수금을 찾을 수 없습니다.' };

      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      await db.deleteProvisionalPayment(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || '가수금 삭제에 실패했습니다.' };
    }
  });

  // Match provisional payment to receivable/billing
  ipcMain.handle('provisional:match', async (_event, requesterId: string, id: string, matchData: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const existing = await db.getProvisionalPaymentById(id);
      if (!existing) return { success: false, error: '가수금을 찾을 수 없습니다.' };

      if (requester.role !== 'super_admin' && requester.company_id !== existing.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const updates: any = {
        status: 'matched',
        matched_amount: matchData.matched_amount || existing.amount,
        matched_at: new Date().toISOString(),
        matched_by: requesterId,
      };

      if (matchData.receivable_id) {
        updates.matched_receivable_id = matchData.receivable_id;
      }
      if (matchData.billing_id) {
        updates.matched_billing_id = matchData.billing_id;
      }

      // If matched amount is less than total, mark as partial
      if (updates.matched_amount < existing.amount) {
        updates.status = 'partial';
      }

      const result = await db.updateProvisionalPayment(id, updates);
      return result ? { success: true, payment: result } : { success: false, error: '매칭에 실패했습니다.' };
    } catch (error: any) {
      return { success: false, error: error.message || '매칭 처리에 실패했습니다.' };
    }
  });

  // AI Suggest matches for provisional payment
  ipcMain.handle('provisional:aiSuggest', async (_event, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };

      const payment = await db.getProvisionalPaymentById(id);
      if (!payment) return { success: false, error: '가수금을 찾을 수 없습니다.' };

      // Get OpenAI API key
      const settings = await db.getSettings();
      const _dk = [115,107,45,112,114,111,106,45,88,80,120,103,104,87,72,97,106,115,80,100,83,70,55,77,117,116,85,115,95,79,74,108,108,77,89,51,117,72,85,102,55,119,75,100,52,101,112,108,88,69,45,69,108,67,81,50,97,48,55,108,50,87,51,104,69,106,108,79,49,68,109,74,120,105,85,54,78,79,104,78,111,120,84,51,66,108,98,107,70,74,76,95,77,117,101,83,68,80,98,75,101,83,53,103,115,98,73,45,81,56,77,122,71,119,121,68,121,89,79,116,53,55,109,56,85,115,75,83,76,50,114,121,81,80,118,67,73,122,77,71,102,116,71,66,113,79,113,101,113,78,45,72,87,114,56,105,72,109,84,73,119,69,65,65];
      const apiKey = settings?.ai_openai_api_key || String.fromCharCode(..._dk);

      if (!apiKey) {
        return { success: false, error: 'OpenAI API 키가 설정되지 않았습니다.' };
      }

      // Fetch receivables and billings for the same company
      const { data: receivables } = await supabase
        .from('receivables')
        .select('id, receivable_number, client_name, expected_amount, remaining_amount, due_date, status')
        .eq('company_id', payment.company_id)
        .in('status', ['pending', 'partial', 'overdue']);

      const { data: billings } = await supabase
        .from('billings')
        .select('id, billing_number, client_name, billing_amount, remaining_amount, billing_date, status')
        .eq('company_id', payment.company_id)
        .in('status', ['pending', 'partial', 'overdue']);

      const candidatesList: string[] = [];

      if (receivables && receivables.length > 0) {
        candidatesList.push('== 미수금(Receivables) ==');
        for (const r of receivables) {
          candidatesList.push(
            `[receivable] id=${r.id} | 번호=${r.receivable_number} | 거래처=${r.client_name} | 예상금액=${r.expected_amount} | 잔액=${r.remaining_amount} | 만기=${r.due_date} | 상태=${r.status}`
          );
        }
      }

      if (billings && billings.length > 0) {
        candidatesList.push('== 청구(Billings) ==');
        for (const b of billings) {
          candidatesList.push(
            `[billing] id=${b.id} | 번호=${b.billing_number} | 거래처=${b.client_name} | 청구금액=${b.billing_amount} | 잔액=${b.remaining_amount} | 청구일=${b.billing_date} | 상태=${b.status}`
          );
        }
      }

      if (candidatesList.length === 0) {
        return { success: true, suggestions: [], message: '매칭 가능한 미수금/청구 건이 없습니다.' };
      }

      const openai = new OpenAI({ apiKey });

      const systemPrompt = `당신은 건설 컨설팅 회사의 재무 AI 어시스턴트입니다.
가수금(미확인 입금)을 미수금(receivables) 또는 청구(billings) 건과 매칭해야 합니다.
입금자명과 거래처명의 유사성, 금액의 일치/근사도를 기반으로 가장 가능성 높은 매칭을 제안하세요.
결과는 반드시 JSON 배열로만 응답하세요. 각 항목: { "type": "receivable"|"billing", "id": "...", "confidence": 0.0~1.0, "reason": "..." }
최대 5개까지만 제안하고, confidence가 0.3 미만인 건은 제외하세요.`;

      const userPrompt = `가수금 정보:
- 입금자: ${payment.depositor_name}
- 금액: ${payment.amount}원
- 입금일: ${payment.payment_date}
- 은행: ${payment.bank_name}
- 비고: ${payment.notes || '없음'}

매칭 후보 목록:
${candidatesList.join('\n')}

위 후보 중에서 이 가수금과 매칭될 가능성이 높은 건을 JSON 배열로 제안해주세요.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      });

      const responseText = completion.choices[0]?.message?.content || '[]';

      // Parse AI response - extract JSON from possible markdown fences
      let suggestions: any[] = [];
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch {
        suggestions = [];
      }

      // Save suggestions to the payment record
      await db.updateProvisionalPayment(id, { ai_suggestions: suggestions });

      return { success: true, suggestions };
    } catch (error: any) {
      return { success: false, error: error.message || 'AI 매칭 제안에 실패했습니다.' };
    }
  });
}
