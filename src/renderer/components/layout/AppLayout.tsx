import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Space, Typography, Badge, Drawer, Descriptions, Divider, Table, Tag, List, Popover, Empty, Progress, message, Modal, Result, Select } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  BellOutlined,
  SunOutlined,
  MoonOutlined,
  HomeOutlined,
  DashboardOutlined,
  SearchOutlined,
  FileTextOutlined,
  ProfileOutlined,
  BarChartOutlined,
  HistoryOutlined,
  TeamOutlined,
  BankOutlined,
  DollarOutlined,
  CreditCardOutlined,
  SafetyOutlined,
  TransactionOutlined,
  CalendarOutlined,
  GiftOutlined,
  CarOutlined,
  ProjectOutlined,
  AppstoreOutlined,
  UserSwitchOutlined,
  LockOutlined,
  ToolOutlined,
  CloudUploadOutlined,
  SolutionOutlined,
  ApartmentOutlined,
  FormOutlined,
  FileAddOutlined,
  EnvironmentOutlined,
  RobotOutlined,
  MessageOutlined,
  IdcardOutlined,
  FileProtectOutlined,
  PhoneOutlined,
  MailOutlined,
  MinusOutlined,
  BorderOutlined,
  BlockOutlined,
  CloseOutlined,
  SafetyCertificateOutlined,
  FundProjectionScreenOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { MENU_STRUCTURE } from '../../../shared/constants/menu';
