/**
 * 견적서-계약서 연결(Linking) IPC 핸들러
 *
 * SQL Migration (run once on Supabase):
 * -------------------------------------------------------
 * ALTER TABLE quotes ADD COLUMN IF NOT EXISTS linked_contract_id UUID REFERENCES contracts(id);
 * ALTER TABLE contracts ADD COLUMN IF NOT EXISTS linked_quote_id UUID REFERENCES quotes(id);
 * -------------------------------------------------------
 */

import { ipcMain } from 'electron';
import { db } from '../database';
import { supabase } from '../database/supabaseClient';

export function registerLinkingHandlers(): void {
  // ========================================
  // 견적서 ↔ 계약서 연결
  // ========================================

  // 견적서와 계약서 연결
  ipcMain.handle(
    'linking:linkQuoteToContract',
    async (_event, requesterId: string, quoteId: string, contractId: string) => {
      try {
        const requester = await db.getUserById(requesterId);
        if (!requester) {
          return { success: false, error: '권한이 없습니다.' };
        }

        // 견적서에 계약서 ID 연결
        const { error: quoteError } = await supabase
          .from('quotes')
          .update({ linked_contract_id: contractId })
          .eq('id', quoteId);

        if (quoteError) {
          return { success: false, error: quoteError.message };
        }

        // 계약서에 견적서 ID 연결
        const { error: contractError } = await supabase
          .from('contracts')
          .update({ linked_quote_id: quoteId })
          .eq('id', contractId);

        if (contractError) {
          // 롤백: 견적서 연결 해제
          await supabase
            .from('quotes')
            .update({ linked_contract_id: null })
            .eq('id', quoteId);
          return { success: false, error: contractError.message };
        }

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  // 견적서와 계약서 연결 해제
  ipcMain.handle(
    'linking:unlinkQuoteFromContract',
    async (_event, requesterId: string, quoteId: string, contractId: string) => {
      try {
        const requester = await db.getUserById(requesterId);
        if (!requester) {
          return { success: false, error: '권한이 없습니다.' };
        }

        const { error: quoteError } = await supabase
          .from('quotes')
          .update({ linked_contract_id: null })
          .eq('id', quoteId);

        if (quoteError) {
          return { success: false, error: quoteError.message };
        }

        const { error: contractError } = await supabase
          .from('contracts')
          .update({ linked_quote_id: null })
          .eq('id', contractId);

        if (contractError) {
          return { success: false, error: contractError.message };
        }

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  // 연결할 견적서 검색
  ipcMain.handle(
    'linking:searchQuotes',
    async (_event, requesterId: string, search: string) => {
      try {
        const requester = await db.getUserById(requesterId);
        if (!requester) {
          return { success: false, error: '권한이 없습니다.' };
        }

        const searchLower = (search || '').trim().toLowerCase();

        let query = supabase
          .from('quotes')
          .select('id, quote_number, recipient_company, service_name, grand_total, status')
          .order('created_at', { ascending: false })
          .limit(20);

        // 슈퍼관리자가 아니면 자기 회사만
        if (requester.role !== 'super_admin' && requester.company_id) {
          query = query.eq('company_id', requester.company_id);
        }

        const { data, error } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        // 클라이언트 사이드 검색 필터링
        let results = data || [];
        if (searchLower) {
          results = results.filter(
            (q: any) =>
              q.quote_number?.toLowerCase().includes(searchLower) ||
              q.recipient_company?.toLowerCase().includes(searchLower) ||
              q.service_name?.toLowerCase().includes(searchLower)
          );
        }

        return { success: true, quotes: results };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  // 연결할 계약서 검색
  ipcMain.handle(
    'linking:searchContracts',
    async (_event, requesterId: string, search: string) => {
      try {
        const requester = await db.getUserById(requesterId);
        if (!requester) {
          return { success: false, error: '권한이 없습니다.' };
        }

        const searchLower = (search || '').trim().toLowerCase();

        let query = supabase
          .from('contracts')
          .select('id, contract_number, client_company, service_name, total_amount, progress')
          .order('created_at', { ascending: false })
          .limit(20);

        // 슈퍼관리자가 아니면 자기 회사만
        if (requester.role !== 'super_admin' && requester.company_id) {
          query = query.eq('company_id', requester.company_id);
        }

        const { data, error } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        // 클라이언트 사이드 검색 필터링
        let results = data || [];
        if (searchLower) {
          results = results.filter(
            (c: any) =>
              c.contract_number?.toLowerCase().includes(searchLower) ||
              c.client_company?.toLowerCase().includes(searchLower) ||
              c.service_name?.toLowerCase().includes(searchLower)
          );
        }

        return { success: true, contracts: results };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  // 견적서에 연결된 계약서 조회
  ipcMain.handle(
    'linking:getLinkedContract',
    async (_event, requesterId: string, quoteId: string) => {
      try {
        const requester = await db.getUserById(requesterId);
        if (!requester) {
          return { success: false, error: '권한이 없습니다.' };
        }

        // 견적서에서 linked_contract_id 조회
        const { data: quote, error: quoteError } = await supabase
          .from('quotes')
          .select('linked_contract_id')
          .eq('id', quoteId)
          .single();

        if (quoteError) {
          return { success: false, error: quoteError.message };
        }

        if (!quote?.linked_contract_id) {
          return { success: true, contract: null };
        }

        // 연결된 계약서 정보 조회
        const { data: contract, error: contractError } = await supabase
          .from('contracts')
          .select('id, contract_number, client_company, service_name, total_amount, progress')
          .eq('id', quote.linked_contract_id)
          .single();

        if (contractError) {
          return { success: false, error: contractError.message };
        }

        return { success: true, contract };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  // 계약서에 연결된 견적서 조회
  ipcMain.handle(
    'linking:getLinkedQuote',
    async (_event, requesterId: string, contractId: string) => {
      try {
        const requester = await db.getUserById(requesterId);
        if (!requester) {
          return { success: false, error: '권한이 없습니다.' };
        }

        // 계약서에서 linked_quote_id 조회
        const { data: contract, error: contractError } = await supabase
          .from('contracts')
          .select('linked_quote_id')
          .eq('id', contractId)
          .single();

        if (contractError) {
          return { success: false, error: contractError.message };
        }

        if (!contract?.linked_quote_id) {
          return { success: true, quote: null };
        }

        // 연결된 견적서 정보 조회
        const { data: quote, error: quoteError } = await supabase
          .from('quotes')
          .select('id, quote_number, recipient_company, service_name, grand_total, status')
          .eq('id', contract.linked_quote_id)
          .single();

        if (quoteError) {
          return { success: false, error: quoteError.message };
        }

        return { success: true, quote };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );
}
