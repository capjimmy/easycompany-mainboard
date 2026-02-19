import type { MenuItem } from '../types';

// 메뉴 구조 정의
export const MENU_STRUCTURE: MenuItem[] = [
  {
    key: 'home',
    label: '홈',
    icon: 'HomeOutlined',
    children: [
      { key: 'dashboard', label: '대시보드', icon: 'DashboardOutlined', path: '/dashboard' },
      { key: 'search', label: '통합검색', icon: 'SearchOutlined', path: '/search' },
    ],
  },
  {
    key: 'contracts',
    label: '계약/매출',
    icon: 'FileTextOutlined',
    children: [
      { key: 'quote-list', label: '견적관리', icon: 'SolutionOutlined', path: '/quotes' },
      { key: 'contract-list', label: '계약관리', icon: 'ProfileOutlined', path: '/contracts' },
      { key: 'monthly', label: '월별현황', icon: 'BarChartOutlined', path: '/contracts/monthly' },
      { key: 'history', label: '계약변경이력', icon: 'HistoryOutlined', path: '/contracts/history' },
      { key: 'subcontract', label: '외주관리', icon: 'TeamOutlined', path: '/contracts/subcontract' },
    ],
  },
  // 재무/회계 메뉴 - 추후 활성화 예정
  // {
  //   key: 'finance',
  //   label: '재무/회계',
  //   icon: 'BankOutlined',
  //   children: [
  //     { key: 'receivables', label: '미수금관리', icon: 'DollarOutlined', path: '/finance/receivables' },
  //     { key: 'payables', label: '미지급금관리', icon: 'CreditCardOutlined', path: '/finance/payables' },
  //     { key: 'deposits', label: '보증금관리', icon: 'SafetyOutlined', path: '/finance/deposits' },
  //     { key: 'billing', label: '청구/입금', icon: 'TransactionOutlined', path: '/finance/billing' },
  //   ],
  // },
  // 인사/총무 메뉴 - 추후 활성화 예정
  // {
  //   key: 'hr',
  //   label: '인사/총무',
  //   icon: 'UserOutlined',
  //   children: [
  //     { key: 'employees', label: '직원명부', icon: 'TeamOutlined', path: '/hr/employees' },
  //     { key: 'leave', label: '연차관리', icon: 'CalendarOutlined', path: '/hr/leave' },
  //     { key: 'birthday', label: '생일관리', icon: 'GiftOutlined', path: '/hr/birthday' },
  //     { key: 'vehicles', label: '법인차량', icon: 'CarOutlined', path: '/hr/vehicles' },
  //   ],
  // },
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
  {
    key: 'project',
    label: '프로젝트',
    icon: 'ProjectOutlined',
    children: [
      { key: 'project-board', label: '프로젝트현황판', icon: 'AppstoreOutlined', path: '/project/board' },
      { key: 'project-timeline', label: '일정관리', icon: 'CalendarOutlined', path: '/project/timeline' },
    ],
  },
  {
    key: 'admin',
    label: '관리',
    icon: 'SettingOutlined',
    roles: ['super_admin', 'company_admin'],
    children: [
      { key: 'user-manage', label: '사용자관리', icon: 'UserSwitchOutlined', path: '/admin/users', roles: ['super_admin', 'company_admin'] },
      { key: 'department-manage', label: '부서관리', icon: 'ApartmentOutlined', path: '/admin/departments', roles: ['super_admin', 'company_admin'] },
      { key: 'permission-manage', label: '권한설정', icon: 'LockOutlined', path: '/admin/permissions', roles: ['super_admin', 'company_admin'] },
      { key: 'company-manage', label: '회사관리', icon: 'BankOutlined', path: '/admin/companies', roles: ['super_admin'] },
    ],
  },
  {
    key: 'system',
    label: '시스템',
    icon: 'ToolOutlined',
    children: [
      { key: 'settings', label: '설정', icon: 'SettingOutlined', path: '/settings' },
      { key: 'price-settings', label: '양식 설정', icon: 'FormOutlined', path: '/settings/price', roles: ['super_admin', 'company_admin'] },
      { key: 'doc-templates', label: '문서 템플릿', icon: 'FileAddOutlined', path: '/settings/templates', roles: ['super_admin', 'company_admin', 'department_admin'] },
      { key: 'backup', label: '백업관리', icon: 'CloudUploadOutlined', path: '/settings/backup' },
    ],
  },
];

