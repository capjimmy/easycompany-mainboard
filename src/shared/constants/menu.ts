import type { MenuItem } from '../types';

// 메뉴 구조 정의
export const MENU_STRUCTURE: MenuItem[] = [
  {
    key: 'executive',
    label: '경영진',
    icon: 'CrownOutlined',
    roles: ['super_admin'],
    children: [
      { key: 'management-dashboard', label: '경영관리 대시보드', icon: 'FundProjectionScreenOutlined', path: '/admin/management-dashboard', roles: ['super_admin'] },
      { key: 'profit-dashboard', label: '순이익 계산', icon: 'DollarOutlined', path: '/dashboard/profit', roles: ['super_admin'] },
      { key: 'director-report', label: '원장님 보고서', icon: 'FileTextOutlined', path: '/admin/director-report', roles: ['super_admin'] },
      { key: 'monthly', label: '월별현황', icon: 'BarChartOutlined', path: '/contracts/monthly', roles: ['super_admin'] },
      { key: 'salary-table', label: '연봉 테이블', icon: 'IdcardOutlined', path: '/admin/salary-table', roles: ['super_admin'] },
    ],
  },
  {
    key: 'home',
    label: '홈',
    icon: 'HomeOutlined',
    children: [
      { key: 'dashboard', label: '대시보드', icon: 'DashboardOutlined', path: '/dashboard', roles: ['super_admin', 'company_admin'] },
      { key: 'project-status', label: '프로젝트 현황', icon: 'FundProjectionScreenOutlined', path: '/project/dashboard' },
      { key: 'search', label: '통합검색', icon: 'SearchOutlined', path: '/search' },
      { key: 'ai-search', label: 'AI 검색', icon: 'RobotOutlined', path: '/ai-search', roles: ['super_admin', 'company_admin'] },
    ],
  },
  {
    key: 'contracts',
    label: '계약/매출',
    icon: 'FileTextOutlined',
    children: [
      { key: 'quote-list', label: '견적관리', icon: 'SolutionOutlined', path: '/quotes' },
      { key: 'contract-list', label: '계약관리', icon: 'ProfileOutlined', path: '/contracts' },
      { key: 'history', label: '계약변경이력', icon: 'HistoryOutlined', path: '/contracts/history' },
      { key: 'subcontract', label: '외주관리', icon: 'TeamOutlined', path: '/contracts/subcontract' },
      { key: 'client-list', label: '거래처관리', icon: 'TeamOutlined', path: '/clients' },
    ],
  },
  {
    key: 'finance',
    label: '재무/회계',
    icon: 'BankOutlined',
    // 그룹 roles는 제거 — child의 roles로 개별 통제 (사원은 expense-request만, 부서관리자는 차단)
    children: [
      { key: 'receivables', label: '미수금관리', icon: 'DollarOutlined', path: '/finance/receivables', roles: ['super_admin', 'company_admin'] },
      { key: 'billing', label: '청구/입금', icon: 'TransactionOutlined', path: '/finance/billing', roles: ['super_admin', 'company_admin'] },
      { key: 'payables', label: '미지급금관리', icon: 'CreditCardOutlined', path: '/finance/payables', roles: ['super_admin', 'company_admin'] },
      { key: 'tax-invoices', label: '세금계산서', icon: 'FileTextOutlined', path: '/finance/tax-invoices', roles: ['super_admin', 'company_admin'] },
      { key: 'expenses', label: '경비정산', icon: 'FormOutlined', path: '/finance/expenses', roles: ['super_admin', 'company_admin'] },
      { key: 'expense-request', label: '지출결의서', icon: 'FormOutlined', path: '/finance/expense-request', roles: ['super_admin', 'company_admin', 'employee'] },
      { key: 'provisional', label: '가수금관리', icon: 'DollarOutlined', path: '/finance/provisional', roles: ['super_admin', 'company_admin'] },
      { key: 'monthly-comparison', label: '월별 비교관리', icon: 'BarChartOutlined', path: '/finance/monthly-comparison', roles: ['super_admin', 'company_admin'] },
    ],
  },
  {
    key: 'hr',
    label: '인사/총무',
    icon: 'UserOutlined',
    children: [
      { key: 'leave', label: '연차 신청', icon: 'CalendarOutlined', path: '/hr/leave' },
      { key: 'leave-admin', label: '연차 승인관리', icon: 'FormOutlined', path: '/hr/leave-admin', roles: ['super_admin', 'company_admin', 'department_manager'] },
      // { key: 'certificates', label: '증명서 발급', icon: 'SafetyCertificateOutlined', path: '/hr/certificates' }, // 일시 숨김
      { key: 'vehicle-logs', label: '운행일지', icon: 'CarOutlined', path: '/hr/vehicle-logs' },
    ],
  },
  {
    key: 'calendar',
    label: '캘린더',
    icon: 'CalendarOutlined',
    children: [
      { key: 'calendar-contract', label: '계약 캘린더', icon: 'FileTextOutlined', path: '/calendar/contracts' },
      { key: 'calendar-hr', label: '인사 캘린더', icon: 'TeamOutlined', path: '/calendar/hr' },
      { key: 'calendar-space', label: '공간 캘린더', icon: 'EnvironmentOutlined', path: '/calendar/spaces' },
    ],
  },
  // 프로젝트 메뉴 일시 숨김
  // {
  //   key: 'project',
  //   label: '프로젝트',
  //   icon: 'ProjectOutlined',
  //   children: [
  //     { key: 'project-dashboard', label: '프로젝트 현황', icon: 'FundProjectionScreenOutlined', path: '/project/dashboard' },
  //     { key: 'project-timeline', label: '일정관리', icon: 'CalendarOutlined', path: '/project/timeline' },
  //   ],
  // },
  {
    key: 'admin',
    label: '관리',
    icon: 'SettingOutlined',
    roles: ['super_admin', 'company_admin'],
    children: [
      { key: 'user-manage', label: '사용자관리', icon: 'UserSwitchOutlined', path: '/admin/users', roles: ['super_admin', 'company_admin'] },
      { key: 'hr-roster', label: '인사 명부', icon: 'IdcardOutlined', path: '/admin/hr-roster', roles: ['super_admin', 'company_admin'] },
      { key: 'department-manage', label: '부서관리', icon: 'ApartmentOutlined', path: '/admin/departments', roles: ['super_admin', 'company_admin'] },
      { key: 'permission-manage', label: '권한설정', icon: 'LockOutlined', path: '/admin/permissions', roles: ['super_admin'] },
      { key: 'company-manage', label: '회사관리', icon: 'BankOutlined', path: '/admin/companies', roles: ['super_admin'] },
      { key: 'vehicle-manage', label: '차량관리', icon: 'CarOutlined', path: '/admin/vehicles', roles: ['super_admin', 'company_admin'] },
      { key: 'space-manage', label: '공간관리', icon: 'EnvironmentOutlined', path: '/admin/spaces', roles: ['super_admin', 'company_admin'] },
    ],
  },
  {
    key: 'system',
    label: '시스템',
    icon: 'ToolOutlined',
    children: [
      { key: 'settings', label: '설정', icon: 'SettingOutlined', path: '/settings' },
      { key: 'price-settings', label: '단가 설정', icon: 'FormOutlined', path: '/settings/price', roles: ['super_admin', 'company_admin'] },
      { key: 'doc-templates', label: '문서 템플릿', icon: 'FileAddOutlined', path: '/settings/templates', roles: ['super_admin', 'company_admin', 'department_manager'] },
      { key: 'template-manager', label: '양식 보관소', icon: 'CloudUploadOutlined', path: '/settings/template-manager' },
      { key: 'backup', label: '백업관리', icon: 'CloudUploadOutlined', path: '/settings/backup', roles: ['super_admin', 'company_admin'] },
      { key: 'manuals', label: '매뉴얼 관리', icon: 'QuestionCircleOutlined', path: '/settings/manuals', roles: ['super_admin', 'company_admin'] },
    ],
  },
];

