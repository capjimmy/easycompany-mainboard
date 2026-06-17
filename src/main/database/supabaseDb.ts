import { supabase } from './supabaseClient';

// Supabase REST API의 1000건 제한을 우회하는 페이징 헬퍼
async function fetchAllPaged(table: string, applyFilter?: (q: any) => any): Promise<any[]> {
  const all: any[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select('*').range(from, from + 999);
    if (applyFilter) q = applyFilter(q);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

export const db = {
  // ========== Users ==========
  getUsers: async () => {
    return await fetchAllPaged('users');
  },
  setUsers: async (_users: any[]) => {
    /* no-op for Supabase compatibility */
  },
  getUserById: async (id: string) => {
    const { data } = await supabase.from('users').select('*').eq('id', id).single();
    return data;
  },
  getUserByUsername: async (username: string) => {
    const { data } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
    return data;
  },
  addUser: async (user: any) => {
    const { data, error } = await supabase.from('users').insert(user).select().single();
    if (error) throw error;
    return data;
  },
  updateUser: async (id: string, updates: any) => {
    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  deleteUser: async (id: string) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
  },

  // ========== Companies ==========
  getCompanies: async () => {
    const { data } = await supabase.from('companies').select('*');
    return data || [];
  },
  setCompanies: async (_companies: any[]) => {
    /* no-op for Supabase compatibility */
  },
  getCompanyById: async (id: string) => {
    const { data } = await supabase.from('companies').select('*').eq('id', id).single();
    return data;
  },
  addCompany: async (company: any) => {
    const { data, error } = await supabase.from('companies').insert(company).select().single();
    if (error) throw error;
    return data;
  },
  updateCompany: async (id: string, updates: any) => {
    const { data } = await supabase.from('companies').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteCompany: async (id: string) => {
    await supabase.from('companies').delete().eq('id', id);
  },

  // ========== Departments ==========
  getDepartments: async () => {
    const { data } = await supabase.from('departments').select('*');
    return data || [];
  },
  setDepartments: async (_d: any[]) => {
    /* no-op for Supabase compatibility */
  },
  getDepartmentById: async (id: string) => {
    const { data } = await supabase.from('departments').select('*').eq('id', id).single();
    return data;
  },
  getDepartmentsByCompanyId: async (companyId: string) => {
    const { data } = await supabase.from('departments').select('*').eq('company_id', companyId);
    return data || [];
  },
  addDepartment: async (department: any) => {
    const { data, error } = await supabase.from('departments').insert(department).select().single();
    if (error) throw error;
    return data;
  },
  updateDepartment: async (id: string, updates: any) => {
    const { data } = await supabase.from('departments').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteDepartment: async (id: string) => {
    await supabase.from('departments').delete().eq('id', id);
  },

  // ========== Menu Permissions ==========
  getMenuPermissions: async () => {
    const { data } = await supabase.from('menu_permissions').select('*');
    return data || [];
  },
  setMenuPermissions: async (_p: any[]) => {
    /* no-op for Supabase compatibility */
  },
  getPermissionsByUserId: async (userId: string) => {
    const { data } = await supabase.from('menu_permissions').select('*').eq('user_id', userId);
    return data || [];
  },
  // 모든 사용자의 권한을 한 번에 가져옴 (N+1 방지)
  getAllPermissions: async () => {
    return await fetchAllPaged('menu_permissions');
  },
  deletePermissionsByUserId: async (userId: string) => {
    await supabase.from('menu_permissions').delete().eq('user_id', userId);
  },
  addMenuPermission: async (permission: any) => {
    const { data, error } = await supabase.from('menu_permissions').insert(permission).select().single();
    if (error) throw error;
    return data;
  },

  // ========== Menu Manuals ==========
  getMenuManuals: async (companyId: string) => {
    const { data } = await supabase.from('menu_manuals').select('*').eq('company_id', companyId);
    return data || [];
  },
  getMenuManual: async (companyId: string, menuKey: string) => {
    const { data } = await supabase.from('menu_manuals').select('*')
      .eq('company_id', companyId).eq('menu_key', menuKey).maybeSingle();
    return data;
  },
  upsertMenuManual: async (manual: any) => {
    const { data, error } = await supabase.from('menu_manuals')
      .upsert(manual, { onConflict: 'company_id,menu_key' }).select().single();
    if (error) throw error;
    return data;
  },
  deleteMenuManual: async (id: string) => {
    await supabase.from('menu_manuals').delete().eq('id', id);
  },

  // ========== Settings (key-value table) ==========
  getSettings: async () => {
    const { data } = await supabase.from('settings').select('*');
    const result: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      result[row.key] = row.value;
    });
    return result;
  },
  getSetting: async (key: string) => {
    const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
    return data?.value ?? undefined;
  },
  setSetting: async (key: string, value: any) => {
    await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
  },

  // ========== Labor Grades ==========
  getLaborGrades: async () => {
    const { data } = await supabase.from('labor_grades').select('*');
    return data || [];
  },
  getLaborGradesByCompanyId: async (companyId: string) => {
    const { data } = await supabase
      .from('labor_grades')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true);
    return data || [];
  },
  getLaborGradeById: async (id: string) => {
    const { data } = await supabase.from('labor_grades').select('*').eq('id', id).single();
    return data;
  },
  addLaborGrade: async (grade: any) => {
    const { data, error } = await supabase.from('labor_grades').insert(grade).select().single();
    if (error) throw error;
    return data;
  },
  updateLaborGrade: async (id: string, updates: any) => {
    const { data } = await supabase.from('labor_grades').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteLaborGrade: async (id: string) => {
    await supabase.from('labor_grades').update({ is_active: false }).eq('id', id);
  },

  // ========== Expense Categories ==========
  getExpenseCategories: async () => {
    const { data } = await supabase.from('expense_categories').select('*');
    return data || [];
  },
  getExpenseCategoriesByCompanyId: async (companyId: string) => {
    const { data } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true);
    return data || [];
  },
  getExpenseCategoryById: async (id: string) => {
    const { data } = await supabase.from('expense_categories').select('*').eq('id', id).single();
    return data;
  },
  addExpenseCategory: async (category: any) => {
    const { data, error } = await supabase.from('expense_categories').insert(category).select().single();
    if (error) throw error;
    return data;
  },
  updateExpenseCategory: async (id: string, updates: any) => {
    const { data } = await supabase.from('expense_categories').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteExpenseCategory: async (id: string) => {
    await supabase.from('expense_categories').update({ is_active: false }).eq('id', id);
  },

  // ========== Quotes ==========
  getQuotes: async () => {
    const all: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
    return all;
  },
  getQuotesByCompanyId: async (companyId: string) => {
    const all: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from('quotes')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
    return all;
  },
  getQuoteById: async (id: string) => {
    const { data } = await supabase.from('quotes').select('*').eq('id', id).single();
    return data;
  },
  addQuote: async (quote: any) => {
    const { data, error } = await supabase.from('quotes').insert(quote).select().single();
    if (error) throw error;
    return data;
  },
  updateQuote: async (id: string, updates: any) => {
    const { data } = await supabase.from('quotes').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteQuote: async (id: string) => {
    // FK ON DELETE CASCADE handles labor/expense items
    await supabase.from('quotes').delete().eq('id', id);
  },

  // ========== Quote Labor Items ==========
  getQuoteLaborItems: async () => {
    const { data } = await supabase.from('quote_labor_items').select('*');
    return data || [];
  },
  getQuoteLaborItemsByQuoteId: async (quoteId: string) => {
    const { data } = await supabase.from('quote_labor_items').select('*').eq('quote_id', quoteId);
    return data || [];
  },
  addQuoteLaborItem: async (item: any) => {
    const { data, error } = await supabase.from('quote_labor_items').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  updateQuoteLaborItem: async (id: string, updates: any) => {
    const { data } = await supabase.from('quote_labor_items').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteQuoteLaborItem: async (id: string) => {
    await supabase.from('quote_labor_items').delete().eq('id', id);
  },
  deleteQuoteLaborItemsByQuoteId: async (quoteId: string) => {
    await supabase.from('quote_labor_items').delete().eq('quote_id', quoteId);
  },

  // ========== Quote Expense Items ==========
  getQuoteExpenseItems: async () => {
    const { data } = await supabase.from('quote_expense_items').select('*');
    return data || [];
  },
  getQuoteExpenseItemsByQuoteId: async (quoteId: string) => {
    const { data } = await supabase.from('quote_expense_items').select('*').eq('quote_id', quoteId);
    return data || [];
  },
  addQuoteExpenseItem: async (item: any) => {
    const { data, error } = await supabase.from('quote_expense_items').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  updateQuoteExpenseItem: async (id: string, updates: any) => {
    const { data } = await supabase.from('quote_expense_items').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteQuoteExpenseItem: async (id: string) => {
    await supabase.from('quote_expense_items').delete().eq('id', id);
  },
  deleteQuoteExpenseItemsByQuoteId: async (quoteId: string) => {
    await supabase.from('quote_expense_items').delete().eq('quote_id', quoteId);
  },

  // ========== Contracts ==========
  getContracts: async () => {
    const all: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
    return all;
  },
  getContractsByCompanyId: async (companyId: string) => {
    const all: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from('contracts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
    return all;
  },
  getContractById: async (id: string) => {
    const { data } = await supabase.from('contracts').select('*').eq('id', id).single();
    return data;
  },
  addContract: async (contract: any) => {
    const { data, error } = await supabase.from('contracts').insert(contract).select().single();
    if (error) throw error;
    return data;
  },
  updateContract: async (id: string, updates: any) => {
    const { data } = await supabase.from('contracts').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteContract: async (id: string) => {
    // FK ON DELETE CASCADE handles histories, payments, events
    await supabase.from('contracts').delete().eq('id', id);
  },

  // ========== Contract Histories ==========
  getContractHistories: async () => {
    const { data } = await supabase.from('contract_histories').select('*');
    return data || [];
  },
  getContractHistoriesByContractId: async (contractId: string) => {
    const { data } = await supabase
      .from('contract_histories')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false });
    return data || [];
  },
  addContractHistory: async (history: any) => {
    const { data, error } = await supabase.from('contract_histories').insert(history).select().single();
    if (error) throw error;
    return data;
  },

  // ========== Contract Payments ==========
  getContractPayments: async () => {
    const { data } = await supabase.from('contract_payments').select('*');
    return data || [];
  },
  getContractPaymentsByContractId: async (contractId: string) => {
    const { data } = await supabase
      .from('contract_payments')
      .select('*')
      .eq('contract_id', contractId)
      .order('payment_date', { ascending: false });
    return data || [];
  },
  addContractPayment: async (payment: any) => {
    const { data, error } = await supabase.from('contract_payments').insert(payment).select().single();
    if (error) throw error;
    return data;
  },
  updateContractPayment: async (id: string, updates: any) => {
    const { data } = await supabase.from('contract_payments').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteContractPayment: async (id: string) => {
    await supabase.from('contract_payments').delete().eq('id', id);
  },

  // ========== Contract Events ==========
  getContractEvents: async () => {
    const { data } = await supabase.from('contract_events').select('*');
    return data || [];
  },
  getContractEventsByContractId: async (contractId: string) => {
    const { data } = await supabase.from('contract_events').select('*').eq('contract_id', contractId);
    return data || [];
  },
  addContractEvent: async (event: any) => {
    const { data, error } = await supabase.from('contract_events').insert(event).select().single();
    if (error) throw error;
    return data;
  },
  updateContractEvent: async (id: string, updates: any) => {
    const { data } = await supabase.from('contract_events').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteContractEvent: async (id: string) => {
    await supabase.from('contract_events').delete().eq('id', id);
  },

  // ========== Sequences ==========
  getNextSequence: async (companyId: string, type: 'quote' | 'contract') => {
    const key = `${companyId}_${type}`;
    const { data } = await supabase.rpc('next_sequence', { seq_key: key });
    return data as number;
  },
  generateQuoteNumber: async (companyId: string, prefix: string = 'Q') => {
    const seq = await db.getNextSequence(companyId, 'quote');
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${seq.toString().padStart(4, '0')}`;
  },
  generateContractNumber: async (companyId: string, prefix: string = 'C') => {
    const seq = await db.getNextSequence(companyId, 'contract');
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${seq.toString().padStart(4, '0')}`;
  },

  // ========== Document Templates ==========
  getDocumentTemplates: async () => {
    const { data } = await supabase.from('document_templates').select('*');
    return data || [];
  },
  getDocumentTemplatesByDepartmentId: async (departmentId: string) => {
    const { data } = await supabase
      .from('document_templates')
      .select('*')
      .eq('department_id', departmentId)
      .eq('is_active', true);
    return data || [];
  },
  getDocumentTemplatesByCompanyId: async (companyId: string) => {
    const { data } = await supabase
      .from('document_templates')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true);
    return data || [];
  },
  getDocumentTemplateById: async (id: string) => {
    const { data } = await supabase.from('document_templates').select('*').eq('id', id).single();
    return data;
  },
  addDocumentTemplate: async (template: any) => {
    const { data, error } = await supabase.from('document_templates').insert(template).select().single();
    if (error) throw error;
    return data;
  },
  updateDocumentTemplate: async (id: string, updates: any) => {
    const { data } = await supabase.from('document_templates').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteDocumentTemplate: async (id: string) => {
    await supabase.from('document_templates').update({ is_active: false }).eq('id', id);
  },

  // ========== Generated Documents ==========
  getGeneratedDocuments: async () => {
    const { data } = await supabase.from('generated_documents').select('*');
    return data || [];
  },
  getGeneratedDocumentsByContractId: async (contractId: string) => {
    const { data } = await supabase.from('generated_documents').select('*').eq('contract_id', contractId);
    return data || [];
  },
  getGeneratedDocumentById: async (id: string) => {
    const { data } = await supabase.from('generated_documents').select('*').eq('id', id).single();
    return data;
  },
  addGeneratedDocument: async (doc: any) => {
    const { data, error } = await supabase.from('generated_documents').insert(doc).select().single();
    if (error) throw error;
    return data;
  },
  updateGeneratedDocument: async (id: string, updates: any) => {
    const { data } = await supabase.from('generated_documents').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteGeneratedDocument: async (id: string) => {
    await supabase.from('generated_documents').delete().eq('id', id);
  },
  deleteGeneratedDocumentsByContractId: async (contractId: string) => {
    await supabase.from('generated_documents').delete().eq('contract_id', contractId);
  },

  // ========== Attached Documents ==========
  getAttachedDocuments: async () => {
    const { data } = await supabase.from('attached_documents').select('*');
    return data || [];
  },
  getAttachedDocumentsByParent: async (parentType: string, parentId: string) => {
    const { data } = await supabase
      .from('attached_documents')
      .select('*')
      .eq('parent_type', parentType)
      .eq('parent_id', parentId);
    return data || [];
  },
  getAttachedDocumentById: async (id: string) => {
    const { data } = await supabase.from('attached_documents').select('*').eq('id', id).single();
    return data;
  },
  addAttachedDocument: async (doc: any) => {
    const { data, error } = await supabase.from('attached_documents').insert(doc).select().single();
    if (error) throw error;
    return data;
  },
  updateAttachedDocument: async (id: string, updates: any) => {
    const { data } = await supabase.from('attached_documents').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteAttachedDocument: async (id: string) => {
    await supabase.from('attached_documents').delete().eq('id', id);
  },
  deleteAttachedDocumentsByParent: async (parentType: string, parentId: string) => {
    await supabase
      .from('attached_documents')
      .delete()
      .eq('parent_type', parentType)
      .eq('parent_id', parentId);
  },

  // ========== Outsourcings ==========
  getOutsourcings: async () => {
    const { data } = await supabase.from('outsourcings').select('*');
    return data || [];
  },
  getOutsourcingsByCompanyId: async (companyId: string) => {
    const { data } = await supabase.from('outsourcings').select('*').eq('company_id', companyId);
    return data || [];
  },
  getOutsourcingsByContractId: async (contractId: string) => {
    const { data } = await supabase.from('outsourcings').select('*').eq('contract_id', contractId);
    return data || [];
  },
  getOutsourcingById: async (id: string) => {
    const { data } = await supabase.from('outsourcings').select('*').eq('id', id).single();
    return data;
  },
  addOutsourcing: async (outsourcing: any) => {
    const { data, error } = await supabase.from('outsourcings').insert(outsourcing).select().single();
    if (error) throw error;
    return data;
  },
  updateOutsourcing: async (id: string, updates: any) => {
    const { data } = await supabase.from('outsourcings').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteOutsourcing: async (id: string) => {
    await supabase.from('outsourcings').delete().eq('id', id);
  },

  // ========== Client Companies ==========
  getClientCompanies: async () => {
    return await fetchAllPaged('client_companies');
  },
  getClientCompaniesByCompanyId: async (companyId: string) => {
    return await fetchAllPaged('client_companies', (q) => q.eq('company_id', companyId));
  },
  getClientCompanyById: async (id: string) => {
    const { data } = await supabase.from('client_companies').select('*').eq('id', id).single();
    return data;
  },
  addClientCompany: async (client: any) => {
    const { data, error } = await supabase.from('client_companies').insert(client).select().single();
    if (error) throw error;
    return data;
  },
  updateClientCompany: async (id: string, updates: any) => {
    const { data } = await supabase.from('client_companies').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteClientCompany: async (id: string) => {
    // FK ON DELETE CASCADE handles contacts
    await supabase.from('client_companies').delete().eq('id', id);
  },

  // ========== Client Contacts ==========
  getClientContacts: async () => {
    const { data } = await supabase.from('client_contacts').select('*');
    return data || [];
  },
  getClientContactsByClientId: async (clientId: string) => {
    const { data } = await supabase.from('client_contacts').select('*').eq('client_id', clientId);
    return data || [];
  },
  addClientContact: async (contact: any) => {
    const { data, error } = await supabase.from('client_contacts').insert(contact).select().single();
    if (error) throw error;
    return data;
  },
  updateClientContact: async (id: string, updates: any) => {
    const { data } = await supabase.from('client_contacts').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteClientContact: async (id: string) => {
    await supabase.from('client_contacts').delete().eq('id', id);
  },

  // ========== HWPX Templates ==========
  getHwpxTemplates: async () => {
    const { data } = await supabase.from('hwpx_templates').select('*');
    return data || [];
  },
  getHwpxTemplateById: async (id: string) => {
    const { data } = await supabase.from('hwpx_templates').select('*').eq('id', id).single();
    return data;
  },
  getHwpxTemplateByDocType: async (docType: string) => {
    const { data } = await supabase
      .from('hwpx_templates')
      .select('*')
      .eq('doc_type', docType)
      .eq('is_active', true)
      .maybeSingle();
    return data;
  },
  getActiveHwpxTemplates: async () => {
    const { data } = await supabase.from('hwpx_templates').select('*').eq('is_active', true);
    return data || [];
  },
  addHwpxTemplate: async (template: any) => {
    const { data, error } = await supabase.from('hwpx_templates').insert(template).select().single();
    if (error) throw error;
    return data;
  },
  updateHwpxTemplate: async (id: string, updates: any) => {
    const { data } = await supabase.from('hwpx_templates').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteHwpxTemplate: async (id: string) => {
    await supabase.from('hwpx_templates').delete().eq('id', id);
  },

  // ========== Messenger Conversations ==========
  getConversations: async () => {
    const { data } = await supabase.from('messenger_conversations').select('*');
    return data || [];
  },
  getConversationById: async (id: string) => {
    const { data } = await supabase.from('messenger_conversations').select('*').eq('id', id).single();
    return data;
  },
  getConversationsByUserId: async (userId: string) => {
    const { data } = await supabase
      .from('messenger_conversations')
      .select('*')
      .contains('participants', [userId]);
    return data || [];
  },
  addConversation: async (conversation: any) => {
    const { data, error } = await supabase
      .from('messenger_conversations')
      .insert(conversation)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  updateConversation: async (id: string, updates: any) => {
    const { data } = await supabase
      .from('messenger_conversations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return data;
  },
  deleteConversation: async (id: string) => {
    // FK ON DELETE CASCADE handles messages and receipts
    await supabase.from('messenger_conversations').delete().eq('id', id);
  },

  // ========== Messenger Messages ==========
  getMessages: async () => {
    const { data } = await supabase.from('messenger_messages').select('*');
    return data || [];
  },
  getMessagesByConversationId: async (conversationId: string) => {
    const { data } = await supabase
      .from('messenger_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    return data || [];
  },
  // 특정 사용자가 볼 수 있는 메시지만 조회 (joined_at 이후)
  getMessagesByConversationIdForUser: async (conversationId: string, userId: string) => {
    const conv = await supabase
      .from('messenger_conversations')
      .select('participant_joined_at, created_at')
      .eq('id', conversationId)
      .single();
    const joinedMap = (conv.data?.participant_joined_at || {}) as Record<string, string>;
    const since = joinedMap[userId] || conv.data?.created_at || '1970-01-01T00:00:00Z';
    const { data } = await supabase
      .from('messenger_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    return data || [];
  },
  // 대화방에 멤버 추가 (joined_at 기록)
  addConversationParticipants: async (conversationId: string, newUserIds: string[], joinedAt: string) => {
    const { data: conv } = await supabase
      .from('messenger_conversations')
      .select('participants, participant_joined_at')
      .eq('id', conversationId)
      .single();
    if (!conv) throw new Error('대화방을 찾을 수 없습니다.');
    const existingParticipants: string[] = conv.participants || [];
    const joinedMap: Record<string, string> = conv.participant_joined_at || {};
    const toAdd = newUserIds.filter((id) => !existingParticipants.includes(id));
    if (toAdd.length === 0) return { added: [] as string[] };
    const updatedParticipants = [...existingParticipants, ...toAdd];
    const updatedJoinedMap = { ...joinedMap };
    for (const id of toAdd) {
      updatedJoinedMap[id] = joinedAt;
    }
    await supabase
      .from('messenger_conversations')
      .update({
        participants: updatedParticipants,
        participant_joined_at: updatedJoinedMap,
        updated_at: joinedAt,
      })
      .eq('id', conversationId);
    return { added: toAdd };
  },
  addMessage: async (message: any) => {
    const { data, error } = await supabase.from('messenger_messages').insert(message).select().single();
    if (error) throw error;
    return data;
  },
  updateMessage: async (id: string, updates: any) => {
    const { data } = await supabase.from('messenger_messages').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteMessage: async (id: string) => {
    await supabase
      .from('messenger_messages')
      .update({
        is_deleted: true,
        content: '',
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id);
  },

  // ========== Messenger Read Receipts ==========
  getReadReceipts: async () => {
    const { data } = await supabase.from('messenger_read_receipts').select('*');
    return data || [];
  },
  getReadReceiptsByConversation: async (conversationId: string, userId: string) => {
    const { data } = await supabase
      .from('messenger_read_receipts')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    return data;
  },
  upsertReadReceipt: async (conversationId: string, userId: string, lastReadMessageId: string) => {
    await supabase.from('messenger_read_receipts').upsert(
      {
        conversation_id: conversationId,
        user_id: userId,
        last_read_message_id: lastReadMessageId,
        read_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id,user_id' }
    );
  },

  // ========== Notifications ==========
  getNotificationsByUserId: async (userId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  },
  getUnreadNotificationCount: async (userId: string) => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    return count || 0;
  },
  addNotification: async (notification: any) => {
    const { data, error } = await supabase.from('notifications').insert(notification).select().single();
    if (error) throw error;
    return data;
  },
  markNotificationRead: async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  },
  markAllNotificationsRead: async (userId: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  },

  // ========== Meeting Reservations ==========
  getMeetingReservations: async () => {
    const { data } = await supabase.from('meeting_reservations').select('*');
    return data || [];
  },
  getMeetingReservationsByDate: async (date: string) => {
    const { data } = await supabase
      .from('meeting_reservations')
      .select('*')
      .eq('reservation_date', date)
      .order('start_time', { ascending: true });
    return data || [];
  },
  addMeetingReservation: async (reservation: any) => {
    const { data, error } = await supabase.from('meeting_reservations').insert(reservation).select().single();
    if (error) throw error;
    return data;
  },
  updateMeetingReservation: async (id: string, updates: any) => {
    const { data, error } = await supabase.from('meeting_reservations').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  deleteMeetingReservation: async (id: string) => {
    await supabase.from('meeting_reservations').delete().eq('id', id);
  },

  // ========== Payment Conditions ==========
  getPaymentConditions: async (contractId: string) => {
    const { data } = await supabase
      .from('payment_conditions')
      .select('*')
      .eq('contract_id', contractId)
      .order('sort_order', { ascending: true });
    return data || [];
  },
  getPaymentConditionById: async (id: string) => {
    const { data } = await supabase.from('payment_conditions').select('*').eq('id', id).single();
    return data;
  },
  addPaymentCondition: async (condition: any) => {
    const { data, error } = await supabase.from('payment_conditions').insert(condition).select().single();
    if (error) throw error;
    return data;
  },
  updatePaymentCondition: async (id: string, updates: any) => {
    const { data } = await supabase
      .from('payment_conditions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return data;
  },
  deletePaymentCondition: async (id: string) => {
    await supabase.from('payment_conditions').delete().eq('id', id);
  },

  // ========== Quote Amount Histories ==========
  getQuoteAmountHistories: async (quoteId: string) => {
    const { data } = await supabase
      .from('quote_amount_histories')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false });
    return data || [];
  },
  addQuoteAmountHistory: async (history: any) => {
    const { data, error } = await supabase.from('quote_amount_histories').insert(history).select().single();
    if (error) throw error;
    return data;
  },

  // ========== Leave Requests ==========
  getLeaveRequests: async (filters?: any) => {
    let query = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
    if (filters?.user_id) query = query.eq('user_id', filters.user_id);
    if (filters?.company_id) query = query.eq('company_id', filters.company_id);
    if (filters?.status) query = query.eq('status', filters.status);
    const { data } = await query;
    return data || [];
  },
  addLeaveRequest: async (request: any) => {
    const { data, error } = await supabase.from('leave_requests').insert(request).select().single();
    if (error) throw error;
    return data;
  },
  updateLeaveRequest: async (id: string, updates: any) => {
    const { data, error } = await supabase.from('leave_requests').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ========== Contract Subtasks ==========
  getContractSubtasks: async (contractId: string) => {
    const { data } = await supabase
      .from('contract_subtasks')
      .select('*')
      .eq('contract_id', contractId)
      .order('sort_order', { ascending: true });
    return data || [];
  },
  addContractSubtask: async (subtask: any) => {
    const { data, error } = await supabase.from('contract_subtasks').insert(subtask).select().single();
    if (error) throw error;
    return data;
  },
  updateContractSubtask: async (id: string, updates: any) => {
    const { data, error } = await supabase.from('contract_subtasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  deleteContractSubtask: async (id: string) => {
    await supabase.from('contract_subtasks').delete().eq('id', id);
  },

  // ========== Certificates (증명서) ==========
  getCertificates: async (filters?: any) => {
    let query = supabase.from('certificates').select('*');
    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters?.company_id) {
      query = query.eq('company_id', filters.company_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    const { data } = await query.order('created_at', { ascending: false });
    return data || [];
  },
  addCertificate: async (certificate: any) => {
    const { data, error } = await supabase.from('certificates').insert(certificate).select().single();
    if (error) throw error;
    return data;
  },
  updateCertificate: async (id: string, updates: any) => {
    const { data, error } = await supabase.from('certificates').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ========== Certificate Types (증명서 종류) ==========
  getCertificateTypes: async (companyId?: string) => {
    let query = supabase.from('certificate_types').select('*').eq('is_active', true);
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    const { data } = await query.order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    return data || [];
  },
  addCertificateType: async (certType: any) => {
    const { data, error } = await supabase.from('certificate_types').insert(certType).select().single();
    if (error) throw error;
    return data;
  },
  updateCertificateType: async (id: string, updates: any) => {
    const { data, error } = await supabase.from('certificate_types').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  deleteCertificateType: async (id: string) => {
    // soft delete
    const { data, error } = await supabase.from('certificate_types').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ========== Quote Sections (견적서 계층 구조) ==========
  getQuoteSectionById: async (id: string) => {
    const { data } = await supabase.from('quote_sections').select('*').eq('id', id).single();
    return data;
  },
  getQuoteSectionsByQuoteId: async (quoteId: string) => {
    const { data } = await supabase
      .from('quote_sections')
      .select('*')
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true });
    return data || [];
  },
  addQuoteSection: async (section: any) => {
    const { data, error } = await supabase.from('quote_sections').insert(section).select().single();
    if (error) throw error;
    return data;
  },
  updateQuoteSection: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('quote_sections')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  deleteQuoteSection: async (id: string) => {
    await supabase.from('quote_sections').delete().eq('id', id);
  },
  deleteQuoteSectionsByQuoteId: async (quoteId: string) => {
    await supabase.from('quote_sections').delete().eq('quote_id', quoteId);
  },

  // ========== Contract Labor Items (계약 인건비) ==========
  getContractLaborItems: async (contractId: string) => {
    const { data } = await supabase.from('contract_labor_items').select('*').eq('contract_id', contractId).order('created_at', { ascending: true });
    return data || [];
  },
  addContractLaborItem: async (item: any) => {
    const { data, error } = await supabase.from('contract_labor_items').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  addContractLaborItems: async (items: any[]) => {
    if (items.length === 0) return [];
    const { data, error } = await supabase.from('contract_labor_items').insert(items).select();
    if (error) throw error;
    return data || [];
  },
  deleteContractLaborItemsByContractId: async (contractId: string) => {
    await supabase.from('contract_labor_items').delete().eq('contract_id', contractId);
  },

  // ========== Contract Clients (발주처 — 공동발주) ==========
  getContractClientsByContractId: async (contractId: string) => {
    const { data } = await supabase.from('contract_clients').select('*').eq('contract_id', contractId).order('sort_order', { ascending: true });
    return data || [];
  },
  addContractClients: async (items: any[]) => {
    if (items.length === 0) return [];
    const { data, error } = await supabase.from('contract_clients').insert(items).select();
    if (error) throw error;
    return data || [];
  },
  deleteContractClientsByContractId: async (contractId: string) => {
    await supabase.from('contract_clients').delete().eq('contract_id', contractId);
  },

  // ========== Contract Expense Items (계약 경비) ==========
  getContractExpenseItems: async (contractId: string) => {
    const { data } = await supabase.from('contract_expense_items').select('*').eq('contract_id', contractId).order('created_at', { ascending: true });
    return data || [];
  },
  addContractExpenseItem: async (item: any) => {
    const { data, error } = await supabase.from('contract_expense_items').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  addContractExpenseItems: async (items: any[]) => {
    if (items.length === 0) return [];
    const { data, error } = await supabase.from('contract_expense_items').insert(items).select();
    if (error) throw error;
    return data || [];
  },
  deleteContractExpenseItemsByContractId: async (contractId: string) => {
    await supabase.from('contract_expense_items').delete().eq('contract_id', contractId);
  },

  // ========== Contract Sections (계약 상세내역) ==========
  getContractSections: async (contractId: string) => {
    const { data } = await supabase.from('contract_sections').select('*').eq('contract_id', contractId).order('sort_order', { ascending: true });
    return data || [];
  },
  addContractSection: async (section: any) => {
    const { data, error } = await supabase.from('contract_sections').insert(section).select().single();
    if (error) throw error;
    return data;
  },
  addContractSections: async (sections: any[]) => {
    if (sections.length === 0) return [];
    const { data, error } = await supabase.from('contract_sections').insert(sections).select();
    if (error) throw error;
    return data || [];
  },
  updateContractSection: async (id: string, updates: any) => {
    const { data, error } = await supabase.from('contract_sections').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  deleteContractSection: async (id: string) => {
    await supabase.from('contract_sections').delete().eq('id', id);
  },
  deleteContractSectionsByContractId: async (contractId: string) => {
    await supabase.from('contract_sections').delete().eq('contract_id', contractId);
  },

  // ========== Email Approvals (메일 승인) ==========
  getEmailApprovals: async (filters?: any) => {
    let query = supabase.from('email_approvals').select('*');
    if (filters?.approver_id) query = query.eq('approver_id', filters.approver_id);
    if (filters?.requester_id) query = query.eq('requester_id', filters.requester_id);
    if (filters?.status) query = query.eq('status', filters.status);
    const { data } = await query.order('created_at', { ascending: false });
    return data || [];
  },
  addEmailApproval: async (approval: any) => {
    const { data, error } = await supabase.from('email_approvals').insert(approval).select().single();
    if (error) throw error;
    return data;
  },
  updateEmailApproval: async (id: string, updates: any) => {
    const { data, error } = await supabase.from('email_approvals').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ========== Contract Defaults (계약서 기본값) ==========
  getContractDefaults: async (companyId: string, departmentId?: string) => {
    let query = supabase.from('contract_defaults').select('*').eq('company_id', companyId);
    if (departmentId) {
      query = query.or(`department_id.eq.${departmentId},department_id.is.null`);
    }
    const { data } = await query;
    return data || [];
  },
  upsertContractDefault: async (defaultData: any) => {
    const { data, error } = await supabase
      .from('contract_defaults')
      .upsert(defaultData, { onConflict: 'company_id,department_id,field_name' })
      .select().single();
    if (error) throw error;
    return data;
  },
  deleteContractDefault: async (id: string) => {
    await supabase.from('contract_defaults').delete().eq('id', id);
  },

  // ========== Quote Preset Sections (견적 사전 항목 분류) ==========
  getQuotePresetSectionsByCompanyId: async (companyId: string) => {
    const { data } = await supabase
      .from('quote_preset_sections')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    return data || [];
  },
  getQuotePresetSectionById: async (id: string) => {
    const { data } = await supabase.from('quote_preset_sections').select('*').eq('id', id).single();
    return data;
  },
  addQuotePresetSection: async (section: any) => {
    const { data, error } = await supabase.from('quote_preset_sections').insert(section).select().single();
    if (error) throw error;
    return data;
  },
  updateQuotePresetSection: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('quote_preset_sections')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteQuotePresetSection: async (id: string) => {
    await supabase.from('quote_preset_sections').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
  },

  // ========== Receivables (미수금) ==========
  getReceivables: async (companyId?: string) => {
    return await fetchAllPaged('receivables', (q) => {
      q = q.order('created_at', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      return q;
    });
  },
  getReceivableById: async (id: string) => {
    const { data } = await supabase.from('receivables').select('*').eq('id', id).single();
    return data;
  },
  addReceivable: async (receivable: any) => {
    const { data, error } = await supabase.from('receivables').insert(receivable).select().single();
    if (error) throw error;
    return data;
  },
  updateReceivable: async (id: string, updates: any) => {
    const { data } = await supabase.from('receivables').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteReceivable: async (id: string) => {
    await supabase.from('receivables').delete().eq('id', id);
  },

  // ========== Billings (청구) ==========
  getBillings: async (companyId?: string) => {
    return await fetchAllPaged('billings', (q) => {
      q = q.order('created_at', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      return q;
    });
  },
  getBillingById: async (id: string) => {
    const { data } = await supabase.from('billings').select('*').eq('id', id).single();
    return data;
  },
  addBilling: async (billing: any) => {
    const { data, error } = await supabase.from('billings').insert(billing).select().single();
    if (error) throw error;
    return data;
  },
  updateBilling: async (id: string, updates: any) => {
    const { data } = await supabase.from('billings').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteBilling: async (id: string) => {
    await supabase.from('billings').delete().eq('id', id);
  },

  // ========== Payment Receipts (입금) ==========
  getPaymentReceipts: async (companyId?: string) => {
    return await fetchAllPaged('payment_receipts', (q) => {
      q = q.order('created_at', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      return q;
    });
  },
  getPaymentReceiptById: async (id: string) => {
    const { data } = await supabase.from('payment_receipts').select('*').eq('id', id).single();
    return data;
  },
  addPaymentReceipt: async (receipt: any) => {
    const { data, error } = await supabase.from('payment_receipts').insert(receipt).select().single();
    if (error) throw error;
    return data;
  },
  updatePaymentReceipt: async (id: string, updates: any) => {
    const { data } = await supabase.from('payment_receipts').update(updates).eq('id', id).select().single();
    return data;
  },

  // ========== Payables (미지급금) ==========
  getPayables: async (companyId?: string) => {
    return await fetchAllPaged('payables', (q) => {
      q = q.order('created_at', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      return q;
    });
  },
  getPayableById: async (id: string) => {
    const { data } = await supabase.from('payables').select('*').eq('id', id).single();
    return data;
  },
  addPayable: async (payable: any) => {
    const { data, error } = await supabase.from('payables').insert(payable).select().single();
    if (error) throw error;
    return data;
  },
  updatePayable: async (id: string, updates: any) => {
    const { data } = await supabase.from('payables').update(updates).eq('id', id).select().single();
    return data;
  },
  deletePayable: async (id: string) => {
    await supabase.from('payables').delete().eq('id', id);
  },

  // ========== Deposits (보증금) ==========
  getDeposits: async (companyId?: string) => {
    let query = supabase.from('deposits').select('*').order('created_at', { ascending: false });
    if (companyId) query = query.eq('company_id', companyId);
    const { data } = await query;
    return data || [];
  },
  getDepositById: async (id: string) => {
    const { data } = await supabase.from('deposits').select('*').eq('id', id).single();
    return data;
  },
  addDeposit: async (deposit: any) => {
    const { data, error } = await supabase.from('deposits').insert(deposit).select().single();
    if (error) throw error;
    return data;
  },
  updateDeposit: async (id: string, updates: any) => {
    const { data } = await supabase.from('deposits').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteDeposit: async (id: string) => {
    await supabase.from('deposits').delete().eq('id', id);
  },

  // ========== Tax Invoices (세금계산서관리) ==========
  getTaxInvoices: async (companyId: string) => {
    return await fetchAllPaged('tax_invoices', (q) =>
      q.eq('company_id', companyId).order('issue_date', { ascending: false })
    );
  },
  getAllTaxInvoices: async () => {
    return await fetchAllPaged('tax_invoices', (q) => q.order('issue_date', { ascending: false }));
  },
  getTaxInvoiceById: async (id: string) => {
    const { data } = await supabase.from('tax_invoices').select('*').eq('id', id).single();
    return data;
  },
  addTaxInvoice: async (invoice: any) => {
    const { data, error } = await supabase.from('tax_invoices').insert(invoice).select().single();
    if (error) throw error;
    return data;
  },
  updateTaxInvoice: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('tax_invoices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteTaxInvoice: async (id: string) => {
    await supabase.from('tax_invoices').delete().eq('id', id);
  },

  // ========== Expense Settlements (경비정산) ==========
  getExpenseSettlements: async (companyId: string) => {
    const { data } = await supabase
      .from('expense_settlements')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    return data || [];
  },
  getExpenseSettlementById: async (id: string) => {
    const { data } = await supabase.from('expense_settlements').select('*').eq('id', id).single();
    return data;
  },
  addExpenseSettlement: async (settlement: any) => {
    const { data, error } = await supabase.from('expense_settlements').insert(settlement).select().single();
    if (error) throw error;
    return data;
  },
  updateExpenseSettlement: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('expense_settlements')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteExpenseSettlement: async (id: string) => {
    await supabase.from('expense_settlements').delete().eq('id', id);
  },
  getExpenseSettlementItems: async (settlementId: string) => {
    const { data } = await supabase
      .from('expense_settlement_items')
      .select('*')
      .eq('settlement_id', settlementId)
      .order('expense_date', { ascending: true });
    return data || [];
  },
  addExpenseSettlementItem: async (item: any) => {
    const { data, error } = await supabase.from('expense_settlement_items').insert(item).select().single();
    if (error) throw error;
    return data;
  },
  updateExpenseSettlementItem: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('expense_settlement_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteExpenseSettlementItems: async (settlementId: string) => {
    await supabase.from('expense_settlement_items').delete().eq('settlement_id', settlementId);
  },
  deleteExpenseSettlementItem: async (id: string) => {
    await supabase.from('expense_settlement_items').delete().eq('id', id);
  },

  // ========== Provisional Payments (가수금관리) ==========
  getProvisionalPayments: async (companyId: string) => {
    const { data } = await supabase
      .from('provisional_payments')
      .select('*')
      .eq('company_id', companyId)
      .order('payment_date', { ascending: false });
    return data || [];
  },
  getProvisionalPaymentById: async (id: string) => {
    const { data } = await supabase.from('provisional_payments').select('*').eq('id', id).single();
    return data;
  },
  addProvisionalPayment: async (payment: any) => {
    const { data, error } = await supabase.from('provisional_payments').insert(payment).select().single();
    if (error) throw error;
    return data;
  },
  updateProvisionalPayment: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('provisional_payments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteProvisionalPayment: async (id: string) => {
    await supabase.from('provisional_payments').delete().eq('id', id);
  },

  // ========== Client Company Financials (거래처 재무정보) ==========
  getClientFinancials: async (clientCompanyId: string) => {
    const { data } = await supabase
      .from('client_company_financials')
      .select('*')
      .eq('client_company_id', clientCompanyId)
      .maybeSingle();
    return data;
  },
  getClientFinancialsByCompany: async (companyId: string) => {
    const { data } = await supabase
      .from('client_company_financials')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    return data || [];
  },
  upsertClientFinancials: async (financialData: any) => {
    const { data, error } = await supabase
      .from('client_company_financials')
      .upsert(financialData, { onConflict: 'client_company_id,company_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ========== Expense Requests (지출결의서) ==========
  getExpenseRequests: async (companyId: string) => {
    const { data } = await supabase
      .from('expense_requests')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    return data || [];
  },
  getExpenseRequestById: async (id: string) => {
    const { data } = await supabase.from('expense_requests').select('*').eq('id', id).single();
    return data;
  },
  addExpenseRequest: async (req: any) => {
    const { data, error } = await supabase.from('expense_requests').insert(req).select().single();
    if (error) throw error;
    return data;
  },
  updateExpenseRequest: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('expense_requests')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteExpenseRequest: async (id: string) => {
    await supabase.from('expense_requests').delete().eq('id', id);
  },

  // ========== Vehicles (차량) ==========
  getVehicles: async (companyId: string | null, includeShared: boolean = true) => {
    let q = supabase.from('vehicles').select('*').order('created_at', { ascending: false });
    if (companyId) {
      // 해당 회사 + 공통(NULL)
      q = includeShared
        ? q.or(`company_id.eq.${companyId},company_id.is.null`)
        : q.eq('company_id', companyId);
    }
    // companyId가 null이면 모든 차량 (super_admin 전체 모드)
    const { data } = await q;
    return data || [];
  },
  getVehicleById: async (id: string) => {
    const { data } = await supabase.from('vehicles').select('*').eq('id', id).single();
    return data;
  },
  addVehicle: async (vehicle: any) => {
    const { data, error } = await supabase.from('vehicles').insert(vehicle).select().single();
    if (error) throw error;
    return data;
  },
  updateVehicle: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('vehicles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteVehicle: async (id: string) => {
    await supabase.from('vehicles').delete().eq('id', id);
  },

  // ========== Vehicle Logs (운행일지) ==========
  getVehicleLogs: async (companyId: string | null, driverId?: string) => {
    let q = supabase.from('vehicle_logs').select('*');
    if (companyId) q = q.eq('company_id', companyId);
    if (driverId) q = q.eq('driver_id', driverId);
    const { data } = await q.order('log_date', { ascending: false });
    return data || [];
  },
  getVehicleLogById: async (id: string) => {
    const { data } = await supabase.from('vehicle_logs').select('*').eq('id', id).single();
    return data;
  },
  addVehicleLog: async (log: any) => {
    const { data, error } = await supabase.from('vehicle_logs').insert(log).select().single();
    if (error) throw error;
    return data;
  },
  updateVehicleLog: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('vehicle_logs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteVehicleLog: async (id: string) => {
    await supabase.from('vehicle_logs').delete().eq('id', id);
  },

  // ========== Spaces (공간 관리) ==========
  getSpaces: async (companyId: string | null) => {
    let q = supabase.from('spaces').select('*').order('created_at', { ascending: false });
    if (companyId) {
      // 해당 회사 + 공통(NULL) 공간
      q = q.or(`company_id.eq.${companyId},company_id.is.null`);
    }
    const { data } = await q;
    return data || [];
  },
  getSpaceById: async (id: string) => {
    const { data } = await supabase.from('spaces').select('*').eq('id', id).single();
    return data;
  },
  addSpace: async (space: any) => {
    const { data, error } = await supabase.from('spaces').insert(space).select().single();
    if (error) throw error;
    return data;
  },
  updateSpace: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('spaces')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteSpace: async (id: string) => {
    await supabase.from('spaces').delete().eq('id', id);
  },

  // ========== Contract Meeting Notes (계약 회의록/기타자료) ==========
  getContractMeetingNotes: async (contractId: string) => {
    const { data } = await supabase
      .from('contract_meeting_notes')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false });
    return data || [];
  },
  getContractMeetingNoteById: async (id: string) => {
    const { data } = await supabase
      .from('contract_meeting_notes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return data || null;
  },
  addContractMeetingNote: async (note: any) => {
    const { data, error } = await supabase
      .from('contract_meeting_notes')
      .insert(note)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  deleteContractMeetingNote: async (id: string) => {
    await supabase.from('contract_meeting_notes').delete().eq('id', id);
  },

  // ========== Contract Members (다중 담당자) ==========
  getContractMembers: async (contractId: string) => {
    const { data } = await supabase
      .from('contract_members')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: true });
    return data || [];
  },
  getContractsByMemberId: async (userId: string) => {
    const { data } = await supabase
      .from('contract_members')
      .select('contract_id')
      .eq('user_id', userId);
    return data || [];
  },
  addContractMember: async (member: any) => {
    const { data, error } = await supabase
      .from('contract_members')
      .upsert(member, { onConflict: 'contract_id,user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  removeContractMember: async (contractId: string, userId: string) => {
    await supabase
      .from('contract_members')
      .delete()
      .eq('contract_id', contractId)
      .eq('user_id', userId);
  },
  setContractMembers: async (contractId: string, members: any[]) => {
    // 기존 멤버 삭제 후 새로 삽입
    await supabase.from('contract_members').delete().eq('contract_id', contractId);
    if (members.length > 0) {
      const { error } = await supabase.from('contract_members').insert(members);
      if (error) throw error;
    }
  },

  // ========== Quote Members (다중 담당자) ==========
  getQuoteMembers: async (quoteId: string) => {
    const { data } = await supabase
      .from('quote_members')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true });
    return data || [];
  },
  getQuotesByMemberId: async (userId: string) => {
    const { data } = await supabase
      .from('quote_members')
      .select('quote_id')
      .eq('user_id', userId);
    return data || [];
  },
  addQuoteMember: async (member: any) => {
    const { data, error } = await supabase
      .from('quote_members')
      .upsert(member, { onConflict: 'quote_id,user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  removeQuoteMember: async (quoteId: string, userId: string) => {
    await supabase
      .from('quote_members')
      .delete()
      .eq('quote_id', quoteId)
      .eq('user_id', userId);
  },
  setQuoteMembers: async (quoteId: string, members: any[]) => {
    await supabase.from('quote_members').delete().eq('quote_id', quoteId);
    if (members.length > 0) {
      const { error } = await supabase.from('quote_members').insert(members);
      if (error) throw error;
    }
  },

  // ========== User-Company Affiliations (junction table) ==========
  getUserCompanies: async (userId: string) => {
    const { data } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', userId);
    return data || [];
  },
  // 모든 사용자-회사 매핑을 한 번에 가져옴 (N+1 방지)
  getAllUserCompanies: async () => {
    return await fetchAllPaged('user_companies');
  },
  setUserCompanies: async (userId: string, companyIds: string[], primaryCompanyId?: string) => {
    await supabase.from('user_companies').delete().eq('user_id', userId);
    if (companyIds.length > 0) {
      const rows = companyIds.map((cid) => ({
        user_id: userId,
        company_id: cid,
        is_primary: cid === primaryCompanyId,
      }));
      const { error } = await supabase.from('user_companies').insert(rows);
      if (error) throw error;
    }
  },
  getUsersByCompanyId: async (companyId: string) => {
    const { data } = await supabase
      .from('user_companies')
      .select('user_id')
      .eq('company_id', companyId);
    return (data || []).map((r: any) => r.user_id);
  },

  // ========== User-Department Affiliations (junction table) ==========
  getUserDepartments: async (userId: string) => {
    const { data } = await supabase
      .from('user_departments')
      .select('*')
      .eq('user_id', userId);
    return data || [];
  },
  // 모든 사용자-부서 매핑을 한 번에 가져옴 (N+1 방지)
  getAllUserDepartments: async () => {
    return await fetchAllPaged('user_departments');
  },
  setUserDepartments: async (userId: string, departmentIds: string[], primaryDepartmentId?: string) => {
    await supabase.from('user_departments').delete().eq('user_id', userId);
    if (departmentIds.length > 0) {
      const rows = departmentIds.map((did) => ({
        user_id: userId,
        department_id: did,
        is_primary: did === primaryDepartmentId,
      }));
      const { error } = await supabase.from('user_departments').insert(rows);
      if (error) throw error;
    }
  },
  getUsersByDepartmentId: async (departmentId: string) => {
    const { data } = await supabase
      .from('user_departments')
      .select('user_id')
      .eq('department_id', departmentId);
    return (data || []).map((r: any) => r.user_id);
  },
};
