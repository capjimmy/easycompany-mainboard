import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from '../../shared/types';

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;

  // Actions
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      isDark: false,

      setMode: (mode: ThemeMode) => {
        let isDark = false;

        if (mode === 'dark') {
          isDark = true;
        } else if (mode === 'system') {
          isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }

        // 서버에도 저장
        window.electronAPI?.settings.setTheme(mode);

        set({ mode, isDark });

        // body 클래스 업데이트
        document.body.classList.toggle('dark', isDark);
      },

      toggle: () => {
        const { isDark } = get();
        const newMode = isDark ? 'light' : 'dark';
        get().setMode(newMode);
      },

      initTheme: async () => {
        try {
          // 서버에서 테마 설정 가져오기
          const savedTheme = await window.electronAPI?.settings.getTheme();
          if (savedTheme) {
            get().setMode(savedTheme as ThemeMode);
          } else {
            get().setMode('system');
          }
        } catch {
          get().setMode('system');
        }

        // 시스템 테마 변경 감지
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          const { mode } = get();
          if (mode === 'system') {
            set({ isDark: e.matches });
            document.body.classList.toggle('dark', e.matches);
          }
        });
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ mode: state.mode }),
    }
  )
);
