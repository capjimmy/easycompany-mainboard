import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, InputNumber,
  DatePicker, Select, message, Typography, Row, Col, Divider, Popconfirm
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

interface PaymentCondition {
  id: string;
  contract_id: string;
  condition_type: string;
  title: string;
  amount: number;
  percentage: number;
  due_date: string | null;
  paid_date: string | null;
  paid_amount: number;
  status: string;
  sort_order: number;
  notes: string | null;
}

interface PaymentConditionsProps {
  contractId: string;
  userId: string;
  totalAmount: number; // 계약 총액 (VAT 포함)
}

const CONDITION_TYPES = [
  { value: 'advance', label: '착수금' },
  { value: 'interim', label: '중도금' },
  { value: 'balance', label: '잔금' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: '대기', color: 'default' },
  { value: 'invoiced', label: '청구', color: 'processing' },
  { value: 'paid', label: '입금완료', color: 'success' },
  { value: 'overdue', label: '연체', color: 'error' },
];

const getConditionTypeLabel = (type: string) => {
  return CONDITION_TYPES.find(t => t.value === type)?.label || type;
};

const getStatusTag = (status: string) => {
  const opt = STATUS_OPTIONS.find(s => s.value === status);
  if (!opt) return <Tag>{status}</Tag>;
  return <Tag color={opt.color}>{opt.label}</Tag>;
};

