import { supabase } from './supabaseClient';

export const db = {
  // ========== Users ==========
  getUsers: async () => {
    const { data } = await supabase.from('users').select('*');
    return data || [];
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
    const { data } = await supabase.from('users').update(updates).eq('id', id).select().single();
    return data;
  },
  deleteUser: async (id: string) => {
    await supabase.from('users').delete().eq('id', id);
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
  deletePermissionsByUserId: async (userId: string) => {
    await supabase.from('menu_permissions').delete().eq('user_id', userId);
  },
  addMenuPermission: async (permission: any) => {
    const { data, error } = await supabase.from('menu_permissions').insert(permission).select().single();
    if (error) throw error;
    return data;
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
    const { data } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });
    return data || [];
  },
  getQuotesByCompanyId: async (companyId: string) => {
    const { data } = await supabase
      .from('quotes')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    return data || [];
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
    const { data } = await supabase
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false });
    return data || [];
  },
  getContractsByCompanyId: async (companyId: string) => {
    const { data } = await supabase
      .from('contracts')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    return data || [];
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
    const { data } = await supabase.from('client_companies').select('*');
    return data || [];
  },
  getClientCompaniesByCompanyId: async (companyId: string) => {
    const { data } = await supabase.from('client_companies').select('*').eq('company_id', companyId);
    return data || [];
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
};
