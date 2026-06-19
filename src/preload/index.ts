import { contextBridge, ipcRenderer } from 'electron';

// Renderer에 노출할 API 정의
const electronAPI = {
  // 창 제어
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

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
    getAll: (requesterId: string, options?: any) =>
      ipcRenderer.invoke('users:getAll', requesterId, options),
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
    importEmployees: (requesterId: string) =>
      ipcRenderer.invoke('users:importEmployees', requesterId),
    generateUsername: (name: string, hireYear: string) =>
      ipcRenderer.invoke('users:generateUsername', name, hireYear),
    getUserCompanies: (requesterId: string, userId: string) =>
      ipcRenderer.invoke('users:getUserCompanies', requesterId, userId),
    getUserDepartments: (requesterId: string, userId: string) =>
      ipcRenderer.invoke('users:getUserDepartments', requesterId, userId),
    setUserCompanies: (requesterId: string, userId: string, companyIds: string[], primaryCompanyId?: string) =>
      ipcRenderer.invoke('users:setUserCompanies', requesterId, userId, companyIds, primaryCompanyId),
    setUserDepartments: (requesterId: string, userId: string, departmentIds: string[], primaryDepartmentId?: string) =>
      ipcRenderer.invoke('users:setUserDepartments', requesterId, userId, departmentIds, primaryDepartmentId),
    updateMenuOrder: (requesterId: string, menuOrder: string[] | null) =>
      ipcRenderer.invoke('users:updateMenuOrder', requesterId, menuOrder),
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
    // 원본 데이터 경로 관리
    getSourceDataPath: () => ipcRenderer.invoke('settings:getSourceDataPath'),
    setSourceDataPath: (requesterId: string, newPath: string) =>
      ipcRenderer.invoke('settings:setSourceDataPath', requesterId, newPath),
    selectSourceDataFolder: () => ipcRenderer.invoke('settings:selectSourceDataFolder'),
    openOriginalFile: (relativePath: string) =>
      ipcRenderer.invoke('settings:openOriginalFile', relativePath),
    getManual: (role: string) =>
      ipcRenderer.invoke('settings:getManual', role),
    // 문서 저장 경로 (네트워크 드라이브)
    getDocumentStoragePath: () => ipcRenderer.invoke('settings:getDocumentStoragePath'),
    setDocumentStoragePath: (requesterId: string, newPath: string) =>
      ipcRenderer.invoke('settings:setDocumentStoragePath', requesterId, newPath),
    selectDocumentStorageFolder: () => ipcRenderer.invoke('settings:selectDocumentStorageFolder'),
    // 구조화 데이터 가져오기
    importStructuredData: (requesterId: string) =>
      ipcRenderer.invoke('settings:importStructuredData', requesterId),
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
    // 금액 변경 이력
    getAmountHistories: (requesterId: string, quoteId: string) =>
      ipcRenderer.invoke('quotes:getAmountHistories', requesterId, quoteId),
    // 견적서 양식 템플릿
    uploadTemplate: (requesterId: string) =>
      ipcRenderer.invoke('quotes:uploadTemplate', requesterId),
    removeTemplate: (requesterId: string) =>
      ipcRenderer.invoke('quotes:removeTemplate', requesterId),
    // 견적서 출력 (AI 기반 문서 생성)
    generateDocument: (requesterId: string, quoteId: string) =>
      ipcRenderer.invoke('quotes:generateDocument', requesterId, quoteId),
    // 견적서 출력 (정부 용역 표준양식 채우기)
    generateGovtDocument: (requesterId: string, quoteId: string) =>
      ipcRenderer.invoke('quotes:generateGovtDocument', requesterId, quoteId),
    // 멤버 관리
    getMembers: (requesterId: string, quoteId: string) =>
      ipcRenderer.invoke('quotes:getMembers', requesterId, quoteId),
    setMembers: (requesterId: string, quoteId: string, members: any[]) =>
      ipcRenderer.invoke('quotes:setMembers', requesterId, quoteId, members),
  },

  // ========================================
  // 대금조건 (Payment Conditions)
  // ========================================
  payments: {
    getByContract: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('payments:getByContract', requesterId, contractId),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('payments:create', requesterId, data),
    update: (requesterId: string, paymentId: string, data: any) =>
      ipcRenderer.invoke('payments:update', requesterId, paymentId, data),
    delete: (requesterId: string, paymentId: string) =>
      ipcRenderer.invoke('payments:delete', requesterId, paymentId),
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
    // 커스텀 이벤트 관리
    addEvent: (requesterId: string, contractId: string, eventData: any) =>
      ipcRenderer.invoke('contracts:addEvent', requesterId, contractId, eventData),
    updateEvent: (requesterId: string, eventId: string, eventData: any) =>
      ipcRenderer.invoke('contracts:updateEvent', requesterId, eventId, eventData),
    deleteEvent: (requesterId: string, eventId: string) =>
      ipcRenderer.invoke('contracts:deleteEvent', requesterId, eventId),
    getEvents: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('contracts:getEvents', requesterId, contractId),
    getAllEvents: (requesterId: string) =>
      ipcRenderer.invoke('contracts:getAllEvents', requesterId),
    // 변경 이력
    getHistories: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('contracts:getHistories', requesterId, contractId),
    getAllHistories: (requesterId: string) =>
      ipcRenderer.invoke('contracts:getAllHistories', requesterId),
    // 월별 현황
    getMonthlyStats: (requesterId: string, year: number, filters?: { company_id?: string }) =>
      ipcRenderer.invoke('contracts:getMonthlyStats', requesterId, year, filters),
    // 추천 기능
    getRecommendations: (requesterId: string, searchParams: { clientCompany?: string; serviceName?: string }) =>
      ipcRenderer.invoke('contracts:getRecommendations', requesterId, searchParams),
    // 멤버 관리
    getMembers: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('contracts:getMembers', requesterId, contractId),
    setMembers: (requesterId: string, contractId: string, members: any[]) =>
      ipcRenderer.invoke('contracts:setMembers', requesterId, contractId, members),
  },

  // ========================================
  // 외주 관리 (Outsourcings)
  // ========================================
  outsourcings: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('outsourcings:getAll', requesterId, filters),
    getById: (requesterId: string, id: string) =>
      ipcRenderer.invoke('outsourcings:getById', requesterId, id),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('outsourcings:create', requesterId, data),
    update: (requesterId: string, id: string, data: any) =>
      ipcRenderer.invoke('outsourcings:update', requesterId, id, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('outsourcings:delete', requesterId, id),
  },

  // ========================================
  // 거래처 관리 (Clients)
  // ========================================
  clients: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('clients:getAll', requesterId, filters),
    getById: (requesterId: string, clientId: string) =>
      ipcRenderer.invoke('clients:getById', requesterId, clientId),
    create: (requesterId: string, clientData: any) =>
      ipcRenderer.invoke('clients:create', requesterId, clientData),
    update: (requesterId: string, clientId: string, clientData: any) =>
      ipcRenderer.invoke('clients:update', requesterId, clientId, clientData),
    delete: (requesterId: string, clientId: string) =>
      ipcRenderer.invoke('clients:delete', requesterId, clientId),
    addContact: (requesterId: string, clientId: string, contactData: any) =>
      ipcRenderer.invoke('clients:addContact', requesterId, clientId, contactData),
    updateContact: (requesterId: string, contactId: string, contactData: any) =>
      ipcRenderer.invoke('clients:updateContact', requesterId, contactId, contactData),
    deleteContact: (requesterId: string, contactId: string) =>
      ipcRenderer.invoke('clients:deleteContact', requesterId, contactId),
    getContracts: (requesterId: string, clientId: string) =>
      ipcRenderer.invoke('clients:getContracts', requesterId, clientId),
  },

  // ========================================
  // 통합검색 (Search)
  // ========================================
  search: {
    global: (requesterId: string, query: string, options?: any) =>
      ipcRenderer.invoke('search:global', requesterId, query, options),
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
    generateHwpx: (requesterId: string, contractId: string, docTypes: string[]) =>
      ipcRenderer.invoke('documents:generateHwpx', requesterId, contractId, docTypes),
    getDocumentTypes: () =>
      ipcRenderer.invoke('documents:getDocumentTypes'),
    getByContract: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('documents:getByContract', requesterId, contractId),
    getAIContent: (requesterId: string, documentId: string) =>
      ipcRenderer.invoke('documents:getAIContent', requesterId, documentId),
    open: (requesterId: string, documentId: string) =>
      ipcRenderer.invoke('documents:open', requesterId, documentId),
    openInExplorer: (requesterId: string, documentId: string) =>
      ipcRenderer.invoke('documents:openInExplorer', requesterId, documentId),
    delete: (requesterId: string, documentId: string) =>
      ipcRenderer.invoke('documents:delete', requesterId, documentId),
    openFolder: (requesterId: string, type: 'templates' | 'generated') =>
      ipcRenderer.invoke('documents:openFolder', requesterId, type),
    fillXlsx: (requesterId: string, sourceId: string, templatePath: string, sourceType?: 'contract' | 'quote') =>
      ipcRenderer.invoke('documents:fillXlsx', requesterId, sourceId, templatePath, sourceType || 'contract'),
    fillDocx: (requesterId: string, sourceId: string, templatePath: string, sourceType?: 'contract' | 'quote') =>
      ipcRenderer.invoke('documents:fillDocx', requesterId, sourceId, templatePath, sourceType || 'contract'),
    fillTemplate: (requesterId: string, sourceId: string, templatePath: string, sourceType?: 'contract' | 'quote') =>
      ipcRenderer.invoke('documents:fillTemplate', requesterId, sourceId, templatePath, sourceType || 'contract'),
  },

  // ========================================
  // 파일 탐색기 & 첨부 문서
  // ========================================
  fileExplorer: {
    getPaths: () => ipcRenderer.invoke('fileExplorer:getPaths'),
    setPaths: (paths: { docsPath?: string; vectorDbPath?: string }) =>
      ipcRenderer.invoke('fileExplorer:setPaths', paths),
    browse: (dirPath?: string, requesterId?: string) => ipcRenderer.invoke('fileExplorer:browse', dirPath, requesterId),
    search: (keyword: string, basePath?: string, requesterId?: string) =>
      ipcRenderer.invoke('fileExplorer:search', keyword, basePath, requesterId),
    openFile: (filePath: string) => ipcRenderer.invoke('fileExplorer:openFile', filePath),
    openFolder: (filePath: string) => ipcRenderer.invoke('fileExplorer:openFolder', filePath),
  },

  attachedDocs: {
    add: (data: {
      parentType: 'quote' | 'contract';
      parentId: string;
      filePath: string;
      category: string;
      description?: string;
      attachedBy: string;
    }) => ipcRenderer.invoke('attachedDocs:add', data),
    getByParent: (parentType: string, parentId: string) =>
      ipcRenderer.invoke('attachedDocs:getByParent', parentType, parentId),
    remove: (requesterId: string, docId: string) =>
      ipcRenderer.invoke('attachedDocs:remove', requesterId, docId),
    updateCategory: (requesterId: string, docId: string, category: string) =>
      ipcRenderer.invoke('attachedDocs:updateCategory', requesterId, docId, category),
    openFile: (requesterId: string, docId: string) =>
      ipcRenderer.invoke('attachedDocs:openFile', requesterId, docId),
  },

  // ========================================
  // HWPX 양식 템플릿 관리
  // ========================================
  hwpxTemplates: {
    list: (requesterId: string) =>
      ipcRenderer.invoke('hwpxTemplates:list', requesterId),
    add: (requesterId: string, templateData: { name: string; doc_type: string; description?: string }) =>
      ipcRenderer.invoke('hwpxTemplates:add', requesterId, templateData),
    replaceFile: (requesterId: string, templateId: string) =>
      ipcRenderer.invoke('hwpxTemplates:replaceFile', requesterId, templateId),
    update: (requesterId: string, templateId: string, updates: { name?: string; description?: string; doc_type?: string }) =>
      ipcRenderer.invoke('hwpxTemplates:update', requesterId, templateId, updates),
    delete: (requesterId: string, templateId: string) =>
      ipcRenderer.invoke('hwpxTemplates:delete', requesterId, templateId),
  },

  // ========================================
  // 메신저 (Messenger)
  // ========================================
  messenger: {
    getConversations: (requesterId: string) =>
      ipcRenderer.invoke('messenger:getConversations', requesterId),
    createConversation: (requesterId: string, data: { participants: string[]; title?: string; type?: 'direct' | 'group' }) =>
      ipcRenderer.invoke('messenger:createConversation', requesterId, data),
    getMessages: (requesterId: string, conversationId: string) =>
      ipcRenderer.invoke('messenger:getMessages', requesterId, conversationId),
    sendMessage: (requesterId: string, data: { conversation_id: string; content: string; type?: 'text' | 'system' }) =>
      ipcRenderer.invoke('messenger:sendMessage', requesterId, data),
    deleteMessage: (requesterId: string, messageId: string) =>
      ipcRenderer.invoke('messenger:deleteMessage', requesterId, messageId),
    markAsRead: (requesterId: string, conversationId: string) =>
      ipcRenderer.invoke('messenger:markAsRead', requesterId, conversationId),
    pollUpdates: (requesterId: string) =>
      ipcRenderer.invoke('messenger:pollUpdates', requesterId),
    getUsers: (requesterId: string) =>
      ipcRenderer.invoke('messenger:getUsers', requesterId),
    leaveConversation: (requesterId: string, conversationId: string) =>
      ipcRenderer.invoke('messenger:leaveConversation', requesterId, conversationId),
    renameConversation: (requesterId: string, conversationId: string, newTitle: string) =>
      ipcRenderer.invoke('messenger:renameConversation', requesterId, conversationId, newTitle),
    addParticipants: (requesterId: string, conversationId: string, newUserIds: string[]) =>
      ipcRenderer.invoke('messenger:addParticipants', requesterId, conversationId, newUserIds),
    // Realtime 이벤트 리스너
    onNewMessage: (callback: (message: any) => void) => {
      const handler = (_event: any, message: any) => callback(message);
      ipcRenderer.on('messenger:newMessage', handler);
      return () => ipcRenderer.removeListener('messenger:newMessage', handler);
    },
    onConversationUpdated: (callback: (conversation: any) => void) => {
      const handler = (_event: any, conversation: any) => callback(conversation);
      ipcRenderer.on('messenger:conversationUpdated', handler);
      return () => ipcRenderer.removeListener('messenger:conversationUpdated', handler);
    },
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

  // ========================================
  // AI 검색 (ChromaDB + OpenAI RAG)
  // ========================================
  aiSearch: {
    search: (requesterId: string, query: string, options?: any) =>
      ipcRenderer.invoke('aiSearch:search', requesterId, query, options),
    askAI: (requesterId: string, query: string, searchResults: any[]) =>
      ipcRenderer.invoke('aiSearch:askAI', requesterId, query, searchResults),
    getSettings: (requesterId: string) =>
      ipcRenderer.invoke('aiSearch:getSettings', requesterId),
    saveSettings: (requesterId: string, settings: any) =>
      ipcRenderer.invoke('aiSearch:saveSettings', requesterId, settings),
    getStatus: () => ipcRenderer.invoke('aiSearch:getStatus'),
  },

  // ========================================
  // 회의실 예약 (Meeting Reservations)
  // ========================================
  meeting: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('meeting:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('meeting:create', requesterId, data),
    update: (requesterId: string, reservationId: string, data: any) =>
      ipcRenderer.invoke('meeting:update', requesterId, reservationId, data),
    delete: (requesterId: string, reservationId: string) =>
      ipcRenderer.invoke('meeting:delete', requesterId, reservationId),
  },

  // ========================================
  // 계약 세부작업 (Contract Subtasks)
  // ========================================
  subtasks: {
    getByContract: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('subtasks:getByContract', requesterId, contractId),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('subtasks:create', requesterId, data),
    update: (requesterId: string, subtaskId: string, data: any) =>
      ipcRenderer.invoke('subtasks:update', requesterId, subtaskId, data),
    delete: (requesterId: string, subtaskId: string) =>
      ipcRenderer.invoke('subtasks:delete', requesterId, subtaskId),
    reorder: (requesterId: string, contractId: string, items: any[]) =>
      ipcRenderer.invoke('subtasks:reorder', requesterId, contractId, items),
  },

  // ========================================
  // 알림 (Notifications)
  // ========================================
  notifications: {
    getAll: (requesterId: string) =>
      ipcRenderer.invoke('notifications:getAll', requesterId),
    getUnreadCount: (requesterId: string) =>
      ipcRenderer.invoke('notifications:getUnreadCount', requesterId),
    markRead: (requesterId: string, notificationId: string) =>
      ipcRenderer.invoke('notifications:markRead', requesterId, notificationId),
    markAllRead: (requesterId: string) =>
      ipcRenderer.invoke('notifications:markAllRead', requesterId),
  },

  // ========================================
  // 이메일 (Email)
  // ========================================
  email: {
    sendQuote: (requesterId: string, data: any) => ipcRenderer.invoke('email:sendQuote', requesterId, data),
    testConnection: (config: any) => ipcRenderer.invoke('email:testConnection', config),
    getConfig: (requesterId: string) => ipcRenderer.invoke('email:getConfig', requesterId),
    saveConfig: (requesterId: string, config: any) => ipcRenderer.invoke('email:saveConfig', requesterId, config),
    requestApproval: (requesterId: string, data: any) => ipcRenderer.invoke('email:requestApproval', requesterId, data),
    getApprovals: (requesterId: string, filters?: any) => ipcRenderer.invoke('email:getApprovals', requesterId, filters),
    processApproval: (requesterId: string, approvalId: string, action: 'approved' | 'rejected', reason?: string) =>
      ipcRenderer.invoke('email:processApproval', requesterId, approvalId, action, reason),
  },

  // ========================================
  // PDF 생성
  // ========================================
  pdf: {
    generateQuote: (requesterId: string, quoteId: string) =>
      ipcRenderer.invoke('pdf:generateQuote', requesterId, quoteId),
    generateContract: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('pdf:generateContract', requesterId, contractId),
    open: (filePath: string) =>
      ipcRenderer.invoke('pdf:open', filePath),
    saveAs: (sourcePath: string, defaultName: string) =>
      ipcRenderer.invoke('pdf:saveAs', sourcePath, defaultName),
    searchContacts: (requesterId: string, clientName: string) =>
      ipcRenderer.invoke('pdf:searchContacts', requesterId, clientName),
    previewQuote: (requesterId: string, quoteId: string) =>
      ipcRenderer.invoke('pdf:previewQuote', requesterId, quoteId),
    previewContract: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('pdf:previewContract', requesterId, contractId),
  },

  // ========================================
  // Quote Sections (견적서 계층 구조)
  // ========================================
  quoteSections: {
    getByQuote: (requesterId: string, quoteId: string) =>
      ipcRenderer.invoke('quoteSections:getByQuote', requesterId, quoteId),
    saveAll: (requesterId: string, quoteId: string, sections: any[]) =>
      ipcRenderer.invoke('quoteSections:saveAll', requesterId, quoteId, sections),
    add: (requesterId: string, data: any) =>
      ipcRenderer.invoke('quoteSections:add', requesterId, data),
    update: (requesterId: string, sectionId: string, data: any) =>
      ipcRenderer.invoke('quoteSections:update', requesterId, sectionId, data),
    delete: (requesterId: string, sectionId: string) =>
      ipcRenderer.invoke('quoteSections:delete', requesterId, sectionId),
  },

  // ========================================
  // Quote Preset Sections (견적 사전 항목 분류)
  // ========================================
  quotePresetSections: {
    getByCompany: (requesterId: string, companyId: string) =>
      ipcRenderer.invoke('quotePresetSections:getByCompany', requesterId, companyId),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('quotePresetSections:create', requesterId, data),
    update: (requesterId: string, sectionId: string, data: any) =>
      ipcRenderer.invoke('quotePresetSections:update', requesterId, sectionId, data),
    delete: (requesterId: string, sectionId: string) =>
      ipcRenderer.invoke('quotePresetSections:delete', requesterId, sectionId),
  },

  // ========================================
  // OCR (외부 문서 인식)
  // ========================================
  ocr: {
    processImage: (requesterId: string, filePath: string, docType: string) =>
      ipcRenderer.invoke('ocr:processImage', requesterId, filePath, docType),
    getConfig: (requesterId: string) => ipcRenderer.invoke('ocr:getConfig', requesterId),
    saveConfig: (requesterId: string, config: any) => ipcRenderer.invoke('ocr:saveConfig', requesterId, config),
  },

  // ========================================
  // 자동 업데이트 (Auto Updater)
  // ========================================
  updater: {
    configure: (accessToken: string) => ipcRenderer.invoke('update:configure', accessToken),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    checkForceUpdate: () => ipcRenderer.invoke('update:checkForceUpdate'),
    setMinVersion: (version: string) => ipcRenderer.invoke('update:setMinVersion', version),
    getMinVersion: () => ipcRenderer.invoke('update:getMinVersion'),
    onUpdateAvailable: (callback: any) => {
      const handler = (_e: any, info: any) => callback(info);
      ipcRenderer.on('update-available', handler);
      return () => ipcRenderer.removeListener('update-available', handler);
    },
    onDownloadProgress: (callback: any) => {
      const handler = (_e: any, progress: any) => callback(progress);
      ipcRenderer.on('update-download-progress', handler);
      return () => ipcRenderer.removeListener('update-download-progress', handler);
    },
    onUpdateDownloaded: (callback: any) => {
      const handler = () => callback();
      ipcRenderer.on('update-downloaded', handler);
      return () => ipcRenderer.removeListener('update-downloaded', handler);
    },
  },

  // ========================================
  // 증명서 발급 (Certificates)
  // ========================================
  certificates: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('certificates:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('certificates:create', requesterId, data),
    approve: (requesterId: string, certificateId: string) =>
      ipcRenderer.invoke('certificates:approve', requesterId, certificateId),
    reject: (requesterId: string, certificateId: string, reason?: string) =>
      ipcRenderer.invoke('certificates:reject', requesterId, certificateId, reason),
    generate: (requesterId: string, certificateId: string) =>
      ipcRenderer.invoke('certificates:generate', requesterId, certificateId),
    download: (requesterId: string, certificateId: string) =>
      ipcRenderer.invoke('certificates:download', requesterId, certificateId),
  },

  // ========================================
  // 증명서 종류 관리 (Certificate Types)
  // ========================================
  certificateTypes: {
    getAll: (requesterId: string) =>
      ipcRenderer.invoke('certificateTypes:getAll', requesterId),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('certificateTypes:create', requesterId, data),
    update: (requesterId: string, typeId: string, data: any) =>
      ipcRenderer.invoke('certificateTypes:update', requesterId, typeId, data),
    delete: (requesterId: string, typeId: string) =>
      ipcRenderer.invoke('certificateTypes:delete', requesterId, typeId),
    uploadTemplate: (requesterId: string, typeId: string) =>
      ipcRenderer.invoke('certificateTypes:uploadTemplate', requesterId, typeId),
    removeTemplate: (requesterId: string, typeId: string) =>
      ipcRenderer.invoke('certificateTypes:removeTemplate', requesterId, typeId),
  },

  // ========================================
  // 폴더 스캔 (Folder Scan)
  // ========================================
  folderScan: {
    scanFolder: (docType: 'quote' | 'contract') =>
      ipcRenderer.invoke('folderScan:scanFolder', docType),
  },

  // ========================================
  // 엑셀 내보내기 (Export)
  // ========================================
  export: {
    quotes: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('export:quotes', requesterId, filters),
    contracts: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('export:contracts', requesterId, filters),
    projects: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('export:projects', requesterId, filters),
    financeGeneric: (requesterId: string, sheetName: string, columns: any[], data: any[]) =>
      ipcRenderer.invoke('export:financeGeneric', requesterId, sheetName, columns, data),
  },

  // ========================================
  // 견적-계약 연결 (Linking)
  // ========================================
  linking: {
    linkQuoteToContract: (requesterId: string, quoteId: string, contractId: string) =>
      ipcRenderer.invoke('linking:linkQuoteToContract', requesterId, quoteId, contractId),
    unlinkQuoteFromContract: (requesterId: string, quoteId: string, contractId: string) =>
      ipcRenderer.invoke('linking:unlinkQuoteFromContract', requesterId, quoteId, contractId),
    searchQuotes: (requesterId: string, search: string) =>
      ipcRenderer.invoke('linking:searchQuotes', requesterId, search),
    searchContracts: (requesterId: string, search: string) =>
      ipcRenderer.invoke('linking:searchContracts', requesterId, search),
    getLinkedContract: (requesterId: string, quoteId: string) =>
      ipcRenderer.invoke('linking:getLinkedContract', requesterId, quoteId),
    getLinkedQuote: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('linking:getLinkedQuote', requesterId, contractId),
  },

  // ========================================
  // 연차/휴가 (Leave)
  // ========================================
  leave: {
    getMyRequests: (requesterId: string) =>
      ipcRenderer.invoke('leave:getMyRequests', requesterId),
    getAllRequests: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('leave:getAllRequests', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('leave:create', requesterId, data),
    approve: (requesterId: string, leaveId: string) =>
      ipcRenderer.invoke('leave:approve', requesterId, leaveId),
    reject: (requesterId: string, leaveId: string, reason?: string) =>
      ipcRenderer.invoke('leave:reject', requesterId, leaveId, reason),
    cancel: (requesterId: string, leaveId: string) =>
      ipcRenderer.invoke('leave:cancel', requesterId, leaveId),
    calculateAnnual: (userId: string) =>
      ipcRenderer.invoke('leave:calculateAnnual', userId),
  },

  // ========================================
  // Menu Manuals (메뉴별 매뉴얼)
  // ========================================
  menuManuals: {
    getAll: (requesterId: string, companyId: string) =>
      ipcRenderer.invoke('menuManuals:getAll', requesterId, companyId),
    get: (requesterId: string, companyId: string, menuKey: string) =>
      ipcRenderer.invoke('menuManuals:get', requesterId, companyId, menuKey),
    save: (requesterId: string, data: any) =>
      ipcRenderer.invoke('menuManuals:save', requesterId, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('menuManuals:delete', requesterId, id),
  },

  // ========================================
  // 미수금관리 (Receivables)
  // ========================================
  receivables: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('receivables:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('receivables:create', requesterId, data),
    update: (requesterId: string, id: string, data: any) =>
      ipcRenderer.invoke('receivables:update', requesterId, id, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('receivables:delete', requesterId, id),
    syncFromContracts: (requesterId: string, companyId?: string) =>
      ipcRenderer.invoke('receivables:syncFromContracts', requesterId, companyId),
  },

  // ========================================
  // 청구/입금관리 (Billings & Payment Receipts)
  // ========================================
  billings: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('billings:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('billings:create', requesterId, data),
    update: (requesterId: string, id: string, data: any) =>
      ipcRenderer.invoke('billings:update', requesterId, id, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('billings:delete', requesterId, id),
  },

  paymentReceipts: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('paymentReceipts:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('paymentReceipts:create', requesterId, data),
  },

  // ========================================
  // 미지급금관리 (Payables)
  // ========================================
  payables: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('payables:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('payables:create', requesterId, data),
    update: (requesterId: string, id: string, data: any) =>
      ipcRenderer.invoke('payables:update', requesterId, id, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('payables:delete', requesterId, id),
    syncFromOutsourcings: (requesterId: string, companyId?: string) =>
      ipcRenderer.invoke('payables:syncFromOutsourcings', requesterId, companyId),
  },

  // ========================================
  // 보증금관리 (Deposits)
  // ========================================
  deposits: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('deposits:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('deposits:create', requesterId, data),
    update: (requesterId: string, id: string, data: any) =>
      ipcRenderer.invoke('deposits:update', requesterId, id, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('deposits:delete', requesterId, id),
  },

  // ========================================
  // 세금계산서관리 (Tax Invoices)
  // ========================================
  taxInvoices: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('taxInvoices:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('taxInvoices:create', requesterId, data),
    update: (requesterId: string, id: string, data: any) =>
      ipcRenderer.invoke('taxInvoices:update', requesterId, id, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('taxInvoices:delete', requesterId, id),
  },

  // ========================================
  // 계약 회의록/기타자료 (Contract Meeting Notes)
  // ========================================
  contractMeetingNotes: {
    getByContract: (requesterId: string, contractId: string) =>
      ipcRenderer.invoke('contractMeetingNotes:getByContract', requesterId, contractId),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('contractMeetingNotes:create', requesterId, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('contractMeetingNotes:delete', requesterId, id),
  },

  // ========================================
  // 경비정산 (Expense Settlements)
  // ========================================
  expenses: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('expenses:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('expenses:create', requesterId, data),
    update: (requesterId: string, id: string, data: any) =>
      ipcRenderer.invoke('expenses:update', requesterId, id, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('expenses:delete', requesterId, id),
    getItems: (requesterId: string, settlementId: string) =>
      ipcRenderer.invoke('expenses:getItems', requesterId, settlementId),
    approve: (requesterId: string, id: string) =>
      ipcRenderer.invoke('expenses:approve', requesterId, id),
    reject: (requesterId: string, id: string, reason?: string) =>
      ipcRenderer.invoke('expenses:reject', requesterId, id, reason),
  },

  // ========================================
  // 직원 월급 (super_admin 전용)
  // ========================================
  userSalary: {
    get: (requesterId: string, userId: string) => ipcRenderer.invoke('userSalary:get', requesterId, userId),
    getAll: (requesterId: string) => ipcRenderer.invoke('userSalary:getAll', requesterId),
    set: (requesterId: string, userId: string, monthlySalary: number, notes?: string) =>
      ipcRenderer.invoke('userSalary:set', requesterId, userId, monthlySalary, notes),
    delete: (requesterId: string, userId: string) => ipcRenderer.invoke('userSalary:delete', requesterId, userId),
  },

  // ========================================
  // 양식 보관소
  // ========================================
  templates: {
    list: () => ipcRenderer.invoke('templates:list'),
    upload: (requesterId: string, category: string, filename: string, bytes: number[]) =>
      ipcRenderer.invoke('templates:upload', requesterId, category, filename, bytes),
    download: (requesterId: string, fullPath: string) =>
      ipcRenderer.invoke('templates:download', requesterId, fullPath),
    delete: (requesterId: string, fullPath: string) =>
      ipcRenderer.invoke('templates:delete', requesterId, fullPath),
  },

  // ========================================
  // 순이익 대시보드
  // ========================================
  profitDashboard: {
    getData: (requesterId: string, filters: any) =>
      ipcRenderer.invoke('profit:getData', requesterId, filters),
    setOverhead: (requesterId: string, year: number, month: number, amount: number) =>
      ipcRenderer.invoke('profit:setOverhead', requesterId, year, month, amount),
    getOverhead: (requesterId: string, year: number) =>
      ipcRenderer.invoke('profit:getOverhead', requesterId, year),
  },

  // ========================================
  // 지출결의서 (Expense Requests)
  // ========================================
  expenseRequests: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('expenseRequests:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('expenseRequests:create', requesterId, data),
    approve: (requesterId: string, id: string) =>
      ipcRenderer.invoke('expenseRequests:approve', requesterId, id),
    reject: (requesterId: string, id: string, reason?: string) =>
      ipcRenderer.invoke('expenseRequests:reject', requesterId, id, reason),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('expenseRequests:delete', requesterId, id),
  },

  // ========================================
  // 차량관리 (Vehicles)
  // ========================================
  vehicles: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('vehicles:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('vehicles:create', requesterId, data),
    update: (requesterId: string, id: string, data: any) =>
      ipcRenderer.invoke('vehicles:update', requesterId, id, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('vehicles:delete', requesterId, id),
  },

  // ========================================
  // 공간관리 (Spaces)
  // ========================================
  spaces: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('spaces:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('spaces:create', requesterId, data),
    update: (requesterId: string, id: string, data: any) =>
      ipcRenderer.invoke('spaces:update', requesterId, id, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('spaces:delete', requesterId, id),
  },

  // ========================================
  // 운행일지 (Vehicle Logs)
  // ========================================
  vehicleLogs: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('vehicleLogs:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('vehicleLogs:create', requesterId, data),
    update: (requesterId: string, id: string, data: any) =>
      ipcRenderer.invoke('vehicleLogs:update', requesterId, id, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('vehicleLogs:delete', requesterId, id),
  },

  // ========================================
  // 가수금관리 (Provisional Payments)
  // ========================================
  provisional: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('provisional:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('provisional:create', requesterId, data),
    update: (requesterId: string, id: string, data: any) =>
      ipcRenderer.invoke('provisional:update', requesterId, id, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('provisional:delete', requesterId, id),
    match: (requesterId: string, id: string, matchData: any) =>
      ipcRenderer.invoke('provisional:match', requesterId, id, matchData),
    aiSuggest: (requesterId: string, id: string) =>
      ipcRenderer.invoke('provisional:aiSuggest', requesterId, id),
  },

  // ========================================
  // 월별입금현황 (Monthly Deposits)
  // ========================================
  monthlyDeposits: {
    getAll: (requesterId: string, filters?: any) =>
      ipcRenderer.invoke('monthlyDeposits:getAll', requesterId, filters),
    create: (requesterId: string, data: any) =>
      ipcRenderer.invoke('monthlyDeposits:create', requesterId, data),
    update: (requesterId: string, id: string, data: any) =>
      ipcRenderer.invoke('monthlyDeposits:update', requesterId, id, data),
    delete: (requesterId: string, id: string) =>
      ipcRenderer.invoke('monthlyDeposits:delete', requesterId, id),
  },

  // ========================================
  // 거래처 재무정보 (Client Company Financials)
  // ========================================
  clientFinancials: {
    get: (requesterId: string, clientCompanyId: string) =>
      ipcRenderer.invoke('clientFinancials:get', requesterId, clientCompanyId),
    getByCompany: (requesterId: string, companyId?: string) =>
      ipcRenderer.invoke('clientFinancials:getByCompany', requesterId, companyId),
    upsert: (requesterId: string, data: any) =>
      ipcRenderer.invoke('clientFinancials:upsert', requesterId, data),
  },

  // 원장님 보고서 (경영관리실 양식)
  reports: {
    getDirectorReportData: (requesterId: string, params: { companyId: string; year: number }) =>
      ipcRenderer.invoke('reports:getDirectorReportData', requesterId, params),
    generateDirectorReport: (requesterId: string, params: { companyId: string; year: number }) =>
      ipcRenderer.invoke('reports:generateDirectorReport', requesterId, params),
  },
};

// Context Bridge로 안전하게 노출
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript 타입 정의
export type ElectronAPI = typeof electronAPI;
