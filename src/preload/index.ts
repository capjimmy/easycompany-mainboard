import { contextBridge, ipcRenderer } from 'electron';

// Renderer에 노출할 API 정의
const electronAPI = {
  // 인증 관련
  auth: {
    login: (username: string, password: string) =>
      ipcRenderer.invoke('auth:login', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    changePassword: (userId: string, oldPassword: string, newPassword: string) =>
      ipcRenderer.invoke('auth:changePassword', userId, oldPassword, newPassword),
    getCurrentUser: (userId: string) =>
      ipcRenderer.invoke('auth:getCurrentUser', userId),
  },

  // 사용자 관련
  users: {
    getAll: (requesterId: string) =>
      ipcRenderer.invoke('users:getAll', requesterId),
    create: (requesterId: string, userData: any) =>
      ipcRenderer.invoke('users:create', requesterId, userData),
    update: (requesterId: string, userId: string, userData: any) =>
      ipcRenderer.invoke('users:update', requesterId, userId, userData),
    delete: (requesterId: string, userId: string) =>
      ipcRenderer.invoke('users:delete', requesterId, userId),
    setPermissions: (requesterId: string, userId: string, permissions: any) =>
      ipcRenderer.invoke('users:setPermissions', requesterId, userId, permissions),
    resetPassword: (requesterId: string, userId: string, newPassword: string) =>
      ipcRenderer.invoke('users:resetPassword', requesterId, userId, newPassword),
  },

  // 회사 관련
  companies: {
    getAll: (requesterId: string) =>
      ipcRenderer.invoke('companies:getAll', requesterId),
    getById: (requesterId: string, companyId: string) =>
      ipcRenderer.invoke('companies:getById', requesterId, companyId),
    create: (requesterId: string, companyData: any) =>
      ipcRenderer.invoke('companies:create', requesterId, companyData),
    update: (requesterId: string, companyId: string, companyData: any) =>
      ipcRenderer.invoke('companies:update', requesterId, companyId, companyData),
    delete: (requesterId: string, companyId: string) =>
      ipcRenderer.invoke('companies:delete', requesterId, companyId),
    getUsers: (requesterId: string, companyId: string) =>
      ipcRenderer.invoke('companies:getUsers', requesterId, companyId),
    getDepartments: (requesterId: string, companyId: string) =>
      ipcRenderer.invoke('companies:getDepartments', requesterId, companyId),
  },

  // 부서 관련
  departments: {
    getAll: (requesterId: string, companyId?: string) =>
      ipcRenderer.invoke('departments:getAll', requesterId, companyId),
    getById: (requesterId: string, departmentId: string) =>
      ipcRenderer.invoke('departments:getById', requesterId, departmentId),
    create: (requesterId: string, departmentData: any) =>
      ipcRenderer.invoke('departments:create', requesterId, departmentData),
    update: (requesterId: string, departmentId: string, departmentData: any) =>
      ipcRenderer.invoke('departments:update', requesterId, departmentId, departmentData),
    delete: (requesterId: string, departmentId: string) =>
      ipcRenderer.invoke('departments:delete', requesterId, departmentId),
    getUsers: (requesterId: string, departmentId: string) =>
      ipcRenderer.invoke('departments:getUsers', requesterId, departmentId),
  },

  // 설정 관련
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    getTheme: () => ipcRenderer.invoke('settings:getTheme'),
    setTheme: (theme: 'light' | 'dark' | 'system') =>
      ipcRenderer.invoke('settings:setTheme', theme),
    clearDatabase: (requesterId: string) =>
      ipcRenderer.invoke('settings:clearDatabase', requesterId),
    // 데이터 경로 관리
    getDataPath: () => ipcRenderer.invoke('settings:getDataPath'),
    setDataPath: (requesterId: string, newPath: string) =>
      ipcRenderer.invoke('settings:setDataPath', requesterId, newPath),
    selectDataFolder: () => ipcRenderer.invoke('settings:selectDataFolder'),
    exportData: (requesterId: string) =>
      ipcRenderer.invoke('settings:exportData', requesterId),
    importData: (requesterId: string) =>
      ipcRenderer.invoke('settings:importData', requesterId),
  },

  // 앱 정보
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => process.platform,
  },

  // ========================================
  // 양식 설정 (Price Settings)
  // ========================================

  // 인건비 등급
  laborGrades: {
    getByCompany: (requesterId: string, companyId: string) =>
      ipcRenderer.invoke('laborGrades:getByCompany', requesterId, companyId),
    create: (requesterId: string, gradeData: any) =>
      ipcRenderer.invoke('laborGrades:create', requesterId, gradeData),
    update: (requesterId: string, gradeId: string, gradeData: any) =>
      ipcRenderer.invoke('laborGrades:update', requesterId, gradeId, gradeData),
    delete: (requesterId: string, gradeId: string) =>
      ipcRenderer.invoke('laborGrades:delete', requesterId, gradeId),
    reorder: (requesterId: string, companyId: string, orderedIds: string[]) =>
      ipcRenderer.invoke('laborGrades:reorder', requesterId, companyId, orderedIds),
  },

  // 경비 항목
  expenseCategories: {
    getByCompany: (requesterId: string, companyId: string) =>
      ipcRenderer.invoke('expenseCategories:getByCompany', requesterId, companyId),
    create: (requesterId: string, categoryData: any) =>
      ipcRenderer.invoke('expenseCategories:create', requesterId, categoryData),
    update: (requesterId: string, categoryId: string, categoryData: any) =>
      ipcRenderer.invoke('expenseCategories:update', requesterId, categoryId, categoryData),
    delete: (requesterId: string, categoryId: string) =>
      ipcRenderer.invoke('expenseCategories:delete', requesterId, categoryId),
    reorder: (requesterId: string, companyId: string, orderedIds: string[]) =>
      ipcRenderer.invoke('expenseCategories:reorder', requesterId, companyId, orderedIds),
  },

  // ========================================
  // 견적서 (Quotes)
  // ========================================
  quotes: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('quotes:getAll', requesterId, filters),
    getById: (requesterId: string, quoteId: string) =>
      ipcRenderer.invoke('quotes:getById', requesterId, quoteId),
    create: (requesterId: string, quoteData: any) =>
      ipcRenderer.invoke('quotes:create', requesterId, quoteData),
    update: (requesterId: string, quoteId: string, quoteData: any) =>
      ipcRenderer.invoke('quotes:update', requesterId, quoteId, quoteData),
    delete: (requesterId: string, quoteId: string) =>
      ipcRenderer.invoke('quotes:delete', requesterId, quoteId),
    updateStatus: (requesterId: string, quoteId: string, status: string) =>
      ipcRenderer.invoke('quotes:updateStatus', requesterId, quoteId, status),
    convertToContract: (requesterId: string, quoteId: string, contractData: any) =>
      ipcRenderer.invoke('quotes:convertToContract', requesterId, quoteId, contractData),
    duplicate: (requesterId: string, quoteId: string) =>
      ipcRenderer.invoke('quotes:duplicate', requesterId, quoteId),
    // 추천 기능
    getRecommendations: (requesterId: string, searchParams: { clientCompany?: string; serviceName?: string }) =>
      ipcRenderer.invoke('quotes:getRecommendations', requesterId, searchParams),
    getClientCompanies: (requesterId: string, search?: string) =>
      ipcRenderer.invoke('quotes:getClientCompanies', requesterId, search),
  },

  // ========================================
  // 계약서 (Contracts)
  // ========================================
  contracts: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('contracts:getAll', requesterId, filters),
    getById: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('contracts:getById', requesterId, contractId),
    create: (requesterId: string, contractData: any) =>
      ipcRenderer.invoke('contracts:create', requesterId, contractData),
    update: (requesterId: string, contractId: string, contractData: any) =>
      ipcRenderer.invoke('contracts:update', requesterId, contractId, contractData),
    delete: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('contracts:delete', requesterId, contractId),
    updateProgress: (requesterId: string, contractId: string, progress: string, note?: string) =>
      ipcRenderer.invoke('contracts:updateProgress', requesterId, contractId, progress, note),
    // 입금 관리
    addPayment: (requesterId: string, contractId: string, paymentData: any) =>
      ipcRenderer.invoke('contracts:addPayment', requesterId, contractId, paymentData),
    updatePayment: (requesterId: string, paymentId: string, paymentData: any) =>
      ipcRenderer.invoke('contracts:updatePayment', requesterId, paymentId, paymentData),
    deletePayment: (requesterId: string, paymentId: string) =>
      ipcRenderer.invoke('contracts:deletePayment', requesterId, paymentId),
    getPayments: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('contracts:getPayments', requesterId, contractId),
    // 변경 이력
    getHistories: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('contracts:getHistories', requesterId, contractId),
    // 월별 현황
    getMonthlyStats: (requesterId: string, year: number, month?: number) =>
      ipcRenderer.invoke('contracts:getMonthlyStats', requesterId, year, month),
    // 추천 기능
    getRecommendations: (requesterId: string, searchParams: { clientCompany?: string; serviceName?: string }) =>
      ipcRenderer.invoke('contracts:getRecommendations', requesterId, searchParams),
  },

  // ========================================
  // 문서 템플릿 (Document Templates)
  // ========================================
  documentTemplates: {
    getByDepartment: (requesterId: string, departmentId: string) =>
      ipcRenderer.invoke('documentTemplates:getByDepartment', requesterId, departmentId),
    getByCompany: (requesterId: string, companyId: string) =>
      ipcRenderer.invoke('documentTemplates:getByCompany', requesterId, companyId),
    getAccessible: (requesterId: string) =>
      ipcRenderer.invoke('documentTemplates:getAccessible', requesterId),
    create: (requesterId: string, templateData: any) =>
      ipcRenderer.invoke('documentTemplates:create', requesterId, templateData),
    update: (requesterId: string, templateId: string, updates: any) =>
      ipcRenderer.invoke('documentTemplates:update', requesterId, templateId, updates),
    delete: (requesterId: string, templateId: string) =>
      ipcRenderer.invoke('documentTemplates:delete', requesterId, templateId),
  },

  // ========================================
  // 생성 문서 (Generated Documents)
  // ========================================
  documents: {
    generate: (requesterId: string, contractId: string, templateIds: string[]) =>
      ipcRenderer.invoke('documents:generate', requesterId, contractId, templateIds),
    generateWithAI: (requesterId: string, contractId: string, templateIds: string[]) =>
      ipcRenderer.invoke('documents:generateWithAI', requesterId, contractId, templateIds),
    getByContract: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('documents:getByContract', requesterId, contractId),
    getAIContent: (requesterId: string, documentId: string) =>
      ipcRenderer.invoke('documents:getAIContent', requesterId, documentId),
    open: (requesterId: string, documentId: string) =>
      ipcRenderer.invoke('documents:open', requesterId, documentId),
    delete: (requesterId: string, documentId: string) =>
      ipcRenderer.invoke('documents:delete', requesterId, documentId),
    openFolder: (requesterId: string, type: 'templates' | 'generated') =>
      ipcRenderer.invoke('documents:openFolder', requesterId, type),
  },

  // ========================================
  // AI 설정
  // ========================================
  ai: {
    setApiKey: (requesterId: string, apiKey: string) =>
      ipcRenderer.invoke('ai:setApiKey', requesterId, apiKey),
    getApiKeyStatus: (requesterId: string) =>
      ipcRenderer.invoke('ai:getApiKeyStatus', requesterId),
    removeApiKey: (requesterId: string) =>
      ipcRenderer.invoke('ai:removeApiKey', requesterId),
  },
};

// Context Bridge로 안전하게 노출
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript 타입 정의
export type ElectronAPI = typeof electronAPI;
