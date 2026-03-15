import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layout,
  List,
  Input,
  Button,
  Avatar,
  Badge,
  Typography,
  Space,
  Modal,
  Checkbox,
  Empty,
  Tooltip,
  Dropdown,
  App,
} from 'antd';
import {
  SendOutlined,
  PlusOutlined,
  UserOutlined,
  TeamOutlined,
  DeleteOutlined,
  LogoutOutlined,
  MoreOutlined,
  SearchOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Sider, Content } = Layout;
const { Text, Title } = Typography;
const { TextArea } = Input;

declare global {
  interface Window {
    electronAPI: any;
  }
}

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title: string;
  participants: string[];
  participantNames: Array<{ id: string; name: string; role: string }>;
  lastMessage: any;
  unreadCount: number;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  type: 'text' | 'system';
  is_deleted: boolean;
  created_at: string;
}

const MessengerPage: React.FC = () => {
  const { user } = useAuthStore();
  const { message: messageApi } = App.useApp();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // 새 대화 모달
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');

  // 대화방 이름 변경
  const [isRenamingConv, setIsRenamingConv] = useState(false);
  const [renameText, setRenameText] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 대화방 목록 로드
  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.messenger.getConversations(user.id);
      if (result.success) {
        setConversations(result.data);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [user?.id]);

  // 메시지 로드
  const loadMessages = useCallback(async (convId: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.messenger.getMessages(user.id, convId);
      if (result.success) {
        setMessages(result.data);
        // 읽음 처리
        await window.electronAPI.messenger.markAsRead(user.id, convId);
        // 대화 목록 새로고침 (안 읽은 수 갱신)
        loadConversations();
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, [user?.id, loadConversations]);

  // 초기 로드
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Realtime 이벤트 리스너
  useEffect(() => {
    const unsubMessage = window.electronAPI.messenger.onNewMessage?.((msg: Message) => {
      // 현재 선택된 대화방 메시지면 즉시 추가
      if (msg.conversation_id === selectedConvId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // 읽음 처리
        if (user?.id) {
          window.electronAPI.messenger.markAsRead(user.id, msg.conversation_id);
        }
      }
      // 대화 목록 새로고침 (unread 갱신)
      loadConversations();
    });

    const unsubConv = window.electronAPI.messenger.onConversationUpdated?.(() => {
      loadConversations();
    });

    return () => {
      unsubMessage?.();
      unsubConv?.();
    };
  }, [selectedConvId, user?.id, loadConversations]);

  // 폴링: 대화 목록 (30초 간격 - Realtime 백업용)
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      loadConversations();
    }, 30000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadConversations]);

  // 선택된 대화방 메시지 폴링 (15초 간격 - Realtime 백업용)
  useEffect(() => {
    if (messagePollingRef.current) clearInterval(messagePollingRef.current);

    if (selectedConvId) {
      loadMessages(selectedConvId);
      messagePollingRef.current = setInterval(() => {
        loadMessages(selectedConvId);
      }, 15000);
    }

    return () => {
      if (messagePollingRef.current) clearInterval(messagePollingRef.current);
    };
  }, [selectedConvId, loadMessages]);

  // 메시지 목록 스크롤 하단 유지
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 대화방 선택
  const handleSelectConversation = (convId: string) => {
    setSelectedConvId(convId);
    setIsRenamingConv(false);
    setRenameText('');
  };

  // 메시지 전송
  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedConvId || !user?.id) return;

    try {
      const result = await window.electronAPI.messenger.sendMessage(user.id, {
        conversation_id: selectedConvId,
        content: inputText.trim(),
      });

      if (result.success) {
        setInputText('');
        loadMessages(selectedConvId);
      } else {
        messageApi.error(result.error || '메시지 전송 실패');
      }
    } catch (err) {
      messageApi.error('메시지 전송 중 오류가 발생했습니다.');
    }
  };

  // Enter로 전송 (Shift+Enter는 줄바꿈)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 새 대화 모달 열기
  const handleOpenNewChat = async () => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.messenger.getUsers(user.id);
      if (result.success) {
        setAvailableUsers(result.data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
    setSelectedUserIds([]);
    setGroupTitle('');
    setNewChatModalOpen(true);
  };

  // 새 대화 생성
  const handleCreateConversation = async () => {
    if (!user?.id || selectedUserIds.length === 0) return;

    try {
      const type = selectedUserIds.length === 1 ? 'direct' : 'group';
      const result = await window.electronAPI.messenger.createConversation(user.id, {
        participants: selectedUserIds,
        title: type === 'group' ? groupTitle || undefined : undefined,
        type,
      });

      if (result.success) {
        setNewChatModalOpen(false);
        await loadConversations();
        setSelectedConvId(result.data.id);
        messageApi.success('대화방이 생성되었습니다.');
      } else {
        messageApi.error(result.error || '대화방 생성 실패');
      }
    } catch (err) {
      messageApi.error('대화방 생성 중 오류가 발생했습니다.');
    }
  };

  // 메시지 삭제
  const handleDeleteMessage = async (messageId: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.messenger.deleteMessage(user.id, messageId);
      if (result.success) {
        loadMessages(selectedConvId!);
      } else {
        messageApi.error(result.error || '삭제 실패');
      }
    } catch (err) {
      messageApi.error('삭제 중 오류가 발생했습니다.');
    }
  };

  // 대화방 나가기
  const handleLeaveConversation = async (convId: string) => {
    if (!user?.id) return;
    Modal.confirm({
      title: '대화방 나가기',
      content: '이 대화방을 나가시겠습니까?',
      okText: '나가기',
      cancelText: '취소',
      okButtonProps: { danger: true },
      onOk: async () => {
        const result = await window.electronAPI.messenger.leaveConversation(user.id, convId);
        if (result.success) {
          if (selectedConvId === convId) {
            setSelectedConvId(null);
            setMessages([]);
          }
          loadConversations();
          messageApi.success('대화방을 나갔습니다.');
        } else {
          messageApi.error(result.error || '나가기 실패');
        }
      },
    });
  };

  // 대화방 이름 변경
  const handleStartRename = () => {
    if (selectedConv) {
      setRenameText(getConvDisplayName(selectedConv));
      setIsRenamingConv(true);
    }
  };

  const handleCancelRename = () => {
    setIsRenamingConv(false);
    setRenameText('');
  };

  const handleConfirmRename = async () => {
    if (!user?.id || !selectedConvId || !renameText.trim()) return;
    try {
      const result = await window.electronAPI.messenger.renameConversation(user.id, selectedConvId, renameText.trim());
      if (result.success) {
        messageApi.success('대화방 이름이 변경되었습니다.');
        setIsRenamingConv(false);
        setRenameText('');
        loadConversations();
      } else {
        messageApi.error(result.error || '이름 변경 실패');
      }
    } catch (err) {
      messageApi.error('이름 변경 중 오류가 발생했습니다.');
    }
  };

  // 시간 포맷팅
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, '0');
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${ampm} ${h12}:${m}`;
  };

  // 현재 선택된 대화방 정보
  const selectedConv = conversations.find(c => c.id === selectedConvId);

  // 대화방 표시 이름 (1:1이면 상대방 이름)
  const getConvDisplayName = (conv: Conversation) => {
    if (conv.type === 'direct') {
      const other = conv.participantNames?.find(p => p.id !== user?.id);
      return other?.name || conv.title;
    }
    return conv.title;
  };

  // 검색 필터
  const filteredConversations = conversations.filter(conv => {
    if (!searchText) return true;
    const displayName = getConvDisplayName(conv);
    return displayName.toLowerCase().includes(searchText.toLowerCase());
  });

  return (
    <Layout style={{ height: 'calc(100vh - 160px)', borderRadius: 8, overflow: 'hidden' }}>
      {/* 대화방 목록 (왼쪽 사이드바) */}
      <Sider
        width={320}
        style={{
          background: 'inherit',
          borderRight: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Title level={4} style={{ margin: 0 }}>메신저</Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenNewChat}
              size="small"
            >
              새 대화
            </Button>
          </div>
          <Input
            prefix={<SearchOutlined />}
            placeholder="대화 검색..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
            size="small"
          />
        </div>

        {/* 대화방 리스트 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredConversations.length === 0 ? (
            <Empty
              description="대화가 없습니다"
              style={{ marginTop: 60 }}
            />
          ) : (
            <List
              dataSource={filteredConversations}
              renderItem={(conv) => {
                const displayName = getConvDisplayName(conv);
                const isSelected = conv.id === selectedConvId;

                return (
                  <List.Item
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      background: isSelected ? '#e6f7ff' : 'transparent',
                      borderBottom: '1px solid #f5f5f5',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#fafafa';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', width: '100%', gap: 12 }}>
                      <Badge count={conv.unreadCount} size="small">
                        <Avatar
                          icon={conv.type === 'group' ? <TeamOutlined /> : <UserOutlined />}
                          style={{
                            background: conv.type === 'group'
                              ? 'linear-gradient(135deg, #667eea, #764ba2)'
                              : '#1890ff',
                          }}
                        />
                      </Badge>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text strong ellipsis style={{ maxWidth: 150 }}>
                            {displayName}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                            {conv.lastMessage ? formatTime(conv.lastMessage.created_at) : ''}
                          </Text>
                        </div>
                        <Text
                          type="secondary"
                          ellipsis
                          style={{ fontSize: 12 }}
                        >
                          {conv.lastMessage
                            ? conv.lastMessage.type === 'system'
                              ? conv.lastMessage.content
                              : `${conv.lastMessage.sender_name}: ${conv.lastMessage.content}`
                            : '대화를 시작해보세요'}
                        </Text>
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          )}
        </div>
      </Sider>

      {/* 메시지 영역 (오른쪽) */}
      <Content style={{ display: 'flex', flexDirection: 'column', background: 'inherit' }}>
        {selectedConv ? (
          <>
            {/* 대화 헤더 */}
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Space>
                <Avatar
                  icon={selectedConv.type === 'group' ? <TeamOutlined /> : <UserOutlined />}
                  style={{
                    background: selectedConv.type === 'group'
                      ? 'linear-gradient(135deg, #667eea, #764ba2)'
                      : '#1890ff',
                  }}
                />
                <div>
                  {isRenamingConv && selectedConv.type === 'group' ? (
                    <Space>
                      <Input
                        value={renameText}
                        onChange={e => setRenameText(e.target.value)}
                        onPressEnter={handleConfirmRename}
                        size="small"
                        style={{ width: 200 }}
                        autoFocus
                      />
                      <Button type="text" size="small" icon={<CheckOutlined />} onClick={handleConfirmRename} style={{ color: '#52c41a' }} />
                      <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleCancelRename} />
                    </Space>
                  ) : (
                    <Space>
                      <Text strong>{getConvDisplayName(selectedConv)}</Text>
                      {selectedConv.type === 'group' && (
                        <Tooltip title="대화방 이름 변경">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={handleStartRename}
                            style={{ color: '#999' }}
                          />
                        </Tooltip>
                      )}
                    </Space>
                  )}
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {selectedConv.participantNames?.map(p => p.name).join(', ')}
                  </Text>
                </div>
              </Space>
              {selectedConv.type === 'group' && (
                <Tooltip title="대화방 나가기">
                  <Button
                    type="text"
                    icon={<LogoutOutlined />}
                    danger
                    onClick={() => handleLeaveConversation(selectedConv.id)}
                  />
                </Tooltip>
              )}
            </div>

            {/* 메시지 목록 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
              {messages.map((msg, idx) => {
                const isMe = msg.sender_id === user?.id;
                const isSystem = msg.type === 'system';

                // 날짜 구분선
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const showDateDivider = !prevMsg ||
                  new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();

                return (
                  <React.Fragment key={msg.id}>
                    {showDateDivider && (
                      <div style={{ textAlign: 'center', margin: '16px 0' }}>
                        <Text type="secondary" style={{ fontSize: 12, background: '#f5f5f5', padding: '4px 12px', borderRadius: 12 }}>
                          {new Date(msg.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                        </Text>
                      </div>
                    )}

                    {isSystem ? (
                      <div style={{ textAlign: 'center', margin: '8px 0' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{msg.content}</Text>
                      </div>
                    ) : (
                      <div style={{
                        display: 'flex',
                        flexDirection: isMe ? 'row-reverse' : 'row',
                        marginBottom: 8,
                        gap: 8,
                      }}>
                        {!isMe && (
                          <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1890ff', flexShrink: 0 }} />
                        )}
                        <div style={{ maxWidth: '70%' }}>
                          {!isMe && (
                            <Text type="secondary" style={{ fontSize: 11, marginBottom: 2, display: 'block' }}>
                              {msg.sender_name}
                            </Text>
                          )}
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                            <Dropdown
                              menu={{
                                items: [
                                  ...(isMe || user?.role === 'super_admin' ? [{
                                    key: 'delete',
                                    label: '삭제',
                                    icon: <DeleteOutlined />,
                                    danger: true,
                                    onClick: () => handleDeleteMessage(msg.id),
                                  }] : []),
                                ],
                              }}
                              trigger={['contextMenu']}
                            >
                              <div
                                style={{
                                  background: msg.is_deleted
                                    ? '#f5f5f5'
                                    : isMe
                                      ? '#1890ff'
                                      : '#f0f0f0',
                                  color: msg.is_deleted ? '#999' : isMe ? '#fff' : '#333',
                                  padding: '8px 14px',
                                  borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  fontSize: 14,
                                  fontStyle: msg.is_deleted ? 'italic' : 'normal',
                                }}
                              >
                                {msg.is_deleted ? '삭제된 메시지입니다' : msg.content}
                              </div>
                            </Dropdown>
                            <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>
                              {formatMessageTime(msg.created_at)}
                            </Text>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #f0f0f0',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
            }}>
              <TextArea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
                autoSize={{ minRows: 1, maxRows: 4 }}
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
              />
            </div>
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
          }}>
            <TeamOutlined style={{ fontSize: 64, marginBottom: 16 }} />
            <Title level={4} type="secondary">대화를 선택하세요</Title>
            <Text type="secondary">왼쪽에서 대화를 선택하거나 새 대화를 시작하세요</Text>
          </div>
        )}
      </Content>

      {/* 새 대화 모달 */}
      <Modal
        title="새 대화 시작"
        open={newChatModalOpen}
        onCancel={() => setNewChatModalOpen(false)}
        onOk={handleCreateConversation}
        okText="대화 시작"
        cancelText="취소"
        okButtonProps={{ disabled: selectedUserIds.length === 0 }}
      >
        {selectedUserIds.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>그룹 이름 (선택사항)</Text>
            <Input
              placeholder="그룹 이름을 입력하세요"
              value={groupTitle}
              onChange={e => setGroupTitle(e.target.value)}
              style={{ marginTop: 4 }}
            />
          </div>
        )}
        <Text strong>대화 상대를 선택하세요</Text>
        <div style={{ marginTop: 8, maxHeight: 400, overflow: 'auto' }}>
          <Checkbox.Group
            value={selectedUserIds}
            onChange={(values) => setSelectedUserIds(values as string[])}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {availableUsers.map(u => (
                <Checkbox key={u.id} value={u.id} style={{ width: '100%' }}>
                  <Space>
                    <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1890ff' }} />
                    <div>
                      <Text>{u.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                        {u.role === 'super_admin' ? '슈퍼관리자' :
                         u.role === 'company_admin' ? '회사 관리자' :
                         u.role === 'department_manager' ? '부서 관리자' : '사원'}
                      </Text>
                    </div>
                  </Space>
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        </div>
        {selectedUserIds.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">
              {selectedUserIds.length === 1
                ? '1:1 대화가 생성됩니다'
                : `${selectedUserIds.length}명과 그룹 대화가 생성됩니다`
              }
            </Text>
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default MessengerPage;
