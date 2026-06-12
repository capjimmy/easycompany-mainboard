import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../../shared/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  // 총괄관리자 회사 전환용
  selectedCompanyId: string | null;
  selectedCompanyName: string | null;

  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setSelectedCompany: (companyId: string | null, companyName: string | null) => void;
  updateUserMenuOrder: (menuOrder: string[] | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      selectedCompanyId: null,
      selectedCompanyName: null,

      setSelectedCompany: (companyId: string | null, companyName: string | null) => {
        set({ selectedCompanyId: companyId, selectedCompanyName: companyName });
      },

      // 본인 메뉴 순서 즉시 반영 (IPC 저장과 별개로 store만 갱신)
      updateUserMenuOrder: (menuOrder: string[] | null) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, menu_order: menuOrder } as any });
      },

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const result = await window.electronAPI.auth.login(username, password);

          if (result.success && result.user) {
            set({
              user: result.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return true;
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: result.error || '로그인에 실패했습니다.',
            });
            return false;
          }
        } catch (err) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: '로그인 중 오류가 발생했습니다.',
          });
          return false;
        }
      },

      logout: async () => {
        try {
          await window.electronAPI.auth.logout();
        } catch (err) {
          console.error('Logout error:', err);
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            selectedCompanyId: null,
            selectedCompanyName: null,
          });
          // 모든 캐시 완전 클리어 (React state, zustand, 메모리 전부 초기화)
          setTimeout(() => window.location.reload(), 100);
        }
      },

      checkAuth: async () => {
        const { user } = get();

        if (!user?.id) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          const currentUser = await window.electronAPI.auth.getCurrentUser(user.id);

          if (currentUser) {
            set({
              user: currentUser,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (err) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, selectedCompanyId: state.selectedCompanyId, selectedCompanyName: state.selectedCompanyName }),
    }
  )
);
