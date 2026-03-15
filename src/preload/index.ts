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
    importEmployees: (requesterId: string) =>
      ipcRenderer.invoke('users:importEmployees', requesterId),
    generateUsername: (name: string, hireYear: string) =>
      ipcRenderer.invoke('users:generateUsername', name, hireYear),
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
    getMonthlyStats: (requesterId: string, year: number, month?: number) =>
      ipcRenderer.invoke('contracts:getMonthlyStats', requesterId, year, month),
    // 추천 기능
    getRecommendations: (requesterId: string, searchParams: { clientCompany?: string; serviceName?: string }) =>
      ipcRenderer.invoke('contracts:getRecommendations', requesterId, searchParams),
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
    remove: (docId: string) => ipcRenderer.invoke('attachedDocs:remove', docId),
    updateCategory: (docId: string, category: string) =>
      ipcRenderer.invoke('attachedDocs:updateCategory', docId, category),
    openFile: (docId: string) => ipcRenderer.invoke('attachedDocs:openFile', docId),
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
};

// Context Bridge로 안전하게 노출
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript 타입 정의
export type ElectronAPI = typeof electronAPI;
