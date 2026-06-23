import React, { useEffect } from 'react';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import koKR from 'antd/locale/ko_KR';

import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { DEFAULT_PERMISSIONS } from '../shared/constants/menu';

import LoginPage from './pages/auth/LoginPage';
import AppLayout from './components/layout/AppLayout';
import ProfitDashboard from './pages/admin/ProfitDashboard';
import SalaryTable from './pages/admin/SalaryTable';
import TemplateManager from './pages/admin/TemplateManager';
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
import ManualManagement from './pages/settings/ManualManagement';
import ReceivableList from './pages/finance/ReceivableList';
import BillingPayment from './pages/finance/BillingPayment';
import PayableList from './pages/finance/PayableList';
import TaxInvoiceList from './pages/finance/TaxInvoiceList';
import ExpenseSettlement from './pages/finance/ExpenseSettlement';
import ExpenseRequest from './pages/finance/ExpenseRequest';
import VehicleManagement from './pages/admin/VehicleManagement';
import SpaceManagement from './pages/admin/SpaceManagement';
import HRRoster from './pages/admin/HRRoster';
import ManagementDashboard from './pages/admin/ManagementDashboard';
import DirectorReport from './pages/admin/DirectorReport';
import VehicleLog from './pages/hr/VehicleLog';
import ProvisionalPaymentList from './pages/finance/ProvisionalPaymentList';
import MonthlyDepositList from './pages/finance/MonthlyDepositList';
import ExecutiveOutsourcingManagement from './pages/contracts/ExecutiveOutsourcingManagement';
import MonthlySalesPurchase from './pages/admin/MonthlySalesPurchase';
import ClientFinancials from './pages/finance/ClientFinancials';
import MonthlyComparison from './pages/finance/MonthlyComparison';
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

// 사용자의 유효 권한을 가져오는 헬퍼
const getEffectivePermissions = (user: any) => {
  if (!user) return {};
  if (user.permissions && Object.keys(user.permissions).length > 0) {
    return user.permissions;
  }
  return (DEFAULT_PERMISSIONS as any)[user.role] || DEFAULT_PERMISSIONS.employee;
};

// 사용자 정의 권한 여부 (menu_permissions DB row 1건이라도 있는지)
const isCustomizedPerms = (user: any) => !!user?.permissionsCustomized && user?.role !== 'super_admin';

// 역할 기반 라우트 가드 (per-user 권한도 함께 확인)
const RoleGuard: React.FC<{ roles: string[]; menuKey?: string; children: React.ReactNode }> = ({ roles, menuKey, children }) => {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#888' }}>
        <h2>접근 권한이 없습니다</h2>
        <p>이 페이지에 접근할 권한이 없습니다.</p>
      </div>
    );
  }
  // per-user 권한 확인 (menuKey가 지정된 경우)
  if (menuKey) {
    const perms = getEffectivePermissions(user);
    const perm = perms[menuKey];
    const denied = isCustomizedPerms(user) ? !perm?.view : (perm && !perm.view);
    if (denied) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#888' }}>
          <h2>접근 권한이 없습니다</h2>
          <p>이 메뉴에 대한 접근 권한이 제거되었습니다. 관리자에게 문의하세요.</p>
        </div>
      );
    }
  }
  return <>{children}</>;
};

