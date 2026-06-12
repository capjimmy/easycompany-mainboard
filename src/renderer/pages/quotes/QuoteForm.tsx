import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Typography, Button, Form, Input, InputNumber, DatePicker, Select,
  Table, Space, Divider, message, Spin, Row, Col, AutoComplete, Modal, Empty, Tag, Collapse, Popconfirm, Switch, Tree
} from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, SaveOutlined, BulbOutlined, PaperClipOutlined, FolderOpenOutlined, ScanOutlined, LinkOutlined, DisconnectOutlined, SearchOutlined, FilePdfOutlined, MailOutlined, AppstoreOutlined, SubnodeOutlined, EyeOutlined, AimOutlined, ImportOutlined, FileTextOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';
import { useQuoteStore } from '../../store/quoteStore';
import RecommendationPopover from '../../components/common/RecommendationPopover';
import DocumentAttachment from '../../components/documents/DocumentAttachment';
import QuoteAmountHistory from './QuoteAmountHistory';
import EmailSendModal from '../../components/common/EmailSendModal';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import type { LaborGrade, ExpenseCategory } from '../../../shared/types';

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

const QuoteForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = id && id !== 'new';

  const { user, selectedCompanyId } = useAuthStore();
  const {
    currentQuote,
    laborGrades,
    expenseCategories,
    isLoading,
    fetchQuoteById,
    fetchPriceSettings,
    createQuote,
    updateQuote,
  } = useQuoteStore();

  const [form] = Form.useForm();
  const [laborItems, setLaborItems] = useState<LaborItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [watchedRecipient, setWatchedRecipient] = useState('');
  const [watchedService, setWatchedService] = useState('');
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [clientCompanyOptions, setClientCompanyOptions] = useState<{ value: string; label: string }[]>([]);
  const [allClientCompanies, setAllClientCompanies] = useState<{ name: string }[]>([]);
  const [scanning, setScanning] = useState(false);
  const [folderScanning, setFolderScanning] = useState(false);
  const [linkedContract, setLinkedContract] = useState<any>(null);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkSearchText, setLinkSearchText] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<any[]>([]);
  const [linkSearchLoading, setLinkSearchLoading] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [docGenerating, setDocGenerating] = useState(false);

  // 프로젝트 멤버
  const [quoteUsers, setQuoteUsers] = useState<any[]>([]);
  const [quoteDepartments, setQuoteDepartments] = useState<any[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  // VAT 옵션 (C7)
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState(0.1);
  // 총금액만 입력 모드 (A3)
  const [totalOnlyMode, setTotalOnlyMode] = useState(false);
  // 총액 직접 편집 (A4) - null이면 자동 계산 사용
  const [manualGrandTotal, setManualGrandTotal] = useState<number | null>(null);

  // 목표값 찾기 (Goal Seek)
  const [goalSeekVisible, setGoalSeekVisible] = useState(false);
  const [goalSeekTarget, setGoalSeekTarget] = useState<number | null>(null);
  const [goalSeekAdjustTarget, setGoalSeekAdjustTarget] = useState<string>('');

  // 계층 구조 섹션
  interface QuoteSection {
    id: string;
    parent_id: string | null;
    level: number;
    title: string;
    description?: string;
    amount: number;
    sort_order: number;
  }
  const [sections, setSections] = useState<QuoteSection[]>([]);

  // 사전 항목 불러오기 모달
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [presetSections, setPresetSections] = useState<any[]>([]);
  const [presetCheckedKeys, setPresetCheckedKeys] = useState<React.Key[]>([]);
  const [presetLoading, setPresetLoading] = useState(false);

  // 합계 계산 (상세내역 sectionTotal은 아래에서 계산 후 합산)
  const laborTotal = laborItems.reduce((sum, item) => sum + item.subtotal, 0);
  const expenseTotal = expenseItems.reduce((sum, item) => sum + item.amount, 0);

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
        fetchPriceSettings(user.id, companyId);
      }
    };

    initCompanyId();
  }, [user?.id, user?.company_id, user?.role, selectedCompanyId]);

  // 거래처 목록 + 사용자 목록 로드
  useEffect(() => {
    const fetchClientCompanies = async () => {
      if (!user?.id) return;
      try {
        const [clientResult, userResult, deptResult] = await Promise.all([
          window.electronAPI.clients.getAll(user.id),
          window.electronAPI.users.getAll(user.id),
          (window as any).electronAPI.departments.getAll(user.id).catch(() => null),
        ]);
        if (deptResult?.success && deptResult.departments) {
          const companyFilter = user.role === 'super_admin'
            ? (selectedCompanyId || activeCompanyId)
            : user.company_id;
          setQuoteDepartments(
            (deptResult.departments as any[]).filter(
              (d: any) => !companyFilter || d.company_id === companyFilter
            )
          );
        }
        if (clientResult.success && clientResult.clients) {
          setAllClientCompanies(clientResult.clients.map((c: any) => ({ name: c.name })));
          setClientCompanyOptions(
            clientResult.clients.map((c: any) => ({ value: c.name, label: c.name }))
          );
        }
        if (userResult.success && userResult.users) {
          const companyFilter = user.role === 'super_admin'
            ? (selectedCompanyId || activeCompanyId)
            : user.company_id;
          setQuoteUsers(
            userResult.users.filter((u: any) =>
              u.is_active && (!companyFilter || u.company_id === companyFilter)
            )
          );
        }
      } catch (err) {
        console.error('Failed to fetch dropdown data:', err);
      }
    };
    fetchClientCompanies();
  }, [user?.id, selectedCompanyId, activeCompanyId]);

  // 수신처 AutoComplete 검색 필터
  const handleRecipientSearch = (searchText: string) => {
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

  // 수정 모드일 때 견적서 로드
  useEffect(() => {
    if (user?.id && isEdit && id) {
      fetchQuoteById(user.id, id);
      // 섹션 로드
      window.electronAPI.quoteSections.getByQuote(user.id, id).then((result: any) => {
        if (result.success) setSections(result.sections || []);
      }).catch(() => {});
    }
  }, [user?.id, id, isEdit]);

  useEffect(() => {
    if (isEdit && currentQuote) {
      form.setFieldsValue({
        recipient_company: currentQuote.recipient_company,
        recipient_contact: currentQuote.recipient_contact,
        recipient_phone: currentQuote.recipient_phone,
        recipient_email: currentQuote.recipient_email,
        recipient_department: currentQuote.recipient_department,
        recipient_address: currentQuote.recipient_address,
        project_period_months: currentQuote.project_period_months,
        title: currentQuote.title,
        service_name: currentQuote.service_name,
        quote_date: currentQuote.quote_date ? dayjs(currentQuote.quote_date) : dayjs(),
        valid_until: currentQuote.valid_until ? dayjs(currentQuote.valid_until) : null,
        notes: currentQuote.notes,
      });

      // 추천 기능을 위한 값 설정
      setWatchedRecipient(currentQuote.recipient_company || '');
      setWatchedService(currentQuote.service_name || '');

      // 인건비 항목 로드
      if (currentQuote.labor_items) {
        setLaborItems(
          currentQuote.labor_items.map((item: any, index: number) => ({
            key: `labor-${index}`,
            grade_id: item.grade_id,
            grade_name: item.grade_name,
            quantity: item.quantity,
            participation_rate: item.participation_rate,
            months: item.months,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
          }))
        );
      }

      // 경비 항목 로드
      if (currentQuote.expense_items) {
        setExpenseItems(
          currentQuote.expense_items.map((item: any, index: number) => ({
            key: `expense-${index}`,
            category_id: item.category_id,
            category_name: item.category_name,
            calculation_type: item.calculation_type || 'manual',
            rate: item.rate || undefined,
            amount: item.amount,
            note: item.note,
          }))
        );
      }

      // 멤버 로드 (메인 제외, member만)
      if (currentQuote.members?.length > 0) {
        const memberUserIds = currentQuote.members
          .filter((m: any) => m.role === 'member')
          .map((m: any) => m.user_id);
        setMemberIds(memberUserIds);
      } else {
        setMemberIds([]);
      }
    }
  }, [currentQuote, isEdit]);

  // 인건비 항목 추가
  const addLaborItem = () => {
    const newItem: LaborItem = {
      key: `labor-${Date.now()}`,
      grade_id: '',
      grade_name: '',
      quantity: 1,
      participation_rate: 1,
      months: 1,
      unit_price: 0,
      subtotal: 0,
    };
    setLaborItems([...laborItems, newItem]);
  };

  // 인건비 항목 삭제
  const removeLaborItem = (key: string) => {
    setLaborItems(laborItems.filter((item) => item.key !== key));
  };

  // 인건비 항목 수정
  const updateLaborItem = (key: string, field: keyof LaborItem, value: any) => {
    setLaborItems(
      laborItems.map((item) => {
        if (item.key !== key) return item;

        const updated = { ...item, [field]: value };

        // 등급 선택 시 단가 자동 입력
        if (field === 'grade_id') {
          const grade = laborGrades.find((g) => g.id === value);
          if (grade) {
            updated.grade_name = grade.name;
            updated.unit_price = grade.monthly_rate;
          }
        }

        // 소계 재계산
        updated.subtotal = updated.quantity * updated.participation_rate * updated.months * updated.unit_price;

        return updated;
      })
    );
  };

  // 경비 항목 추가
  const addExpenseItem = () => {
    const newItem: ExpenseItem = {
      key: `expense-${Date.now()}`,
      category_id: '',
      category_name: '',
      calculation_type: 'manual',
      amount: 0,
    };
    setExpenseItems([...expenseItems, newItem]);
  };

  // 경비 항목 삭제
  const removeExpenseItem = (key: string) => {
    setExpenseItems(expenseItems.filter((item) => item.key !== key));
  };

  // 경비 항목 수정
  const updateExpenseItem = (key: string, field: keyof ExpenseItem, value: any) => {
    setExpenseItems(
      expenseItems.map((item) => {
        if (item.key !== key) return item;

        const updated = { ...item, [field]: value };

        // 항목 선택 시 자동 설정
        if (field === 'category_id') {
          const category = expenseCategories.find((c) => c.id === value);
          if (category) {
            updated.category_name = category.name;
            updated.calculation_type = category.calculation_type;
            updated.rate = category.default_rate || undefined;

            // 비율 계산인 경우 자동 계산
            if (category.calculation_type === 'percentage' && category.default_rate) {
              updated.amount = Math.round(laborTotal * category.default_rate);
            }
          }
        }

        return updated;
      })
    );
  };

  // 비율 기반 경비 재계산
  useEffect(() => {
    setExpenseItems((items) =>
      items.map((item) => {
        if (item.calculation_type === 'percentage' && item.rate) {
          return {
            ...item,
            amount: Math.round(laborTotal * item.rate),
          };
        }
        return item;
      })
    );
  }, [laborTotal]);

  const handleSubmit = async (values: any) => {
    const companyId = activeCompanyId || user?.company_id;
    if (!user?.id || !companyId) {
      message.error('회사 정보를 찾을 수 없습니다.');
      return;
    }

    // 인건비 항목 또는 상세내역이 없으면 경고 (총금액만 입력 모드에서는 스킵)
    if (!totalOnlyMode && laborItems.length === 0 && sections.length === 0) {
      message.warning('인건비 항목 또는 상세내역을 1개 이상 추가해주세요.');
      return;
    }

    setSubmitting(true);

    // 멤버 배열 생성
    const membersData = memberIds.map((uid) => {
      const u = quoteUsers.find((u: any) => u.id === uid);
      return { user_id: uid, user_name: u?.name || '' };
    });

    const quoteData = {
      ...values,
      company_id: companyId,
      quote_date: values.quote_date?.format('YYYY-MM-DD'),
      valid_until: values.valid_until?.format('YYYY-MM-DD'),
      section_total: sectionTotal,
      labor_items: laborItems.map((item) => ({
        grade_id: item.grade_id,
        grade_name: item.grade_name,
        quantity: item.quantity,
        participation_rate: item.participation_rate,
        months: item.months,
        unit_price: item.unit_price,
      })),
      expense_items: expenseItems.map((item) => ({
        category_id: item.category_id,
        category_name: item.category_name,
        calculation_type: item.calculation_type,
        rate: item.rate,
        amount: item.amount,
        note: item.note,
      })),
      members: membersData,
    };

    try {
      let result;
      if (isEdit && id) {
        result = await updateQuote(user.id, id, quoteData);
      } else {
        result = await createQuote(user.id, quoteData);
      }

      if (result.success) {
        // 섹션 저장
        const quoteId = isEdit ? id : result.quoteId;
        if (quoteId && sections.length > 0) {
          try {
            await window.electronAPI.quoteSections.saveAll(user.id, quoteId, sections);
          } catch (err: any) { message.error(err?.message || '섹션 저장에 실패했습니다.'); }
        }
        message.success(isEdit ? '견적서가 수정되었습니다.' : '견적서가 생성되었습니다.');
        navigate('/quotes');
      } else {
        message.error(result.error || '저장에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // ========== 계층 구조 섹션 관리 ==========
  const addSection = (level: number, parentId: string | null = null) => {
    const siblings = sections.filter(s => s.parent_id === parentId && s.level === level);
    const maxOrder = siblings.reduce((max, s) => Math.max(max, s.sort_order), 0);
    const newSection: QuoteSection = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      parent_id: parentId,
      level,
      title: '',
      amount: 0,
      sort_order: maxOrder + 1,
    };
    setSections([...sections, newSection]);
  };

  const updateSection = (id: string, field: keyof QuoteSection, value: any) => {
    setSections(sections.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeSection = (id: string) => {
    // 하위 항목도 함께 삭제
    const idsToRemove = new Set<string>();
    const collectIds = (parentId: string) => {
      idsToRemove.add(parentId);
      sections.filter(s => s.parent_id === parentId).forEach(s => collectIds(s.id));
    };
    collectIds(id);
    setSections(sections.filter(s => !idsToRemove.has(s.id)));
  };

  // 섹션 합계 계산 (상위 항목은 하위 합산)
  const getSectionAmount = (sectionId: string): number => {
    const children = sections.filter(s => s.parent_id === sectionId);
    if (children.length === 0) {
      return sections.find(s => s.id === sectionId)?.amount || 0;
    }
    return children.reduce((sum, child) => sum + getSectionAmount(child.id), 0);
  };

  const sectionTotal = sections.filter(s => s.level === 1).reduce((sum, s) => sum + getSectionAmount(s.id), 0);

  // 총금액 계산 (인건비 + 경비 + 상세내역)
  const calcTotalAmount = totalOnlyMode
    ? (manualGrandTotal !== null
        ? (vatEnabled ? Math.round(manualGrandTotal / (1 + vatRate)) : manualGrandTotal)
        : 0)
    : (manualGrandTotal !== null
        ? (vatEnabled ? Math.round(manualGrandTotal / (1 + vatRate)) : manualGrandTotal)
        : laborTotal + expenseTotal + sectionTotal);
  const totalAmount = calcTotalAmount;
  const vatAmount = vatEnabled ? Math.round(totalAmount * vatRate) : 0;
  const grandTotal = totalAmount + vatAmount;

  // 총액(VAT포함) 직접 편집 핸들러 (A4)
  const handleGrandTotalChange = (value: number | null) => {
    if (value === null || value === 0) {
      setManualGrandTotal(null);
      return;
    }
    setManualGrandTotal(value);
  };

  // 목표값 찾기: 조정 대상 옵션 생성
  const getGoalSeekOptions = () => {
    const options: { value: string; label: string }[] = [];
    // 인건비 항목
    laborItems.forEach((item) => {
      if (item.grade_name) {
        options.push({ value: `labor:${item.key}`, label: `${item.grade_name} 단가 조정` });
      }
    });
    // 경비 항목 (비율 계산이 아닌 항목만)
    expenseItems.forEach((item) => {
      if (item.category_name && item.calculation_type !== 'percentage') {
        options.push({ value: `expense:${item.key}`, label: `${item.category_name} 금액 조정` });
      }
    });
    // 섹션 리프 항목 (하위 항목이 없는 섹션)
    sections.forEach((s) => {
      const hasChildren = sections.some((c) => c.parent_id === s.id);
      if (!hasChildren && s.title) {
        options.push({ value: `section:${s.id}`, label: `${s.title} 금액 조정` });
      }
    });
    return options;
  };

  // 목표값 찾기 적용
  const handleGoalSeekApply = () => {
    if (goalSeekTarget === null || goalSeekTarget <= 0) {
      message.warning('목표 총금액을 입력해주세요.');
      return;
    }
    if (!goalSeekAdjustTarget) {
      message.warning('조정 대상을 선택해주세요.');
      return;
    }

    // 목표 합계 (VAT 제외)
    const targetTotal = vatEnabled
      ? Math.round(goalSeekTarget / (1 + vatRate))
      : goalSeekTarget;

    const currentTotal = laborTotal + expenseTotal + sectionTotal;
    const diff = targetTotal - currentTotal;

    const [type, key] = goalSeekAdjustTarget.split(':');

    if (type === 'labor') {
      const item = laborItems.find((i) => i.key === key);
      if (!item) { message.error('해당 인건비 항목을 찾을 수 없습니다.'); return; }
      const divisor = item.quantity * item.participation_rate * item.months;
      if (divisor === 0) { message.error('인원, 참여율, 개월 중 0인 값이 있어 계산할 수 없습니다.'); return; }
      const newUnitPrice = Math.round((item.subtotal + diff) / divisor);
      if (newUnitPrice < 0) { message.error('목표 금액이 너무 낮아 단가가 음수가 됩니다.'); return; }
      setLaborItems(
        laborItems.map((i) => {
          if (i.key !== key) return i;
          const updated = { ...i, unit_price: newUnitPrice };
          updated.subtotal = updated.quantity * updated.participation_rate * updated.months * updated.unit_price;
          return updated;
        })
      );
    } else if (type === 'expense') {
      const item = expenseItems.find((i) => i.key === key);
      if (!item) { message.error('해당 경비 항목을 찾을 수 없습니다.'); return; }
      const newAmount = item.amount + diff;
      if (newAmount < 0) { message.error('목표 금액이 너무 낮아 금액이 음수가 됩니다.'); return; }
      setExpenseItems(
        expenseItems.map((i) => i.key === key ? { ...i, amount: Math.round(newAmount) } : i)
      );
    } else if (type === 'section') {
      const section = sections.find((s) => s.id === key);
      if (!section) { message.error('해당 섹션 항목을 찾을 수 없습니다.'); return; }
      const newAmount = section.amount + diff;
      if (newAmount < 0) { message.error('목표 금액이 너무 낮아 금액이 음수가 됩니다.'); return; }
      setSections(
        sections.map((s) => s.id === key ? { ...s, amount: Math.round(newAmount) } : s)
      );
    }

    // manualGrandTotal 초기화 (자동 계산으로 복원)
    setManualGrandTotal(null);
    setGoalSeekVisible(false);
    setGoalSeekTarget(null);
    setGoalSeekAdjustTarget('');
    message.success('목표값이 적용되었습니다.');
  };

  // ========== 사전 항목 불러오기 ==========
  const openPresetModal = async () => {
    if (!user?.id || !activeCompanyId) return;
    setPresetLoading(true);
    setPresetCheckedKeys([]);
    try {
      const result = await window.electronAPI.quotePresetSections.getByCompany(user.id, activeCompanyId);
      if (result.success) {
        setPresetSections(result.sections || []);
      } else {
        message.error(result.error || '사전 항목을 불러올 수 없습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '사전 항목을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setPresetLoading(false);
      setPresetModalVisible(true);
    }
  };

  const buildPresetTreeData = () => {
    const buildChildren = (parentId: string | null, level: number): any[] => {
      return presetSections
        .filter(s => (parentId ? s.parent_id === parentId : (!s.parent_id && s.level === level)))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(s => {
          const children = buildChildren(s.id, s.level + 1);
          return {
            title: s.title,
            key: s.id,
            children: children.length > 0 ? children : undefined,
            presetData: s,
          };
        });
    };
    return buildChildren(null, 1);
  };

  const handlePresetImport = () => {
    if (presetCheckedKeys.length === 0) {
      message.warning('불러올 항목을 선택해주세요.');
      return;
    }

    // Build a set of selected IDs
    const selectedIds = new Set(presetCheckedKeys.map(k => String(k)));

    // We need to include parent items if any child is selected
    const ensureParents = (id: string) => {
      const item = presetSections.find(s => s.id === id);
      if (item?.parent_id && !selectedIds.has(item.parent_id)) {
        selectedIds.add(item.parent_id);
        ensureParents(item.parent_id);
      }
    };
    presetCheckedKeys.forEach(k => ensureParents(String(k)));

    // Build new sections from selected preset items, preserving hierarchy
    const newSections: QuoteSection[] = [];
    const idMap = new Map<string, string>(); // preset id -> new temp id

    const processLevel = (parentPresetId: string | null, level: number, newParentId: string | null) => {
      const items = presetSections
        .filter(s => {
          if (parentPresetId) return s.parent_id === parentPresetId && selectedIds.has(s.id);
          return !s.parent_id && s.level === level && selectedIds.has(s.id);
        })
        .sort((a, b) => a.sort_order - b.sort_order);

      // Calculate existing max sort_order for this parent
      const existingSiblings = sections.filter(s =>
        newParentId ? s.parent_id === newParentId : (!s.parent_id && s.level === level)
      );
      let nextOrder = existingSiblings.reduce((max, s) => Math.max(max, s.sort_order), 0) + 1;

      items.forEach(item => {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        idMap.set(item.id, tempId);

        newSections.push({
          id: tempId,
          parent_id: newParentId,
          level: item.level,
          title: item.title,
          amount: 0,
          sort_order: nextOrder++,
        });

        // Process children
        if (item.level < 3) {
          processLevel(item.id, item.level + 1, tempId);
        }
      });
    };

    processLevel(null, 1, null);

    if (newSections.length > 0) {
      setSections(prev => [...prev, ...newSections]);
      message.success(`${newSections.length}개 항목이 추가되었습니다.`);
    }

    setPresetModalVisible(false);
  };

  // 인건비 등급 일괄 불러오기
  const loadAllLaborGrades = () => {
    if (laborGrades.length === 0) {
      message.warning('등록된 인건비 등급이 없습니다. 단가 설정에서 먼저 등록해주세요.');
      return;
    }
    const newItems: LaborItem[] = laborGrades.map((grade, idx) => ({
      key: `labor-${Date.now()}-${idx}`,
      grade_id: grade.id,
      grade_name: grade.name,
      quantity: 1,
      participation_rate: 1,
      months: 1,
      unit_price: grade.unit_price || grade.monthly_rate || 0,
      subtotal: grade.unit_price || grade.monthly_rate || 0,
    }));
    setLaborItems([...laborItems, ...newItems]);
    message.success(`${newItems.length}개 인건비 등급이 추가되었습니다.`);
  };

  // 경비 항목 일괄 불러오기
  const loadAllExpenseCategories = () => {
    if (expenseCategories.length === 0) {
      message.warning('등록된 경비 항목이 없습니다. 단가 설정에서 먼저 등록해주세요.');
      return;
    }
    const newItems: ExpenseItem[] = expenseCategories.map((cat, idx) => {
      let amount = 0;
      if (cat.calculation_type === 'percentage' && cat.default_rate) {
        amount = Math.round(laborTotal * cat.default_rate);
      } else if (cat.calculation_type === 'fixed' && cat.default_amount) {
        amount = cat.default_amount;
      }
      return {
        key: `expense-${Date.now()}-${idx}`,
        category_id: cat.id,
        category_name: cat.name,
        calculation_type: cat.calculation_type || 'manual',
        rate: cat.default_rate || undefined,
        amount,
      };
    });
    setExpenseItems([...expenseItems, ...newItems]);
    message.success(`${newItems.length}개 경비 항목이 추가되었습니다.`);
  };

  const renderSections = () => {
    const level1 = sections.filter(s => s.level === 1).sort((a, b) => a.sort_order - b.sort_order);

    return level1.map((cat, idx) => {
      const level2 = sections.filter(s => s.parent_id === cat.id && s.level === 2).sort((a, b) => a.sort_order - b.sort_order);
      const catAmount = getSectionAmount(cat.id);

      return (
        <div key={cat.id} style={{ marginBottom: 16, border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
          {/* 대분류 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Tag color="blue">{idx + 1}. 대분류</Tag>
            <Input
              value={cat.title}
              onChange={(e) => updateSection(cat.id, 'title', e.target.value)}
              placeholder="대분류명"
              style={{ flex: 1 }}
            />
            <Text strong style={{ minWidth: 120, textAlign: 'right' }}>{catAmount.toLocaleString()}원</Text>
            <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => addSection(2, cat.id)}>세부</Button>
            <Popconfirm title="삭제하시겠습니까?" onConfirm={() => removeSection(cat.id)}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>

          {/* 세부 */}
          {level2.map((sub, subIdx) => {
            const level3 = sections.filter(s => s.parent_id === sub.id && s.level === 3).sort((a, b) => a.sort_order - b.sort_order);
            const subAmount = getSectionAmount(sub.id);

            return (
              <div key={sub.id} style={{ marginLeft: 24, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Tag color="cyan">{idx + 1}-{subIdx + 1}. 세부</Tag>
                  <Input
                    value={sub.title}
                    onChange={(e) => updateSection(sub.id, 'title', e.target.value)}
                    placeholder="세부항목명"
                    style={{ flex: 1 }}
                    size="small"
                  />
                  <Text style={{ minWidth: 120, textAlign: 'right' }}>{subAmount.toLocaleString()}원</Text>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => addSection(3, sub.id)}>세세부</Button>
                  <Popconfirm title="삭제?" onConfirm={() => removeSection(sub.id)}>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>

                {/* 세세부 */}
                {level3.map((detail, detailIdx) => (
                  <div key={detail.id} style={{ marginLeft: 24, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Tag>{idx + 1}-{subIdx + 1}-{detailIdx + 1}</Tag>
                    <Input
                      value={detail.title}
                      onChange={(e) => updateSection(detail.id, 'title', e.target.value)}
                      placeholder="세세부항목명"
                      style={{ flex: 1 }}
                      size="small"
                    />
                    <InputNumber
                      value={detail.amount}
                      onChange={(value) => updateSection(detail.id, 'amount', value || 0)}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                      min={0}
                      style={{ width: 150 }}
                      size="small"
                      addonAfter="원"
                    />
                    <Popconfirm title="삭제?" onConfirm={() => removeSection(detail.id)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                ))}

                {level3.length === 0 && (
                  <div style={{ marginLeft: 24 }}>
                    <InputNumber
                      value={sub.amount}
                      onChange={(value) => updateSection(sub.id, 'amount', value || 0)}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                      min={0}
                      style={{ width: 200 }}
                      size="small"
                      addonAfter="원"
                      placeholder="금액 직접 입력"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {level2.length === 0 && (
            <div style={{ marginLeft: 24 }}>
              <InputNumber
                value={cat.amount}
                onChange={(value) => updateSection(cat.id, 'amount', value || 0)}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                min={0}
                style={{ width: 200 }}
                size="small"
                addonAfter="원"
                placeholder="금액 직접 입력"
              />
            </div>
          )}
        </div>
      );
    });
  };

  const laborColumns = [
    {
      title: '등급',
      dataIndex: 'grade_id',
      key: 'grade_id',
      width: 150,
      render: (_: any, record: LaborItem) => (
        <Select
          value={record.grade_id || undefined}
          onChange={(value) => updateLaborItem(record.key, 'grade_id', value)}
          placeholder="등급 선택"
          style={{ width: '100%' }}
        >
          {laborGrades.map((grade) => (
            <Option key={grade.id} value={grade.id}>
              {grade.name}
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: '인원',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      render: (_: any, record: LaborItem) => (
        <InputNumber
          value={record.quantity}
          onChange={(value) => updateLaborItem(record.key, 'quantity', value || 0)}
          min={0}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '참여율',
      dataIndex: 'participation_rate',
      key: 'participation_rate',
      width: 100,
      render: (_: any, record: LaborItem) => (
        <InputNumber
          value={record.participation_rate}
          onChange={(value) => updateLaborItem(record.key, 'participation_rate', value || 0)}
          min={0}
          max={1}
          step={0.1}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '개월',
      dataIndex: 'months',
      key: 'months',
      width: 80,
      render: (_: any, record: LaborItem) => (
        <InputNumber
          value={record.months}
          onChange={(value) => updateLaborItem(record.key, 'months', value || 0)}
          min={0}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '월 단가',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 140,
      render: (_: any, record: LaborItem) => (
        <InputNumber
          value={record.unit_price}
          onChange={(value) => updateLaborItem(record.key, 'unit_price', value || 0)}
          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
          min={0}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '소계',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 140,
      align: 'right' as const,
      render: (value: number) => `${value.toLocaleString()}원`,
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: any, record: LaborItem) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLaborItem(record.key)}
        />
      ),
    },
  ];

  const expenseColumns = [
    {
      title: '항목',
      dataIndex: 'category_id',
      key: 'category_id',
      width: 150,
      render: (_: any, record: ExpenseItem) => (
        <Select
          value={record.category_id || undefined}
          onChange={(value) => updateExpenseItem(record.key, 'category_id', value)}
          placeholder="항목 선택"
          style={{ width: '100%' }}
        >
          {expenseCategories.map((category) => (
            <Option key={category.id} value={category.id}>
              {category.name}
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: '계산방식',
      dataIndex: 'calculation_type',
      key: 'calculation_type',
      width: 120,
      render: (value: string, record: ExpenseItem) => {
        if (value === 'percentage') {
          return `인건비 x ${((record.rate || 0) * 100).toFixed(0)}%`;
        }
        return '직접입력';
      },
    },
    {
      title: '금액',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      render: (_: any, record: ExpenseItem) => (
        <InputNumber
          value={record.amount}
          onChange={(value) => updateExpenseItem(record.key, 'amount', value || 0)}
          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
          min={0}
          style={{ width: '100%' }}
          disabled={record.calculation_type === 'percentage'}
        />
      ),
    },
    {
      title: '비고',
      dataIndex: 'note',
      key: 'note',
      render: (_: any, record: ExpenseItem) => (
        <Input
          value={record.note}
          onChange={(e) => updateExpenseItem(record.key, 'note', e.target.value)}
          placeholder="비고"
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: any, record: ExpenseItem) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeExpenseItem(record.key)}
        />
      ),
    },
  ];

  // 원본 파일 열기
  const handleOpenOriginal = async () => {
    if (!currentQuote?.source_file_path) {
      message.warning('이 견적서에는 원본 파일 경로 정보가 없습니다.');
      return;
    }
    try {
      const result = await window.electronAPI.settings.openOriginalFile(currentQuote.source_file_path);
      if (!result.success) {
        message.error(result.error);
      }
    } catch (err: any) {
      message.error(err?.message || '원본 파일 열기에 실패했습니다.');
    }
  };

  // 문서 스캔 (OCR)
  const handleOCRScan = async () => {
    if (!user?.id) return;
    setScanning(true);
    try {
      const result = await window.electronAPI.ocr.processImage(user.id, '', 'quote');
      if (result.error === 'canceled') {
        // 사용자가 취소
      } else if (result.success && result.data) {
        const data = result.data;
        // 추출된 데이터로 폼 자동 채우기
        const formValues: any = {};
        if (data.recipient_company) formValues.recipient_company = data.recipient_company;
        if (data.recipient_contact) formValues.recipient_contact = data.recipient_contact;
        if (data.recipient_phone) formValues.recipient_phone = data.recipient_phone;
        if (data.recipient_email) formValues.recipient_email = data.recipient_email;
        if (data.service_name) formValues.service_name = data.service_name;
        if (data.title) formValues.title = data.title;
        if (data.quote_date) formValues.quote_date = dayjs(data.quote_date);
        if (data.notes) formValues.notes = data.notes;

        form.setFieldsValue(formValues);

        if (data.recipient_company) setWatchedRecipient(data.recipient_company);
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
          const flatSections: QuoteSection[] = [];
          let sortOrder = 0;
          const flattenSections = (items: any[], parentId: string | null) => {
            items.forEach((item: any) => {
              const id = crypto.randomUUID();
              sortOrder++;
              flatSections.push({
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
          setSections(flatSections);
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
      const result = await window.electronAPI.folderScan.scanFolder('quote');
      if (result.error === 'canceled') {
        // user cancelled
      } else if (result.success && result.data) {
        const data = result.data;
        const formValues: any = {};
        if (data.recipient_company) formValues.recipient_company = data.recipient_company;
        if (data.recipient_contact) formValues.recipient_contact = data.recipient_contact;
        if (data.recipient_phone) formValues.recipient_phone = data.recipient_phone;
        if (data.recipient_email) formValues.recipient_email = data.recipient_email;
        if (data.service_name) formValues.service_name = data.service_name;
        if (data.title) formValues.title = data.title;
        if (data.quote_date) formValues.quote_date = dayjs(data.quote_date);
        if (data.notes) formValues.notes = data.notes;
        form.setFieldsValue(formValues);
        if (data.recipient_company) setWatchedRecipient(data.recipient_company);
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
          const flatSections: QuoteSection[] = [];
          let sortOrder = 0;
          const flattenSections = (items: any[], parentId: string | null) => {
            items.forEach((item: any) => {
              const id = crypto.randomUUID();
              sortOrder++;
              flatSections.push({
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
          setSections(flatSections);
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

  // 연결된 계약서 로드
  useEffect(() => {
    if (isEdit && id && user?.id) {
      loadLinkedContract();
    }
  }, [isEdit, id, user?.id]);

  const loadLinkedContract = async () => {
    if (!user?.id || !id) return;
    try {
      const result = await window.electronAPI.linking.getLinkedContract(user.id, id);
      if (result.success) {
        setLinkedContract(result.contract);
      }
    } catch (err) {
      console.error('Failed to load linked contract:', err);
    }
  };

  const handleSearchContracts = async () => {
    if (!user?.id) return;
    setLinkSearchLoading(true);
    try {
      const result = await window.electronAPI.linking.searchContracts(user.id, linkSearchText);
      if (result.success) {
        setLinkSearchResults(result.contracts || []);
      }
    } catch (err) {
      console.error('Failed to search contracts:', err);
    } finally {
      setLinkSearchLoading(false);
    }
  };

  const handleLinkContract = async (contractId: string) => {
    if (!user?.id || !id) return;
    try {
      const result = await window.electronAPI.linking.linkQuoteToContract(user.id, id, contractId);
      if (result.success) {
        message.success('계약서가 연결되었습니다.');
        setLinkModalVisible(false);
        loadLinkedContract();
      } else {
        message.error(result.error || '연결에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '연결 중 오류가 발생했습니다.');
    }
  };

  const handleUnlinkContract = async () => {
    if (!user?.id || !id || !linkedContract) return;
    try {
      const result = await window.electronAPI.linking.unlinkQuoteFromContract(user.id, id, linkedContract.id);
      if (result.success) {
        message.success('연결이 해제되었습니다.');
        setLinkedContract(null);
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
      const result = await window.electronAPI.pdf.generateQuote(user.id, id);
      if (result.success && result.filePath) {
        const defaultName = `견적서_${currentQuote?.quote_number || ''}.pdf`;
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

  const handleGenerateDocument = async () => {
    if (!user?.id || !id) return;
    setDocGenerating(true);
    try {
      const result = await window.electronAPI.quotes.generateDocument(user.id, id);
      if (result.success) {
        message.success('견적서가 출력되었습니다.');
      } else if (result.error !== 'canceled') {
        message.error(result.error || '견적서 출력에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '견적서 출력 중 오류가 발생했습니다.');
    } finally {
      setDocGenerating(false);
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quotes')} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? '견적서 수정' : '견적서 작성'}
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
          {isEdit && currentQuote?.source_file_path && (
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
                icon={<FileTextOutlined />}
                onClick={handleGenerateDocument}
                loading={docGenerating}
              >
                견적서 출력
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
          quote_date: dayjs(),
        }}
      >
        {/* 기본 정보 */}
        <Card
          title="기본 정보"
          style={{ marginBottom: 16 }}
          extra={
            <RecommendationPopover
              type="quote"
              clientCompany={watchedRecipient}
              serviceName={watchedService}
              onSelect={(item: any) => {
                // 선택한 견적서 정보로 참고할 수 있도록 메시지 표시
                message.info(`참고: ${item.quote_number} - 총액 ${item.grand_total?.toLocaleString()}원`);
              }}
            />
          }
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="recipient_company"
                label="수신처 (회사명)"
                rules={[{ required: true, message: '수신처를 입력해주세요.' }]}
              >
                <AutoComplete
                  options={clientCompanyOptions}
                  onSearch={handleRecipientSearch}
                  onChange={(value) => setWatchedRecipient(value)}
                  placeholder="견적서를 받을 회사/기관명"
                  filterOption={false}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="recipient_contact" label="담당자">
                <Input placeholder="담당자명" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="recipient_phone" label="연락처">
                <Input placeholder="전화번호" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="recipient_email" label="이메일">
                <Input placeholder="이메일" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="recipient_department" label="수신 부서/팀">
                <Input placeholder="수신 부서 또는 팀명" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="department_id" label="작성 부서 (담당)">
                <Select placeholder="작성 부서 선택" allowClear showSearch optionFilterProp="children">
                  {quoteDepartments.map((d: any) => (
                    <Option key={d.id} value={d.id}>{d.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="recipient_address" label="수신처 주소">
                <Input placeholder="수신처 주소" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label={<span><TeamOutlined /> 프로젝트 멤버</span>}>
                <Select
                  mode="multiple"
                  placeholder="프로젝트 멤버 선택 (작성자는 자동 포함)"
                  value={memberIds}
                  onChange={(values: string[]) => setMemberIds(values)}
                  optionFilterProp="children"
                  showSearch
                  allowClear
                  style={{ width: '100%' }}
                >
                  {quoteUsers
                    .filter((u: any) => u.id !== user?.id)
                    .map((u: any) => (
                      <Option key={u.id} value={u.id}>
                        {u.name} ({u.rank || u.position || u.role})
                      </Option>
                    ))}
                </Select>
                <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
                  작성자는 자동으로 포함됩니다. 추가 멤버를 선택하세요.
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
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
            <Col span={12}>
              <Form.Item name="title" label="견적서 제목">
                <Input placeholder="견적서 제목 (선택)" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="quote_date"
                label="견적일자"
                rules={[{ required: true, message: '견적일자를 선택해주세요.' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="valid_until" label="유효기간">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="project_period_months" label="예상 기간 (개월)">
                <InputNumber style={{ width: '100%' }} min={1} placeholder="개월 수" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 입력 모드 선택 */}
        <Card style={{ marginBottom: 16 }}>
          <Space size="large">
            <Space>
              <Text strong>총금액만 입력:</Text>
              <Switch
                checked={totalOnlyMode}
                onChange={(checked) => {
                  setTotalOnlyMode(checked);
                  if (checked) setManualGrandTotal(null);
                  else setManualGrandTotal(null);
                }}
              />
            </Space>
            <Space>
              <Text strong>VAT 포함:</Text>
              <Switch
                checked={vatEnabled}
                onChange={(checked) => {
                  setVatEnabled(checked);
                  setManualGrandTotal(null);
                }}
              />
              {vatEnabled && (
                <Select
                  value={vatRate}
                  onChange={(v) => { setVatRate(v); setManualGrandTotal(null); }}
                  style={{ width: 100 }}
                  size="small"
                >
                  <Option value={0.1}>10%</Option>
                  <Option value={0.05}>5%</Option>
                  <Option value={0.03}>3%</Option>
                </Select>
              )}
            </Space>
          </Space>
        </Card>

        {/* 총금액만 입력 모드 */}
        {totalOnlyMode && (
          <Card title="총금액 입력" style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col span={12}>
                <Text strong>총액 (VAT 포함):</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 8 }}
                  size="large"
                  min={0}
                  step={10000}
                  value={grandTotal || undefined}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => Number(value!.replace(/,/g, ''))}
                  onChange={handleGrandTotalChange}
                  placeholder="총금액을 입력하세요"
                  addonAfter="원"
                />
              </Col>
              <Col span={12}>
                <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                  <div style={{ marginBottom: 4 }}>
                    <Text>합계 (VAT 별도): </Text>
                    <Text strong>{totalAmount.toLocaleString()}원</Text>
                  </div>
                  <div>
                    <Text>VAT ({vatEnabled ? `${vatRate * 100}%` : '없음'}): </Text>
                    <Text strong>{vatAmount.toLocaleString()}원</Text>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        )}

        {/* 인건비/경비/상세내역 - 상세 모드에서만 표시 */}
        {!totalOnlyMode && (<>
        <Card
          title="인건비"
          style={{ marginBottom: 16 }}
          extra={
            <Space>
              <Button type="default" icon={<ImportOutlined />} onClick={loadAllLaborGrades}>
                단가표 불러오기
              </Button>
              <Button type="dashed" icon={<PlusOutlined />} onClick={addLaborItem}>
                인건비 항목 추가
              </Button>
            </Space>
          }
        >
          <Table
            columns={laborColumns}
            dataSource={laborItems}
            rowKey="key"
            pagination={false}
            size="small"
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5}>
                    <Text strong>인건비 합계</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong>{laborTotal.toLocaleString()}원</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>

        {/* 경비 */}
        <Card
          title="경비"
          style={{ marginBottom: 16 }}
          extra={
            <Space>
              <Button type="default" icon={<ImportOutlined />} onClick={loadAllExpenseCategories}>
                경비항목 불러오기
              </Button>
              <Button type="dashed" icon={<PlusOutlined />} onClick={addExpenseItem}>
                경비 항목 추가
              </Button>
            </Space>
          }
        >
          <Table
            columns={expenseColumns}
            dataSource={expenseItems}
            rowKey="key"
            pagination={false}
            size="small"
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2}>
                    <Text strong>경비 합계</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong>{expenseTotal.toLocaleString()}원</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={2} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>

        {/* 상세내역 (계층 구조) */}
        <Card
          title={
            <Space>
              <AppstoreOutlined />
              <span>상세내역 (대분류/세부/세세부)</span>
              {sectionTotal > 0 && <Tag color="blue">합계: {sectionTotal.toLocaleString()}원</Tag>}
            </Space>
          }
          style={{ marginBottom: 16 }}
          extra={
            <Space>
              <Button type="default" icon={<ImportOutlined />} onClick={openPresetModal}>
                사전 항목 불러오기
              </Button>
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => addSection(1, null)}>
                대분류 추가
              </Button>
            </Space>
          }
        >
          {sections.filter(s => s.level === 1).length === 0 ? (
            <Empty description="상세내역이 없습니다. 대분류를 추가하거나 사전 항목을 불러오세요." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            renderSections()
          )}
        </Card>

        {/* 사전 항목 불러오기 모달 */}
        <Modal
          title="사전 항목 불러오기"
          open={presetModalVisible}
          onCancel={() => setPresetModalVisible(false)}
          onOk={handlePresetImport}
          okText="선택 항목 추가"
          cancelText="취소"
          width={600}
          destroyOnClose
        >
          {presetLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : buildPresetTreeData().length === 0 ? (
            <Empty description="등록된 사전 항목이 없습니다. 설정 > 단가 설정 > 견적 항목 관리에서 추가해주세요." />
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <Tag color="blue">선택한 항목이 상세내역에 추가됩니다. 금액은 추가 후 직접 입력하세요.</Tag>
              </div>
              <Tree
                checkable
                defaultExpandAll
                checkedKeys={presetCheckedKeys}
                onCheck={(checked) => {
                  if (Array.isArray(checked)) {
                    setPresetCheckedKeys(checked);
                  } else {
                    setPresetCheckedKeys(checked.checked);
                  }
                }}
                treeData={buildPresetTreeData()}
                style={{ maxHeight: 400, overflow: 'auto' }}
              />
            </>
          )}
        </Modal>

        {/* 합계 */}
        <Card title="합계" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <Text>인건비 합계: </Text>
                <Text strong>{laborTotal.toLocaleString()}원</Text>
              </div>
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <Text>경비 합계: </Text>
                <Text strong>{expenseTotal.toLocaleString()}원</Text>
              </div>
              {sectionTotal > 0 && (
                <div style={{ textAlign: 'right', marginBottom: 8 }}>
                  <Text>상세내역 합계: </Text>
                  <Text strong>{sectionTotal.toLocaleString()}원</Text>
                </div>
              )}
            </Col>
            <Col span={8}>
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <Text>합계 (VAT 별도): </Text>
                <Text strong>{totalAmount.toLocaleString()}원</Text>
              </div>
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <Text>VAT ({vatEnabled ? `${vatRate * 100}%` : '없음'}): </Text>
                <Text strong>{vatAmount.toLocaleString()}원</Text>
              </div>
            </Col>
            <Col span={8}>
              <div
                style={{
                  textAlign: 'right',
                  fontSize: 18,
                  padding: 16,
                  background: '#f5f5f5',
                  borderRadius: 8,
                }}
              >
                <Text strong style={{ fontSize: 16 }}>총액 (VAT 포함): </Text>
                <br />
                <InputNumber
                  style={{ width: '100%' }}
                  size="large"
                  min={0}
                  step={10000}
                  value={grandTotal || undefined}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => Number(value!.replace(/,/g, ''))}
                  onChange={handleGrandTotalChange}
                  addonAfter="원"
                />
                {manualGrandTotal !== null && (
                  <div style={{ marginTop: 4 }}>
                    <Text type="warning" style={{ fontSize: 12 }}>직접 입력됨</Text>
                    <Button type="link" size="small" onClick={() => setManualGrandTotal(null)}>자동계산</Button>
                  </div>
                )}
                {!totalOnlyMode && (
                  <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <Button
                      icon={<AimOutlined />}
                      onClick={() => {
                        setGoalSeekTarget(grandTotal || null);
                        setGoalSeekVisible(true);
                      }}
                      size="small"
                    >
                      목표값 찾기
                    </Button>
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Card>
        </>)}

        {/* 비고 */}
        <Card title="비고" style={{ marginBottom: 16 }}>
          <Form.Item name="notes" noStyle>
            <TextArea rows={3} placeholder="추가 메모 또는 특이사항" />
          </Form.Item>
        </Card>
      </Form>

      {/* 계약서 연결 */}
      <Card
        title={
          <Space>
            <LinkOutlined />
            <span>연결된 계약서</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={
          isEdit && id && (
            <Button
              size="small"
              icon={<SearchOutlined />}
              onClick={() => { setLinkModalVisible(true); handleSearchContracts(); }}
            >
              계약서 검색/연결
            </Button>
          )
        }
      >
        {linkedContract ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space direction="vertical" size={0}>
              <Text strong>{linkedContract.contract_number}</Text>
              <Text type="secondary">{linkedContract.client_company} - {linkedContract.service_name}</Text>
              <Text type="secondary">총액: {linkedContract.total_amount?.toLocaleString()}원</Text>
            </Space>
            <Button
              type="text"
              danger
              icon={<DisconnectOutlined />}
              onClick={handleUnlinkContract}
            >
              연결해제
            </Button>
          </div>
        ) : (
          <Empty description="연결된 계약서가 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      {/* 계약서 검색 모달 */}
      <Modal
        title="계약서 검색 및 연결"
        open={linkModalVisible}
        onCancel={() => setLinkModalVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Space style={{ marginBottom: 16, width: '100%' }}>
          <Input
            placeholder="계약번호, 발주처, 용역명 검색"
            value={linkSearchText}
            onChange={(e) => setLinkSearchText(e.target.value)}
            onPressEnter={handleSearchContracts}
            style={{ width: 400 }}
          />
          <Button type="primary" onClick={handleSearchContracts} loading={linkSearchLoading}>
            검색
          </Button>
        </Space>
        <Table
          dataSource={linkSearchResults}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: '계약번호', dataIndex: 'contract_number', width: 120 },
            { title: '발주처', dataIndex: 'client_company', ellipsis: true },
            { title: '용역명', dataIndex: 'service_name', ellipsis: true },
            { title: '총액', dataIndex: 'total_amount', width: 130, render: (v: number) => `${(v||0).toLocaleString()}원` },
            { title: '', key: 'action', width: 80, render: (_: any, record: any) => (
              <Button size="small" type="primary" onClick={() => handleLinkContract(record.id)}>연결</Button>
            )},
          ]}
        />
      </Modal>

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
            parentType="quote"
            parentId={id}
            userId={user.id}
            serviceName={watchedService || form.getFieldValue('service_name')}
          />
        </Card>
      )}

      {/* 금액 변경 이력 (수정 모드에서만) */}
      {isEdit && id && user?.id && (
        <QuoteAmountHistory quoteId={id} userId={user.id} />
      )}

      {/* 미리보기 모달 */}
      {isEdit && id && (
        <PdfPreviewModal
          visible={previewVisible}
          onClose={() => setPreviewVisible(false)}
          type="quote"
          documentId={id}
          documentNumber={currentQuote?.quote_number}
        />
      )}

      {/* 이메일 발송 모달 */}
      {isEdit && id && currentQuote && (
        <EmailSendModal
          visible={emailModalVisible}
          onClose={() => setEmailModalVisible(false)}
          type="quote"
          documentId={id}
          documentNumber={currentQuote.quote_number}
          serviceName={currentQuote.service_name}
          recipientCompany={currentQuote.recipient_company}
          recipientEmail={currentQuote.recipient_email}
        />
      )}

      {/* 목표값 찾기 모달 */}
      <Modal
        title="목표값 찾기"
        open={goalSeekVisible}
        onCancel={() => {
          setGoalSeekVisible(false);
          setGoalSeekTarget(null);
          setGoalSeekAdjustTarget('');
        }}
        onOk={handleGoalSeekApply}
        okText="적용"
        destroyOnClose
        cancelText="취소"
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>목표 총금액 (VAT 포함)</Text>
          <InputNumber
            value={goalSeekTarget}
            onChange={(value) => setGoalSeekTarget(value)}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => Number(value!.replace(/,/g, ''))}
            min={0}
            step={100000}
            style={{ width: '100%' }}
            size="large"
            addonAfter="원"
            placeholder="원하는 총금액 입력"
          />
          {goalSeekTarget && vatEnabled && (
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              VAT 제외 금액: {Math.round(goalSeekTarget / (1 + vatRate)).toLocaleString()}원
            </Text>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>조정 대상</Text>
          <Select
            value={goalSeekAdjustTarget || undefined}
            onChange={(value) => setGoalSeekAdjustTarget(value)}
            placeholder="조정할 항목 선택"
            style={{ width: '100%' }}
            options={getGoalSeekOptions()}
          />
        </div>
        {goalSeekTarget && goalSeekAdjustTarget && (() => {
          const targetTotal = vatEnabled ? Math.round(goalSeekTarget / (1 + vatRate)) : goalSeekTarget;
          const currentTotal = laborTotal + expenseTotal + sectionTotal;
          const diff = targetTotal - currentTotal;
          return (
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
              <div><Text type="secondary">현재 합계 (VAT 별도): </Text><Text>{currentTotal.toLocaleString()}원</Text></div>
              <div><Text type="secondary">목표 합계 (VAT 별도): </Text><Text>{targetTotal.toLocaleString()}원</Text></div>
              <div><Text type="secondary">차이: </Text><Text strong style={{ color: diff >= 0 ? '#52c41a' : '#ff4d4f' }}>{diff >= 0 ? '+' : ''}{diff.toLocaleString()}원</Text></div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default QuoteForm;
