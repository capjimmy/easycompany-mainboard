import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Space, Typography, Badge, Drawer, Descriptions, Divider, Table, Tag, List, Popover, Empty, Progress, message, Modal, Result, Select, Tooltip } from 'antd';
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
  QuestionCircleOutlined,
  EditOutlined,
  HolderOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { MENU_STRUCTURE, DEFAULT_PERMISSIONS } from '../../../shared/constants/menu';
import type { MenuItem as MenuItemType } from '../../../shared/types';
import MenuReorderModal from '../MenuReorderModal';

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
  IdcardOutlined: <IdcardOutlined />,
  SafetyCertificateOutlined: <SafetyCertificateOutlined />,
  FundProjectionScreenOutlined: <FundProjectionScreenOutlined />,
  QuestionCircleOutlined: <QuestionCircleOutlined />,
};

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [menuReorderOpen, setMenuReorderOpen] = useState(false);
  // 사이드바 드래그앤드롭 편집 모드
  const [isMenuEditing, setIsMenuEditing] = useState(false);
  const [tempMenuOrder, setTempMenuOrder] = useState<string[]>([]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [leaveInfo, setLeaveInfo] = useState<{ total: number; used: number; remaining: number } | null>(null);
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
  // 매뉴얼 모달
  const [manualVisible, setManualVisible] = useState(false);
  const [manualHtml, setManualHtml] = useState('');
  const [manualTitle, setManualTitle] = useState('매뉴얼');
  const [manualMenus, setManualMenus] = useState<{ key: string; label: string; group: string }[]>([]);
  const [selectedManualKey, setSelectedManualKey] = useState<string>('');
  const [manualCache, setManualCache] = useState<Record<string, { title: string; content: string }>>({});

  const navigate = useNavigate();
  const location = useLocation();

  const { user, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();

  // 회사 목록 로드 (총괄관리자 또는 다중 회사 소속자)
  useEffect(() => {
    if (!user?.id) return;
    if (user.role === 'super_admin') {
      // 슈퍼관리자: 모든 회사
      window.electronAPI.companies.getAll(user.id).then((result: any) => {
        if (result.success) {
          setCompanyList(result.companies || []);
          if (!selectedCompanyId) setSelectedCompany(null, '전체');
        }
      }).catch(() => {});
    } else {
      // 일반 사용자: user_companies에서 소속 회사 로드
      (window as any).electronAPI.users.getUserCompanies(user.id).then((result: any) => {
        if (result.success && result.data && result.data.length > 1) {
          // 다중 회사 소속 → 회사 목록 로드
          window.electronAPI.companies.getAll(user.id).then((cResult: any) => {
            if (cResult.success) {
              const myCompanyIds = new Set(result.data.map((uc: any) => uc.company_id));
              const myCompanies = (cResult.companies || []).filter((c: any) => myCompanyIds.has(c.id));
              setCompanyList(myCompanies);
              if (!selectedCompanyId && user.company_id) {
                const primary = myCompanies.find((c: any) => c.id === user.company_id);
                setSelectedCompany(user.company_id, primary?.name || '');
              }
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [user?.id, user?.role]);

  // 단축키: Ctrl+F5 → 홈(대시보드)으로 이동
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'F5') {
        e.preventDefault();
        navigate('/dashboard');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

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

  // 현재 경로에서 메뉴 키 찾기
  const getCurrentMenuKey = (): { key: string; label: string } | null => {
    const path = location.pathname;
    for (const group of MENU_STRUCTURE) {
      if (group.path === path) return { key: group.key, label: group.label };
      if (group.children) {
        for (const child of group.children) {
          if (child.path === path) return { key: child.key, label: child.label };
        }
      }
    }
    return null;
  };

  // 사용자가 접근 가능한 메뉴 목록 (매뉴얼용)
  const getAccessibleMenus = () => {
    const menus: { key: string; label: string; group: string }[] = [];
    for (const group of MENU_STRUCTURE) {
      // 역할 기반 필터링
      if (group.roles && user && !group.roles.includes(user.role)) continue;

      if (group.children) {
        for (const child of group.children) {
          // 역할 기반 필터링
          if (child.roles && user && !child.roles.includes(user.role)) continue;
          // per-user 권한 필터링
          const perm = effectivePermissions[child.key];
          if (perm && !perm.view) continue;
          menus.push({ key: child.key, label: child.label, group: group.label });
        }
      }
    }
    return menus;
  };

  // 매뉴얼 열기 (접근 가능한 전체 메뉴 목록 + 현재 메뉴 선택)
  const handleOpenManual = async () => {
    const accessibleMenus = getAccessibleMenus();
    setManualMenus(accessibleMenus);

    // 현재 메뉴 키 찾기
    const currentMenu = getCurrentMenuKey();
    const initialKey = currentMenu?.key || (accessibleMenus.length > 0 ? accessibleMenus[0].key : '');
    setSelectedManualKey(initialKey);

    // 모든 매뉴얼을 미리 로드
    const cache: Record<string, { title: string; content: string }> = {};
    let cid = selectedCompanyId || user?.company_id;
    // super_admin이 '전체' 모드일 때 기본 회사 ID 사용
    if (!cid) {
      cid = 'a0000000-0000-0000-0000-000000000001';
    }
    if (cid) {
      try {
        const result = await (window as any).electronAPI.menuManuals.getAll(user?.id, cid);
        if (result.success && result.manuals) {
          for (const m of result.manuals) {
            cache[m.menu_key] = { title: m.title, content: m.content };
          }
        }
      } catch { /* ignore */ }
    }
    setManualCache(cache);

    // 선택된 메뉴의 매뉴얼 표시
    if (initialKey && cache[initialKey]) {
      setManualTitle(cache[initialKey].title);
      setManualHtml(cache[initialKey].content);
    } else {
      const label = accessibleMenus.find(m => m.key === initialKey)?.label || '';
      setManualTitle(`${label} 매뉴얼`);
      setManualHtml(`
        <div style="padding: 40px; text-align: center; color: #888;">
          <h2 style="margin-bottom: 16px;">매뉴얼 준비 중</h2>
          <p style="font-size: 15px; line-height: 1.8;">
            <strong>${label}</strong> 메뉴에 대한 매뉴얼이 아직 등록되지 않았습니다.
          </p>
        </div>
      `);
    }

    setManualVisible(true);
  };

  // 매뉴얼에서 메뉴 선택 변경
  const handleManualMenuSelect = (menuKey: string) => {
    setSelectedManualKey(menuKey);
    const menu = manualMenus.find(m => m.key === menuKey);
    const label = menu?.label || '';

    if (manualCache[menuKey]) {
      setManualTitle(manualCache[menuKey].title);
      setManualHtml(manualCache[menuKey].content);
    } else {
      setManualTitle(`${label} 매뉴얼`);
      setManualHtml(`
        <div style="padding: 40px; text-align: center; color: #888;">
          <h2 style="margin-bottom: 16px;">매뉴얼 준비 중</h2>
          <p style="font-size: 15px; line-height: 1.8;">
            <strong>${label}</strong> 메뉴에 대한 매뉴얼이 아직 등록되지 않았습니다.
          </p>
        </div>
      `);
    }
  };

  // 창 제어
  const handleMinimize = () => window.electronAPI.window.minimize();
  const handleMaximize = async () => {
    await window.electronAPI.window.maximize();
    const maximized = await window.electronAPI.window.isMaximized();
    setIsMaximized(maximized);
  };
  const handleClose = () => window.electronAPI.window.close();

  // 사용자의 유효 권한 계산 (per-user 권한 > 역할 기본 권한)
  const getUserPermissions = () => {
    if (!user) return {};
    // per-user 권한이 있으면 사용, 없으면 역할 기본 권한 사용
    if (user.permissions && Object.keys(user.permissions).length > 0) {
      return user.permissions;
    }
    return (DEFAULT_PERMISSIONS as any)[user.role] || DEFAULT_PERMISSIONS.employee;
  };

  const effectivePermissions = getUserPermissions();

  // 메뉴 아이템 빌드
  // 사용자 정의 권한 모드: menu_permissions에 row가 1건이라도 있으면 true
  // → 명시되지 않은 메뉴는 숨김 (super_admin은 항상 모두 표시)
  const isCustomized = !!(user as any)?.permissionsCustomized && user?.role !== 'super_admin';

  const buildMenuItems = (items: MenuItemType[]): any[] => {
    return items
      .filter((item) => {
        if (!user) return false;

        // 1. 역할 기반 필터링 (MENU_STRUCTURE에 roles가 지정된 경우)
        if (item.roles && !item.roles.includes(user.role)) {
          return false;
        }

        // 2. per-user 권한 필터링 (leaf 메뉴 아이템만 - key로 확인)
        //    부모 메뉴(children이 있는)는 자식이 있으면 표시
        if (item.children) {
          // 부모 메뉴: 표시 가능한 자식이 하나라도 있는지 확인
          const visibleChildren = item.children.filter((child) => {
            if (child.roles && !child.roles.includes(user.role)) return false;
            const perm = effectivePermissions[child.key];
            if (isCustomized) {
              // 사용자 정의 권한: 명시적으로 view=true 인 메뉴만 표시
              return !!perm?.view;
            }
            // 기본: perm 명시 + view=false 만 숨김
            if (perm && !perm.view) return false;
            return true;
          });
          return visibleChildren.length > 0;
        }

        // leaf 아이템
        const perm = effectivePermissions[item.key];
        if (isCustomized) {
          return !!perm?.view;
        }
        if (perm && !perm.view) {
          return false;
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

  // 사용자별 메뉴 순서 적용 (저장된 순서가 있으면 그대로, 모르는 키는 끝에)
  const orderedMenuStructure = React.useMemo(() => {
    const userOrder = (user as any)?.menu_order;
    if (!Array.isArray(userOrder) || userOrder.length === 0) return MENU_STRUCTURE;
    const byKey: Record<string, any> = {};
    MENU_STRUCTURE.forEach((g) => { byKey[g.key] = g; });
    const ordered: any[] = [];
    for (const k of userOrder) {
      if (byKey[k]) {
        ordered.push(byKey[k]);
        delete byKey[k];
      }
    }
    // 사용자 순서에 없는 그룹은 원본 순서대로 뒤에 붙임
    for (const g of MENU_STRUCTURE) if (byKey[g.key]) ordered.push(g);
    return ordered;
  }, [user]);

  const menuItems = buildMenuItems(orderedMenuStructure as any);

  // ===== 사이드바 드래그앤드롭 메뉴 순서 편집 =====
  const enterMenuEdit = () => {
    setTempMenuOrder(orderedMenuStructure.map((g: any) => g.key));
    setIsMenuEditing(true);
  };
  const cancelMenuEdit = () => {
    setIsMenuEditing(false);
    setDragKey(null);
  };
  const saveMenuOrder = async () => {
    if (!user?.id) return;
    try {
      const res = await (window as any).electronAPI.users.updateMenuOrder(user.id, tempMenuOrder);
      if (res?.success) {
        const { updateUserMenuOrder } = useAuthStore.getState() as any;
        if (typeof updateUserMenuOrder === 'function') updateUserMenuOrder(tempMenuOrder);
        message.success('메뉴 순서가 저장되었습니다.');
        setIsMenuEditing(false);
      } else {
        message.error(res?.error || '저장 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '저장 중 오류');
    }
  };
  const resetMenuOrder = async () => {
    if (!user?.id) return;
    try {
      const res = await (window as any).electronAPI.users.updateMenuOrder(user.id, null);
      if (res?.success) {
        const { updateUserMenuOrder } = useAuthStore.getState() as any;
        if (typeof updateUserMenuOrder === 'function') updateUserMenuOrder(null);
        message.success('기본 순서로 초기화되었습니다.');
        setIsMenuEditing(false);
      } else {
        message.error(res?.error || '초기화 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '초기화 중 오류');
    }
  };
  const handleDragStart = (key: string) => (e: React.DragEvent) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (overKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragKey || dragKey === overKey) return;
    const next = [...tempMenuOrder];
    const fromIdx = next.indexOf(dragKey);
    const toIdx = next.indexOf(overKey);
    if (fromIdx < 0 || toIdx < 0) return;
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, dragKey);
    setTempMenuOrder(next);
  };
  const handleDragEnd = () => setDragKey(null);

  // 사용자 드롭다운 메뉴
  const userMenuItems = [
    {
      key: 'profile',
      icon: <IdcardOutlined />,
      label: '내 정보',
      onClick: async () => {
        setProfileDrawerOpen(true);
        // 연차 정보 로드
        if (user?.id) {
          try {
            const result = await (window as any).electronAPI.leave.calculateAnnual(user.id);
            if (result.success) setLeaveInfo(result.data);
          } catch (_) {}
        }
      },
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '설정',
      onClick: () => navigate('/settings'),
    },
    {
      key: 'menu-reorder',
      icon: <AppstoreOutlined />,
      label: '메뉴 순서 변경',
      onClick: () => setMenuReorderOpen(true),
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
                    {(user?.role === 'super_admin' || companyList.length > 1) ? (
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
                        {user?.role === 'super_admin' && <Select.Option value="all">전체 (총괄)</Select.Option>}
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

        {/* 메뉴 영역 헤더 (편집 토글) — collapsed가 아닐 때만 */}
        {!collapsed && (
          <div
            style={{
              padding: '6px 12px',
              borderBottom: `1px solid ${isDark ? '#262626' : '#f5f5f5'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
              color: isDark ? '#888' : '#999',
            }}
          >
            <span>{isMenuEditing ? '드래그하여 순서 변경' : '메뉴'}</span>
            {isMenuEditing ? (
              <Space size={4}>
                <Tooltip title="기본값 복원">
                  <Button size="small" type="text" icon={<ReloadOutlined />} onClick={resetMenuOrder} />
                </Tooltip>
                <Button size="small" type="text" onClick={cancelMenuEdit}>취소</Button>
                <Button size="small" type="primary" onClick={saveMenuOrder}>저장</Button>
              </Space>
            ) : (
              <Tooltip title="메뉴 순서 편집">
                <Button size="small" type="text" icon={<EditOutlined />} onClick={enterMenuEdit} />
              </Tooltip>
            )}
          </div>
        )}

        {/* 메뉴 - 스크롤 가능 */}
        <div
          style={{
            height: `calc(100vh - 64px${!collapsed ? ' - 36px' : ''})`,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {isMenuEditing ? (
            <div style={{ padding: 8 }}>
              {tempMenuOrder.map((key) => {
                const g = orderedMenuStructure.find((x: any) => x.key === key);
                if (!g) return null;
                // 권한 체크 (편집 모드에서도 권한 없는 그룹은 표시 안함)
                if ((g as any).roles && user && !(g as any).roles.includes(user.role)) return null;
                const isDragging = dragKey === key;
                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={handleDragStart(key)}
                    onDragOver={handleDragOver(key)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => { e.preventDefault(); handleDragEnd(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      marginBottom: 4,
                      border: `1px dashed ${isDark ? '#444' : '#d9d9d9'}`,
                      borderRadius: 6,
                      background: isDragging ? (isDark ? '#1a3a5a' : '#e6f7ff') : (isDark ? '#1a1a1a' : '#fafafa'),
                      cursor: 'grab',
                      userSelect: 'none',
                      opacity: isDragging ? 0.6 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    <HolderOutlined style={{ color: '#bbb', cursor: 'grab' }} />
                    {iconMap[(g as any).icon]}
                    <span style={{ flex: 1, fontWeight: 500 }}>{(g as any).label}</span>
                  </div>
                );
              })}
              <div style={{ marginTop: 12, padding: '0 4px', fontSize: 11, color: '#999' }}>
                💡 항목을 잡고 위/아래로 끌어 순서를 바꾼 뒤 저장하세요.
              </div>
            </div>
          ) : (
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              defaultOpenKeys={['home', 'contracts', 'finance', 'hr', 'calendar', 'communication', 'project', 'admin', 'system']}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
              style={{
                border: 'none',
                background: 'transparent',
              }}
            />
          )}
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

            {/* 창 컨트롤 - 모던 스타일 */}
            <div className="window-controls">
              <button className="window-btn manual-btn" onClick={handleOpenManual} title="매뉴얼">
                <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5 }}>매뉴얼</span>
              </button>
              <button className="window-btn" onClick={handleMinimize} title="최소화">
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <line x1="2.5" y1="6" x2="9.5" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
              <button className="window-btn" onClick={handleMaximize} title={isMaximized ? '이전 크기로 복원' : '최대화'}>
                {isMaximized ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="2" y="3.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
                    <path d="M4 3.5V2.8A1.2 1.2 0 015.2 1.6h3A1.2 1.2 0 019.4 2.8v3A1.2 1.2 0 018.2 7H7.5" stroke="currentColor" strokeWidth="1.1" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                )}
              </button>
              <button className="window-btn close-btn" onClick={handleClose} title="닫기">
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <line x1="2.75" y1="2.75" x2="9.25" y2="9.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="9.25" y1="2.75" x2="2.75" y2="9.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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

        {/* 연차 정보 */}
        {leaveInfo && (
          <div style={{
            marginBottom: 20,
            padding: 16,
            background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)',
            borderRadius: 8,
            border: '1px solid #d6e4ff',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#1890ff' }}>
              📅 내 연차 현황 ({new Date().getFullYear()}년)
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', background: 'white', borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: '#888' }}>총 연차</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1890ff' }}>{leaveInfo.total}<span style={{ fontSize: 12, marginLeft: 2 }}>일</span></div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', background: 'white', borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: '#888' }}>사용</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fa8c16' }}>{leaveInfo.used}<span style={{ fontSize: 12, marginLeft: 2 }}>일</span></div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', background: 'white', borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: '#888' }}>잔여</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: leaveInfo.remaining <= 3 ? '#cf1322' : '#52c41a' }}>
                  {leaveInfo.remaining}<span style={{ fontSize: 12, marginLeft: 2 }}>일</span>
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* 하단 버튼 — 개인 메뉴 (증명서/지출결의서/연차/운행) */}
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
            icon={<FormOutlined />}
            onClick={() => {
              setProfileDrawerOpen(false);
              navigate('/finance/expense-request');
            }}
          >
            지출결의서
          </Button>
          <Button
            block
            icon={<CalendarOutlined />}
            onClick={() => {
              setProfileDrawerOpen(false);
              navigate('/hr/leave');
            }}
          >
            연차 신청
          </Button>
          <Button
            block
            icon={<CarOutlined />}
            onClick={() => {
              setProfileDrawerOpen(false);
              navigate('/hr/vehicle-logs');
            }}
          >
            운행일지
          </Button>
          <Divider style={{ margin: '8px 0' }} />
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

      {/* 매뉴얼 모달 - 좌측 메뉴 목록 + 우측 콘텐츠 */}
      <Modal
        title="매뉴얼"
        open={manualVisible}
        onCancel={() => { setManualVisible(false); setManualHtml(''); }}
        footer={null}
        width="85vw"
        style={{ top: 20 }}
        styles={{ body: { height: '80vh', overflow: 'hidden', padding: 0 } }}
        destroyOnClose
      >
        <div style={{ display: 'flex', height: '100%' }}>
          {/* 좌측 메뉴 목록 */}
          <div style={{
            width: 240,
            minWidth: 240,
            borderRight: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
            overflowY: 'auto',
            background: isDark ? '#141414' : '#fafafa',
          }}>
            {(() => {
              let currentGroup = '';
              return manualMenus.map((menu) => {
                const showGroup = menu.group !== currentGroup;
                currentGroup = menu.group;
                const hasManual = !!manualCache[menu.key];
                return (
                  <React.Fragment key={menu.key}>
                    {showGroup && (
                      <div style={{
                        padding: '10px 16px 4px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#999',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}>
                        {menu.group}
                      </div>
                    )}
                    <div
                      onClick={() => handleManualMenuSelect(menu.key)}
                      style={{
                        padding: '8px 16px',
                        cursor: 'pointer',
                        background: selectedManualKey === menu.key
                          ? (isDark ? '#177ddc33' : '#e6f7ff')
                          : 'transparent',
                        borderRight: selectedManualKey === menu.key ? '3px solid #1890ff' : '3px solid transparent',
                        fontSize: 13,
                        color: hasManual
                          ? (isDark ? '#fff' : '#333')
                          : (isDark ? '#666' : '#aaa'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{menu.label}</span>
                      {hasManual && <span style={{ color: '#52c41a', fontSize: 10 }}>●</span>}
                    </div>
                  </React.Fragment>
                );
              });
            })()}
          </div>

          {/* 우측 콘텐츠 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
            <div
              dangerouslySetInnerHTML={{ __html: manualHtml }}
              style={{ width: '100%', minHeight: '100%', padding: 16 }}
            />
          </div>
        </div>
      </Modal>

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

      {/* 메뉴 순서 변경 모달 */}
      <MenuReorderModal
        open={menuReorderOpen}
        onClose={() => setMenuReorderOpen(false)}
      />
    </Layout>
  );
};

export default AppLayout;
