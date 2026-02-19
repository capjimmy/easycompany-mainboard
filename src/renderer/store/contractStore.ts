import { create } from 'zustand';
import type { Contract, ContractProgress, ContractPayment, ContractHistory } from '../../shared/types';

interface ContractFilters {
  progress?: ContractProgress;
  search?: string;
  startDate?: string;
  endDate?: string;
  year?: number;
}

interface ContractState {
  contracts: Contract[];
  currentContract: (Contract & { payments?: ContractPayment[]; histories?: ContractHistory[] }) | null;
  isLoading: boolean;
  error: string | null;
  filters: ContractFilters;

  // Actions
  fetchContracts: (userId: string, filters?: ContractFilters) => Promise<void>;
  fetchContractById: (userId: string, contractId: string) => Promise<Contract | null>;
  createContract: (userId: string, contractData: any) => Promise<{ success: boolean; contractId?: string; error?: string }>;
  updateContract: (userId: string, contractId: string, contractData: any) => Promise<{ success: boolean; error?: string }>;
  deleteContract: (userId: string, contractId: string) => Promise<{ success: boolean; error?: string }>;
  updateProgress: (userId: string, contractId: string, progress: ContractProgress, note?: string) => Promise<{ success: boolean; error?: string }>;

  // 입금 관리
  addPayment: (userId: string, contractId: string, paymentData: any) => Promise<{ success: boolean; error?: string }>;
  updatePayment: (userId: string, paymentId: string, paymentData: any) => Promise<{ success: boolean; error?: string }>;
  deletePayment: (userId: string, paymentId: string) => Promise<{ success: boolean; error?: string }>;

  // 통계
  fetchMonthlyStats: (userId: string, year: number, month?: number) => Promise<any>;

  setFilters: (filters: ContractFilters) => void;
  clearError: () => void;
  setCurrentContract: (contract: Contract | null) => void;
}

export const useContractStore = create<ContractState>((set, get) => ({
  contracts: [],
  currentContract: null,
  isLoading: false,
  error: null,
  filters: {},

  fetchContracts: async (userId: string, filters?: ContractFilters) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.contracts.getAll(userId, filters || get().filters);

      if (result.success) {
        set({ contracts: result.contracts, isLoading: false });
      } else {
        set({ error: result.error || '계약 목록을 불러오는데 실패했습니다.', isLoading: false });
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
    }
  },

  fetchContractById: async (userId: string, contractId: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.contracts.getById(userId, contractId);

      if (result.success) {
        set({ currentContract: result.contract, isLoading: false });
        return result.contract;
      } else {
        set({ error: result.error || '계약을 불러오는데 실패했습니다.', isLoading: false });
        return null;
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return null;
    }
  },

  createContract: async (userId: string, contractData: any) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.contracts.create(userId, contractData);

      if (result.success) {
        set({ isLoading: false });
        get().fetchContracts(userId);
        return { success: true, contractId: result.contractId };
      } else {
        set({ error: result.error || '계약 생성에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  updateContract: async (userId: string, contractId: string, contractData: any) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.contracts.update(userId, contractId, contractData);

      if (result.success) {
        set({ isLoading: false });
        get().fetchContracts(userId);
        return { success: true };
      } else {
        set({ error: result.error || '계약 수정에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  deleteContract: async (userId: string, contractId: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.contracts.delete(userId, contractId);

      if (result.success) {
        set({ isLoading: false });
        get().fetchContracts(userId);
        return { success: true };
      } else {
        set({ error: result.error || '계약 삭제에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  updateProgress: async (userId: string, contractId: string, progress: ContractProgress, note?: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.contracts.updateProgress(userId, contractId, progress, note);

      if (result.success) {
        set({ isLoading: false });
        get().fetchContracts(userId);
        // 현재 계약 상세도 갱신
        if (get().currentContract?.id === contractId) {
          get().fetchContractById(userId, contractId);
        }
        return { success: true };
      } else {
        set({ error: result.error || '진행상황 변경에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  addPayment: async (userId: string, contractId: string, paymentData: any) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.contracts.addPayment(userId, contractId, paymentData);

      if (result.success) {
        set({ isLoading: false });
        get().fetchContracts(userId);
        get().fetchContractById(userId, contractId);
        return { success: true };
      } else {
        set({ error: result.error || '입금 등록에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  updatePayment: async (userId: string, paymentId: string, paymentData: any) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.contracts.updatePayment(userId, paymentId, paymentData);

      if (result.success) {
        set({ isLoading: false });
        return { success: true };
      } else {
        set({ error: result.error || '입금 수정에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  deletePayment: async (userId: string, paymentId: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.contracts.deletePayment(userId, paymentId);

      if (result.success) {
        set({ isLoading: false });
        return { success: true };
      } else {
        set({ error: result.error || '입금 삭제에 실패했습니다.', isLoading: false });
        return { success: false, error: result.error };
      }
    } catch (err) {
      set({ error: '오류가 발생했습니다.', isLoading: false });
      return { success: false, error: '오류가 발생했습니다.' };
    }
  },

  fetchMonthlyStats: async (userId: string, year: number, month?: number) => {
    try {
      const result = await window.electronAPI.contracts.getMonthlyStats(userId, year, month);

      if (result.success) {
        return result;
      } else {
        return null;
      }
    } catch (err) {
      return null;
    }
  },

  setFilters: (filters: ContractFilters) => {
    set({ filters });
  },

  clearError: () => set({ error: null }),

  setCurrentContract: (contract: Contract | null) => set({ currentContract: contract }),
}));
