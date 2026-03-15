import { ipcMain, BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { supabase } from '../database/supabaseClient';

// Realtime 구독 설정
export function setupMessengerRealtime(getMainWindow: () => BrowserWindow | null): void {
  const channel = supabase
    .channel('messenger-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messenger_messages' },
      (payload) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('messenger:newMessage', payload.new);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messenger_conversations' },
      (payload) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('messenger:conversationUpdated', payload.new);
        }
      }
    )
    .subscribe();
}

export function registerMessengerHandlers(): void {
  // ========================================
  // 대화방 목록 조회 (내가 참여중인 대화방)
  // ========================================
  ipcMain.handle('messenger:getConversations', async (_event, requesterId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const conversations = await db.getConversationsByUserId(requesterId);

      // 각 대화방의 마지막 메시지, 안 읽은 수 계산
      const enriched = [];
      for (const conv of conversations) {
        const messages = await db.getMessagesByConversationId(conv.id);
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

        // 안 읽은 메시지 수 계산
        const receipt = await db.getReadReceiptsByConversation(conv.id, requesterId);
        let unreadCount = 0;
        if (receipt) {
          const lastReadIdx = messages.findIndex((m: any) => m.id === receipt.last_read_message_id);
          unreadCount = lastReadIdx >= 0 ? messages.length - lastReadIdx - 1 : messages.length;
        } else {
          unreadCount = messages.length;
        }

        // 참여자 이름 조회
        const participantNames = [];
        for (const pid of (conv.participants || [])) {
          const u = await db.getUserById(pid);
          participantNames.push(u ? { id: u.id, name: u.name, role: u.role } : { id: pid, name: '(탈퇴)', role: 'employee' });
        }

        enriched.push({
          ...conv,
          lastMessage,
          unreadCount,
          participantNames,
        });
      }

      // 마지막 메시지 시간순 정렬 (최신이 위)
      enriched.sort((a: any, b: any) => {
        const aTime = a.lastMessage?.created_at || a.created_at;
        const bTime = b.lastMessage?.created_at || b.created_at;
        return bTime.localeCompare(aTime);
      });

      return { success: true, data: enriched };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 대화방 생성 (1:1 또는 그룹)
  // ========================================
  ipcMain.handle('messenger:createConversation', async (_event, requesterId: string, data: {
    participants: string[];
    title?: string;
    type?: 'direct' | 'group';
  }) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const participants = data.participants.includes(requesterId)
        ? data.participants
        : [requesterId, ...data.participants];

      const type = data.type || (participants.length === 2 ? 'direct' : 'group');

      // 1:1 대화인 경우 기존 대화방 확인
      if (type === 'direct' && participants.length === 2) {
        const convs = await db.getConversationsByUserId(requesterId);
        const existing = convs.find((c: any) => {
          if (c.type !== 'direct') return false;
          const p = c.participants || [];
          return p.length === 2 && participants.every((pid: string) => p.includes(pid));
        });
        if (existing) {
          return { success: true, data: existing };
        }
      }

      // 대화방 제목 자동 생성 (1:1이면 상대방 이름)
      let title = data.title;
      if (!title) {
        if (type === 'direct') {
          const otherId = participants.find((p: string) => p !== requesterId);
          const other = otherId ? await db.getUserById(otherId) : null;
          title = other ? other.name : '대화';
        } else {
          const names = [];
          for (const pid of participants) {
            const u = await db.getUserById(pid);
            names.push(u ? u.name : '(탈퇴)');
          }
          title = names.join(', ');
        }
      }

      const conversation = {
        id: uuidv4(),
        type,
        title,
        participants,
        created_by: requesterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.addConversation(conversation);
      return { success: true, data: conversation };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 메시지 조회 (대화방별)
  // ========================================
  ipcMain.handle('messenger:getMessages', async (_event, requesterId: string, conversationId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      // 참여자 확인
      const conv = await db.getConversationById(conversationId);
      if (!conv || !conv.participants.includes(requesterId)) {
        return { success: false, error: '이 대화에 참여하고 있지 않습니다.' };
      }

      const messages = await db.getMessagesByConversationId(conversationId);
      return { success: true, data: messages };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 메시지 전송
  // ========================================
  ipcMain.handle('messenger:sendMessage', async (_event, requesterId: string, data: {
    conversation_id: string;
    content: string;
    type?: 'text' | 'system';
  }) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      // 대화방 참여 확인
      const conv = await db.getConversationById(data.conversation_id);
      if (!conv || !conv.participants.includes(requesterId)) {
        return { success: false, error: '이 대화에 참여하고 있지 않습니다.' };
      }

      const message = {
        id: uuidv4(),
        conversation_id: data.conversation_id,
        sender_id: requesterId,
        sender_name: requester.name,
        content: data.content,
        type: data.type || 'text',
        is_deleted: false,
        created_at: new Date().toISOString(),
      };

      await db.addMessage(message);

      // 대화방 updated_at 갱신
      await db.updateConversation(data.conversation_id, { updated_at: new Date().toISOString() });

      // 자신의 읽음 처리 자동
      await db.upsertReadReceipt(data.conversation_id, requesterId, message.id);

      return { success: true, data: message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 메시지 삭제 (소프트 삭제)
  // ========================================
  ipcMain.handle('messenger:deleteMessage', async (_event, requesterId: string, messageId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const messages = await db.getMessages();
      const msg = messages.find((m: any) => m.id === messageId);
      if (!msg) {
        return { success: false, error: '메시지를 찾을 수 없습니다.' };
      }

      // 본인 메시지만 삭제 가능 (admin은 모두 가능)
      if (msg.sender_id !== requesterId && requester.role !== 'super_admin') {
        return { success: false, error: '자신의 메시지만 삭제할 수 있습니다.' };
      }

      await db.deleteMessage(messageId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 읽음 처리
  // ========================================
  ipcMain.handle('messenger:markAsRead', async (_event, requesterId: string, conversationId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const messages = await db.getMessagesByConversationId(conversationId);
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        await db.upsertReadReceipt(conversationId, requesterId, lastMsg.id);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 폴링: 새 메시지 확인 (전체 안 읽은 수)
  // ========================================
  ipcMain.handle('messenger:pollUpdates', async (_event, requesterId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const conversations = await db.getConversationsByUserId(requesterId);
      let totalUnread = 0;
      const updates: any[] = [];

      for (const conv of conversations) {
        const messages = await db.getMessagesByConversationId(conv.id);
        const receipt = await db.getReadReceiptsByConversation(conv.id, requesterId);

        let unreadCount = 0;
        if (receipt) {
          const lastReadIdx = messages.findIndex((m: any) => m.id === receipt.last_read_message_id);
          unreadCount = lastReadIdx >= 0 ? messages.length - lastReadIdx - 1 : messages.length;
        } else {
          unreadCount = messages.length;
        }

        if (unreadCount > 0) {
          totalUnread += unreadCount;
          updates.push({
            conversation_id: conv.id,
            unreadCount,
            lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
          });
        }
      }

      return { success: true, data: { totalUnread, updates } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 사용자 목록 (대화 상대 선택용)
  // ========================================
  ipcMain.handle('messenger:getUsers', async (_event, requesterId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const allUsers = await db.getUsers();
      const users = allUsers
        .filter((u: any) => u.is_active && u.id !== requesterId)
        .map((u: any) => ({
          id: u.id,
          name: u.name,
          role: u.role,
          department_id: u.department_id,
          company_id: u.company_id,
        }));

      return { success: true, data: users };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 대화방 이름 변경 (그룹만)
  // ========================================
  ipcMain.handle('messenger:renameConversation', async (_event, requesterId: string, conversationId: string, newTitle: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const conv = await db.getConversationById(conversationId);
      if (!conv) {
        return { success: false, error: '대화방을 찾을 수 없습니다.' };
      }

      if (conv.type !== 'group') {
        return { success: false, error: '그룹 대화방만 이름을 변경할 수 있습니다.' };
      }

      if (!conv.participants.includes(requesterId)) {
        return { success: false, error: '이 대화에 참여하고 있지 않습니다.' };
      }

      if (!newTitle || !newTitle.trim()) {
        return { success: false, error: '대화방 이름을 입력해주세요.' };
      }

      const trimmedTitle = newTitle.trim();
      await db.updateConversation(conversationId, {
        title: trimmedTitle,
        updated_at: new Date().toISOString(),
      });

      // 시스템 메시지로 이름 변경 알림
      const sysMsg = {
        id: uuidv4(),
        conversation_id: conversationId,
        sender_id: 'system',
        sender_name: '시스템',
        content: `${requester.name}님이 대화방 이름을 '${trimmedTitle}'(으)로 변경했습니다.`,
        type: 'system',
        is_deleted: false,
        created_at: new Date().toISOString(),
      };
      await db.addMessage(sysMsg);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 대화방 나가기
  // ========================================
  ipcMain.handle('messenger:leaveConversation', async (_event, requesterId: string, conversationId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const conv = await db.getConversationById(conversationId);
      if (!conv) {
        return { success: false, error: '대화방을 찾을 수 없습니다.' };
      }

      // 1:1 대화방은 나가기 불가
      if (conv.type === 'direct') {
        return { success: false, error: '1:1 대화는 나갈 수 없습니다.' };
      }

      const newParticipants = (conv.participants || []).filter((p: string) => p !== requesterId);

      if (newParticipants.length === 0) {
        // 참여자가 없으면 대화방 삭제
        await db.deleteConversation(conversationId);
      } else {
        await db.updateConversation(conversationId, { participants: newParticipants });

        // 나갔다는 시스템 메시지
        const sysMsg = {
          id: uuidv4(),
          conversation_id: conversationId,
          sender_id: 'system',
          sender_name: '시스템',
          content: `${requester.name}님이 대화방을 나갔습니다.`,
          type: 'system',
          is_deleted: false,
          created_at: new Date().toISOString(),
        };
        await db.addMessage(sysMsg);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