const PaymentConditions: React.FC<PaymentConditionsProps> = ({ contractId, userId, totalAmount }) => {
  const [conditions, setConditions] = useState<PaymentCondition[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [payingCondition, setPayingCondition] = useState<PaymentCondition | null>(null);
  const [form] = Form.useForm();
  const [payForm] = Form.useForm();

  const fetchConditions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.payments.getByContract(userId, contractId);
      if (result.success) {
        setConditions(result.conditions || []);
      }
    } catch (err) {
      console.error('Failed to fetch payment conditions:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, contractId]);

  useEffect(() => {
    fetchConditions();
  }, [fetchConditions]);

  // 금액 입력 시 비율 자동 계산
  const handleAmountChange = (value: number | null) => {
    if (value && totalAmount > 0) {
      const pct = parseFloat(((value / totalAmount) * 100).toFixed(2));
      form.setFieldValue('percentage', pct);
    }
  };

  // 비율 입력 시 금액 자동 계산
  const handlePercentageChange = (value: number | null) => {
    if (value !== null && totalAmount > 0) {
      const amt = Math.round(totalAmount * (value / 100));
      form.setFieldValue('amount', amt);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      condition_type: 'interim',
      status: 'pending',
      amount: 0,
      percentage: 0,
    });
    setModalVisible(true);
  };

  const handleEdit = (record: PaymentCondition) => {
    setEditingId(record.id);
    form.setFieldsValue({
      condition_type: record.condition_type,
      title: record.title,
      amount: record.amount,
      percentage: record.percentage,
      due_date: record.due_date ? dayjs(record.due_date) : null,
      status: record.status,
      notes: record.notes,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        contract_id: contractId,
        due_date: values.due_date?.format('YYYY-MM-DD') || null,
      };

      if (editingId) {
        const result = await window.electronAPI.payments.update(userId, editingId, data);
        if (result.success) {
          message.success('대금조건이 수정되었습니다.');
        } else {
          message.error(result.error || '수정 실패');
          return;
        }
      } else {
        const result = await window.electronAPI.payments.create(userId, data);
        if (result.success) {
          message.success('대금조건이 추가되었습니다.');
        } else {
          message.error(result.error || '추가 실패');
          return;
        }
      }

      setModalVisible(false);
      fetchConditions();
    } catch (err) {
      // validation error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await window.electronAPI.payments.delete(userId, id);
      if (result.success) {
        message.success('대금조건이 삭제되었습니다.');
        fetchConditions();
      } else {
        message.error(result.error || '삭제 실패');
      }
    } catch (err) {
      message.error('삭제 중 오류가 발생했습니다.');
    }
  };

  // 입금 처리 모달
  const handlePayClick = (record: PaymentCondition) => {
    setPayingCondition(record);
    payForm.setFieldsValue({
      paid_amount: record.amount,
      paid_date: dayjs(),
    });
    setPayModalVisible(true);
  };

  const handlePaySave = async () => {
    if (!payingCondition) return;
    try {
      const values = await payForm.validateFields();
      const result = await window.electronAPI.payments.update(userId, payingCondition.id, {
        contract_id: contractId,
        paid_amount: values.paid_amount,
        paid_date: values.paid_date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        status: 'paid',
      });
      if (result.success) {
        message.success('입금 처리가 완료되었습니다.');
        setPayModalVisible(false);
        fetchConditions();
      } else {
        message.error(result.error || '입금 처리 실패');
      }
    } catch (err) {
      // validation error
    }
  };

  // 합계 계산
  const totalConditionAmount = conditions.reduce((s, c) => s + (c.amount || 0), 0);
  const totalPaidAmount = conditions.reduce((s, c) => s + (c.paid_amount || 0), 0);
  const totalRemainingAmount = totalConditionAmount - totalPaidAmount;

  const columns = [
    {
      title: '구분',
      dataIndex: 'condition_type',
      key: 'condition_type',
      width: 90,
      render: (type: string) => {
        const colorMap: Record<string, string> = { advance: 'blue', interim: 'orange', balance: 'green' };
        return <Tag color={colorMap[type] || 'default'}>{getConditionTypeLabel(type)}</Tag>;
      },
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      width: 150,
    },
    {
      title: '금액',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right' as const,
      render: (val: number) => `${(val || 0).toLocaleString()}원`,
    },
    {
      title: '비율(%)',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 80,
      align: 'right' as const,
      render: (val: number) => `${val || 0}%`,
    },
    {
      title: '예정일',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 110,
      render: (val: string | null) => val || '-',
    },
    {
      title: '입금일',
      dataIndex: 'paid_date',
      key: 'paid_date',
      width: 110,
      render: (val: string | null) => val || '-',
    },
    {
      title: '입금액',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 130,
      align: 'right' as const,
      render: (val: number) => val ? `${val.toLocaleString()}원` : '-',
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      render: (_: any, record: PaymentCondition) => (
        <Space size="small">
          {record.status !== 'paid' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handlePayClick(record)}
              title="입금 처리"
            />
          )}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="이 대금조건을 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <DollarOutlined />
          <span>대금조건 (착수금/중도금/잔금)</span>
          <Tag>{conditions.length}건</Tag>
        </Space>
      }
      style={{ marginBottom: 16 }}
      extra={
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreate}>
          조건 추가
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={conditions}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                <Text strong>합계</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text strong>{totalConditionAmount.toLocaleString()}원</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <Text type="secondary">
                  {totalAmount > 0 ? `${((totalConditionAmount / totalAmount) * 100).toFixed(1)}%` : '-'}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} />
              <Table.Summary.Cell index={4} />
              <Table.Summary.Cell index={5} align="right">
                <Text strong style={{ color: '#52c41a' }}>{totalPaidAmount.toLocaleString()}원</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} />
              <Table.Summary.Cell index={7} />
            </Table.Summary.Row>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={6}>
                <Text type="secondary">미수금</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text strong style={{ color: totalRemainingAmount > 0 ? '#ff4d4f' : '#52c41a' }}>
                  {totalRemainingAmount.toLocaleString()}원
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} colSpan={2} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      {/* 추가/수정 모달 */}
      <Modal
        title={editingId ? '대금조건 수정' : '대금조건 추가'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        okText={editingId ? '수정' : '추가'}
        cancelText="취소"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="condition_type"
                label="구분"
                rules={[{ required: true, message: '구분을 선택해주세요.' }]}
              >
                <Select>
                  {CONDITION_TYPES.map(t => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="title"
                label="제목"
                rules={[{ required: true, message: '제목을 입력해주세요.' }]}
              >
                <Input placeholder="예: 1차 착수금" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="금액">
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                  min={0}
                  onChange={handleAmountChange}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="percentage" label="비율 (%)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={handlePercentageChange}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="due_date" label="예정일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="상태">
                <Select>
                  {STATUS_OPTIONS.map(s => (
                    <Option key={s.value} value={s.value}>{s.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} placeholder="메모" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 입금 처리 모달 */}
      <Modal
        title="입금 처리"
        open={payModalVisible}
        onOk={handlePaySave}
        onCancel={() => setPayModalVisible(false)}
        okText="입금 확인"
        cancelText="취소"
        width={400}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            {payingCondition ? `${getConditionTypeLabel(payingCondition.condition_type)} - ${payingCondition.title}` : ''}
          </Text>
          <br />
          <Text>
            예정 금액: <Text strong>{(payingCondition?.amount || 0).toLocaleString()}원</Text>
          </Text>
        </div>
        <Form form={payForm} layout="vertical">
          <Form.Item
            name="paid_amount"
            label="입금액"
            rules={[{ required: true, message: '입금액을 입력해주세요.' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
              min={0}
            />
          </Form.Item>
          <Form.Item
            name="paid_date"
            label="입금일"
            rules={[{ required: true, message: '입금일을 선택해주세요.' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default PaymentConditions;
