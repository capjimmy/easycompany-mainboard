import type { ElectronAPI } from '../../preload';

declare global {
  interface Window {
    electronAPI: {
      auth: {
        login: (username: string, password: string) => Promise<{
          success: boolean;
          user?: any;
          error?: string;
        }>;
        logout: () => Promise<{ success: boolean }>;
        changePassword: (userId: string, oldPassword: string, newPassword: string) => Promise<{
          success: boolean;
          error?: string;
        }>;
        getCurrentUser: (userId: string) => Promise<any>;
      };
      users: {
        getAll: (requesterId: string) => Promise<{
          success: boolean;
          users?: any[];
          error?: string;
        }>;
        create: (requesterId: string, userData: any) => Promise<{
          success: boolean;
          userId?: string;
          error?: string;
        }>;
        update: (requesterId: string, userId: string, userData: any) => Promise<{
          success: boolean;
          error?: string;
        }>;
        delete: (requesterId: string, userId: string) => Promise<{
          success: boolean;
          error?: string;
        }>;
        setPermissions: (requesterId: string, userId: string, permissions: any) => Promise<{
          success: boolean;
          error?: string;
        }>;
      };
      settings: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<{ success: boolean }>;
        getAll: () => Promise<Record<string, any>>;
        getTheme: () => Promise<string>;
        setTheme: (theme: 'light' | 'dark' | 'system') => Promise<{ success: boolean }>;
      };
      app: {
        getVersion: () => Promise<string>;
        getPlatform: () => string;
      };
    };
  }
}

export {};
