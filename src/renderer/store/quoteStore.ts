import { create } from 'zustand';
import type { Quote, QuoteStatus, LaborGrade, ExpenseCategory } from '../../shared/types';

interface QuoteFilters {
  status?: QuoteStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
}

interface QuoteState {
  quotes: Quote[];
  currentQuote: Quote | null;
  laborGrades: LaborGrade[];
  expenseCategories: ExpenseCategory[];
  isLoading: boolean;
  error: string | null;
  filters: QuoteFilters;

  // Actions
  fetchQuotes: (userId: string, filters?: QuoteFilters) => Promise<void>;
  fetchQuoteById: (userId: string, quoteId: string) => Promise<Quote | null>;
  fetchPriceSettings: (userId: string, companyId: string) => Promise<void>;
  createQuote: (userId: string, quoteData: any) => Promise<{ success: boolean; quoteId?: string; error?: string }>;
  updateQuote: (userId: string, quoteId: string, quoteData: any) => Promise<{ success: boolean; error?: string }>;
  deleteQuote: (userId: string, quoteId: string) => Promise<{ success: boolean; error?: string }>;
  updateStatus: (userId: string, quoteId: string, status: QuoteStatus) => Promise<{ success: boolean; error?: string }>;
  duplicateQuote: (userId: string, quoteId: string) => Promise<{ success: boolean; quoteId?: string; error?: string }>;
  convertToContract: (userId: string, quoteId: string, contractData: any) => Promise<{ success: boolean; contractId?: string; error?: string }>;
  setFilters: (filters: QuoteFilters) => void;
  clearError: () => void;
  setCurrentQuote: (quote: Quote | null) => void;
}

export const useQuoteStore = create<QuoteState>((set, get) => ({
  quotes: [],
  currentQuote: null,
  laborGrades: [],
  expenseCategories: [],
  isLoading: false,
  error: null,
  filters: {},

  fetchQuotes: async (userId: string, filters?: QuoteFilters) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.quotes.getAll(userId, filters || get().filters);

      if (result.success) {
        set({ quotes: result.quotes, isLoading: false });
      } else {
        set({ error: result.error || '견적서 목록을 불러오는데 실패했습니다.', isLoading: false });
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
    }
  },

  fetchQuoteById: async (userId: string, quoteId: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.quotes.getById(userId, quoteId);

      if (result.success) {
        set({ currentQuote: result.quote, isLoading: false });
        return result.quote;
      } else {
        set({ error: result.error || '견적서를 불러오는데 실패했습니다.', isLoading: false });
        return null;
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return null;
    }
  },

  fetchPriceSettings: async (userId: string, companyId: string) => {
    try {
      const [laborResult, expenseResult] = await Promise.all([
        window.electronAPI.laborGrades.getByCompany(userId, companyId),
        window.electronAPI.expenseCategories.getByCompany(userId, companyId),
      ]);

      if (laborResult.success) {
        set({ laborGrades: laborResult.laborGrades });
      }
      if (expenseResult.success) {
        set({ expenseCategories: expenseResult.expenseCategories });
      }
    } catch (err) {
      console.error('Failed to fetch price settings:', err);
    }
  },

  createQuote: async (userId: string, quoteData: any) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.quotes.create(userId, quoteData);

      if (result.success) {
        set({ isLoading: false });
        // 목록 새로고침
        get().fetchQuotes(userId);
        return { success: true, quoteId: result.quoteId };
      } else {
        set({ error: result.error || '견적서 생성에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  updateQuote: async (userId: string, quoteId: string, quoteData: any) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.quotes.update(userId, quoteId, quoteData);

      if (result.success) {
        set({ isLoading: false });
        get().fetchQuotes(userId);
        return { success: true };
      } else {
        set({ error: result.error || '견적서 수정에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  deleteQuote: async (userId: string, quoteId: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.quotes.delete(userId, quoteId);

      if (result.success) {
        set({ isLoading: false });
        get().fetchQuotes(userId);
        return { success: true };
      } else {
        set({ error: result.error || '견적서 삭제에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  updateStatus: async (userId: string, quoteId: string, status: QuoteStatus) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.quotes.updateStatus(userId, quoteId, status);

      if (result.success) {
        set({ isLoading: false });
        get().fetchQuotes(userId);
        return { success: true };
      } else {
        set({ error: result.error || '상태 변경에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  duplicateQuote: async (userId: string, quoteId: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.quotes.duplicate(userId, quoteId);

      if (result.success) {
        set({ isLoading: false });
        get().fetchQuotes(userId);
        return { success: true, quoteId: result.quoteId };
      } else {
        set({ error: result.error || '견적서 복제에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  convertToContract: async (userId: string, quoteId: string, contractData: any) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.quotes.convertToContract(userId, quoteId, contractData);

      if (result.success) {
        set({ isLoading: false });
        get().fetchQuotes(userId);
        return { success: true, contractId: result.contractId };
      } else {
        set({ error: result.error || '계약 전환에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  setFilters: (filters: QuoteFilters) => {
    set({ filters });
  },

  clearError: () => set({ error: null }),

  setCurrentQuote: (quote: Quote | null) => set({ currentQuote: quote }),
}));
