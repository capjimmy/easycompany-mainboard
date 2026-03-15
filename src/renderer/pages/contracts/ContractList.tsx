import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Table, Space, Tag, Input, Select, DatePicker,
  message, Popconfirm, Tooltip, Modal, Form, InputNumber, Dropdown, Statistic, Row, Col
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
  DollarOutlined, MoreOutlined, CheckCircleOutlined, WarningOutlined, ExclamationCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';
import { useContractStore } from '../../store/contractStore';
import type { Contract, ContractProgress } from '../../../shared/types';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const PROGRESS_CONFIG: Record<ContractProgress, { label: string; color: string }> = {
  contract_signed: { label: '계약체결', color: 'blue' },
  in_progress: { label: '진행중', color: 'processing' },
  inspection: { label: '검수중', color: 'warning' },
  completed: { label: '완료', color: 'success' },
  on_hold: { label: '보류', color: 'default' },
  cancelled: { label: '취소', color: 'error' },
};

const ContractList: React.FC = () => {
  const navigate = useNavigate();
  const { user, selectedCompanyId } = useAuthStore();
  const {
    contracts,
    isLoading,
    fetchContracts,
    deleteContract,
    updateProgress,
    addPayment,
  } = useContractStore();

  const [searchText, setSearchText] = useState('');
  const [progressFilter, setProgressFilter] = useState<ContractProgress | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [paymentForm] = Form.useForm();
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressForm] = Form.useForm();

  useEffect(() => {
    if (user?.id) {
      const filters: any = {};
      if (user.role === 'super_admin' && selectedCompanyId) filters.company_id = selectedCompanyId;
      fetchContracts(user.id, filters);
    }
  }, [user?.id, selectedCompanyId]);

  // 통계 계산
  const stats = {
    total_amount: contracts.reduce((sum, c) => sum + c.total_amount, 0),
    received_amount: contracts.reduce((sum, c) => sum + c.received_amount, 0),
    remaining_amount: contracts.reduce((sum, c) => sum + c.remaining_amount, 0),
  };

  const handleSearch = () => {
    if (!user?.id) return;

    const filters: any = {};
    if (searchText) filters.search = searchText;
    if (progressFilter) filters.progress = progressFilter;
    if (dateRange) {
      filters.startDate = dateRange[0].format('YYYY-MM-DD');
      filters.endDate = dateRange[1].format('YYYY-MM-DD');
    }
    if (user.role === 'super_admin' && selectedCompanyId) filters.company_id = selectedCompanyId;

    fetchContracts(user.id, filters);
  };

  const handleReset = () => {
    setSearchText('');
    setProgressFilter(undefined);
    setDateRange(null);
    if (user?.id) {
      const filters: any = {};
      if (user.role === 'super_admin' && selectedCompanyId) filters.company_id = selectedCompanyId;
      fetchContracts(user.id, filters);
    }
  };

  const handleDelete = async (contractId: string) => {
    if (!user?.id) return;

    const result = await deleteContract(user.id, contractId);
    if (result.success) {
      message.success('계약이 삭제되었습니다.');
    } else {
      message.error(result.error || '삭제에 실패했습니다.');
    }
  };

  const handleProgressClick = (contract: Contract) => {
    setSelectedContract(contract);
    progressForm.resetFields();
    progressForm.setFieldsValue({ progress: contract.progress });
    setProgressModalVisible(true);
  };

  const handleProgressChange = async (values: any) => {
    if (!user?.id || !selectedContract) return;

    const result = await updateProgress(user.id, selectedContract.id, values.progress, values.note);
    if (result.success) {
      message.success('진행상황이 변경되었습니다.');
      setProgressModalVisible(false);
    } else {
      message.error(result.error || '변경에 실패했습니다.');
    }
  };

  const handlePaymentClick = (contract: Contract) => {
    setSelectedContract(contract);
    paymentForm.resetFields();
    paymentForm.setFieldsValue({
      payment_date: dayjs(),
    });
    setPaymentModalVisible(true);
  };

  const handlePayment = async (values: any) => {
    if (!user?.id || !selectedContract) return;

    const paymentData = {
      ...values,
      payment_date: values.payment_date?.format('YYYY-MM-DD'),
    };

    const result = await addPayment(user.id, selectedContract.id, paymentData);
    if (result.success) {
      message.success('입금이 등록되었습니다.');
      setPaymentModalVisible(false);
      fetchContracts(user.id);
    } else {
      message.error(result.error || '입금 등록에 실패했습니다.');
    }
  };

  // 수금률 계산 및 색상 결정
  const getCollectionRateInfo = (record: Contract) => {
    const totalAmt = record.total_amount || 0;
    if (totalAmt === 0) return { rate: 0, color: '#d9d9d9', label: '-' };
    const rate = Math.round((record.received_amount / totalAmt) * 100);
    let color = '#ff4d4f'; // red: 0-49%
    if (rate >= 100) color = '#52c41a'; // green: 100%
    else if (rate >= 80) color = '#1890ff'; // blue: 80-99%
    else if (rate >= 50) color = '#faad14'; // gold: 50-79%
    return { rate, color, label: `${rate}%` };
  };

  // 연체 여부 확인
  const isOverdue = (record: Contract) => {
    if (!record.contract_end_date) return false;
    if (record.remaining_amount <= 0) return false;
    const endDate = dayjs(record.contract_end_date);
    return dayjs().isAfter(endDate, 'day');
  };

  const handleExportExcel = async () => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.export.contracts(user.id);
      if (result.success) {
        message.success(`엑셀 파일이 저장되었습니다: ${result.filePath}`);
      } else if (result.error !== '저장이 취소되었습니다.') {
        message.error(result.error || '내보내기에 실패했습니다.');
      }
    } catch (err) {
      message.error('엑셀 내보내기 중 오류가 발생했습니다.');
    }
  };

  const getActionMenu = (record: Contract): MenuProps['items'] => {
    const items: MenuProps['items'] = [
      {
        key: 'view',
        label: '상세보기',
        icon: <EyeOutlined />,
        onClick: () => navigate(`/contracts/${record.id}`),
      },
      {
        key: 'edit',
        label: '수정',
        icon: <EditOutlined />,
        onClick: () => navigate(`/contracts/${record.id}/edit`),
      },
      {
        key: 'progress',
        label: '진행상황 변경',
        icon: <CheckCircleOutlined />,
        onClick: () => handleProgressClick(record),
      },
      {
        key: 'payment',
        label: '입금 등록',
        icon: <DollarOutlined />,
        onClick: () => handlePaymentClick(record),
      },
      { type: 'divider' },
      {
        key: 'delete',
        label: '삭제',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => handleDelete(record.id),
      },
    ];

    return items;
  };

  const columns = [
    {
      title: '계약번호',
      dataIndex: 'contract_number',
      key: 'contract_number',
      width: 130,
      render: (value: string, record: Contract) => (
        <a onClick={() => navigate(`/contracts/${record.id}`)}>{value}</a>
      ),
    },
    {
      title: '발주기관',
      dataIndex: 'client_company',
      key: 'client_company',
      ellipsis: true,
    },
    {
      title: '용역명',
      dataIndex: 'service_name',
      key: 'service_name',
      ellipsis: true,
    },
    {
      title: '계약일',
      dataIndex: 'contract_start_date',
      key: 'contract_start_date',
      width: 110,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD'),
    },
    {
      title: '계약금액',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right' as const,
      render: (value: number) => `${value.toLocaleString()}원`,
    },
    {
      title: '입금액',
      dataIndex: 'received_amount',
      key: 'received_amount',
      width: 130,
      align: 'right' as const,
      render: (value: number, record: Contract) => (
        <span style={{ color: value >= record.total_amount ? '#52c41a' : undefined }}>
          {value.toLocaleString()}원
        </span>
      ),
    },
    {
      title: '수금률',
      key: 'collection_rate',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: Contract) => {
        const info = getCollectionRateInfo(record);
        return (
          <Tag
            color={info.color}
            style={{ fontWeight: 'bold', minWidth: 48, textAlign: 'center' }}
          >
            {info.label}
          </Tag>
        );
      },
    },
    {
      title: '미수금',
      dataIndex: 'remaining_amount',
      key: 'remaining_amount',
      width: 140,
      align: 'right' as const,
      render: (value: number, record: Contract) => {
        const overdue = isOverdue(record);
        return (
          <Space size={4}>
            <span style={{ color: value > 0 ? '#ff4d4f' : '#52c41a' }}>
              {value.toLocaleString()}원
            </span>
            {overdue && (
              <Tooltip title={`연체 (종료일: ${dayjs(record.contract_end_date).format('YYYY-MM-DD')})`}>
                <Tag color="red" style={{ marginLeft: 4 }}>
                  <ExclamationCircleOutlined /> 연체
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '진행상황',
      dataIndex: 'progress',
      key: 'progress',
      width: 100,
      render: (value: ContractProgress) => (
        <Tag color={PROGRESS_CONFIG[value]?.color}>
          {PROGRESS_CONFIG[value]?.label}
        </Tag>
      ),
    },
    {
      title: '담당자',
      dataIndex: 'manager_name',
      key: 'manager_name',
      width: 100,
    },
    {
      title: '작업',
      key: 'action',
      width: 80,
      render: (_: any, record: Contract) => (
        <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>계약관리</Title>
          <span style={{ color: '#888' }}>계약을 조회하고 관리합니다.</span>
        </div>
        <Space>
          {(user?.role === 'super_admin' || user?.role === 'company_admin') && (
            <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>
              엑셀 내보내기
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/contracts/new')}>
            계약 등록
          </Button>
        </Space>
      </div>

      {/* 통계 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="총 계약금액"
              value={stats.total_amount}
              suffix="원"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="총 입금액"
              value={stats.received_amount}
              suffix="원"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="총 미수금"
              value={stats.remaining_amount}
              suffix="원"
              valueStyle={{ color: stats.remaining_amount > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 검색 필터 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="계약번호, 발주기관, 용역명 검색"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 250 }}
          />
          <Select
            placeholder="진행상황"
            value={progressFilter}
            onChange={setProgressFilter}
            allowClear
            style={{ width: 120 }}
          >
            {Object.entries(PROGRESS_CONFIG).map(([key, config]) => (
              <Option key={key} value={key}>
                {config.label}
              </Option>
            ))}
          </Select>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          />
          <Button type="primary" onClick={handleSearch}>검색</Button>
          <Button onClick={handleReset}>초기화</Button>
        </Space>
      </Card>

      {/* 목록 */}
      <Card>
        <Table
          columns={columns}
          dataSource={contracts}
          rowKey="id"
          loading={isLoading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}건`,
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* 진행상황 변경 모달 */}
      <Modal
        title="진행상황 변경"
        open={progressModalVisible}
        onCancel={() => setProgressModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        {selectedContract && (
          <Form
            form={progressForm}
            layout="vertical"
            onFinish={handleProgressChange}
          >
            <Card size="small" style={{ marginBottom: 16 }}>
              <Text strong>계약번호: </Text>{selectedContract.contract_number}<br />
              <Text strong>발주기관: </Text>{selectedContract.client_company}
            </Card>

            <Form.Item
              name="progress"
              label="진행상황"
              rules={[{ required: true, message: '진행상황을 선택해주세요.' }]}
            >
              <Select>
                {Object.entries(PROGRESS_CONFIG).map(([key, config]) => (
                  <Option key={key} value={key}>
                    <Tag color={config.color}>{config.label}</Tag>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="note" label="비고">
              <Input.TextArea rows={2} placeholder="변경 사유 (선택)" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setProgressModalVisible(false)}>취소</Button>
                <Button type="primary" htmlType="submit">변경</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 입금 등록 모달 */}
      <Modal
        title="입금 등록"
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        {selectedContract && (
          <Form
            form={paymentForm}
            layout="vertical"
            onFinish={handlePayment}
          >
            <Card size="small" style={{ marginBottom: 16 }}>
              <Text strong>계약번호: </Text>{selectedContract.contract_number}<br />
              <Text strong>발주기관: </Text>{selectedContract.client_company}<br />
              <Text strong>미수금: </Text>
              <Text type="danger">{selectedContract.remaining_amount.toLocaleString()}원</Text>
            </Card>

            <Form.Item
              name="payment_date"
              label="입금일"
              rules={[{ required: true, message: '입금일을 선택해주세요.' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="amount"
              label="입금액"
              rules={[{ required: true, message: '입금액을 입력해주세요.' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                placeholder="입금 금액"
                min={0}
              />
            </Form.Item>

            <Form.Item name="payment_method" label="입금 방법">
              <Select placeholder="선택 (선택사항)">
                <Option value="계좌이체">계좌이체</Option>
                <Option value="현금">현금</Option>
                <Option value="카드">카드</Option>
                <Option value="어음">어음</Option>
              </Select>
            </Form.Item>

            <Form.Item name="note" label="비고">
              <Input.TextArea rows={2} placeholder="메모 (선택)" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setPaymentModalVisible(false)}>취소</Button>
                <Button type="primary" htmlType="submit">등록</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default ContractList;
