// 사용자 역할 (4단계)
export type UserRole =
  | 'super_admin'      // 슈퍼관리자: 전체 시스템 관리 (KOC)
  | 'company_admin'    // 회사 관리자: 회사 내 모든 기능 + 권한 설정
  | 'department_admin' // 부서 관리자: 부서 내 모든 기능
  | 'employee';        // 사원: 부여받은 권한만

// 사용자 정보
export interface User {
  id: string;
  company_id: string | null;
  company_name: string | null;
  department_id: string | null;
  department_name: string | null;
  username: string;
  name: string;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  permissions: Record<string, MenuPermission>;
}

// 부서 정보
export interface Department {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// 메뉴 권한
export interface MenuPermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

// 회사 정보
export interface Company {
  id: string;
  name: string;
  business_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

// 메뉴 아이템
export interface MenuItem {
  key: string;
  label: string;
  icon: string;
  path?: string;
  children?: MenuItem[];
  roles?: UserRole[]; // 접근 가능한 역할
}

// 테마
export type ThemeMode = 'light' | 'dark' | 'system';

// API 응답
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 로그인 응답
export interface LoginResponse {
  success: boolean;
  user?: User;
  error?: string;
}

// ========================================
// 견적서 관련 타입
// ========================================

// 인건비 등급 (회사별 커스터마이징 가능)
export interface LaborGrade {
  id: string;
  company_id: string;
  name: string;                    // '책임연구원', '연구원', '선임연구보조', '연구보조'
  monthly_rate: number;            // 월 단가 (예: 3300000)
  daily_rate?: number;             // 일 단가 (옵션)
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 경비 항목 설정
export interface ExpenseCategory {
  id: string;
  company_id: string;
  name: string;                    // '사무용품비', '출장비', '회의비', '제경비', '기술료'
  calculation_type: 'fixed' | 'percentage' | 'manual';
  base_field?: string;             // 'labor_total' (percentage일 때 기준)
  default_rate?: number;           // 비율 (예: 0.1 = 10%)
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// 견적서 인건비 상세
export interface QuoteLaborItem {
  id: string;
  quote_id: string;
  grade_id: string;
  grade_name: string;              // 스냅샷
  quantity: number;                // 인원 수
  participation_rate: number;      // 참여율 (0~1)
  months: number;                  // 개월 수
  unit_price: number;              // 단가 (스냅샷)
  subtotal: number;                // 소계
}

// 견적서 경비 상세
export interface QuoteExpenseItem {
  id: string;
  quote_id: string;
  category_id: string;
  category_name: string;           // 스냅샷
  amount: number;
  note?: string;
}

// 견적서 상태
export type QuoteStatus =
  | 'draft'           // 작성중
  | 'submitted'       // 제출완료
  | 'negotiating'     // 협상중
  | 'approved'        // 승인됨
  | 'rejected'        // 거절됨
  | 'converted';      // 계약전환

// 견적서
export interface Quote {
  id: string;
  company_id: string;
  quote_number: string;            // Q-2024-0001

  // 수신처 정보
  recipient_company: string;
  recipient_contact?: string;
  recipient_phone?: string;
  recipient_email?: string;

  title: string;
  service_name: string;

  // 금액
  labor_total: number;
  expense_total: number;
  total_amount: number;
  vat_amount: number;
  grand_total: number;

  // 상태
  status: QuoteStatus;
  quote_date: string;
  valid_until?: string;

  // 작성자
  created_by: string;
  created_by_name: string;

  // 회사 정보 스냅샷
  company_name: string;
  company_business_number?: string;
  company_representative?: string;
  company_address?: string;
  company_phone?: string;

  notes?: string;

  // 상세 항목
  labor_items?: QuoteLaborItem[];
  expense_items?: QuoteExpenseItem[];

  // 계약 전환
  converted_contract_id?: string;

  created_at: string;
  updated_at: string;
}

// ========================================
// 계약 관련 타입
// ========================================

// 계약 진행상황
export type ContractProgress =
  | 'contract_signed'    // 계약체결
  | 'in_progress'        // 진행중
  | 'inspection'         // 검수중
  | 'completed'          // 완료
  | 'on_hold'            // 보류
  | 'cancelled';         // 취소

// 계약 유형
export type ContractType =
  | 'service'            // 용역계약
  | 'research'           // 연구용역
  | 'consulting'         // 컨설팅
  | 'maintenance'        // 유지보수
  | 'other';

// 계약서
export interface Contract {
  id: string;
  company_id: string;
  contract_number: string;         // C-2024-0001
  contract_code?: string;

  // 발주기관 정보
  client_business_number?: string;
  client_company: string;
  client_contact_name?: string;
  client_contact_phone?: string;
  client_contact_email?: string;

  // 계약 기본 정보
  contract_type: ContractType;
  service_name: string;
  description?: string;

  // 계약 기간
  contract_start_date: string;
  contract_end_date?: string;

  // 금액 정보
  contract_amount: number;         // VAT 제외
  vat_amount: number;
  total_amount: number;            // VAT 포함

  // 진행 상황
  progress: ContractProgress;
  progress_note?: string;

  // 입금 관련
  received_amount: number;
  remaining_amount: number;

  // 기성 관련
  progress_billing_rate: number;
  progress_billing_amount: number;

  // 담당자
  manager_id: string;
  manager_name: string;

  // 원본 견적서
  source_quote_id?: string;

  notes?: string;

  created_by: string;
  created_at: string;
  updated_at: string;
}

// 계약 변경 이력
export interface ContractHistory {
  id: string;
  contract_id: string;
  change_type: 'created' | 'updated' | 'status_changed' | 'payment_received';
  change_description: string;
  previous_value?: string;
  new_value?: string;
  changed_by: string;
  changed_by_name: string;
  changed_at: string;
}

// 입금 기록
export interface ContractPayment {
  id: string;
  contract_id: string;
  payment_date: string;
  amount: number;
  payment_method?: string;
  note?: string;
  created_by: string;
  created_at: string;
}

// ========================================
// 양식 설정 (회사별)
// ========================================

export interface PriceSettings {
  id: string;
  company_id: string;

  labor_grades: LaborGrade[];
  expense_categories: ExpenseCategory[];

  default_vat_rate: number;        // 0.1 = 10%

  quote_number_prefix: string;     // 'Q'
  contract_number_prefix: string;  // 'C'

  updated_by: string;
  updated_at: string;
}
