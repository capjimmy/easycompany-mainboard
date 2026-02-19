import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Space, Typography, Badge } from 'antd';
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
};

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { user, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();

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
      icon: <UserOutlined />,
      label: '내 정보',
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
    department_admin: '부서 관리자',
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
            E
          </div>
          {!collapsed && (
            <span
              style={{
                marginLeft: 12,
                fontSize: 18,
                fontWeight: 600,
                color: isDark ? '#fff' : '#333',
              }}
            >
              EasyCompany
            </span>
          )}
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
            defaultOpenKeys={['home', 'contracts', 'calendar', 'project', 'admin', 'system']}
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
          style={{
            padding: '0 24px',
            background: isDark ? '#141414' : '#fff',
            borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16 }}
            />
          </Space>

          <Space size="middle">
            {/* 테마 토글 */}
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggle}
            />

            {/* 알림 */}
            <Badge count={3} size="small">
              <Button type="text" icon={<BellOutlined />} />
            </Badge>

            {/* 사용자 메뉴 */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }}
                  icon={<UserOutlined />}
                />
                <div style={{ lineHeight: 1.2 }}>
                  <Text strong style={{ display: 'block' }}>
                    {user?.name || '사용자'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {roleLabel[user?.role || 'employee'] || '사원'}
                  </Text>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* 컨텐츠 영역 - 스크롤 가능 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 24,
          }}
        >
          <Content
            style={{
              padding: 24,
              background: isDark ? '#1f1f1f' : '#fff',
              borderRadius: 12,
              minHeight: 'calc(100vh - 160px)',
            }}
          >
            <Outlet />
          </Content>
        </div>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
