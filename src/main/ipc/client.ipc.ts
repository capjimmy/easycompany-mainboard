import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

// 계약 캐시 (재무 요약 계산용) - 기본 TTL 30초
type ContractsCacheEntry = { data: any[]; expiresAt: number };
const contractsCache = new Map<string, ContractsCacheEntry>();
const CONTRACTS_CACHE_TTL_MS = 30_000;

async function getContractsCached(scopeKey: string, loader: () => Promise<any[]>): Promise<any[]> {
  const now = Date.now();
  const cached = contractsCache.get(scopeKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const data = await loader();
  contractsCache.set(scopeKey, { data, expiresAt: now + CONTRACTS_CACHE_TTL_MS });
  return data;
}

// 외부에서 캐시 무효화 (계약 추가/수정/삭제 후)
export function invalidateClientContractsCache(): void {
  contractsCache.clear();
}

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

    // 총괄관리자의 회사 전환 필터
    if (requester.role === 'super_admin' && filters?.company_id) {
      clients = clients.filter((c: any) => c.company_id === filters.company_id);
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

    // 재무 요약용 계약 로드: 회사 범위로 좁히고 30초 캐시 사용 (skipFinancials 옵션 시 생략)
    const skipFinancials = !!filters?.skipFinancials;
    let contractsByClientName = new Map<string, { total: number; received: number }>();

    if (!skipFinancials) {
      // 캐시 키: super_admin은 전체, 그 외는 자기 회사
      const scopeCompanyId = requester.role === 'super_admin'
        ? (filters?.company_id || '__all__')
        : requester.company_id;
      const cacheKey = `contracts:${scopeCompanyId}`;
      const relevantContracts = await getContractsCached(cacheKey, async () => {
        if (requester.role !== 'super_admin' && requester.company_id) {
          return await db.getContractsByCompanyId(requester.company_id);
        }
        if (requester.role === 'super_admin' && filters?.company_id) {
          return await db.getContractsByCompanyId(filters.company_id);
        }
        return await db.getContracts();
      });

      // 거래처명별로 계약 합계 미리 집계 (선형 시간)
      for (const contract of relevantContracts) {
        const key = contract.client_company;
        if (!key) continue;
        const acc = contractsByClientName.get(key) || { total: 0, received: 0 };
        acc.total += contract.total_amount || 0;
        acc.received += contract.received_amount || 0;
        contractsByClientName.set(key, acc);
      }
    }

    const clientsWithPrimary = clients.map((client: any) => {
      const contacts = contactsByClientId[client.id] || [];
      const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0] || null;

      // Lookup precomputed financial summary
      const summary = contractsByClientName.get(client.name);
      const totalContractAmount = summary?.total || 0;
      const receivedAmount = summary?.received || 0;
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

    // 회사 권한 확인
    if (requester.role !== 'super_admin' && client.company_id !== requester.company_id) {
      return { success: false, error: '권한이 없습니다.' };
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

    // 회사 권한 확인
    if (requester.role !== 'super_admin' && existing.company_id !== requester.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 관리자 이상만 수정 가능
    if (!['super_admin', 'company_admin'].includes(requester.role)) {
      return { success: false, error: '권한이 없습니다.' };
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

    // 회사 권한 확인
    const clientToDelete = await db.getClientCompanyById(clientId);
    if (!clientToDelete) return { success: false, error: '거래처를 찾을 수 없습니다.' };
    if (requester.role !== 'super_admin' && clientToDelete.company_id !== requester.company_id) {
      return { success: false, error: '권한이 없습니다.' };
    }

    // 참조 무결성: 이 거래처와 연관된 계약·견적이 있으면 삭제 차단
    try {
      const allContracts = await db.getContractsByCompanyId(clientToDelete.company_id);
      const linkedContracts = (allContracts || []).filter((c: any) =>
        c.client_company === clientToDelete.name || c.client_id === clientId
      );
      if (linkedContracts.length > 0) {
        return { success: false, error: `이 거래처와 연결된 계약 ${linkedContracts.length}건이 있어 삭제할 수 없습니다. 먼저 계약을 정리해주세요.` };
      }
    } catch { /* 검증 실패 시에도 진행 안 함 */ }

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

    // 회사 권한 확인
    if (requester.role !== 'super_admin' && client.company_id !== requester.company_id) {
      return { success: false, error: '권한이 없습니다.' };
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

    // 회사 권한 확인: 담당자의 소속 거래처 → company_id 체크
    const allContactsForAuth = await db.getClientContacts();
    const contactForAuth = allContactsForAuth.find((c: any) => c.id === contactId);
    if (contactForAuth) {
      const parentClient = await db.getClientCompanyById(contactForAuth.client_id);
      if (parentClient && requester.role !== 'super_admin' && parentClient.company_id !== requester.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }
    }

    // 대표 담당자로 설정하면 기존 대표 해제
    if (contactData.is_primary) {
      const allContacts = allContactsForAuth;
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

    // 회사 권한 확인: 담당자의 소속 거래처 → company_id 체크
    const allContactsForDel = await db.getClientContacts();
    const contactForDel = allContactsForDel.find((c: any) => c.id === contactId);
    if (contactForDel) {
      const parentClient = await db.getClientCompanyById(contactForDel.client_id);
      if (parentClient && requester.role !== 'super_admin' && parentClient.company_id !== requester.company_id) {
        return { success: false, error: '권한이 없습니다.' };
      }
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

    // 회사 권한 확인
    if (requester.role !== 'super_admin' && client.company_id !== requester.company_id) {
      return { success: false, error: '권한이 없습니다.' };
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

    // 자기 회사의 계약/견적만 반환
    if (requester.role !== 'super_admin' && requester.company_id) {
      contracts = contracts.filter((c: any) => c.company_id === requester.company_id);
      quotes = quotes.filter((q: any) => q.company_id === requester.company_id);
    }

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
