import React, { useEffect } from 'react';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import koKR from 'antd/locale/ko_KR';

import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';

import LoginPage from './pages/auth/LoginPage';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/home/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import PermissionManagement from './pages/admin/PermissionManagement';
import PermissionMatrix from './pages/admin/PermissionMatrix';
import DepartmentManagement from './pages/admin/DepartmentManagement';
import CompanyManagement from './pages/admin/CompanyManagement';
import Settings from './pages/settings/Settings';
import PriceSettings from './pages/settings/PriceSettings';
import DocumentTemplates from './pages/settings/DocumentTemplates';
import BackupSettings from './pages/settings/BackupSettings';
import QuoteList from './pages/quotes/QuoteList';
import QuoteForm from './pages/quotes/QuoteForm';
import ContractList from './pages/contracts/ContractList';
import ContractForm from './pages/contracts/ContractForm';
import ContractMonthly from './pages/contracts/ContractMonthly';
import ContractHistory from './pages/contracts/ContractHistory';
import OutsourcingManagement from './pages/contracts/OutsourcingManagement';
import ContractCalendar from './pages/calendar/ContractCalendar';
import HRCalendar from './pages/calendar/HRCalendar';
import SpaceCalendar from './pages/calendar/SpaceCalendar';
import SearchPage from './pages/search/SearchPage';
import AISearchPage from './pages/search/AISearchPage';
import ProjectBoard from './pages/project/ProjectBoard';
import ProjectTimeline from './pages/project/ProjectTimeline';
import ClientList from './pages/clients/ClientList';
import ClientDetail from './pages/clients/ClientDetail';
import MessengerPage from './pages/messenger/MessengerPage';
import LeavePage from './pages/hr/LeavePage';
import LeaveAdminPage from './pages/hr/LeaveAdminPage';
import CertificatePage from './pages/hr/CertificatePage';
import ProjectDashboard from './pages/projects/ProjectDashboard';
import NotFound from './pages/NotFound';

// 테마 설정
const lightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#1890ff',
    borderRadius: 8,
    fontSize: 14,
  },
};

const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#1890ff',
    colorBgContainer: '#1f1f1f',
    borderRadius: 8,
    fontSize: 14,
  },
};

// 보호된 라우트
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        로딩 중...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { isDark, initTheme } = useThemeStore();
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    // 테마 초기화
    initTheme();
    // 인증 상태 확인
    checkAuth();
  }, []);

  return (
    <ConfigProvider
      locale={koKR}
      theme={isDark ? darkTheme : lightTheme}
    >
      <AntApp>
        <HashRouter>
          <Routes>
            {/* 로그인 페이지 */}
            <Route path="/login" element={<LoginPage />} />

            {/* 메인 레이아웃 */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DefaultRedirect />} />
              <Route path="dashboard" element={<Dashboard />} />

              {/* 관리 */}
              <Route path="admin/users" element={<UserManagement />} />
              <Route path="admin/departments" element={<DepartmentManagement />} />
              <Route path="admin/permissions" element={<PermissionManagement />} />
              <Route path="admin/permissions/matrix" element={<PermissionMatrix />} />
              <Route path="admin/companies" element={<CompanyManagement />} />

              {/* 설정 */}
              <Route path="settings" element={<Settings />} />
              <Route path="settings/price" element={<PriceSettings />} />
              <Route path="settings/templates" element={<DocumentTemplates />} />
              <Route path="settings/backup" element={<BackupSettings />} />

              {/* 견적서 */}
              <Route path="quotes" element={<QuoteList />} />
              <Route path="quotes/new" element={<QuoteForm />} />
              <Route path="quotes/:id" element={<QuoteForm />} />
              <Route path="quotes/:id/edit" element={<QuoteForm />} />

              {/* 거래처 */}
              <Route path="clients" element={<ClientList />} />
              <Route path="clients/:id" element={<ClientDetail />} />

              {/* 계약서 */}
              <Route path="contracts" element={<ContractList />} />
              <Route path="contracts/new" element={<ContractForm />} />
              <Route path="contracts/:id" element={<ContractForm />} />
              <Route path="contracts/:id/edit" element={<ContractForm />} />
              <Route path="contracts/monthly" element={<ContractMonthly />} />
              <Route path="contracts/history" element={<ContractHistory />} />
              <Route path="contracts/subcontract" element={<OutsourcingManagement />} />

              {/* 메신저 */}
              <Route path="messenger" element={<MessengerPage />} />

              {/* 캘린더 */}
              <Route path="calendar/contracts" element={<ContractCalendar />} />
              <Route path="calendar/hr" element={<HRCalendar />} />
              <Route path="calendar/spaces" element={<SpaceCalendar />} />

              {/* 검색 */}
              <Route path="search" element={<SearchPage />} />
              <Route path="ai-search" element={<AISearchPage />} />
              {/* 인사/총무 */}
              <Route path="hr/leave" element={<LeavePage />} />
              <Route path="hr/leave-admin" element={<LeaveAdminPage />} />
              <Route path="hr/certificates" element={<CertificatePage />} />
              <Route path="finance/*" element={<ComingSoon title="재무/회계" />} />
              <Route path="project/board" element={<ProjectBoard />} />
              <Route path="project/dashboard" element={<ProjectDashboard />} />
              <Route path="project/timeline" element={<ProjectTimeline />} />
              <Route path="project/*" element={<ComingSoon title="프로젝트" />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  );
};

// 역할 기반 기본 페이지 리다이렉트
const DefaultRedirect: React.FC = () => {
  const { user } = useAuthStore();
  // 사원/부서장은 대시보드 접근 불가 → 프로젝트 현황으로
  if (user?.role === 'department_manager' || user?.role === 'employee') {
    return <Navigate to="/project/dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

// 준비 중 컴포넌트
const ComingSoon: React.FC<{ title: string }> = ({ title }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    color: '#888',
  }}>
    <h2 style={{ marginBottom: 16 }}>{title}</h2>
    <p>이 기능은 준비 중입니다.</p>
  </div>
);

export default App;
