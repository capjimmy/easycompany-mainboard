import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Button, Table, Space, Tag, Modal, Form, Select, Input,
  message, Popconfirm
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const CERT_TYPE_LABELS: Record<string, string> = {
  employment: '재직증명서',
  career: '경력증명서',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '대기중', color: 'processing' },
  approved: { label: '승인됨', color: 'success' },
  rejected: { label: '반려됨', color: 'error' },
  issued: { label: '발급완료', color: 'purple' },
};

const CertificatePage: React.FC = () => {
  const { user } = useAuthStore();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const isAdmin = user?.role === 'super_admin' || user?.role === 'company_admin';

  const fetchCertificates = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.certificates.getAll(user.id);
      if (result.success) {
        setCertificates(result.certificates || []);
      } else {
        message.error(result.error || '증명서 목록 조회에 실패했습니다.');
      }
    } catch (err) {
      message.error('증명서 목록 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, [user?.id]);

  const handleRequest = async (values: any) => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      const result = await window.electronAPI.certificates.create(user.id, {
        certificate_type: values.certificate_type,
        purpose: values.purpose,
      });
      if (result.success) {
        message.success(`증명서가 신청되었습니다. (발급번호: ${result.issueNumber})`);
        setRequestModalVisible(false);
        form.resetFields();
        fetchCertificates();
      } else {
        message.error(result.error || '증명서 신청에 실패했습니다.');
      }
    } catch (err) {
      message.error('증명서 신청 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (certificateId: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.certificates.approve(user.id, certificateId);
      if (result.success) {
        message.success('증명서가 승인되었습니다.');
        fetchCertificates();
      } else {
        message.error(result.error || '승인에 실패했습니다.');
      }
    } catch (err) {
      message.error('승인 중 오류가 발생했습니다.');
    }
  };

  const handleReject = async () => {
    if (!user?.id || !rejectingId) return;
    try {
      const result = await window.electronAPI.certificates.reject(user.id, rejectingId, rejectReason);
      if (result.success) {
        message.success('증명서가 반려되었습니다.');
        setRejectModalVisible(false);
        setRejectingId(null);
        setRejectReason('');
        fetchCertificates();
      } else {
        message.error(result.error || '반려에 실패했습니다.');
      }
    } catch (err) {
      message.error('반려 중 오류가 발생했습니다.');
    }
  };

  const columns = [
    {
      title: '발급번호',
      dataIndex: 'issue_number',
      key: 'issue_number',
      width: 180,
    },
    {
      title: '신청자',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 100,
    },
    {
      title: '증명서 종류',
      dataIndex: 'certificate_type',
      key: 'certificate_type',
      width: 120,
      render: (value: string) => CERT_TYPE_LABELS[value] || value,
    },
    {
      title: '용도',
      dataIndex: 'purpose',
      key: 'purpose',
      ellipsis: true,
    },
    {
      title: '신청일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 110,
      render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD') : '-',
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: string) => {
        const config = STATUS_CONFIG[value] || { label: value, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '승인자',
      dataIndex: 'approved_by_name',
      key: 'approved_by_name',
      width: 100,
      render: (value: string) => value || '-',
    },
    ...(isAdmin ? [{
      title: '관리',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => {
        if (record.status !== 'pending') return null;
        return (
          <Space size="small">
            <Popconfirm
              title="증명서 승인"
              description="이 증명서를 승인하시겠습니까?"
              onConfirm={() => handleApprove(record.id)}
              okText="승인"
              cancelText="취소"
            >
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                style={{ color: '#52c41a' }}
              >
                승인
              </Button>
            </Popconfirm>
            <Button
              type="link"
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => {
                setRejectingId(record.id);
                setRejectReason('');
                setRejectModalVisible(true);
              }}
            >
              반려
            </Button>
          </Space>
        );
      },
    }] : []),
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <SafetyCertificateOutlined style={{ marginRight: 8 }} />
            증명서 발급
          </Title>
          <span style={{ color: '#888' }}>
            {isAdmin ? '증명서 신청 및 승인 관리' : '증명서를 신청하고 발급 상태를 확인합니다.'}
          </span>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            setRequestModalVisible(true);
          }}
        >
          증명서 신청
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={certificates}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}건`,
          }}
        />
      </Card>

      {/* 증명서 신청 모달 */}
      <Modal
        title="증명서 신청"
        open={requestModalVisible}
        onCancel={() => setRequestModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleRequest}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="certificate_type"
            label="증명서 종류"
            rules={[{ required: true, message: '증명서 종류를 선택해주세요.' }]}
          >
            <Select placeholder="증명서 종류 선택">
              <Option value="employment">재직증명서</Option>
              <Option value="career">경력증명서</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="purpose"
            label="발급 용도"
            rules={[{ required: true, message: '발급 용도를 입력해주세요.' }]}
          >
            <TextArea
              rows={3}
              placeholder="예: 은행 대출용, 비자 신청용, 기타 제출용 등"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setRequestModalVisible(false)}>취소</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                신청
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 반려 사유 모달 */}
      <Modal
        title="증명서 반려"
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false);
          setRejectingId(null);
          setRejectReason('');
        }}
        onOk={handleReject}
        okText="반려"
        okType="danger"
        cancelText="취소"
      >
        <div style={{ marginTop: 16 }}>
          <Text>반려 사유를 입력해주세요 (선택):</Text>
          <TextArea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="반려 사유"
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default CertificatePage;
