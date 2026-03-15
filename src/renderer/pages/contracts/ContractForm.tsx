import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Typography, Button, Form, Input, InputNumber, DatePicker, Select,
  Space, Divider, message, Spin, Row, Col, List, Empty, Tag, Badge, AutoComplete,
  Timeline, Table, Collapse, Modal
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, FileAddOutlined, BulbOutlined, PaperClipOutlined, FolderOpenOutlined, CalendarOutlined, PlusOutlined, DeleteOutlined, HistoryOutlined, ScanOutlined, LinkOutlined, DisconnectOutlined, SearchOutlined, FilePdfOutlined, MailOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';
import { useContractStore } from '../../store/contractStore';
import DocumentGenerateModal from '../../components/documents/DocumentGenerateModal';
import GeneratedDocumentList from '../../components/documents/GeneratedDocumentList';
import DocumentAttachment from '../../components/documents/DocumentAttachment';
import RecommendationPopover from '../../components/common/RecommendationPopover';
import PaymentConditions from './PaymentConditions';
import ContractSubtasks from './ContractSubtasks';
import EmailSendModal from '../../components/common/EmailSendModal';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

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

  const { user } = useAuthStore();
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
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // 계약유형 감시 (용역계약일 때 용역종류 표시)
  const watchedContractType = Form.useWatch('contract_type', form);

  // 금액 계산
  const contractAmount = Form.useWatch('contract_amount', form) || 0;
  const vatAmount = Math.round(contractAmount * 0.1);
  const totalAmount = contractAmount + vatAmount;

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
      }
    };

    initCompanyId();
  }, [user?.id, user?.company_id, user?.role]);

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
          setUsers(userResult.users.filter((u: any) => u.is_active));
        }
        if (deptResult.success && deptResult.departments) {
          setDepartments(deptResult.departments);
        }
      } catch (err) {
        console.error('Failed to fetch dropdown data:', err);
      }
    };
    fetchDropdownData();
  }, [user?.id]);

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
        outsource_company: currentContract.outsource_company,
        outsource_amount: currentContract.outsource_amount,
        notes: currentContract.notes,
      });

      // 추천 기능을 위한 값 설정
      setWatchedClient(currentContract.client_company || '');
      setWatchedService(currentContract.service_name || '');
    }
  }, [currentContract, isEdit]);

  const handleSubmit = async (values: any) => {
    const companyId = activeCompanyId || user?.company_id;
    if (!user?.id || !companyId) {
      message.error('회사 정보를 찾을 수 없습니다.');
      return;
    }

    setSubmitting(true);

    const contractData = {
      ...values,
      company_id: companyId,
      contract_date: values.contract_date?.format('YYYY-MM-DD'),
      contract_start_date: values.contract_start_date?.format('YYYY-MM-DD'),
      contract_end_date: values.contract_end_date?.format('YYYY-MM-DD'),
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
    } catch (err) {
      message.error('오류가 발생했습니다.');
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
    } catch (err) {
      message.error('원본 파일 열기에 실패했습니다.');
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
    } catch (err) {
      message.error('이벤트 추가 중 오류가 발생했습니다.');
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
    } catch (err) {
      message.error('이벤트 삭제 중 오류가 발생했습니다.');
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
    } catch (err) {
      message.error('연결 중 오류가 발생했습니다.');
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
    } catch (err) {
      message.error('연결 해제 중 오류가 발생했습니다.');
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
    } catch (err) {
      message.error('PDF 생성 중 오류가 발생했습니다.');
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
          </Row>
        </Card>

        {/* 금액 정보 */}
        <Card title="금액 정보" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="contract_amount"
                label="계약금액 (VAT 별도)"
                rules={[{ required: true, message: '계약금액을 입력해주세요.' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                  placeholder="계약 금액"
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="VAT (10%)">
                <InputNumber
                  style={{ width: '100%' }}
                  value={vatAmount}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  disabled
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="총액 (VAT 포함)">
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#f5f5f5',
                    borderRadius: 6,
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: '#1890ff',
                  }}
                >
                  {totalAmount.toLocaleString()}원
                </div>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 진행/외주 정보 */}
        <Card title="진행/외주 정보" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
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
            <Col span={6}>
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
            <Col span={6}>
              <Form.Item name="progress_billing_amount" label="기성 청구금액">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                  placeholder="청구 금액"
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>
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
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                  placeholder="외주 금액"
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

        {/* 비고 */}
        <Card title="비고" style={{ marginBottom: 16 }}>
          <Form.Item name="notes" noStyle>
            <TextArea rows={3} placeholder="추가 메모 또는 특이사항" />
          </Form.Item>
        </Card>
      </Form>

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