// 기본 권한 템플릿 (4단계 역할)
export const DEFAULT_PERMISSIONS = {
  // 슈퍼관리자: 모든 시스템 접근 (KOC)
  super_admin: {
    dashboard: { view: true, create: true, edit: true, delete: true },
    search: { view: true, create: true, edit: true, delete: true },
    'quote-list': { view: true, create: true, edit: true, delete: true },
    'contract-list': { view: true, create: true, edit: true, delete: true },
    monthly: { view: true, create: true, edit: true, delete: true },
    history: { view: true, create: true, edit: true, delete: true },
    subcontract: { view: true, create: true, edit: true, delete: true },
    receivables: { view: true, create: true, edit: true, delete: true },
    payables: { view: true, create: true, edit: true, delete: true },
    deposits: { view: true, create: true, edit: true, delete: true },
    billing: { view: true, create: true, edit: true, delete: true },
    employees: { view: true, create: true, edit: true, delete: true },
    leave: { view: true, create: true, edit: true, delete: true },
    birthday: { view: true, create: true, edit: true, delete: true },
    vehicles: { view: true, create: true, edit: true, delete: true },
    'project-board': { view: true, create: true, edit: true, delete: true },
    'project-timeline': { view: true, create: true, edit: true, delete: true },
    'user-manage': { view: true, create: true, edit: true, delete: true },
    'department-manage': { view: true, create: true, edit: true, delete: true },
    'permission-manage': { view: true, create: true, edit: true, delete: true },
    'company-manage': { view: true, create: true, edit: true, delete: true },
    settings: { view: true, create: true, edit: true, delete: true },
    'price-settings': { view: true, create: true, edit: true, delete: true },
    'doc-templates': { view: true, create: true, edit: true, delete: true },
    backup: { view: true, create: true, edit: true, delete: true },
  },
  // 회사 관리자: 회사 내 모든 기능 + 권한 설정
  company_admin: {
    dashboard: { view: true, create: true, edit: true, delete: true },
    search: { view: true, create: true, edit: true, delete: true },
    'quote-list': { view: true, create: true, edit: true, delete: true },
    'contract-list': { view: true, create: true, edit: true, delete: true },
    monthly: { view: true, create: true, edit: true, delete: true },
    history: { view: true, create: true, edit: true, delete: true },
    subcontract: { view: true, create: true, edit: true, delete: true },
    receivables: { view: true, create: true, edit: true, delete: true },
    payables: { view: true, create: true, edit: true, delete: true },
    deposits: { view: true, create: true, edit: true, delete: true },
    billing: { view: true, create: true, edit: true, delete: true },
    employees: { view: true, create: true, edit: true, delete: true },
    leave: { view: true, create: true, edit: true, delete: true },
    birthday: { view: true, create: true, edit: true, delete: true },
    vehicles: { view: true, create: true, edit: true, delete: true },
    'project-board': { view: true, create: true, edit: true, delete: true },
    'project-timeline': { view: true, create: true, edit: true, delete: true },
    'user-manage': { view: true, create: true, edit: true, delete: true },
    'department-manage': { view: true, create: true, edit: true, delete: true },
    'permission-manage': { view: true, create: true, edit: true, delete: true },
    settings: { view: true, create: true, edit: true, delete: false },
    'price-settings': { view: true, create: true, edit: true, delete: true },
    'doc-templates': { view: true, create: true, edit: true, delete: true },
    backup: { view: true, create: true, edit: false, delete: false },
  },
  // 부서 관리자: 부서 내 모든 기능
  department_admin: {
    dashboard: { view: true, create: true, edit: true, delete: false },
    search: { view: true, create: true, edit: true, delete: false },
    'quote-list': { view: true, create: true, edit: true, delete: false },
    'contract-list': { view: true, create: true, edit: true, delete: false },
    monthly: { view: true, create: false, edit: false, delete: false },
    history: { view: true, create: false, edit: false, delete: false },
    subcontract: { view: true, create: true, edit: true, delete: false },
    receivables: { view: true, create: true, edit: true, delete: false },
    payables: { view: true, create: true, edit: true, delete: false },
    deposits: { view: true, create: true, edit: true, delete: false },
    billing: { view: true, create: true, edit: true, delete: false },
    employees: { view: true, create: false, edit: false, delete: false },
    leave: { view: true, create: true, edit: true, delete: false },
    birthday: { view: true, create: false, edit: false, delete: false },
    vehicles: { view: true, create: true, edit: true, delete: false },
    'project-board': { view: true, create: true, edit: true, delete: false },
    'project-timeline': { view: true, create: true, edit: true, delete: false },
    settings: { view: true, create: false, edit: true, delete: false },
    'doc-templates': { view: true, create: true, edit: true, delete: true },
  },
  // 사원: 기본 권한 (회사 관리자가 조정)
  employee: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    search: { view: true, create: false, edit: false, delete: false },
    'quote-list': { view: true, create: true, edit: false, delete: false },
    'contract-list': { view: true, create: true, edit: false, delete: false },
    monthly: { view: true, create: false, edit: false, delete: false },
    'project-board': { view: true, create: false, edit: false, delete: false },
    'project-timeline': { view: true, create: false, edit: false, delete: false },
    leave: { view: true, create: true, edit: false, delete: false },
    settings: { view: true, create: false, edit: false, delete: false },
  },
};

// 역할 레이블
export const ROLE_LABELS: Record<string, string> = {
  super_admin: '슈퍼관리자',
  company_admin: '회사 관리자',
  department_admin: '부서 관리자',
  employee: '사원',
};
