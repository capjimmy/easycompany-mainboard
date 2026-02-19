import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Typography, Button, Form, Input, InputNumber, DatePicker, Select,
  Space, Divider, message, Spin, Row, Col
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, FileAddOutlined, BulbOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';
import { useContractStore } from '../../store/contractStore';
import DocumentGenerateModal from '../../components/documents/DocumentGenerateModal';
import GeneratedDocumentList from '../../components/documents/GeneratedDocumentList';
import RecommendationPopover from '../../components/common/RecommendationPopover';

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
        service_name: currentContract.service_name,
        description: currentContract.description,
        contract_code: currentContract.contract_code,
        contract_start_date: currentContract.contract_start_date ? dayjs(currentContract.contract_start_date) : null,
        contract_end_date: currentContract.contract_end_date ? dayjs(currentContract.contract_end_date) : null,
        contract_amount: currentContract.contract_amount,
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
          {isEdit && id && (
            <Button
              icon={<FileAddOutlined />}
              onClick={() => setShowDocumentModal(true)}
            >
              문서 생성
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
                <Input
                  placeholder="계약 발주 기관/회사명"
                  onChange={(e) => setWatchedClient(e.target.value)}
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
            <Col span={6}>
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
            <Col span={6}>
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
            <Col span={8}>
              <Form.Item
                name="contract_start_date"
                label="계약 시작일"
                rules={[{ required: true, message: '계약 시작일을 선택해주세요.' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contract_end_date" label="계약 종료일">
                <DatePicker style={{ width: '100%' }} />
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

        {/* 비고 */}
        <Card title="비고" style={{ marginBottom: 16 }}>
          <Form.Item name="notes" noStyle>
            <TextArea rows={3} placeholder="추가 메모 또는 특이사항" />
          </Form.Item>
        </Card>
      </Form>

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

      {/* 문서 생성 모달 */}
      <DocumentGenerateModal
        visible={showDocumentModal}
        contractId={id || ''}
        contractNumber={currentContract?.contract_number}
        onClose={() => setShowDocumentModal(false)}
        onGenerated={() => setDocumentRefreshTrigger(prev => prev + 1)}
      />
    </div>
  );
};

export default ContractForm;