// 기본 권한 템플릿 (4단계 역할)
// 모든 키는 MENU_STRUCTURE의 children key와 1:1 대응
const ALL_FULL = { view: true, create: true, edit: true, delete: true };
const VIEW_ONLY = { view: true, create: false, edit: false, delete: false };
const VIEW_CREATE = { view: true, create: true, edit: false, delete: false };
const VIEW_CREATE_EDIT = { view: true, create: true, edit: true, delete: false };
const NO_ACCESS = { view: false, create: false, edit: false, delete: false };

export const DEFAULT_PERMISSIONS: Record<string, Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>> = {
  // 슈퍼관리자: 모든 시스템 접근
  super_admin: {
    // 홈
    dashboard: ALL_FULL, 'profit-dashboard': ALL_FULL, 'management-dashboard': ALL_FULL, 'director-report': ALL_FULL, 'salary-table': ALL_FULL, 'project-status': ALL_FULL, search: ALL_FULL, 'ai-search': ALL_FULL,
    // 계약/매출
    'quote-list': ALL_FULL, 'contract-list': ALL_FULL, monthly: ALL_FULL,
    history: ALL_FULL, subcontract: ALL_FULL, 'client-list': ALL_FULL,
    // 재무/회계
    receivables: ALL_FULL, billing: ALL_FULL, payables: ALL_FULL,
    'tax-invoices': ALL_FULL, expenses: ALL_FULL, 'expense-request': ALL_FULL, provisional: ALL_FULL,
    'monthly-comparison': ALL_FULL,
    // 인사/총무
    leave: ALL_FULL, 'leave-admin': ALL_FULL, certificates: ALL_FULL, 'vehicle-logs': ALL_FULL,
    // 캘린더
    'calendar-contract': ALL_FULL, 'calendar-hr': ALL_FULL, 'calendar-space': ALL_FULL,
    // 프로젝트
    'project-dashboard': ALL_FULL, 'project-timeline': ALL_FULL,
    // 관리
    'user-manage': ALL_FULL, 'hr-roster': ALL_FULL, 'department-manage': ALL_FULL,
    'permission-manage': ALL_FULL, 'company-manage': ALL_FULL, 'space-manage': ALL_FULL, 'vehicle-manage': ALL_FULL,
    // 시스템
    settings: ALL_FULL, 'price-settings': ALL_FULL, 'doc-templates': ALL_FULL, 'template-manager': ALL_FULL,
    backup: ALL_FULL, manuals: ALL_FULL,
  },
  // 회사 관리자: 회사 내 모든 기능 + 권한 설정 (경영진 메뉴 제외)
  company_admin: {
    // 홈 — profit-dashboard, management-dashboard, director-report는 경영진(super_admin)전용
    dashboard: ALL_FULL, 'project-status': ALL_FULL, search: ALL_FULL, 'ai-search': ALL_FULL,
    // 경영진 전용 (회사관리자는 접근 불가)
    'profit-dashboard': NO_ACCESS, 'management-dashboard': NO_ACCESS, 'director-report': NO_ACCESS, 'salary-table': NO_ACCESS,
    // 계약/매출
    'quote-list': ALL_FULL, 'contract-list': ALL_FULL, monthly: ALL_FULL,
    history: ALL_FULL, subcontract: ALL_FULL, 'client-list': ALL_FULL,
    // 재무/회계
    receivables: ALL_FULL, billing: ALL_FULL, payables: ALL_FULL,
    'tax-invoices': ALL_FULL, expenses: ALL_FULL, 'expense-request': ALL_FULL, provisional: ALL_FULL,
    'monthly-comparison': ALL_FULL,
    // 인사/총무
    leave: ALL_FULL, 'leave-admin': ALL_FULL, certificates: ALL_FULL, 'vehicle-logs': ALL_FULL,
    // 캘린더
    'calendar-contract': ALL_FULL, 'calendar-hr': ALL_FULL, 'calendar-space': ALL_FULL,
    // 프로젝트
    'project-dashboard': ALL_FULL, 'project-timeline': ALL_FULL,
    // 관리
    'user-manage': ALL_FULL, 'hr-roster': ALL_FULL, 'department-manage': ALL_FULL, 'permission-manage': ALL_FULL, 'space-manage': ALL_FULL, 'vehicle-manage': ALL_FULL,
    // 시스템
    settings: { view: true, create: true, edit: true, delete: false },
    'price-settings': ALL_FULL, 'doc-templates': ALL_FULL,
    backup: { view: true, create: true, edit: false, delete: false }, manuals: ALL_FULL,
  },
  // 부서 관리자: 부서 내 모든 기능 (관리메뉴 접근 불가)
  department_manager: {
    // 홈
    dashboard: VIEW_CREATE_EDIT, 'project-status': VIEW_CREATE_EDIT, search: VIEW_CREATE_EDIT,
    'ai-search': { view: true, create: true, edit: false, delete: false },
    // 계약/매출
    'quote-list': VIEW_CREATE_EDIT, 'contract-list': VIEW_CREATE_EDIT, monthly: VIEW_ONLY,
    history: VIEW_ONLY, subcontract: VIEW_CREATE_EDIT, 'client-list': VIEW_CREATE_EDIT,
    // 재무/회계 — 전면 차단 (지출결의서만 조회/신청 가능)
    'expense-request': VIEW_ONLY,
    // 인사/총무
    leave: VIEW_CREATE_EDIT, 'leave-admin': VIEW_CREATE_EDIT, certificates: VIEW_CREATE_EDIT, 'vehicle-logs': VIEW_CREATE_EDIT,
    // 캘린더
    'calendar-contract': VIEW_CREATE_EDIT, 'calendar-hr': VIEW_CREATE_EDIT, 'calendar-space': VIEW_CREATE_EDIT,
    // 프로젝트
    'project-dashboard': VIEW_CREATE_EDIT, 'project-timeline': VIEW_CREATE_EDIT,
    // 시스템
    settings: { view: true, create: false, edit: true, delete: false },
    'doc-templates': ALL_FULL,
  },
  // 사원: 기본 권한 (재무/회계, 관리 메뉴 접근 불가)
  employee: {
    // 홈
    'project-status': VIEW_ONLY, search: VIEW_ONLY,
    // 계약/매출
    'quote-list': VIEW_CREATE, 'contract-list': VIEW_CREATE, monthly: VIEW_ONLY,
    history: VIEW_ONLY, subcontract: VIEW_ONLY, 'client-list': VIEW_CREATE,
    // 재무/회계 (사원: 지출결의서 신청만 가능)
    'expense-request': VIEW_CREATE,
    // 인사/총무
    leave: VIEW_CREATE, certificates: VIEW_CREATE, 'vehicle-logs': VIEW_CREATE,
    // 캘린더
    'calendar-contract': VIEW_ONLY, 'calendar-hr': VIEW_ONLY, 'calendar-space': VIEW_CREATE,
    // 프로젝트
    'project-dashboard': VIEW_ONLY, 'project-timeline': VIEW_ONLY,
    // 시스템
    settings: VIEW_ONLY,
  },
};

// 역할 레이블
export const ROLE_LABELS: Record<string, string> = {
  super_admin: '슈퍼관리자',
  company_admin: '회사 관리자',
  department_manager: '부서 관리자',
  employee: '사원',
};
