import ResizableTable from '../../components/ResizableTable';
import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Select, DatePicker, InputNumber, Input,
  Tag, Space, Typography, message, Card, Popconfirm, Statistic, Row, Col,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const LEAVE_TYPE_OPTIONS = [
  { value: 'annual', label: '연차' },
  { value: 'half_am', label: '오전반차' },
  { value: 'half_pm', label: '오후반차' },
  { value: 'sick', label: '병가' },
  { value: 'special', label: '특별휴가' },
  { value: 'business_trip', label: '출장' },
  { value: 'remote', label: '재택근무' },
];

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: '연차',
  half_am: '오전반차',
  half_pm: '오후반차',
  sick: '병가',
  special: '특별휴가',
  business_trip: '출장',
  remote: '재택근무',
};

// 연차 차감 대상 유형 (출장/재택/특별휴가/병가는 차감 안 함 → days=0)
const ANNUAL_DEDUCT_TYPES = ['annual', 'half_am', 'half_pm'];
// 사용일수를 0으로 고정하는 유형
const ZERO_DAYS_TYPES = ['business_trip', 'remote', 'special', 'sick'];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'processing', label: '대기' },
  dept_approved: { color: 'warning', label: '부서승인' },
  approved: { color: 'success', label: '최종승인' },
  rejected: { color: 'error', label: '반려' },
  cancelled: { color: 'default', label: '취소됨' },
};

const LeavePage: React.FC = () => {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [annualInfo, setAnnualInfo] = useState<{ total: number; used: number; remaining: number } | null>(null);

  const fetchRequests = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.leave.getMyRequests(user.id);
      if (result.success) {
        setRequests(result.requests || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnualInfo = async () => {
    if (!user?.id) return;
    try {
      const result = await (window as any).electronAPI.leave.calculateAnnual(user.id);
      if (result.success) {
        setAnnualInfo(result.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchAnnualInfo();
  }, [user?.id]);

  const handleLeaveTypeChange = (value: string) => {
    if (ZERO_DAYS_TYPES.includes(value)) {
      form.setFieldsValue({ days: 0 });
    } else if (value === 'half_am' || value === 'half_pm') {
      form.setFieldsValue({ days: 0.5 });
    } else {
      // 날짜가 이미 선택되어 있으면 일수 재계산
      const range = form.getFieldValue('dateRange');
      if (range && range[0] && range[1]) {
        const days = range[1].diff(range[0], 'day') + 1;
        form.setFieldsValue({ days });
      } else {
        form.setFieldsValue({ days: 1 });
      }
    }
  };

  const handleDateRangeChange = (range: any) => {
    if (!range || !range[0] || !range[1]) return;
    const leaveType = form.getFieldValue('leave_type');
    if (ZERO_DAYS_TYPES.includes(leaveType)) {
      form.setFieldsValue({ days: 0 });
      return;
    }
    if (leaveType === 'half_am' || leaveType === 'half_pm') {
      form.setFieldsValue({ days: 0.5 });
      return;
    }
    // 시작일~종료일 일수 계산 (양 끝 포함)
    const days = range[1].diff(range[0], 'day') + 1;
    form.setFieldsValue({ days });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const [startDate, endDate] = values.dateRange;
      const data = {
        leave_type: values.leave_type,
        start_date: startDate.format('YYYY-MM-DD'),
        end_date: endDate.format('YYYY-MM-DD'),
        days: values.days,
        reason: values.reason || '',
      };

      const result = await (window as any).electronAPI.leave.create(user!.id, data);
      if (result.success) {
        message.success('연차 신청이 완료되었습니다.');
        setModalOpen(false);
        form.resetFields();
        fetchRequests();
        fetchAnnualInfo();
      } else {
        message.error(result.error || '신청 실패');
      }
    } catch (err) {
      // validation error
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (leaveId: string) => {
    try {
      const result = await (window as any).electronAPI.leave.cancel(user!.id, leaveId);
      if (result.success) {
        message.success('신청이 취소되었습니다.');
        fetchRequests();
        fetchAnnualInfo();
      } else {
        message.error(result.error || '취소 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '취소 중 오류가 발생했습니다.');
    }
  };

  const columns = [
    {
      title: '유형',
      dataIndex: 'leave_type',
      key: 'leave_type',
      width: 100,
      render: (v: string) => LEAVE_TYPE_LABELS[v] || v,
    },
    {
      title: '시작일',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120,
    },
    {
      title: '종료일',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 120,
    },
    {
      title: '일수',
      dataIndex: 'days',
      key: 'days',
      width: 70,
      render: (v: number) => `${v}일`,
    },
    {
      title: '사유',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: string) => {
        const s = STATUS_MAP[v] || { color: 'default', label: v };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '승인자',
      dataIndex: 'approver_name',
      key: 'approver_name',
      width: 100,
      render: (v: string | null) => v || '-',
    },
    {
      title: '신청일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_: any, record: any) => {
        if (record.status === 'rejected' || record.status === 'cancelled') return null;
        const isApproved = record.status === 'approved';
        return (
          <Popconfirm
            title={isApproved ? '승인된 신청을 취소하시겠습니까?' : '신청을 취소하시겠습니까?'}
            description={isApproved && ANNUAL_DEDUCT_TYPES.includes(record.leave_type) ? '연차가 환원됩니다.' : undefined}
            onConfirm={() => handleCancel(record.id)}
            okText="취소"
            cancelText="아니오"
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small">취소</Button>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>연차 신청</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          연차 신청
        </Button>
      </div>

      {annualInfo && (
        <Card style={{ marginTop: 16 }}>
          <Row gutter={24}>
            <Col span={8}>
              <Statistic title="총 연차" value={annualInfo.total} suffix="일" />
            </Col>
            <Col span={8}>
              <Statistic title="사용" value={annualInfo.used} suffix="일" />
            </Col>
            <Col span={8}>
              <Statistic
                title="잔여"
                value={annualInfo.remaining}
                suffix="일"
                valueStyle={{ color: annualInfo.remaining <= 3 ? '#cf1322' : '#3f8600' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      <Card style={{ marginTop: 16 }}>
        <ResizableTable
          dataSource={requests}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: '신청 내역이 없습니다.' }}
        />
      </Card>

      <Modal
        title="연차 신청"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="신청"
        cancelText="취소"
        width={500}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ leave_type: 'annual', days: 1 }}>
          <Form.Item name="leave_type" label="휴가 유형" rules={[{ required: true }]}>
            <Select options={LEAVE_TYPE_OPTIONS} onChange={handleLeaveTypeChange} />
          </Form.Item>
          <Form.Item name="dateRange" label="기간" rules={[{ required: true, message: '기간을 선택해주세요' }]}>
            <RangePicker style={{ width: '100%' }} onChange={handleDateRangeChange} />
          </Form.Item>
          <Form.Item name="days" label="사용일수" rules={[{ required: true }]}>
            <InputNumber min={0.5} max={30} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="사유">
            <TextArea rows={3} placeholder="사유를 입력해주세요 (선택사항)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LeavePage;