// per-user 권한만 확인하는 가드 (역할 제한이 없는 메뉴용)
const PermissionGuard: React.FC<{ menuKey: string; children: React.ReactNode }> = ({ menuKey, children }) => {
  const { user } = useAuthStore();
  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#888' }}>
        <h2>접근 권한이 없습니다</h2>
        <p>로그인이 필요합니다.</p>
      </div>
    );
  }
  const perms = getEffectivePermissions(user);
  const perm = perms[menuKey];
  const denied = isCustomizedPerms(user) ? !perm?.view : (perm && !perm.view);
  if (denied) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#888' }}>
        <h2>접근 권한이 없습니다</h2>
        <p>이 메뉴에 대한 접근 권한이 없습니다. 관리자에게 문의하세요.</p>
      </div>
    );
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
              <Route path="dashboard" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="dashboard"><Dashboard /></RoleGuard>} />
              <Route path="dashboard/profit" element={<RoleGuard roles={['super_admin']} menuKey="profit-dashboard"><ProfitDashboard /></RoleGuard>} />
              <Route path="admin/salary-table" element={<RoleGuard roles={['super_admin']} menuKey="salary-table"><SalaryTable /></RoleGuard>} />
              <Route path="settings/template-manager" element={<PermissionGuard menuKey="template-manager"><TemplateManager /></PermissionGuard>} />

              {/* 관리 */}
              <Route path="admin/users" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="user-manage"><UserManagement /></RoleGuard>} />
              <Route path="admin/departments" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="department-manage"><DepartmentManagement /></RoleGuard>} />
              <Route path="admin/permissions" element={<RoleGuard roles={['super_admin']} menuKey="permission-manage"><PermissionManagement /></RoleGuard>} />
              <Route path="admin/permissions/matrix" element={<RoleGuard roles={['super_admin']} menuKey="permission-manage"><PermissionMatrix /></RoleGuard>} />
              <Route path="admin/companies" element={<RoleGuard roles={['super_admin']} menuKey="company-manage"><CompanyManagement /></RoleGuard>} />

              {/* 설정 */}
              <Route path="settings" element={<PermissionGuard menuKey="settings"><Settings /></PermissionGuard>} />
              <Route path="settings/price" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="price-settings"><PriceSettings /></RoleGuard>} />
              <Route path="settings/templates" element={<RoleGuard roles={['super_admin', 'company_admin', 'department_manager']} menuKey="doc-templates"><DocumentTemplates /></RoleGuard>} />
              <Route path="settings/backup" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="backup"><BackupSettings /></RoleGuard>} />
              <Route path="settings/manuals" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="manuals"><ManualManagement /></RoleGuard>} />

              {/* 견적서 */}
              <Route path="quotes" element={<PermissionGuard menuKey="quote-list"><QuoteList /></PermissionGuard>} />
              <Route path="quotes/new" element={<PermissionGuard menuKey="quote-list"><QuoteForm /></PermissionGuard>} />
              <Route path="quotes/:id" element={<PermissionGuard menuKey="quote-list"><QuoteForm /></PermissionGuard>} />
              <Route path="quotes/:id/edit" element={<PermissionGuard menuKey="quote-list"><QuoteForm /></PermissionGuard>} />

              {/* 거래처 */}
              <Route path="clients" element={<PermissionGuard menuKey="client-list"><ClientList /></PermissionGuard>} />
              <Route path="clients/:id" element={<PermissionGuard menuKey="client-list"><ClientDetail /></PermissionGuard>} />

              {/* 계약서 */}
              <Route path="contracts" element={<PermissionGuard menuKey="contract-list"><ContractList /></PermissionGuard>} />
              <Route path="contracts/new" element={<PermissionGuard menuKey="contract-list"><ContractForm /></PermissionGuard>} />
              <Route path="contracts/:id" element={<PermissionGuard menuKey="contract-list"><ContractForm /></PermissionGuard>} />
              <Route path="contracts/:id/edit" element={<PermissionGuard menuKey="contract-list"><ContractForm /></PermissionGuard>} />
              <Route path="contracts/monthly" element={<PermissionGuard menuKey="monthly"><ContractMonthly /></PermissionGuard>} />
              <Route path="contracts/history" element={<PermissionGuard menuKey="history"><ContractHistory /></PermissionGuard>} />
              <Route path="contracts/subcontract" element={<PermissionGuard menuKey="subcontract"><OutsourcingManagement /></PermissionGuard>} />

              {/* 메신저 */}
              <Route path="messenger" element={<PermissionGuard menuKey="messenger"><MessengerPage /></PermissionGuard>} />

              {/* 캘린더 */}
              <Route path="calendar/contracts" element={<PermissionGuard menuKey="calendar-contract"><ContractCalendar /></PermissionGuard>} />
              <Route path="calendar/hr" element={<PermissionGuard menuKey="calendar-hr"><HRCalendar /></PermissionGuard>} />
              <Route path="calendar/spaces" element={<PermissionGuard menuKey="calendar-space"><SpaceCalendar /></PermissionGuard>} />

              {/* 검색 */}
              <Route path="search" element={<PermissionGuard menuKey="search"><SearchPage /></PermissionGuard>} />
              <Route path="ai-search" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="ai-search"><AISearchPage /></RoleGuard>} />
              {/* 인사/총무 */}
              <Route path="hr/leave" element={<PermissionGuard menuKey="leave"><LeavePage /></PermissionGuard>} />
              <Route path="hr/leave-admin" element={<RoleGuard roles={['super_admin', 'company_admin', 'department_manager']} menuKey="leave-admin"><LeaveAdminPage /></RoleGuard>} />
              <Route path="hr/certificates" element={<PermissionGuard menuKey="certificates"><CertificatePage /></PermissionGuard>} />
              {/* 재무/회계 */}
              <Route path="finance/receivables" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="receivables"><ReceivableList /></RoleGuard>} />
              <Route path="finance/billing" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="billing"><BillingPayment /></RoleGuard>} />
              <Route path="finance/payables" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="payables"><PayableList /></RoleGuard>} />
              <Route path="finance/tax-invoices" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="tax-invoices"><TaxInvoiceList /></RoleGuard>} />
              <Route path="finance/expenses" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="expenses"><ExpenseSettlement /></RoleGuard>} />
              <Route path="finance/expense-request" element={<RoleGuard roles={['super_admin', 'company_admin', 'employee']} menuKey="expense-request"><ExpenseRequest /></RoleGuard>} />
              <Route path="admin/vehicles" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="vehicle-manage"><VehicleManagement /></RoleGuard>} />
              <Route path="admin/spaces" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="space-manage"><SpaceManagement /></RoleGuard>} />
              <Route path="admin/hr-roster" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="hr-roster"><HRRoster /></RoleGuard>} />
              <Route path="admin/management-dashboard" element={<RoleGuard roles={['super_admin']} menuKey="management-dashboard"><ManagementDashboard /></RoleGuard>} />
              <Route path="admin/director-report" element={<RoleGuard roles={['super_admin']} menuKey="director-report"><DirectorReport /></RoleGuard>} />
              <Route path="hr/vehicle-logs" element={<PermissionGuard menuKey="vehicle-logs"><VehicleLog /></PermissionGuard>} />
              <Route path="finance/provisional" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="provisional"><ProvisionalPaymentList /></RoleGuard>} />
              <Route path="finance/monthly-deposits" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="monthly-deposits"><MonthlyDepositList /></RoleGuard>} />
              <Route path="admin/executive-outsourcing" element={<RoleGuard roles={['super_admin']} menuKey="exec-outsourcing"><ExecutiveOutsourcingManagement /></RoleGuard>} />
              <Route path="admin/monthly-sales-purchase" element={<RoleGuard roles={['super_admin']} menuKey="exec-monthly-sales-purchase"><MonthlySalesPurchase /></RoleGuard>} />
              <Route path="finance/monthly-comparison" element={<RoleGuard roles={['super_admin', 'company_admin']} menuKey="monthly-comparison"><MonthlyComparison /></RoleGuard>} />
              <Route path="finance/client-financials" element={<PermissionGuard menuKey="client-list"><ClientFinancials /></PermissionGuard>} />
              <Route path="project/board" element={<PermissionGuard menuKey="project-board"><ProjectBoard /></PermissionGuard>} />
              <Route path="project/dashboard" element={<PermissionGuard menuKey="project-dashboard"><ProjectDashboard /></PermissionGuard>} />
              <Route path="project/timeline" element={<PermissionGuard menuKey="project-timeline"><ProjectTimeline /></PermissionGuard>} />
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