import type { MenuItem as MenuItemType } from '../../../shared/types';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// 아이콘 매핑
const iconMap: Record<string, React.ReactNode> = {
  HomeOutlined: <HomeOutlined />,
  DashboardOutlined: <DashboardOutlined />,
  SearchOutlined: <SearchOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  ProfileOutlined: <ProfileOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  HistoryOutlined: <HistoryOutlined />,
  TeamOutlined: <TeamOutlined />,
  BankOutlined: <BankOutlined />,
  DollarOutlined: <DollarOutlined />,
  CreditCardOutlined: <CreditCardOutlined />,
  SafetyOutlined: <SafetyOutlined />,
  TransactionOutlined: <TransactionOutlined />,
  UserOutlined: <UserOutlined />,
  CalendarOutlined: <CalendarOutlined />,
  GiftOutlined: <GiftOutlined />,
  CarOutlined: <CarOutlined />,
  ProjectOutlined: <ProjectOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  SettingOutlined: <SettingOutlined />,
  UserSwitchOutlined: <UserSwitchOutlined />,
  LockOutlined: <LockOutlined />,
  ToolOutlined: <ToolOutlined />,
  CloudUploadOutlined: <CloudUploadOutlined />,
  SolutionOutlined: <SolutionOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  FormOutlined: <FormOutlined />,
  FileAddOutlined: <FileAddOutlined />,
  EnvironmentOutlined: <EnvironmentOutlined />,
  RobotOutlined: <RobotOutlined />,
  MessageOutlined: <MessageOutlined />,
  SafetyCertificateOutlined: <SafetyCertificateOutlined />,
  FundProjectionScreenOutlined: <FundProjectionScreenOutlined />,
};

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  // 업데이트 상태
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState('');
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [appVersion, setAppVersion] = useState('');
  // 강제 업데이트 상태
  const [forceUpdateRequired, setForceUpdateRequired] = useState(false);
  const [forceMinVersion, setForceMinVersion] = useState('');
  // 회사 전환 (총괄관리자용)
  const [companyList, setCompanyList] = useState<any[]>([]);
  const { selectedCompanyId, selectedCompanyName, setSelectedCompany } = useAuthStore();

  const navigate = useNavigate();
  const location = useLocation();

  const { user, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();

  // 총괄관리자: 회사 목록 로드
  useEffect(() => {
    if (user?.role === 'super_admin' && user?.id) {
      window.electronAPI.companies.getAll(user.id).then((result: any) => {
        if (result.success) {
          setCompanyList(result.companies || []);
          // 선택된 회사가 없으면 '전체' 모드
          if (!selectedCompanyId) {
            setSelectedCompany(null, '전체');
          }
        }
      }).catch(() => {});
    }
  }, [user?.id, user?.role]);

  // 앱 시작 시 버전 조회 및 업데이트 확인
  useEffect(() => {
    // 버전 조회
    window.electronAPI.app.getVersion().then((v: string) => setAppVersion(v)).catch(() => {});

    // 강제 업데이트 확인
    window.electronAPI.updater.checkForceUpdate().then((result: any) => {
      if (result?.forceUpdate) {
        setForceUpdateRequired(true);
        setForceMinVersion(result.minVersion);
        // 강제 업데이트 시 자동 다운로드 시작
        window.electronAPI.updater.check().then(() => {
          window.electronAPI.updater.download().catch(() => {});
        }).catch(() => {});
      }
    }).catch(() => {});

    // 업데이트 체크
    window.electronAPI.updater.check().catch(() => {});

    // 업데이트 이벤트 리스너
    const unsubAvailable = window.electronAPI.updater.onUpdateAvailable((info: any) => {
      setUpdateAvailable(true);
      setUpdateVersion(info?.version || '');
    });
    const unsubProgress = window.electronAPI.updater.onDownloadProgress((progress: any) => {
      setDownloadPercent(Math.round(progress?.percent || 0));
    });
    const unsubDownloaded = window.electronAPI.updater.onUpdateDownloaded(() => {
      setUpdateDownloading(false);
      setUpdateDownloaded(true);
    });

    return () => {
      unsubAvailable?.();
      unsubProgress?.();
      unsubDownloaded?.();
    };
  }, []);

  const handleUpdateDownload = async () => {
    setUpdateDownloading(true);
    setDownloadPercent(0);
    try {
      const result = await window.electronAPI.updater.download();
      if (!result.success) {
        message.error('업데이트 다운로드에 실패했습니다.');
        setUpdateDownloading(false);
      }
    } catch {
      message.error('업데이트 다운로드 중 오류가 발생했습니다.');
      setUpdateDownloading(false);
    }
  };

  const handleUpdateInstall = () => {
    window.electronAPI.updater.install();
  };

  // 읽지 않은 메시지 수 폴링
  useEffect(() => {
    if (!user?.id) return;
    const fetchUnread = async () => {
      try {
        const result = await (window as any).electronAPI.messenger.pollUpdates(user.id);
        if (result.success) {
          setUnreadMessages(result.data.totalUnread || 0);
        }
      } catch (_) {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // 알림 수 폴링
  const fetchNotificationCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await (window as any).electronAPI.notifications.getUnreadCount(user.id);
      if (result.success) {
        setUnreadNotifications(result.count || 0);
      }
    } catch (_) {}
  }, [user?.id]);

  useEffect(() => {
    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 15000);
    return () => clearInterval(interval);
  }, [fetchNotificationCount]);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      const result = await (window as any).electronAPI.notifications.getAll(user.id);
      if (result.success) {
        setNotifications(result.notifications || []);
      }
    } catch (_) {}
  };

  const handleNotifPopoverOpen = (open: boolean) => {
    setNotifPopoverOpen(open);
    if (open) fetchNotifications();
  };

  const handleNotifClick = async (notif: any) => {
    if (!notif.is_read) {
      await (window as any).electronAPI.notifications.markRead(user!.id, notif.id);
      fetchNotificationCount();
    }
    setNotifPopoverOpen(false);
    if (notif.link) navigate(notif.link);
  };

  const handleMarkAllRead = async () => {
    await (window as any).electronAPI.notifications.markAllRead(user!.id);
    fetchNotificationCount();
    fetchNotifications();
  };

  // 창 제어
  const handleMinimize = () => window.electronAPI.window.minimize();
  const handleMaximize = async () => {
    await window.electronAPI.window.maximize();
    const maximized = await window.electronAPI.window.isMaximized();
    setIsMaximized(maximized);
  };
  const handleClose = () => window.electronAPI.window.close();

  // 메뉴 아이템 빌드
  const buildMenuItems = (items: MenuItemType[]): any[] => {
    return items
      .filter((item) => {
        // 역할 기반 필터링
        if (item.roles && user) {
          return item.roles.includes(user.role);
        }
        return true;
      })
      .map((item) => ({
        key: item.path || item.key,
        icon: iconMap[item.icon],
        label: item.label,
        children: item.children ? buildMenuItems(item.children) : undefined,
      }));
  };

  const menuItems = buildMenuItems(MENU_STRUCTURE);

  // 사용자 드롭다운 메뉴
  const userMenuItems = [
    {
      key: 'profile',
      icon: <IdcardOutlined />,
      label: '내 정보',
      onClick: () => setProfileDrawerOpen(true),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '설정',
      onClick: () => navigate('/settings'),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      danger: true,
      onClick: async () => {
        await logout();
        navigate('/login');
      },
    },
  ];

  // 역할 표시 (4단계 권한 시스템)
  const roleLabel: Record<string, string> = {
    super_admin: '슈퍼관리자',
    company_admin: '회사 관리자',
    department_manager: '부서 관리자',
    employee: '사원',
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 사이드바 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={260}
        style={{
          background: isDark ? '#141414' : '#fff',
          borderRight: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 100,
          overflow: 'hidden',
        }}
      >
        {/* 로고 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 24px',
            borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          }}
        >
          {(() => {
            const displayName = user?.role === 'super_admin'
              ? (selectedCompanyName || '전체')
              : (user?.company_name || '건설경제연구원');
            const firstChar = displayName.charAt(0) || '건';
            return (
              <>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 16,
                  }}
                >
                  {firstChar}
                </div>
                {!collapsed && (
                  <div style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
                    {user?.role === 'super_admin' ? (
                      <Select
                        value={selectedCompanyId || 'all'}
                        onChange={(value) => {
                          if (value === 'all') {
                            setSelectedCompany(null, '전체');
                          } else {
                            const company = companyList.find((c: any) => c.id === value);
                            setSelectedCompany(value, company?.name || '');
                          }
                        }}
                        bordered={false}
                        style={{
                          width: '100%',
                          fontWeight: 600,
                          fontSize: 15,
                        }}
                        dropdownStyle={{ minWidth: 200 }}
                        size="small"
                      >
                        <Select.Option value="all">전체 (총괄)</Select.Option>
                        {companyList.map((c: any) => (
                          <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                        ))}
                      </Select>
                    ) : (
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: isDark ? '#fff' : '#333',
                          display: 'block',
                          lineHeight: 1.2,
                        }}
                      >
                        {user?.company_name || '건설경제연구원'}
                      </span>
                    )}
                    {appVersion && (
                      <span style={{ fontSize: 10, color: '#999', display: 'block' }}>v{appVersion}</span>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* 메뉴 - 스크롤 가능 */}
        <div
          style={{
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            defaultOpenKeys={['home', 'contracts', 'calendar', 'communication', 'project', 'admin', 'system']}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{
              border: 'none',
              background: 'transparent',
            }}
          />
        </div>
      </Sider>

      {/* 사이드바 공간 확보 */}
      <div style={{ width: collapsed ? 80 : 260, flexShrink: 0, transition: 'width 0.2s' }} />

      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
        {/* 헤더 */}
        <Header
          className="titlebar-drag"
          style={{
            padding: 0,
            background: isDark ? '#141414' : '#fff',
            borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            height: 48,
            lineHeight: '48px',
          }}
        >
          <Space className="titlebar-no-drag" style={{ paddingLeft: 12 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16 }}
            />
          </Space>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Space size="middle" className="titlebar-no-drag" style={{ paddingRight: 8 }}>
              {/* 테마 토글 */}
              <Button
                type="text"
                icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggle}
              />

              {/* 메신저 */}
              <Badge count={unreadMessages} size="small">
                <Button
                  type="text"
                  icon={<MessageOutlined />}
                  onClick={() => navigate('/messenger')}
                />
              </Badge>

              {/* 알림 */}
              <Popover
                content={
                  <div style={{ width: 340, maxHeight: 400, overflow: 'auto' }}>
                    {notifications.length === 0 ? (
                      <Empty description="알림이 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <>
                        <div style={{ textAlign: 'right', marginBottom: 8 }}>
                          <Button type="link" size="small" onClick={handleMarkAllRead}>
                            모두 읽음
                          </Button>
                        </div>
                        <List
                          dataSource={notifications.slice(0, 20)}
                          renderItem={(item: any) => (
                            <List.Item
                              style={{
                                cursor: 'pointer',
                                padding: '8px 12px',
                                background: item.is_read ? 'transparent' : (isDark ? '#1a2332' : '#f0f5ff'),
                                borderRadius: 6,
                                marginBottom: 4,
                              }}
                              onClick={() => handleNotifClick(item)}
                            >
                              <List.Item.Meta
                                title={<span style={{ fontSize: 13 }}>{item.title}</span>}
                                description={
                                  <div>
                                    <div style={{ fontSize: 12, color: '#888' }}>{item.message}</div>
                                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                                      {item.created_at ? new Date(item.created_at).toLocaleString('ko-KR') : ''}
                                    </div>
                                  </div>
                                }
                              />
                            </List.Item>
                          )}
                        />
                      </>
                    )}
                  </div>
                }
                title="알림"
                trigger="click"
                open={notifPopoverOpen}
                onOpenChange={handleNotifPopoverOpen}
                placement="bottomRight"
              >
                <Badge count={unreadNotifications} size="small">
                  <Button type="text" icon={<BellOutlined />} />
                </Badge>
              </Popover>

              {/* 사용자 메뉴 */}
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar
                    size="small"
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                    icon={<UserOutlined />}
                  />
                  <div style={{ lineHeight: 1.2 }}>
                    <Text strong style={{ display: 'block', fontSize: 13 }}>
                      {user?.name || '사용자'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {roleLabel[user?.role || 'employee'] || '사원'}
                    </Text>
                  </div>
                </Space>
              </Dropdown>
            </Space>

            {/* 창 컨트롤 - Windows 11 스타일 */}
            <div className="window-controls">
              <button className="window-btn" onClick={handleMinimize} title="최소화">
                <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
                  <rect width="10" height="1" />
                </svg>
              </button>
              <button className="window-btn" onClick={handleMaximize} title={isMaximized ? '이전 크기로 복원' : '최대화'}>
                {isMaximized ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="1.5" y="3" width="6.5" height="6.5" />
                    <polyline points="3,3 3,0.5 9.5,0.5 9.5,7 7.5,7" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="0.5" y="0.5" width="9" height="9" />
                  </svg>
                )}
              </button>
              <button className="window-btn close-btn" onClick={handleClose} title="닫기">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M1.05 0.34L0.34 1.05 3.79 4.5 0.34 7.95 1.05 8.66 4.5 5.21 7.95 8.66 8.66 7.95 5.21 4.5 8.66 1.05 7.95 0.34 4.5 3.79Z" />
                </svg>
              </button>
            </div>
          </div>
        </Header>

        {/* 업데이트 알림 배너 */}
        {updateAvailable && (
          <div
            style={{
              padding: '8px 16px',
              background: updateDownloaded ? '#f6ffed' : '#e6f7ff',
              borderBottom: `1px solid ${updateDownloaded ? '#b7eb8f' : '#91d5ff'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <Space>
              <SyncOutlined spin={updateDownloading} style={{ color: '#1890ff' }} />
              <span style={{ fontSize: 13 }}>
                {updateDownloaded
                  ? `새 버전(${updateVersion})이 준비되었습니다. 재시작하여 업데이트를 적용하세요.`
                  : updateDownloading
                    ? `업데이트 다운로드 중... ${downloadPercent}%`
                    : `새 버전(${updateVersion})이 있습니다.`
                }
              </span>
              {updateDownloading && (
                <Progress percent={downloadPercent} size="small" style={{ width: 120, margin: 0 }} showInfo={false} />
              )}
            </Space>
            <Space>
              {!updateDownloading && !updateDownloaded && (
                <Button type="primary" size="small" onClick={handleUpdateDownload}>
                  업데이트
                </Button>
              )}
              {updateDownloaded && (
                <Button type="primary" size="small" onClick={handleUpdateInstall}>
                  재시작
                </Button>
              )}
              {!updateDownloading && !updateDownloaded && (
                <Button type="text" size="small" onClick={() => setUpdateAvailable(false)}>
                  <CloseOutlined />
                </Button>
              )}
            </Space>
          </div>
        )}

        {/* 컨텐츠 영역 - 세로 스크롤 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px 24px',
            background: isDark
              ? 'linear-gradient(180deg, #1a1a2e 0%, #141414 100%)'
              : 'linear-gradient(180deg, #f8f9fe 0%, #f0f2f5 100%)',
          }}
        >
          <Content
            className="content-area"
            style={{
              padding: 24,
              background: isDark ? '#1f1f1f' : '#fff',
              borderRadius: 16,
              minHeight: 'calc(100vh - 160px)',
              boxShadow: isDark
                ? '0 1px 3px rgba(0,0,0,0.3)'
                : '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <Outlet />
          </Content>
        </div>
      </Layout>

      {/* 내 정보 Drawer */}
      <Drawer
        title={
          <Space>
            <Avatar
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              icon={<UserOutlined />}
              size={40}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{user?.name || '-'}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {roleLabel[user?.role || 'employee']} {user?.position ? `/ ${user.position}` : ''}
              </Text>
            </div>
          </Space>
        }
        placement="right"
        width={480}
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
      >
        {/* 기본 정보 */}
        <Descriptions column={2} size="small" bordered style={{ marginBottom: 20 }}>
          <Descriptions.Item label="사번">{user?.employee_number || '-'}</Descriptions.Item>
          <Descriptions.Item label="이름">{user?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="아이디">{user?.username || '-'}</Descriptions.Item>
          <Descriptions.Item label="역할">
            <Tag color={
              user?.role === 'super_admin' ? 'red' :
              user?.role === 'company_admin' ? 'orange' :
              user?.role === 'department_manager' ? 'blue' : 'default'
            }>
              {roleLabel[user?.role || 'employee']}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="직급">{user?.rank || '-'}</Descriptions.Item>
          <Descriptions.Item label="직책">{user?.position || '-'}</Descriptions.Item>
          <Descriptions.Item label="소속 회사">{user?.company_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="소속 부서">{user?.department_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="입사일">{user?.hire_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="연락처">
            {user?.phone ? (
              <Space size={4}><PhoneOutlined />{user.phone}</Space>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="이메일" span={2}>
            {user?.email ? (
              <Space size={4}><MailOutlined />{user.email}</Space>
            ) : '-'}
          </Descriptions.Item>
        </Descriptions>

        {/* 학력 */}
        {user?.education && user.education.length > 0 && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>학력</Divider>
            <Table
              dataSource={user.education}
              rowKey={(_: any, i: any) => `edu-${i}`}
              pagination={false}
              size="small"
              columns={[
                { title: '학교', dataIndex: 'school', key: 'school' },
                { title: '전공', dataIndex: 'major', key: 'major' },
                { title: '학위', dataIndex: 'degree', key: 'degree' },
                { title: '졸업', dataIndex: 'graduation_year', key: 'graduation_year', width: 70 },
              ]}
            />
          </>
        )}

        {/* 자격증 */}
        {user?.certifications && user.certifications.length > 0 && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>자격증</Divider>
            <Table
              dataSource={user.certifications}
              rowKey={(_: any, i: any) => `cert-${i}`}
              pagination={false}
              size="small"
              columns={[
                { title: '자격증명', dataIndex: 'name', key: 'name' },
                { title: '발급기관', dataIndex: 'issuer', key: 'issuer' },
                { title: '취득일', dataIndex: 'acquired_date', key: 'acquired_date', width: 100 },
              ]}
            />
          </>
        )}

        {/* 경력 */}
        {user?.career_history && user.career_history.length > 0 && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>경력사항</Divider>
            <Table
              dataSource={user.career_history}
              rowKey={(_: any, i: any) => `career-${i}`}
              pagination={false}
              size="small"
              columns={[
                { title: '회사', dataIndex: 'company', key: 'company' },
                { title: '직위', dataIndex: 'position', key: 'position' },
                { title: '기간', dataIndex: 'period', key: 'period' },
              ]}
            />
          </>
        )}

        <Divider />

        {/* 하단 버튼 */}
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            block
            icon={<FileProtectOutlined />}
            onClick={() => {
              setProfileDrawerOpen(false);
              navigate('/hr/certificates');
            }}
          >
            증명서 발급
          </Button>
          <Button
            block
            icon={<SettingOutlined />}
            onClick={() => {
              setProfileDrawerOpen(false);
              navigate('/settings');
            }}
          >
            설정으로 이동
          </Button>
        </Space>
      </Drawer>

      {/* 강제 업데이트 모달 - 닫을 수 없음 */}
      <Modal
        open={forceUpdateRequired}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={null}
        centered
        width={480}
      >
        <Result
          status="warning"
          title="필수 업데이트"
          subTitle={
            <>
              <p>현재 버전({appVersion})은 더 이상 사용할 수 없습니다.</p>
              <p>최소 요구 버전: <strong>v{forceMinVersion}</strong></p>
            </>
          }
        >
          {updateDownloaded ? (
            <Button type="primary" size="large" onClick={handleUpdateInstall}>
              재시작하여 업데이트 적용
            </Button>
          ) : updateDownloading ? (
            <Space direction="vertical" align="center" style={{ width: '100%' }}>
              <SyncOutlined spin style={{ fontSize: 24, color: '#1890ff' }} />
              <span>업데이트 다운로드 중... {downloadPercent}%</span>
              <Progress percent={downloadPercent} style={{ width: 300 }} />
            </Space>
          ) : updateAvailable ? (
            <Button type="primary" size="large" onClick={handleUpdateDownload}>
              업데이트 다운로드
            </Button>
          ) : (
            <Space direction="vertical" align="center" style={{ width: '100%' }}>
              <SyncOutlined spin style={{ fontSize: 24, color: '#1890ff' }} />
              <span>업데이트 확인 중...</span>
            </Space>
          )}
        </Result>
      </Modal>
    </Layout>
  );
};

export default AppLayout;
