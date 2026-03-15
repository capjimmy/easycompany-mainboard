import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Typography, Button, Form, Input, InputNumber, DatePicker, Select,
  Table, Space, Divider, message, Spin, Row, Col, AutoComplete, Modal, Empty, Tag
} from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, SaveOutlined, BulbOutlined, PaperClipOutlined, FolderOpenOutlined, ScanOutlined, LinkOutlined, DisconnectOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';
import { useQuoteStore } from '../../store/quoteStore';
import RecommendationPopover from '../../components/common/RecommendationPopover';
import DocumentAttachment from '../../components/documents/DocumentAttachment';
import QuoteAmountHistory from './QuoteAmountHistory';
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

  const { user } = useAuthStore();
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

  // 합계 계산
  const laborTotal = laborItems.reduce((sum, item) => sum + item.subtotal, 0);
  const expenseTotal = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  const totalAmount = laborTotal + expenseTotal;
  const vatAmount = Math.round(totalAmount * 0.1);
  const grandTotal = totalAmount + vatAmount;

  // 회사 ID 결정 (super_admin의 경우 첫 번째 회사 사용)
  useEffect(() => {
    const initCompanyId = async () => {
      if (!user?.id) return;

      let companyId = user.company_id;

      // super_admin인 경우 회사 목록에서 첫 번째 회사 사용
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
  }, [user?.id, user?.company_id, user?.role]);

  // 거래처 목록 로드 (AutoComplete 용)
  useEffect(() => {
    const fetchClientCompanies = async () => {
      if (!user?.id) return;
      try {
        const result = await window.electronAPI.clients.getAll(user.id);
        if (result.success && result.clients) {
          setAllClientCompanies(result.clients.map((c: any) => ({ name: c.name })));
          setClientCompanyOptions(
            result.clients.map((c: any) => ({ value: c.name, label: c.name }))
          );
        }
      } catch (err) {
        console.error('Failed to fetch client companies:', err);
      }
    };
    fetchClientCompanies();
  }, [user?.id]);

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
            calculation_type: 'manual',
            amount: item.amount,
            note: item.note,
          }))
        );
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

    // 인건비 항목이 없으면 경고
    if (laborItems.length === 0) {
      message.warning('인건비 항목을 1개 이상 추가해주세요.');
      return;
    }

    setSubmitting(true);

    const quoteData = {
      ...values,
      company_id: companyId,
      quote_date: values.quote_date?.format('YYYY-MM-DD'),
      valid_until: values.valid_until?.format('YYYY-MM-DD'),
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
    };

    try {
      let result;
      if (isEdit && id) {
        result = await updateQuote(user.id, id, quoteData);
      } else {
        result = await createQuote(user.id, quoteData);
      }

      if (result.success) {
        message.success(isEdit ? '견적서가 수정되었습니다.' : '견적서가 생성되었습니다.');
        navigate('/quotes');
      } else {
        message.error(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
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
    } catch (err) {
      message.error('원본 파일 열기에 실패했습니다.');
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

        message.success('문서에서 정보가 추출되었습니다. 내용을 확인해주세요.');
      } else if (result.rawText) {
        message.info('문서를 인식했지만 구조화된 데이터로 변환하지 못했습니다.');
      } else if (result.error && result.error !== 'canceled') {
        message.error(result.error);
      }
    } catch (err) {
      message.error('문서 스캔 중 오류가 발생했습니다.');
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
        message.success(`폴더에서 ${result.scannedFiles}개 파일을 분석하여 정보를 추출했습니다.`);
      } else if (result.error) {
        message.error(result.error);
      }
    } catch (err) {
      message.error('폴더 스캔 중 오류가 발생했습니다.');
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
    } catch (err) {
      message.error('연결 중 오류가 발생했습니다.');
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
    } catch (err) {
      message.error('연결 해제 중 오류가 발생했습니다.');
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
            <Col span={24}>
              <Form.Item name="recipient_address" label="수신처 주소">
                <Input placeholder="수신처 주소" />
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

        {/* 인건비 */}
        <Card
          title="인건비"
          style={{ marginBottom: 16 }}
          extra={
            <Button type="dashed" icon={<PlusOutlined />} onClick={addLaborItem}>
              인건비 항목 추가
            </Button>
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
            <Button type="dashed" icon={<PlusOutlined />} onClick={addExpenseItem}>
              경비 항목 추가
            </Button>
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
            </Col>
            <Col span={8}>
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <Text>합계 (VAT 별도): </Text>
                <Text strong>{totalAmount.toLocaleString()}원</Text>
              </div>
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <Text>VAT (10%): </Text>
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
                <Text strong style={{ fontSize: 24, color: '#1890ff' }}>
                  {grandTotal.toLocaleString()}원
                </Text>
              </div>
            </Col>
          </Row>
        </Card>

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
    </div>
  );
};

export default QuoteForm;
