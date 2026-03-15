import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerClientHandlers(): void {
  // ========================================
  // 거래처 CRUD
  // ========================================

  // 거래처 목록 조회
  ipcMain.handle('clients:getAll', async (_event, requesterId: string, filters?: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    let clients = await db.getClientCompanies();

    // 슈퍼관리자가 아니면 자기 회사의 거래처만 조회
    if (requester.role !== 'super_admin' && requester.company_id) {
      clients = clients.filter((c: any) => c.company_id === requester.company_id);
    }

    // 필터 적용
    if (filters) {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        clients = clients.filter((c: any) =>
          c.name?.toLowerCase().includes(search) ||
          c.business_number?.toLowerCase().includes(search) ||
          c.phone?.toLowerCase().includes(search) ||
          c.industry?.toLowerCase().includes(search)
        );
      }
      if (filters.client_type) {
        clients = clients.filter((c: any) => c.client_type === filters.client_type);
      }
    }

    // 이름순 정렬
    clients.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

    // 모든 담당자를 한 번에 가져와서 매핑
    const allContacts = await db.getClientContacts();
    const contactsByClientId: Record<string, any[]> = {};
    for (const contact of allContacts) {
      if (!contactsByClientId[contact.client_id]) {
        contactsByClientId[contact.client_id] = [];
      }
      contactsByClientId[contact.client_id].push(contact);
    }

    // 계약/입금 정보 가져오기 (재무 요약용)
    const allContracts = await db.getContracts();

    const clientsWithPrimary = clients.map((client: any) => {
      const contacts = contactsByClientId[client.id] || [];
      const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0] || null;

      // Calculate financial summary for this client
      const clientContracts = allContracts.filter(
        (c: any) => c.client_company === client.name
      );
      let totalContractAmount = 0;
      let receivedAmount = 0;
      for (const contract of clientContracts) {
        totalContractAmount += contract.total_amount || 0;
        receivedAmount += contract.received_amount || 0;
      }
      const outstandingAmount = totalContractAmount - receivedAmount;
      const collectionRate = totalContractAmount > 0
        ? (receivedAmount / totalContractAmount) * 100
        : 0;

      return {
        ...client,
        client_type: client.client_type || 'both',
        primary_contact: primaryContact,
        contact_count: contacts.length,
        total_contract_amount: totalContractAmount,
        received_amount: receivedAmount,
        outstanding_amount: outstandingAmount,
        collection_rate: collectionRate,
      };
    });

    return { success: true, clients: clientsWithPrimary };
  });

  // 거래처 상세 조회 (담당자 목록 포함)
  ipcMain.handle('clients:getById', async (_event, requesterId: string, clientId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const client = await db.getClientCompanyById(clientId);
    if (!client) {
      return { success: false, error: '거래처를 찾을 수 없습니다.' };
    }

    // 담당자 목록
    const contacts = await db.getClientContactsByClientId(clientId);

    return { success: true, client: { ...client, client_type: client.client_type || 'both', contacts } };
  });

  // 거래처 등록
  ipcMain.handle('clients:create', async (_event, requesterId: string, clientData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const companyId = requester.company_id;
    if (!companyId && requester.role !== 'super_admin') {
      return { success: false, error: '소속 회사가 없습니다.' };
    }

    const newClient = {
      id: uuidv4(),
      company_id: clientData.company_id || companyId,
      name: clientData.name,
      client_type: clientData.client_type || 'both',
      business_number: clientData.business_number || null,
      address: clientData.address || null,
      phone: clientData.phone || null,
      industry: clientData.industry || null,
      business_registration_file: clientData.business_registration_file || null,
      bank_copy_file: clientData.bank_copy_file || null,
      notes: clientData.notes || null,
      created_by: requesterId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.addClientCompany(newClient);
    return { success: true, client: newClient };
  });

  // 거래처 수정
  ipcMain.handle('clients:update', async (_event, requesterId: string, clientId: string, clientData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const existing = await db.getClientCompanyById(clientId);
    if (!existing) {
      return { success: false, error: '거래처를 찾을 수 없습니다.' };
    }

    const updated = await db.updateClientCompany(clientId, {
      name: clientData.name,
      client_type: clientData.client_type,
      business_number: clientData.business_number,
      address: clientData.address,
      phone: clientData.phone,
      industry: clientData.industry,
      business_registration_file: clientData.business_registration_file,
      bank_copy_file: clientData.bank_copy_file,
      notes: clientData.notes,
    });

    return { success: true, client: updated };
  });

  // 거래처 삭제
  ipcMain.handle('clients:delete', async (_event, requesterId: string, clientId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 관리자만 삭제 가능
    if (!['super_admin', 'company_admin'].includes(requester.role)) {
      return { success: false, error: '삭제 권한이 없습니다.' };
    }

    await db.deleteClientCompany(clientId); // 담당자 캐스케이드 삭제 포함
    return { success: true };
  });

  // ========================================
  // 담당자 CRUD
  // ========================================

  // 담당자 추가
  ipcMain.handle('clients:addContact', async (_event, requesterId: string, clientId: string, contactData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const client = await db.getClientCompanyById(clientId);
    if (!client) {
      return { success: false, error: '거래처를 찾을 수 없습니다.' };
    }

    const newContact = {
      id: uuidv4(),
      client_id: clientId,
      name: contactData.name,
      position: contactData.position || null,
      department: contactData.department || null,
      phone: contactData.phone || null,
      email: contactData.email || null,
      is_primary: contactData.is_primary || false,
      notes: contactData.notes || null,
      created_at: new Date().toISOString(),
    };

    // 대표 담당자로 설정하면 기존 대표 해제
    if (newContact.is_primary) {
      const existingContacts = await db.getClientContactsByClientId(clientId);
      for (const c of existingContacts) {
        if (c.is_primary) {
          await db.updateClientContact(c.id, { is_primary: false });
        }
      }
    }

    await db.addClientContact(newContact);
    return { success: true, contact: newContact };
  });

  // 담당자 수정
  ipcMain.handle('clients:updateContact', async (_event, requesterId: string, contactId: string, contactData: any) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 대표 담당자로 설정하면 기존 대표 해제
    if (contactData.is_primary) {
      const allContacts = await db.getClientContacts();
      const existing = allContacts.find((c: any) => c.id === contactId);
      if (existing) {
        const sameClientContacts = allContacts.filter((c: any) => c.client_id === existing.client_id && c.id !== contactId);
        for (const c of sameClientContacts) {
          if (c.is_primary) {
            await db.updateClientContact(c.id, { is_primary: false });
          }
        }
      }
    }

    const updated = await db.updateClientContact(contactId, contactData);
    if (!updated) {
      return { success: false, error: '담당자를 찾을 수 없습니다.' };
    }
    return { success: true, contact: updated };
  });

  // 담당자 삭제
  ipcMain.handle('clients:deleteContact', async (_event, requesterId: string, contactId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    await db.deleteClientContact(contactId);
    return { success: true };
  });

  // ========================================
  // 거래 이력 조회 (연관 계약/견적)
  // ========================================
  ipcMain.handle('clients:getContracts', async (_event, requesterId: string, clientId: string) => {
    const requester = await db.getUserById(requesterId);
    if (!requester) {
      return { success: false, error: '권한이 없습니다.' };
    }

    const client = await db.getClientCompanyById(clientId);
    if (!client) {
      return { success: false, error: '거래처를 찾을 수 없습니다.' };
    }

    const clientName = client.name;

    // 계약서에서 거래처명 매칭
    const allContracts = await db.getContracts();
    let contracts = allContracts.filter((c: any) =>
      c.client_company === clientName
    );

    // 견적서에서 거래처명 매칭
    const allQuotes = await db.getQuotes();
    let quotes = allQuotes.filter((q: any) =>
      q.recipient_company === clientName
    );

    // 최신순
    contracts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    quotes.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      success: true,
      contracts,
      quotes,
    };
  });
}
