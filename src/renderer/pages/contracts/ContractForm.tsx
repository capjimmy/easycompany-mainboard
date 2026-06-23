import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Typography, Button, Form, Input, InputNumber, DatePicker, Select,
  Space, Divider, message, Spin, Row, Col, List, Empty, Tag, Badge, AutoComplete,
  Timeline, Table, Collapse, Modal, Switch, Upload, Checkbox
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, FileAddOutlined, BulbOutlined, PaperClipOutlined, FolderOpenOutlined, CalendarOutlined, PlusOutlined, DeleteOutlined, HistoryOutlined, ScanOutlined, LinkOutlined, DisconnectOutlined, SearchOutlined, FilePdfOutlined, MailOutlined, EyeOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';
import { useContractStore } from '../../store/contractStore';
import DocumentGenerateModal from '../../components/documents/DocumentGenerateModal';
import GeneratedDocumentList from '../../components/documents/GeneratedDocumentList';
import DocumentAttachment from '../../components/documents/DocumentAttachment';
import RecommendationPopover from '../../components/common/RecommendationPopover';
import PaymentConditions from './PaymentConditions';
import ContractSubtasks from './ContractSubtasks';
import ContractItemsEditor from './ContractItemsEditor';
import EmailSendModal from '../../components/common/EmailSendModal';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface LaborItem {
  key: string;
  grade_id: string;
  grade_name: string;
  quantity: number;
  participation_rate: number;
  months: number;
  unit_price: number;
  subtotal: number;
}

interface ExpenseItem {
  key: string;
  category_id: string;
  category_name: string;
  calculation_type: 'manual' | 'percentage' | 'fixed';
  rate?: number;
  amount: number;
  note?: string;
}

interface SectionItem {
  id: string;
  parent_id: string | null;
  level: number;
  title: string;
  description?: string;
  amount: number;
  sort_order: number;
}

const CONTRACT_TYPES = [
  { value: 'service', label: '용역계약' },
  { value: 'research', label: '연구용역' },
  { value: 'consulting', label: '컨설팅' },
  { value: 'maintenance', label: '유지보수' },
  { value: 'other', label: '기타' },
];

const SERVICE_CATEGORIES = [
  { value: 'apartment', label: '공동주택' },
  { value: 'public_housing', label: '공공주택' },
  { value: 'private_rental', label: '민간임대주택' },
  { value: 'happy_housing', label: '행복주택' },
  { value: 'mixed_use', label: '주상복합' },
  { value: 'officetel', label: '오피스텔' },
  { value: 'residential_improvement', label: '주거환경개선' },
  { value: 'urban_development', label: '도시개발' },
  { value: 'redevelopment', label: '도시재개발/정비사업' },
  { value: 'knowledge_industry', label: '지식산업센터' },
  { value: 'educational', label: '교육시설' },
  { value: 'other', label: '기타' },
];

const ContractForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = id && id !== 'new';

  const { user, selectedCompanyId } = useAuthStore();
  const { currentContract, isLoading, fetchContractById, createContract, updateContract } = useContractStore();

  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentRefreshTrigger, setDocumentRefreshTrigger] = useState(0);
  const [watchedClient, setWatchedClient] = useState('');
  const [watchedService, setWatchedService] = useState('');
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [clientCompanyOptions, setClientCompanyOptions] = useState<{ value: string; label: string }[]>([]);
  const [allClientCompanies, setAllClientCompanies] = useState<{ name: string }[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // 이벤트 관련 상태
  const [contractEvents, setContractEvents] = useState<any[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState<any>(null);
  const [newEventDesc, setNewEventDesc] = useState('');
  const [eventLoading, setEventLoading] = useState(false);

  // 변경 이력 관련 상태
  const [contractHistories, setContractHistories] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 인건비/경비/상세내역
  const [laborItems, setLaborItems] = useState<LaborItem[]>([]);
  // 발주처(공동발주) — 한 계약에 여러 발주처, 각사 금액
  const [clients, setClients] = useState<any[]>([]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [sectionItems, setSectionItems] = useState<SectionItem[]>([]);
  const [laborGrades, setLaborGrades] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);

  // OCR 스캔 상태
  const [scanning, setScanning] = useState(false);

  // 폴더 스캔 상태
  const [folderScanning, setFolderScanning] = useState(false);

  // 견적서 연결 상태
  const [linkedQuote, setLinkedQuote] = useState<any>(null);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkSearchText, setLinkSearchText] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<any[]>([]);
  const [linkSearchLoading, setLinkSearchLoading] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [vatEnabled, setVatEnabled] = useState(true);

  // 프로젝트 멤버 상태
  const [memberIds, setMemberIds] = useState<string[]>([]);

  // 계약유형 감시 (용역계약일 때 용역종류 표시)
  const watchedContractType = Form.useWatch('contract_type', form);

  // 회의록/기타자료 상태
  const [meetingNotes, setMeetingNotes] = useState<any[]>([]);
  const [meetingNotesLoading, setMeetingNotesLoading] = useState(false);
  const [meetingNoteUploading, setMeetingNoteUploading] = useState(false);

  const loadMeetingNotes = async () => {
    if (!isEdit || !id || !user?.id) return;
    setMeetingNotesLoading(true);
    try {
      const res = await (window.electronAPI as any).contractMeetingNotes.getByContract(user.id, id);
      if (res?.success) setMeetingNotes(res.notes || []);
    } catch (_) {}
    setMeetingNotesLoading(false);
  };

  useEffect(() => {
    loadMeetingNotes();
  }, [id, user?.id]);

  const handleMeetingNoteUpload = async (file: File) => {
    if (!isEdit || !id || !user?.id) {
      message.warning('계약 저장 후 업로드 가능합니다.');
      return false;
    }
    setMeetingNoteUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((acc, b) => acc + String.fromCharCode(b), '')
      );
      const res = await (window.electronAPI as any).contractMeetingNotes.create(user.id, {
        contract_id: id,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        file_base64: base64,
      });
      if (res?.success) {
        message.success('업로드되었습니다.');
        loadMeetingNotes();
      } else {
        message.error(res?.error || '업로드 실패');
      }
    } catch (err: any) {
      message.error('업로드 중 오류: ' + (err.message || ''));
    }
    setMeetingNoteUploading(false);
    return false;
  };

  const handleMeetingNoteDelete = async (noteId: string) => {
    if (!user?.id) return;
    try {
      const res = await (window.electronAPI as any).contractMeetingNotes.delete(user.id, noteId);
      if (res?.success) {
        message.success('삭제되었습니다.');
        loadMeetingNotes();
      }
    } catch (_) {}
  };

  // 금액 계산 (항목 기반)
  const laborTotal = laborItems.reduce((sum, item) => sum + item.subtotal, 0);
  const expenseTotal = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  const level1Sections = sectionItems.filter(s => s.level === 1);
  const sectionTotal = level1Sections.reduce((sum, s) => sum + (s.amount || 0), 0);
  const hasItems = laborItems.length > 0 || expenseItems.length > 0 || sectionItems.length > 0;
  const directAmount = Form.useWatch('contract_amount', form) || 0;
  const contractAmount = hasItems ? (laborTotal + expenseTotal + sectionTotal) : directAmount;
  const vatAmount = vatEnabled ? Math.round(contractAmount * 0.1) : 0;
  const totalAmount = contractAmount + vatAmount;

  // 회사 ID 결정: super_admin이 선택한 회사(selectedCompanyId) 우선, 그다음 user.company_id, 마지막 첫 회사
  useEffect(() => {
    const initCompanyId = async () => {
      if (!user?.id) return;

      // 1순위: super_admin이 헤더에서 선택한 회사
      let companyId: string | null | undefined = (user.role === 'super_admin' && selectedCompanyId) ? selectedCompanyId : user.company_id;

      // 2순위: super_admin인데 선택 안 했고 본인 회사도 없으면 회사 목록 첫 번째
      if (!companyId && user.role === 'super_admin') {
        try {
          const result = await window.electronAPI.companies.getAll(user.id);
          if (result.success && result.companies && result.companies.length > 0) {
            companyId = result.companies[0].id;
          }
        } catch (err) {
          console.error('Failed to fetch companies:', err);
        }
      }

      if (companyId) {
        setActiveCompanyId(companyId);
      }
    };

    initCompanyId();
  }, [user?.id, user?.company_id, user?.role, selectedCompanyId]);

  // 거래처, 사용자, 부서 목록 로드
  useEffect(() => {
    const fetchDropdownData = async () => {
      if (!user?.id) return;
      try {
        const [clientResult, userResult, deptResult] = await Promise.all([
          window.electronAPI.clients.getAll(user.id),
          window.electronAPI.users.getAll(user.id),
          window.electronAPI.departments.getAll(user.id),
        ]);
        if (clientResult.success && clientResult.clients) {
          setAllClientCompanies(clientResult.clients.map((c: any) => ({ name: c.name })));
          setClientCompanyOptions(
            clientResult.clients.map((c: any) => ({ value: c.name, label: c.name }))
          );
        }
        if (userResult.success && userResult.users) {
          // 담당자/프로젝트멤버는 회사 무관 전체 표시 (요청사항)
          setUsers(userResult.users.filter((u: any) => u.is_active));
        }
        if (deptResult.success && deptResult.departments) {
          // 회사별 부서 필터링 (선택된 회사의 부서만)
          const companyFilter = user.role === 'super_admin'
            ? (selectedCompanyId || activeCompanyId)
            : user.company_id;
          setDepartments(
            (deptResult.departments as any[]).filter(
              (d: any) => !companyFilter || d.company_id === companyFilter
            )
          );
        }
      } catch (err) {
        console.error('Failed to fetch dropdown data:', err);
      }
    };
    fetchDropdownData();
  }, [user?.id, selectedCompanyId, activeCompanyId]);

  // 인건비 등급, 경비 항목 로드 (AI 스캔 매칭용)
  useEffect(() => {
    const loadPriceSettings = async () => {
      if (!user?.id || !activeCompanyId) return;
      try {
        const result = await window.electronAPI.priceSettings.getAll(user.id, activeCompanyId);
        if (result.success) {
          setLaborGrades(result.laborGrades || []);
          setExpenseCategories(result.expenseCategories || []);
        }
      } catch (err) {
        console.error('Failed to load price settings:', err);
      }
    };
    loadPriceSettings();
  }, [user?.id, activeCompanyId]);

  // 발주기관 AutoComplete 검색 필터
  const handleClientSearch = (searchText: string) => {
    if (!searchText) {
      setClientCompanyOptions(
        allClientCompanies.map((c) => ({ value: c.name, label: c.name }))
      );
      return;
    }
    const filtered = allClientCompanies.filter((c) =>
      c.name.toLowerCase().includes(searchText.toLowerCase())
    );
    setClientCompanyOptions(
      filtered.map((c) => ({ value: c.name, label: c.name }))
    );
  };

  useEffect(() => {
    if (user?.id && isEdit && id) {
      fetchContractById(user.id, id);
    }
  }, [user?.id, id, isEdit]);

  useEffect(() => {
    if (isEdit && currentContract) {
      form.setFieldsValue({
        client_company: currentContract.client_company,
        client_business_number: currentContract.client_business_number,
        client_contact_name: currentContract.client_contact_name,
        client_contact_phone: currentContract.client_contact_phone,
        client_contact_email: currentContract.client_contact_email,
        contract_type: currentContract.contract_type,
        service_category: currentContract.service_category,
        service_name: currentContract.service_name,
        description: currentContract.description,
        contract_code: currentContract.contract_code,
        contract_date: currentContract.contract_date ? dayjs(currentContract.contract_date) : null,
        contract_start_date: currentContract.contract_start_date ? dayjs(currentContract.contract_start_date) : null,
        contract_end_date: currentContract.contract_end_date ? dayjs(currentContract.contract_end_date) : null,
        contract_amount: currentContract.contract_amount,
        progress_rate: currentContract.progress_rate,
        progress_note: currentContract.progress_note,
        progress_billing_rate: currentContract.progress_billing_rate,
        progress_billing_amount: currentContract.progress_billing_amount,
        manager_name: currentContract.manager_name,
        manager_id: currentContract.manager_id,
        department_id: currentContract.department_id,
        is_outsourced: currentContract.is_outsourced ?? false,
        outsource_company: currentContract.outsource_company,
        outsource_amount: currentContract.outsource_amount,
        notes: currentContract.notes,
        // 추가기재 — 계약정보
        has_original_contract: currentContract.has_original_contract ?? false,
        contract_seal_shapes: currentContract.contract_seal_shapes || [],
        statement_submitted: currentContract.statement_submitted ?? false,
        statement_submitted_date: currentContract.statement_submitted_date ? dayjs(currentContract.statement_submitted_date) : null,
        // 추가기재 — 금액정보
        contract_deposit_amount: currentContract.contract_deposit_amount ?? 0,
        contract_deposit_rate: currentContract.contract_deposit_rate ?? undefined,
        guarantee_esubmission: currentContract.guarantee_esubmission ?? undefined,
        defect_guarantee_rate: currentContract.defect_guarantee_rate ?? undefined,
        defect_liability_months: currentContract.defect_liability_months ?? undefined,
        delay_penalty_rate: currentContract.delay_penalty_rate ?? undefined,
        local_bond_applicable: currentContract.local_bond_applicable ?? false,
        local_bond_amount: currentContract.local_bond_amount ?? 0,
        stamp_tax_applicable: currentContract.stamp_tax_applicable ?? false,
        stamp_tax_amount: currentContract.stamp_tax_amount ?? 0,
      });

      // 추천 기능을 위한 값 설정
      setWatchedClient(currentContract.client_company || '');
      setWatchedService(currentContract.service_name || '');

      // 발주처(공동발주) 로드
      if ((currentContract as any).clients?.length > 0) {
        setClients((currentContract as any).clients.map((c: any, i: number) => ({
          key: `client-${i}`,
          client_company: c.client_company || '',
          client_business_number: c.client_business_number || '',
          client_contact_name: c.client_contact_name || '',
          client_contact_phone: c.client_contact_phone || '',
          amount: c.amount || 0,
        })));
      }

      // 인건비 항목 로드
      if (currentContract.laborItems?.length > 0) {
        setLaborItems(
          currentContract.laborItems.map((item: any, index: number) => ({
            key: `labor-${index}`,
            grade_id: item.grade_id || '',
            grade_name: item.grade_name || '',
            quantity: item.quantity || 1,
            participation_rate: item.participation_rate || 1,
            months: item.months || 1,
            unit_price: item.unit_price || 0,
            subtotal: item.subtotal || 0,
          }))
        );
      }

      // 경비 항목 로드
      if (currentContract.expenseItems?.length > 0) {
        setExpenseItems(
          currentContract.expenseItems.map((item: any, index: number) => ({
            key: `expense-${index}`,
            category_id: item.category_id || '',
            category_name: item.category_name || '',
            calculation_type: item.calculation_type || 'manual',
            rate: item.rate || undefined,
            amount: item.amount || 0,
            note: item.note || '',
          }))
        );
      }

      // 상세내역(섹션) 로드
      if (currentContract.sections?.length > 0) {
        setSectionItems(
          currentContract.sections.map((item: any) => ({
            id: item.id,
            parent_id: item.parent_id,
            level: item.level || 1,
            title: item.title || '',
            description: item.description || '',
            amount: item.amount || 0,
            sort_order: item.sort_order || 0,
          }))
        );
      }

      // 멤버 로드 (메인 담당자 제외, member role만)
      if (currentContract.members?.length > 0) {
        const memberUserIds = currentContract.members
          .filter((m: any) => m.role === 'member')
          .map((m: any) => m.user_id);
        setMemberIds(memberUserIds);
      } else {
        setMemberIds([]);
      }
    }
  }, [currentContract, isEdit]);

  const handleSubmit = async (values: any) => {
    const companyId = activeCompanyId || user?.company_id;
    if (!user?.id || !companyId) {
      message.error('회사 정보를 찾을 수 없습니다.');
      return;
    }

    setSubmitting(true);

    // 멤버 배열 생성
    const membersData = memberIds.map((uid) => {
      const u = users.find((u: any) => u.id === uid);
      return { user_id: uid, user_name: u?.name || '' };
    });

    const contractData = {
      ...values,
      company_id: companyId,
      contract_date: values.contract_date?.format('YYYY-MM-DD'),
      contract_start_date: values.contract_start_date?.format('YYYY-MM-DD'),
      contract_end_date: values.contract_end_date?.format('YYYY-MM-DD'),
      statement_submitted_date: values.statement_submitted_date?.format('YYYY-MM-DD') || null,
      // 항목 기반 금액
      contract_amount: contractAmount,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      vat_enabled: vatEnabled,
      laborItems,
      expenseItems,
      sectionItems,
      section_total: sectionTotal,
      members: membersData,
      // 발주처(공동발주) — 업체명 있는 행만
      clients: clients.filter((c) => (c.client_company || '').trim()),
    };

    try {
      let result;
      if (isEdit && id) {
        result = await updateContract(user.id, id, contractData);
      } else {
        result = await createContract(user.id, contractData);
      }

      if (result.success) {
        message.success(isEdit ? '계약이 수정되었습니다.' : '계약이 등록되었습니다.');
        navigate('/contracts');
      } else {
        message.error(result.error || '저장에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 원본 파일 열기
  const handleOpenOriginal = async () => {
    if (!currentContract?.source_file_path) {
      message.warning('이 계약서에는 원본 파일 경로 정보가 없습니다.');
      return;
    }
    try {
      const result = await window.electronAPI.settings.openOriginalFile(currentContract.source_file_path);
      if (!result.success) {
        message.error(result.error);
      }
    } catch (err: any) {
      message.error(err?.message || '원본 파일 열기에 실패했습니다.');
    }
  };

  // 이벤트 로드
  useEffect(() => {
    if (isEdit && id && user?.id) {
      loadEvents();
    }
  }, [isEdit, id, user?.id]);

  const loadEvents = async () => {
    if (!user?.id || !id) return;
    try {
      const result = await window.electronAPI.contracts.getEvents(user.id, id);
      if (result.success) {
        setContractEvents(result.events || []);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  const handleAddEvent = async () => {
    if (!user?.id || !id) return;
    if (!newEventTitle || !newEventDate) {
      message.warning('제목과 날짜를 입력해주세요.');
      return;
    }
    setEventLoading(true);
    try {
      const result = await window.electronAPI.contracts.addEvent(user.id, id, {
        event_title: newEventTitle,
        event_date: newEventDate.format('YYYY-MM-DD'),
        event_description: newEventDesc || undefined,
      });
      if (result.success) {
        message.success('이벤트가 추가되었습니다.');
        setNewEventTitle('');
        setNewEventDate(null);
        setNewEventDesc('');
        setShowEventForm(false);
        loadEvents();
      } else {
        message.error(result.error || '이벤트 추가 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '이벤트 추가 중 오류가 발생했습니다.');
    } finally {
      setEventLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.contracts.deleteEvent(user.id, eventId);
      if (result.success) {
        message.success('이벤트가 삭제되었습니다.');
        loadEvents();
      } else {
        message.error(result.error || '이벤트 삭제 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '이벤트 삭제 중 오류가 발생했습니다.');
    }
  };

  // 변경 이력 로드
  useEffect(() => {
    if (isEdit && id && user?.id) {
      loadHistories();
    }
  }, [isEdit, id, user?.id]);

  const loadHistories = async () => {
    if (!user?.id || !id) return;
    setHistoryLoading(true);
    try {
      const result = await window.electronAPI.contracts.getHistories(user.id, id);
      if (result.success) {
        setContractHistories(result.histories || []);
      }
    } catch (err) {
      console.error('Failed to load histories:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getChangeTypeTag = (changeType: string) => {
    const typeMap: Record<string, { color: string; label: string }> = {
      created: { color: 'green', label: '생성' },
      updated: { color: 'blue', label: '수정' },
      status_changed: { color: 'cyan', label: '상태 변경' },
      payment_received: { color: 'gold', label: '입금' },
      amount: { color: 'purple', label: '금액 변경' },
      deleted: { color: 'red', label: '삭제' },
    };
    const type = typeMap[changeType] || { color: 'default', label: changeType };
    return <Tag color={type.color}>{type.label}</Tag>;
  };

  const historyColumns = [
    {
      title: '일시',
      dataIndex: 'changed_at',
      key: 'changed_at',
      width: 160,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '변경유형',
      dataIndex: 'change_type',
      key: 'change_type',
      width: 110,
      render: (val: string) => getChangeTypeTag(val),
    },
    {
      title: '변경내용',
      dataIndex: 'change_description',
      key: 'change_description',
      ellipsis: true,
    },
    {
      title: '이전 값',
      dataIndex: 'previous_value',
      key: 'previous_value',
      width: 200,
      ellipsis: true,
      render: (val: string | null) => val || '-',
    },
    {
      title: '새 값',
      dataIndex: 'new_value',
      key: 'new_value',
      width: 200,
      ellipsis: true,
      render: (val: string | null) => <strong>{val || '-'}</strong>,
    },
    {
      title: '처리자',
      dataIndex: 'changed_by_name',
      key: 'changed_by_name',
      width: 100,
      render: (name: string) => name || '-',
    },
  ];

  // 문서 스캔 (OCR)
  const handleOCRScan = async () => {
    if (!user?.id) return;
    setScanning(true);
    try {
      const result = await window.electronAPI.ocr.processImage(user.id, '', 'contract');
      if (result.error === 'canceled') {
        // 사용자가 취소
      } else if (result.success && result.data) {
        const data = result.data;
        const formValues: any = {};
        if (data.client_company) formValues.client_company = data.client_company;
        if (data.client_contact_name) formValues.client_contact_name = data.client_contact_name;
        if (data.client_contact_phone) formValues.client_contact_phone = data.client_contact_phone;
        if (data.service_name) formValues.service_name = data.service_name;
        if (data.contract_type) formValues.contract_type = data.contract_type;
        if (data.contract_start_date) formValues.contract_start_date = dayjs(data.contract_start_date);
        if (data.contract_end_date) formValues.contract_end_date = dayjs(data.contract_end_date);
        if (data.contract_amount) formValues.contract_amount = data.contract_amount;
        if (data.description) formValues.description = data.description;
        if (data.notes) formValues.notes = data.notes;

        form.setFieldsValue(formValues);
        if (data.client_company) setWatchedClient(data.client_company);
        if (data.service_name) setWatchedService(data.service_name);

        // 인건비 항목 자동 채우기
        if (data.labor_items?.length > 0) {
          const mapped = data.labor_items.map((item: any, idx: number) => {
            const matched = laborGrades.find((g: any) => g.name === item.grade_name);
            return {
              key: `scan-labor-${idx}`,
              grade_id: matched?.id || '',
              grade_name: item.grade_name || '',
              quantity: item.quantity || 1,
              participation_rate: item.participation_rate || 100,
              months: item.months || 1,
              unit_price: matched?.monthly_rate || item.unit_price || 0,
              subtotal: (item.quantity || 1) * ((item.participation_rate || 100) / 100) * (item.months || 1) * (matched?.monthly_rate || item.unit_price || 0),
            };
          });
          setLaborItems(mapped);
        }

        // 경비 항목 자동 채우기
        if (data.expense_items?.length > 0) {
          const mapped = data.expense_items.map((item: any, idx: number) => {
            const matched = expenseCategories.find((c: any) => c.name === item.category_name);
            return {
              key: `scan-expense-${idx}`,
              category_id: matched?.id || '',
              category_name: item.category_name || '',
              calculation_type: item.calculation_type || 'manual',
              rate: item.rate,
              amount: item.amount || 0,
              note: '',
            };
          });
          setExpenseItems(mapped);
        }

        // 섹션(대분류/세부/세세부) 자동 채우기
        if (data.sections?.length > 0) {
          const flatItems: SectionItem[] = [];
          let sortOrder = 0;
          const flattenSections = (items: any[], parentId: string | null) => {
            items.forEach((item: any) => {
              const id = crypto.randomUUID();
              sortOrder++;
              flatItems.push({
                id,
                parent_id: parentId,
                level: item.level || 1,
                title: item.title || '',
                amount: item.amount || 0,
                sort_order: sortOrder,
              });
              if (item.children?.length > 0) {
                flattenSections(item.children, id);
              }
            });
          };
          flattenSections(data.sections, null);
          setSectionItems(flatItems);
        }

        message.success('문서에서 정보가 추출되었습니다. 내용을 확인해주세요.');
      } else if (result.rawText) {
        message.info('문서를 인식했지만 구조화된 데이터로 변환하지 못했습니다.');
      } else if (result.error && result.error !== 'canceled') {
        message.error(result.error);
      }
    } catch (err: any) {
      message.error(err?.message || '문서 스캔 중 오류가 발생했습니다.');
    } finally {
      setScanning(false);
    }
  };

  // 폴더 불러오기
  const handleFolderImport = async () => {
    setFolderScanning(true);
    try {
      const result = await window.electronAPI.folderScan.scanFolder('contract');
      if (result.error === 'canceled') {
        // user cancelled
      } else if (result.success && result.data) {
        const data = result.data;
        const formValues: any = {};
        if (data.client_company) formValues.client_company = data.client_company;
        if (data.client_contact_name) formValues.client_contact_name = data.client_contact_name;
        if (data.client_contact_phone) formValues.client_contact_phone = data.client_contact_phone;
        if (data.client_contact_email) formValues.client_contact_email = data.client_contact_email;
        if (data.service_name) formValues.service_name = data.service_name;
        if (data.contract_type) formValues.contract_type = data.contract_type;
        if (data.contract_start_date) formValues.contract_start_date = dayjs(data.contract_start_date);
        if (data.contract_end_date) formValues.contract_end_date = dayjs(data.contract_end_date);
        if (data.contract_amount) formValues.contract_amount = data.contract_amount;
        if (data.description) formValues.description = data.description;
        if (data.notes) formValues.notes = data.notes;
        form.setFieldsValue(formValues);
        if (data.client_company) setWatchedClient(data.client_company);
        if (data.service_name) setWatchedService(data.service_name);

        // 인건비 항목 자동 채우기
        if (data.labor_items?.length > 0) {
          const mapped = data.labor_items.map((item: any, idx: number) => {
            const matched = laborGrades.find((g: any) => g.name === item.grade_name);
            return {
              key: `folder-labor-${idx}`,
              grade_id: matched?.id || '',
              grade_name: item.grade_name || '',
              quantity: item.quantity || 1,
              participation_rate: item.participation_rate || 100,
              months: item.months || 1,
              unit_price: matched?.monthly_rate || item.unit_price || 0,
              subtotal: (item.quantity || 1) * ((item.participation_rate || 100) / 100) * (item.months || 1) * (matched?.monthly_rate || item.unit_price || 0),
            };
          });
          setLaborItems(mapped);
        }

        // 경비 항목 자동 채우기
        if (data.expense_items?.length > 0) {
          const mapped = data.expense_items.map((item: any, idx: number) => {
            const matched = expenseCategories.find((c: any) => c.name === item.category_name);
            return {
              key: `folder-expense-${idx}`,
              category_id: matched?.id || '',
              category_name: item.category_name || '',
              calculation_type: item.calculation_type || 'manual',
              rate: item.rate,
              amount: item.amount || 0,
              note: '',
            };
          });
          setExpenseItems(mapped);
        }

        // 섹션(대분류/세부/세세부) 자동 채우기
        if (data.sections?.length > 0) {
          const flatItems: SectionItem[] = [];
          let sortOrder = 0;
          const flattenSections = (items: any[], parentId: string | null) => {
            items.forEach((item: any) => {
              const id = crypto.randomUUID();
              sortOrder++;
              flatItems.push({
                id,
                parent_id: parentId,
                level: item.level || 1,
                title: item.title || '',
                amount: item.amount || 0,
                sort_order: sortOrder,
              });
              if (item.children?.length > 0) {
                flattenSections(item.children, id);
              }
            });
          };
          flattenSections(data.sections, null);
          setSectionItems(flatItems);
        }

        message.success(`폴더에서 ${result.scannedFiles}개 파일을 분석하여 정보를 추출했습니다.`);
      } else if (result.error) {
        message.error(result.error);
      }
    } catch (err: any) {
      message.error(err?.message || '폴더 스캔 중 오류가 발생했습니다.');
    } finally {
      setFolderScanning(false);
    }
  };

  // 연결된 견적서 로드
  useEffect(() => {
    if (isEdit && id && user?.id) {
      loadLinkedQuote();
    }
  }, [isEdit, id, user?.id]);

  const loadLinkedQuote = async () => {
    if (!user?.id || !id) return;
    try {
      const result = await window.electronAPI.linking.getLinkedQuote(user.id, id);
      if (result.success) {
        setLinkedQuote(result.quote);
      }
    } catch (err) {
      console.error('Failed to load linked quote:', err);
    }
  };

  const handleSearchQuotes = async () => {
    if (!user?.id) return;
    setLinkSearchLoading(true);
    try {
      const result = await window.electronAPI.linking.searchQuotes(user.id, linkSearchText);
      if (result.success) {
        setLinkSearchResults(result.quotes || []);
      }
    } catch (err) {
      console.error('Failed to search quotes:', err);
    } finally {
      setLinkSearchLoading(false);
    }
  };

  const handleLinkQuote = async (quoteId: string) => {
    if (!user?.id || !id) return;
    try {
      const result = await window.electronAPI.linking.linkQuoteToContract(user.id, quoteId, id);
      if (result.success) {
        message.success('견적서가 연결되었습니다.');
        setLinkModalVisible(false);
        loadLinkedQuote();
      } else {
        message.error(result.error || '연결에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '연결 중 오류가 발생했습니다.');
    }
  };

  const handleUnlinkQuote = async () => {
    if (!user?.id || !id || !linkedQuote) return;
    try {
      const result = await window.electronAPI.linking.unlinkQuoteFromContract(user.id, linkedQuote.id, id);
      if (result.success) {
        message.success('연결이 해제되었습니다.');
        setLinkedQuote(null);
      } else {
        message.error(result.error || '연결 해제에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '연결 해제 중 오류가 발생했습니다.');
    }
  };

  // PDF 다운로드
  const handleDownloadPdf = async () => {
    if (!user?.id || !id) return;
    setPdfGenerating(true);
    try {
      const result = await window.electronAPI.pdf.generateContract(user.id, id);
      if (result.success && result.filePath) {
        const defaultName = `계약서_${currentContract?.contract_number || ''}.pdf`;
        const saveResult = await window.electronAPI.pdf.saveAs(result.filePath, defaultName);
        if (saveResult.success) {
          message.success('PDF가 저장되었습니다.');
        } else if (saveResult.error !== 'canceled') {
          message.error(saveResult.error || 'PDF 저장에 실패했습니다.');
        }
      } else {
        message.error(result.error || 'PDF 생성에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || 'PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setPdfGenerating(false);
    }
  };

  if (isLoading && isEdit) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/contracts')} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? '계약 수정' : '계약 등록'}
            </Title>
          </div>
        </div>
        <Space>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={handleFolderImport}
            loading={folderScanning}
          >
            폴더 불러오기
          </Button>
          <Button
            icon={<ScanOutlined />}
            onClick={handleOCRScan}
            loading={scanning}
          >
            문서 스캔
          </Button>
          {isEdit && currentContract?.source_file_path && (
            <Button
              icon={<FolderOpenOutlined />}
              onClick={handleOpenOriginal}
            >
              원본열기
            </Button>
          )}
          {isEdit && id && (
            <>
              <Button
                icon={<FileAddOutlined />}
                onClick={() => setShowDocumentModal(true)}
              >
                문서 생성
              </Button>
              <Button
                icon={<EyeOutlined />}
                onClick={() => setPreviewVisible(true)}
              >
                미리보기
              </Button>
              <Button
                icon={<FilePdfOutlined />}
                onClick={handleDownloadPdf}
                loading={pdfGenerating}
              >
                PDF 저장
              </Button>
              <Button
                icon={<MailOutlined />}
                onClick={() => setEmailModalVisible(true)}
              >
                이메일 발송
              </Button>
            </>
          )}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            onClick={() => form.submit()}
          >
            저장
          </Button>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          contract_type: 'service',
          contract_start_date: dayjs(),
        }}
      >
        {/* 발주기관 정보 */}
        <Card
          title="발주기관 정보"
          style={{ marginBottom: 16 }}
          extra={
            <RecommendationPopover
              type="contract"
              clientCompany={watchedClient}
              serviceName={watchedService}
              onSelect={(item: any) => {
                // 선택한 계약서 정보로 참고할 수 있도록 메시지 표시
                message.info(`참고: ${item.contract_number} - 총액 ${item.total_amount?.toLocaleString()}원`);
              }}
            />
          }
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="client_company"
                label="발주기관명"
                rules={[{ required: true, message: '발주기관명을 입력해주세요.' }]}
              >
                <AutoComplete
                  options={clientCompanyOptions}
                  onSearch={handleClientSearch}
                  onChange={(value) => setWatchedClient(value)}
                  placeholder="계약 발주 기관/회사명"
                  filterOption={false}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="client_business_number" label="사업자번호">
                <Input placeholder="000-00-00000" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="client_contact_name" label="담당자명">
                <Input placeholder="담당자명" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="client_contact_phone" label="연락처">
                <Input placeholder="전화번호" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="client_contact_email" label="이메일">
                <Input placeholder="이메일" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 발주처 (공동발주) — 한 계약에 여러 발주처, 각사 금액 */}
        <Card
          title="발주처 (공동발주)"
          size="small"
          style={{ marginBottom: 16 }}
          extra={
            <Button
              size="small"
              type="dashed"
              onClick={() => setClients([...clients, { key: `client-${Date.now()}`, client_company: '', client_business_number: '', client_contact_name: '', client_contact_phone: '', amount: 0 }])}
            >
              + 발주처 추가
            </Button>
          }
        >
          <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
            여러 발주처가 공동발주한 계약이면 각 발주처와 금액을 추가하세요. 추가하면 <strong>계약총액 = 발주처 금액 합</strong>으로 계산되고, 청구·수금을 발주처별로 관리할 수 있습니다. (발주처가 한 곳이면 추가 안 하셔도 됩니다)
          </div>
          {clients.length > 0 && (
            <>
              {clients.map((c, idx) => (
                <Row gutter={8} key={c.key || idx} style={{ marginBottom: 8 }}>
                  <Col span={6}><Input placeholder="업체명" value={c.client_company} onChange={(e) => { const n = [...clients]; n[idx] = { ...c, client_company: e.target.value }; setClients(n); }} /></Col>
                  <Col span={5}><Input placeholder="사업자번호" value={c.client_business_number} onChange={(e) => { const n = [...clients]; n[idx] = { ...c, client_business_number: e.target.value }; setClients(n); }} /></Col>
                  <Col span={4}><Input placeholder="담당/연락처" value={c.client_contact_phone} onChange={(e) => { const n = [...clients]; n[idx] = { ...c, client_contact_phone: e.target.value }; setClients(n); }} /></Col>
                  <Col span={6}><InputNumber style={{ width: '100%' }} placeholder="금액(VAT별도)" min={0} value={c.amount} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={((v?: string) => Number((v || '').replace(/[^0-9]/g, ''))) as any} onChange={(v) => { const n = [...clients]; n[idx] = { ...c, amount: v || 0 }; setClients(n); }} /></Col>
                  <Col span={3}><Button danger size="small" onClick={() => setClients(clients.filter((_, i) => i !== idx))}>삭제</Button></Col>
                </Row>
              ))}
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
                발주처 합계(공급가): {clients.reduce((s, c) => s + (Number(c.amount) || 0), 0).toLocaleString()}원
              </div>
            </>
          )}
        </Card>

        {/* 계약 정보 */}
        <Card title="계약 정보" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={watchedContractType === 'service' ? 8 : 12}>
              <Form.Item
                name="service_name"
                label="용역명"
                rules={[{ required: true, message: '용역명을 입력해주세요.' }]}
              >
                <Input
                  placeholder="용역/프로젝트명"
                  onChange={(e) => setWatchedService(e.target.value)}
                />
              </Form.Item>
            </Col>
            <Col span={watchedContractType === 'service' ? 4 : 6}>
              <Form.Item
                name="contract_type"
                label="계약유형"
                rules={[{ required: true, message: '계약유형을 선택해주세요.' }]}
              >
                <Select>
                  {CONTRACT_TYPES.map((type) => (
                    <Option key={type.value} value={type.value}>
                      {type.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            {watchedContractType === 'service' && (
              <Col span={4}>
                <Form.Item name="service_category" label="용역종류">
                  <Select placeholder="종류 선택" allowClear>
                    {SERVICE_CATEGORIES.map((cat) => (
                      <Option key={cat.value} value={cat.value}>
                        {cat.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            )}
            <Col span={watchedContractType === 'service' ? 4 : 6}>
              <Form.Item name="contract_code" label="계약코드">
                <Input placeholder="내부 관리 코드" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="description" label="계약 설명">
                <TextArea rows={2} placeholder="계약 내용 설명" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="contract_date" label="계약 체결일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="contract_start_date"
                label="계약 시작일"
                rules={[{ required: true, message: '계약 시작일을 선택해주세요.' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="contract_end_date" label="계약 종료일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="manager_id" label="담당자">
                <Select
                  placeholder="담당자 선택"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  onChange={(value) => {
                    const selected = users.find((u: any) => u.id === value);
                    if (selected) {
                      form.setFieldValue('manager_name', selected.name);
                    }
                  }}
                >
                  {users.map((u: any) => (
                    <Option key={u.id} value={u.id}>
                      {u.name} ({u.rank || u.position || u.role})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="manager_name" hidden><Input /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="department_id" label="담당 부서">
                <Select placeholder="부서 선택" allowClear showSearch optionFilterProp="children">
                  {departments.map((d: any) => (
                    <Option key={d.id} value={d.id}>{d.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_outsourced" valuePropName="checked" label="외주 여부">
                <Checkbox>외주 진행 계약</Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label={<span><TeamOutlined /> 프로젝트 멤버</span>}>
                <Select
                  mode="multiple"
                  placeholder="프로젝트 멤버 선택 (메인 담당자는 자동 포함)"
                  value={memberIds}
                  onChange={(values: string[]) => setMemberIds(values)}
                  optionFilterProp="children"
                  showSearch
                  allowClear
                  style={{ width: '100%' }}
                >
                  {users
                    .filter((u: any) => u.id !== form.getFieldValue('manager_id'))
                    .map((u: any) => (
                      <Option key={u.id} value={u.id}>
                        {u.name} ({u.rank || u.position || u.role})
                      </Option>
                    ))}
                </Select>
                <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
                  메인 담당자는 자동으로 포함됩니다. 추가 멤버를 선택하세요.
                </div>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 인건비/경비/상세내역 — 계약관리에서는 제거(요청). 계약은 직접금액/발주처 기준. (견적서에서 사용) */}

        {/* 금액 정보 (직접 입력) */}
        {!hasItems && (
          <Card title="금액 정보 (직접 입력)" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item
                  name="contract_amount"
                  label="계약금액 (VAT 별도)"
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={((value?: string) => Number((value || '').replace(/[^0-9]/g, ''))) as any}
                    placeholder="계약 금액"
                    min={0}
                  />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item label="VAT">
                  <Space direction="vertical" size={4}>
                    <Switch
                      checked={vatEnabled}
                      onChange={setVatEnabled}
                      checkedChildren="VAT 포함"
                      unCheckedChildren="VAT 없음"
                    />
                    <div style={{ fontSize: 14, color: '#888' }}>
                      {vatEnabled ? vatAmount.toLocaleString() + '원' : '0원'}
                    </div>
                  </Space>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="총액 (VAT 포함)">
                  <InputNumber
                    style={{ width: '100%', fontWeight: 'bold', fontSize: 16 }}
                    value={totalAmount}
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={((value?: string) => Number((value || '').replace(/[^0-9]/g, ''))) as any}
                    min={0}
                    onChange={(value) => {
                      const newTotal = value || 0;
                      if (vatEnabled) {
                        // 공급가액 + round(공급가액×0.1) === 입력 총액 이 되도록 보정 (반올림 1원 오차 제거)
                        let supply = Math.round(newTotal / 1.1);
                        for (let i = 0; i < 3; i++) {
                          const t = supply + Math.round(supply * 0.1);
                          if (t === newTotal) break;
                          supply += t < newTotal ? 1 : -1;
                        }
                        form.setFieldValue('contract_amount', supply);
                      } else {
                        form.setFieldValue('contract_amount', newTotal);
                      }
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Text type="secondary">위에서 인건비/경비/상세내역을 추가하면 자동 계산됩니다.</Text>
          </Card>
        )}

        {/* 진행 정보 */}
        <Card title="진행 정보" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="progress_rate" label="진행률 (%)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={100}
                  placeholder="0~100"
                  formatter={(value) => `${value}%`}
                  parser={(value) => value!.replace('%', '') as unknown as number}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="progress_billing_rate" label="기성 청구율 (%)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={100}
                  placeholder="0~100"
                  formatter={(value) => `${value}%`}
                  parser={(value) => value!.replace('%', '') as unknown as number}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="progress_billing_amount" label="기성 청구금액">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={((value?: string) => Number((value || '').replace(/[^0-9]/g, ''))) as any}
                  placeholder="청구 금액"
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="progress_note" label="진행 메모">
                <TextArea rows={2} placeholder="진행 상황 메모 (예: 1차 중간보고 완료)" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 외주 정보 */}
        <Card title="외주 정보" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="outsource_company" label="외주사/협력사명">
                <Input placeholder="외주 업체명" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="outsource_amount" label="외주비">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={((value?: string) => Number((value || '').replace(/[^0-9]/g, ''))) as any}
                  placeholder="외주 금액"
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 비고 */}
        <Card title="비고" style={{ marginBottom: 16 }}>
          <Form.Item name="notes" noStyle>
            <TextArea rows={3} placeholder="추가 메모 또는 특이사항" />
          </Form.Item>
        </Card>

        {/* 추가 계약정보 (계약/매출) — 추가기재요청사항 2026-06-16 */}
        <Card title="추가 계약정보 (계약/매출)" style={{ marginBottom: 16 }}>
          <Divider orientation="left" style={{ marginTop: 0 }}>계약정보</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="has_original_contract" label="원본계약서 유무" valuePropName="checked">
                <Switch checkedChildren="유" unCheckedChildren="무" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="contract_seal_shapes" label="계약도장[사용인감]">
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="도장 모양 선택 (복수 가능)"
                  options={[
                    { value: '마름모', label: '마름모' },
                    { value: '세모', label: '세모' },
                    { value: '동그라미', label: '동그라미' },
                    { value: '네모', label: '네모' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="statement_submitted" label="기성청구서·거래명세서 제출" valuePropName="checked">
                <Switch checkedChildren="제출" unCheckedChildren="미제출" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="statement_submitted_date" label="제출일">
                <DatePicker style={{ width: '100%' }} placeholder="제출일 선택" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">금액정보 (직접입력)</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="contract_deposit_amount" label="총계약보증금">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={((value?: string) => Number((value || '').replace(/[^0-9]/g, ''))) as any}
                  min={0}
                  addonAfter="원"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contract_deposit_rate" label="계약보증금율">
                <InputNumber style={{ width: '100%' }} min={0} max={100} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="guarantee_esubmission" label="계약보증서 전자제출여부">
                <Select
                  allowClear
                  placeholder="선택"
                  options={[
                    { value: '전자접수및직접수납', label: '전자접수및직접수납' },
                    { value: '지급각서로대체', label: '지급각서로대체' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="defect_guarantee_rate" label="하자보수보증금율">
                <InputNumber style={{ width: '100%' }} min={0} max={100} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="defect_liability_months" label="하자담보책임기간">
                <InputNumber style={{ width: '100%' }} min={0} addonAfter="개월" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="delay_penalty_rate" label="지체상금율">
                <InputNumber style={{ width: '100%' }} min={0} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="local_bond_applicable" label="지방채매입액 여부" valuePropName="checked">
                <Switch checkedChildren="해당" unCheckedChildren="비해당" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="local_bond_amount" label="지방채매입액">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={((value?: string) => Number((value || '').replace(/[^0-9]/g, ''))) as any}
                  min={0}
                  addonAfter="원"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="stamp_tax_applicable" label="인지세 과세 대상여부" valuePropName="checked">
                <Switch checkedChildren="해당" unCheckedChildren="비해당" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="stamp_tax_amount" label="인지세액">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={((value?: string) => Number((value || '').replace(/[^0-9]/g, ''))) as any}
                  min={0}
                  addonAfter="원"
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Form>

      {/* 발주처별 현황 (청구·수금·진행률) — 편집모드 */}
      {isEdit && (currentContract as any)?.clients?.length > 0 && (
        <Card title="발주처별 현황 (청구·수금)" style={{ marginBottom: 16 }}>
          <Table
            size="small"
            pagination={false}
            rowKey={(r: any) => r.id}
            dataSource={(currentContract as any).clients}
            columns={[
              { title: '발주처', dataIndex: 'client_company' },
              { title: '계약액', dataIndex: 'total_amount', align: 'right' as const, render: (v: number) => (v || 0).toLocaleString() + '원' },
              { title: '청구', dataIndex: 'billed_amount', align: 'center' as const, render: (v: number) => (v > 0 ? <Tag color="blue">{(v || 0).toLocaleString()}원</Tag> : <Tag>미청구</Tag>) },
              { title: '수금', dataIndex: 'received_amount', align: 'center' as const, render: (v: number, r: any) => { const done = (v || 0) >= (r.total_amount || 0) && (r.total_amount || 0) > 0; return v > 0 ? <Tag color={done ? 'green' : 'orange'}>{(v || 0).toLocaleString()}원 {done ? '완납' : '일부'}</Tag> : <Tag color="red">미지급</Tag>; } },
              { title: '미수금', dataIndex: 'remaining_amount', align: 'right' as const, render: (v: number) => (v || 0).toLocaleString() + '원' },
              { title: '진행률', dataIndex: 'progress_rate', align: 'center' as const, render: (v: number) => (v || 0) + '%' },
              { title: '수금률', dataIndex: 'collection_rate', align: 'center' as const, render: (v: number) => (v || 0) + '%' },
            ]}
          />
        </Card>
      )}

      {/* 견적서 연결 */}
      <Card
        title={
          <Space>
            <LinkOutlined />
            <span>연결된 견적서</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={
          isEdit && id && (
            <Button
              size="small"
              icon={<SearchOutlined />}
              onClick={() => { setLinkModalVisible(true); handleSearchQuotes(); }}
            >
              견적서 검색/연결
            </Button>
          )
        }
      >
        {linkedQuote ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space direction="vertical" size={0}>
              <Text strong>{linkedQuote.quote_number}</Text>
              <Text type="secondary">{linkedQuote.recipient_company} - {linkedQuote.service_name}</Text>
              <Text type="secondary">총액: {linkedQuote.grand_total?.toLocaleString()}원</Text>
            </Space>
            <Button
              type="text"
              danger
              icon={<DisconnectOutlined />}
              onClick={handleUnlinkQuote}
            >
              연결해제
            </Button>
          </div>
        ) : (
          <Empty description="연결된 견적서가 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      {/* 견적서 검색 모달 */}
      <Modal
        title="견적서 검색 및 연결"
        open={linkModalVisible}
        onCancel={() => setLinkModalVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Space style={{ marginBottom: 16, width: '100%' }}>
          <Input
            placeholder="견적번호, 수신처, 용역명 검색"
            value={linkSearchText}
            onChange={(e) => setLinkSearchText(e.target.value)}
            onPressEnter={handleSearchQuotes}
            style={{ width: 400 }}
          />
          <Button type="primary" onClick={handleSearchQuotes} loading={linkSearchLoading}>
            검색
          </Button>
        </Space>
        <Table
          dataSource={linkSearchResults}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: '견적번호', dataIndex: 'quote_number', width: 120 },
            { title: '수신처', dataIndex: 'recipient_company', ellipsis: true },
            { title: '용역명', dataIndex: 'service_name', ellipsis: true },
            { title: '총액', dataIndex: 'grand_total', width: 130, render: (v: number) => `${(v||0).toLocaleString()}원` },
            { title: '', key: 'action', width: 80, render: (_: any, record: any) => (
              <Button size="small" type="primary" onClick={() => handleLinkQuote(record.id)}>연결</Button>
            )},
          ]}
        />
      </Modal>

      {/* 대금조건 (수정 모드에서만) */}
      {isEdit && id && user?.id && (
        <PaymentConditions
          contractId={id}
          userId={user.id}
          totalAmount={totalAmount}
        />
      )}

      {/* 세부작업 관리 (수정 모드에서만) */}
      {isEdit && id && user?.id && (
        <Card
          title={
            <Space>
              <span>세부작업 관리</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <ContractSubtasks contractId={id} />
        </Card>
      )}

      {/* 일정 이벤트 (수정 모드에서만) */}
      {isEdit && id && user?.id && (
        <Card
          title={
            <Space>
              <CalendarOutlined />
              <span>일정 이벤트</span>
              <Tag>{contractEvents.length}개</Tag>
            </Space>
          }
          style={{ marginBottom: 16 }}
          extra={
            !showEventForm && (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setShowEventForm(true)}
              >
                이벤트 추가
              </Button>
            )
          }
        >
          {showEventForm && (
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
              <Row gutter={12} align="middle">
                <Col span={7}>
                  <Input
                    placeholder="이벤트 제목 (예: 중간수금일)"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                  />
                </Col>
                <Col span={5}>
                  <DatePicker
                    style={{ width: '100%' }}
                    value={newEventDate}
                    onChange={(date) => setNewEventDate(date)}
                    placeholder="날짜 선택"
                  />
                </Col>
                <Col span={7}>
                  <Input
                    placeholder="설명 (선택)"
                    value={newEventDesc}
                    onChange={(e) => setNewEventDesc(e.target.value)}
                  />
                </Col>
                <Col span={5}>
                  <Space>
                    <Button
                      type="primary"
                      size="small"
                      loading={eventLoading}
                      onClick={handleAddEvent}
                    >
                      추가
                    </Button>
                    <Button size="small" onClick={() => setShowEventForm(false)}>
                      취소
                    </Button>
                  </Space>
                </Col>
              </Row>
            </div>
          )}

          {contractEvents.length === 0 ? (
            <Empty description="등록된 일정 이벤트가 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <List
              size="small"
              dataSource={contractEvents}
              renderItem={(evt: any) => (
                <List.Item
                  actions={[
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteEvent(evt.id)}
                    />
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Badge color={evt.event_color || 'cyan'} />}
                    title={
                      <Space>
                        <span>{evt.event_title}</span>
                        <span style={{ color: '#888', fontSize: 12 }}>
                          {dayjs(evt.event_date).format('YYYY-MM-DD')}
                        </span>
                      </Space>
                    }
                    description={evt.event_description}
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      )}

      {/* 문서 첨부 (수정 모드에서만) */}
      {isEdit && id && user?.id && (
        <Card
          title={
            <Space>
              <PaperClipOutlined />
              <span>문서 첨부</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <DocumentAttachment
            parentType="contract"
            parentId={id}
            userId={user.id}
            serviceName={watchedService || form.getFieldValue('service_name')}
          />
        </Card>
      )}

      {/* 회의록/기타자료 (수정 모드에서만) */}
      {isEdit && id && user?.id && (
        <Card
          title={
            <Space>
              <PaperClipOutlined />
              <span>회의록/기타자료</span>
              <Tag>{meetingNotes.length}개</Tag>
            </Space>
          }
          style={{ marginBottom: 16 }}
          extra={
            <Upload
              beforeUpload={handleMeetingNoteUpload}
              showUploadList={false}
              accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
              disabled={meetingNoteUploading}
            >
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                loading={meetingNoteUploading}
              >
                업로드
              </Button>
            </Upload>
          }
        >
          <Spin spinning={meetingNotesLoading}>
            {meetingNotes.length === 0 ? (
              <Empty description="등록된 회의록이 없습니다." image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={meetingNotes}
                renderItem={(note: any) => (
                  <List.Item
                    actions={[
                      <Button
                        key="del"
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleMeetingNoteDelete(note.id)}
                      />,
                    ]}
                  >
                    <List.Item.Meta
                      title={note.file_name}
                      description={
                        <div>
                          <div style={{ color: '#999', fontSize: 11 }}>
                            {note.created_at ? dayjs(note.created_at).format('YYYY-MM-DD HH:mm') : ''}
                            {note.file_size ? ` · ${(note.file_size / 1024).toFixed(1)} KB` : ''}
                          </div>
                          {note.content_text && (
                            <div style={{ marginTop: 4, fontSize: 12, color: '#555', maxHeight: 100, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                              {note.content_text.slice(0, 500)}
                              {note.content_text.length > 500 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Spin>
        </Card>
      )}

      {/* 생성된 문서 목록 (수정 모드에서만) */}
      {isEdit && id && (
        <Card
          title="생성된 문서"
          style={{ marginBottom: 16 }}
          extra={
            <Button
              type="primary"
              size="small"
              icon={<FileAddOutlined />}
              onClick={() => setShowDocumentModal(true)}
            >
              문서 생성
            </Button>
          }
        >
          <GeneratedDocumentList
            contractId={id}
            refreshTrigger={documentRefreshTrigger}
          />
        </Card>
      )}

      {/* 변경 이력 (수정 모드에서만) */}
      {isEdit && id && user?.id && (
        <Card
          title={
            <Space>
              <HistoryOutlined />
              <span>변경 이력</span>
              <Tag>{contractHistories.length}건</Tag>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : contractHistories.length === 0 ? (
            <Empty description="변경 이력이 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Table
              columns={historyColumns}
              dataSource={contractHistories}
              rowKey="id"
              size="small"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `총 ${total}건`,
              }}
              locale={{ emptyText: '변경 이력이 없습니다.' }}
            />
          )}
        </Card>
      )}

      {/* 문서 생성 모달 */}
      <DocumentGenerateModal
        visible={showDocumentModal}
        contractId={id || ''}
        contractNumber={currentContract?.contract_number}
        onClose={() => setShowDocumentModal(false)}
        onGenerated={() => setDocumentRefreshTrigger(prev => prev + 1)}
      />

      {/* 미리보기 모달 */}
      {isEdit && id && (
        <PdfPreviewModal
          visible={previewVisible}
          onClose={() => setPreviewVisible(false)}
          type="contract"
          documentId={id}
          documentNumber={currentContract?.contract_number}
        />
      )}

      {/* 이메일 발송 모달 */}
      {isEdit && id && currentContract && (
        <EmailSendModal
          visible={emailModalVisible}
          onClose={() => setEmailModalVisible(false)}
          type="contract"
          documentId={id}
          documentNumber={currentContract.contract_number}
          serviceName={currentContract.service_name}
          recipientCompany={currentContract.client_company}
          recipientEmail={currentContract.client_contact_email}
        />
      )}
    </div>
  );
};

export default ContractForm;
