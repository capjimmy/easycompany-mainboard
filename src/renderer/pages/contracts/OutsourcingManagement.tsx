import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Table, Button, Space, Tag, Input, Select, Modal,
  Form, InputNumber, DatePicker, Row, Col, Statistic, Spin, message, Popconfirm
} from 'antd';
import {
  TeamOutlined, ArrowLeftOutlined, PlusOutlined, SearchOutlined,
  EditOutlined, DeleteOutlined, DollarOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface Outsourcing {
  id: string;
  contract_id: string;
  contract_number: string;
  vendor_name: string;
  vendor_business_number: string;
  vendor_contact_name: string;
  vendor_contact_phone: string;
  vendor_contact_email: string;
  service_description: string;
  outsourcing_amount: number;
  vat_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  start_date: string;
  end_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes: string;
  created_at: string;
}

const OutsourcingManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [form] = Form.useForm();

  const [outsourcings, setOutsourcings] = useState<Outsourcing[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // 더미 데이터
  const dummyOutsourcings: Outsourcing[] = [
    {
      id: '1',
      contract_id: 'c1',
      contract_number: 'C-2024-0001',
      vendor_name: '(주)테크솔루션',
      vendor_business_number: '123-45-67890',
      vendor_contact_name: '이기술',
      vendor_contact_phone: '02-1234-5678',
      vendor_contact_email: 'tech@solution.co.kr',
      service_description: 'AI 모델 개발 외주',
      outsourcing_amount: 5000000,
      vat_amount: 500000,
      total_amount: 5500000,
      paid_amount: 2750000,
      remaining_amount: 2750000,
      start_date: '2024-03-01',
      end_date: '2024-06-30',
      status: 'in_progress',
      notes: '1차 결과물 제출 완료',
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      contract_id: 'c2',
      contract_number: 'C-2024-0002',
      vendor_name: '디자인팩토리',
      vendor_business_number: '234-56-78901',
      vendor_contact_name: '김디자인',
      vendor_contact_phone: '02-2345-6789',
      vendor_contact_email: 'design@factory.co.kr',
      service_description: 'UI/UX 디자인 외주',
      outsourcing_amount: 3000000,
      vat_amount: 300000,
      total_amount: 3300000,
      paid_amount: 3300000,
      remaining_amount: 0,
      start_date: '2024-01-15',
      end_date: '2024-02-28',
      status: 'completed',
      notes: '완료, 최종 검수 승인',
      created_at: new Date().toISOString(),
    },
    {
      id: '3',
      contract_id: 'c3',
      contract_number: 'C-2024-0003',
      vendor_name: '데이터마이닝(주)',
      vendor_business_number: '345-67-89012',
      vendor_contact_name: '박데이터',
      vendor_contact_phone: '02-3456-7890',
      vendor_contact_email: 'data@mining.co.kr',
      service_description: '데이터 수집 및 분석',
      outsourcing_amount: 8000000,
      vat_amount: 800000,
      total_amount: 8800000,
      paid_amount: 0,
      remaining_amount: 8800000,
      start_date: '2024-04-01',
      end_date: '2024-07-31',
      status: 'pending',
      notes: '계약 체결 예정',
      created_at: new Date().toISOString(),
    },
  ];

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    setIsLoading(true);

    try {
      // 계약 목록 가져오기
      const contractsResult = await window.electronAPI.contracts.getAll(user.id, {});
      if (contractsResult.success) {
        setContracts(contractsResult.contracts || []);
      }

      // 외주 데이터는 아직 API가 없으므로 더미 데이터 사용
      setOutsourcings(dummyOutsourcings);
    } catch (err) {
      console.error('Failed to load data:', err);
      setOutsourcings(dummyOutsourcings);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      start_date: dayjs(),
      status: 'pending',
    });
    setModalVisible(true);
  };

  const handleEdit = (record: Outsourcing) => {
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      start_date: record.start_date ? dayjs(record.start_date) : null,
      end_date: record.end_date ? dayjs(record.end_date) : null,
    });
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    setOutsourcings(outsourcings.filter((o) => o.id !== id));
    message.success('외주 정보가 삭제되었습니다.');
  };

  const handleSubmit = async (values: any) => {
    const outsourcingData = {
      ...values,
      start_date: values.start_date?.format('YYYY-MM-DD'),
      end_date: values.end_date?.format('YYYY-MM-DD'),
      vat_amount: Math.round(values.outsourcing_amount * 0.1),
      total_amount: values.outsourcing_amount + Math.round(values.outsourcing_amount * 0.1),
      remaining_amount: (values.outsourcing_amount + Math.round(values.outsourcing_amount * 0.1)) - (values.paid_amount || 0),
    };

    if (editingId) {
      setOutsourcings(outsourcings.map((o) =>
        o.id === editingId ? { ...o, ...outsourcingData } : o
      ));
      message.success('외주 정보가 수정되었습니다.');
    } else {
      const newOutsourcing: Outsourcing = {
        id: Date.now().toString(),
        ...outsourcingData,
        created_at: new Date().toISOString(),
      };
      setOutsourcings([...outsourcings, newOutsourcing]);
      message.success('외주가 등록되었습니다.');
    }

    setModalVisible(false);
    form.resetFields();
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      pending: { color: 'default', label: '대기' },
      in_progress: { color: 'processing', label: '진행중' },
      completed: { color: 'green', label: '완료' },
      cancelled: { color: 'red', label: '취소' },
    };
    const s = statusMap[status] || { color: 'default', label: status };
    return <Tag color={s.color}>{s.label}</Tag>;
  };

  // 필터링
  const filteredOutsourcings = outsourcings.filter((o) => {
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesSearch =
        o.vendor_name.toLowerCase().includes(search) ||
        o.contract_number.toLowerCase().includes(search) ||
        o.service_description.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    if (statusFilter && o.status !== statusFilter) return false;
    return true;
  });

  // 통계
  const totalOutsourcingAmount = outsourcings.reduce((sum, o) => sum + o.total_amount, 0);
  const totalPaidAmount = outsourcings.reduce((sum, o) => sum + o.paid_amount, 0);
  const totalRemainingAmount = outsourcings.reduce((sum, o) => sum + o.remaining_amount, 0);
  const inProgressCount = outsourcings.filter((o) => o.status === 'in_progress').length;

  const columns = [
    {
      title: '계약번호',
      dataIndex: 'contract_number',
      key: 'contract_number',
      width: 130,
      render: (num: string, record: Outsourcing) => (
        <a onClick={() => navigate(`/contracts/${record.contract_id}`)}>{num}</a>
      ),
    },
    {
      title: '외주업체',
      dataIndex: 'vendor_name',
      key: 'vendor_name',
      width: 150,
    },
    {
      title: '용역내용',
      dataIndex: 'service_description',
      key: 'service_description',
      ellipsis: true,
    },
    {
      title: '외주금액',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right' as const,
      render: (amount: number) => `${amount.toLocaleString()}원`,
    },
    {
      title: '지급액',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 130,
      align: 'right' as const,
      render: (amount: number) => (
        <span style={{ color: '#52c41a' }}>{amount.toLocaleString()}원</span>
      ),
    },
    {
      title: '미지급액',
      dataIndex: 'remaining_amount',
      key: 'remaining_amount',
      width: 130,
      align: 'right' as const,
      render: (amount: number) => (
        <span style={{ color: amount > 0 ? '#ff4d4f' : '#000' }}>
          {amount.toLocaleString()}원
        </span>
      ),
    },
    {
      title: '기간',
      key: 'period',
      width: 180,
      render: (_: any, record: Outsourcing) => (
        <span>
          {record.start_date} ~ {record.end_date || ''}
        </span>
      ),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: getStatusTag,
    },
    {
      title: '담당자',
      dataIndex: 'vendor_contact_name',
      key: 'vendor_contact_name',
      width: 80,
    },
    {
      title: '액션',
      key: 'action',
      width: 100,
      render: (_: any, record: Outsourcing) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 금액 자동 계산
  const outsourcingAmount = Form.useWatch('outsourcing_amount', form) || 0;
  const paidAmount = Form.useWatch('paid_amount', form) || 0;
  const vatAmount = Math.round(outsourcingAmount * 0.1);
  const totalAmount = outsourcingAmount + vatAmount;
  const remainingAmount = totalAmount - paidAmount;

  if (isLoading) {
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
              <TeamOutlined /> 외주 관리
            </Title>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          외주 등록
        </Button>
      </div>

      {/* 통계 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="총 외주 건수"
              value={outsourcings.length}
              suffix="건"
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="총 외주 금액"
              value={totalOutsourcingAmount}
              suffix="원"
              prefix={<DollarOutlined />}
              formatter={(value) => value?.toLocaleString()}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="총 지급액"
              value={totalPaidAmount}
              suffix="원"
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              formatter={(value) => value?.toLocaleString()}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="미지급액"
              value={totalRemainingAmount}
              suffix="원"
              valueStyle={{ color: totalRemainingAmount > 0 ? '#ff4d4f' : '#000' }}
              formatter={(value) => value?.toLocaleString()}
            />
          </Card>
        </Col>
      </Row>

      {/* 필터 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Input
              placeholder="업체명, 계약번호, 용역내용 검색"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="상태 선택"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
            >
              <Option value="pending">대기</Option>
              <Option value="in_progress">진행중</Option>
              <Option value="completed">완료</Option>
              <Option value="cancelled">취소</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* 목록 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredOutsourcings}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}건`,
          }}
          size="middle"
          locale={{ emptyText: '등록된 외주가 없습니다.' }}
        />
      </Card>

      {/* 등록/수정 모달 */}
      <Modal
        title={editingId ? '외주 수정' : '외주 등록'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contract_id"
                label="관련 계약"
                rules={[{ required: true, message: '계약을 선택해주세요.' }]}
              >
                <Select placeholder="계약 선택">
                  {contracts.map((c) => (
                    <Option key={c.id} value={c.id}>
                      {c.contract_number} - {c.client_company}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="vendor_name"
                label="외주업체명"
                rules={[{ required: true, message: '업체명을 입력해주세요.' }]}
              >
                <Input placeholder="업체명" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="vendor_business_number" label="사업자번호">
                <Input placeholder="000-00-00000" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vendor_contact_name" label="담당자">
                <Input placeholder="담당자명" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vendor_contact_phone" label="연락처">
                <Input placeholder="전화번호" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="service_description"
            label="용역 내용"
            rules={[{ required: true, message: '용역 내용을 입력해주세요.' }]}
          >
            <TextArea rows={2} placeholder="외주 용역 내용" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="outsourcing_amount"
                label="외주금액 (VAT 별도)"
                rules={[{ required: true, message: '금액을 입력해주세요.' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
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
                    padding: '4px 11px',
                    background: '#f5f5f5',
                    borderRadius: 6,
                    fontWeight: 'bold',
                  }}
                >
                  {totalAmount.toLocaleString()}원
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="paid_amount" label="지급액">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="미지급액">
                <div
                  style={{
                    padding: '4px 11px',
                    background: remainingAmount > 0 ? '#fff2f0' : '#f5f5f5',
                    borderRadius: 6,
                    color: remainingAmount > 0 ? '#ff4d4f' : '#000',
                  }}
                >
                  {remainingAmount.toLocaleString()}원
                </div>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="status"
                label="상태"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="pending">대기</Option>
                  <Option value="in_progress">진행중</Option>
                  <Option value="completed">완료</Option>
                  <Option value="cancelled">취소</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="start_date"
                label="시작일"
                rules={[{ required: true, message: '시작일을 선택해주세요.' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_date" label="종료일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="비고">
            <TextArea rows={2} placeholder="메모 또는 특이사항" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>취소</Button>
              <Button type="primary" htmlType="submit">
                {editingId ? '수정' : '등록'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OutsourcingManagement;
