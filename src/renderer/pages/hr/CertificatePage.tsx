import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Button, Table, Space, Tag, Modal, Form, Select, Input,
  message, Popconfirm, Tabs, InputNumber, Empty
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SafetyCertificateOutlined, EditOutlined, DeleteOutlined, SettingOutlined,
  DownloadOutlined, FileTextOutlined, UploadOutlined, FileDoneOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '대기중', color: 'processing' },
  approved: { label: '승인됨', color: 'success' },
  rejected: { label: '반려됨', color: 'error' },
  issued: { label: '발급완료', color: 'purple' },
};

interface CertificateType {
  id: string;
  company_id: string;
  key: string;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  template_path?: string;
}

const CertificatePage: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // 증명서 종류 관리
  const [certTypes, setCertTypes] = useState<CertificateType[]>([]);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [editingType, setEditingType] = useState<CertificateType | null>(null);
  const [typeForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('list');

  const isAdmin = user?.role === 'super_admin' || user?.role === 'company_admin';

  // 증명서 종류 목록 로드
  const fetchCertTypes = async () => {
    if (!user?.id) return;
    try {
      const filters: any = {};
      if (user.role === 'super_admin' && selectedCompanyId) filters.company_id = selectedCompanyId;
      const result = await (window as any).electronAPI.certificateTypes.getAll(user.id, filters);
      if (result.success) {
        setCertTypes(result.types || []);
      }
    } catch (err) {
      // silent
    }
  };

  // 증명서 종류를 레이블 맵으로 변환
  const certTypeLabelMap: Record<string, string> = {};
  certTypes.forEach(t => { certTypeLabelMap[t.key] = t.name; });
  // 기본 폴백 (DB에 데이터 없을 때)
  if (!certTypeLabelMap['employment']) certTypeLabelMap['employment'] = '재직증명서';
  if (!certTypeLabelMap['career']) certTypeLabelMap['career'] = '경력증명서';

  const fetchCertificates = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (user.role === 'super_admin' && selectedCompanyId) filters.company_id = selectedCompanyId;
      const result = await window.electronAPI.certificates.getAll(user.id, filters);
      if (result.success) {
        setCertificates(result.certificates || []);
      } else {
        message.error(result.error || '증명서 목록 조회에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '증명서 목록 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertTypes();
    fetchCertificates();
  }, [user?.id, selectedCompanyId]);

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
    } catch (err: any) {
      message.error(err?.message || '증명서 신청 중 오류가 발생했습니다.');
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
    } catch (err: any) {
      message.error(err?.message || '승인 중 오류가 발생했습니다.');
    }
  };

  // 증명서 발급 (AI 생성)
  const handleGenerate = async (certificateId: string) => {
    if (!user?.id) return;
    try {
      message.loading({ content: '증명서를 생성하고 있습니다...', key: 'generate', duration: 0 });
      const result = await window.electronAPI.certificates.generate(user.id, certificateId);
      message.destroy('generate');
      if (result.success) {
        message.success('증명서가 발급되었습니다.');
        fetchCertificates();
      } else {
        message.error(result.error || '증명서 생성에 실패했습니다.');
      }
    } catch (err: any) {
      message.destroy('generate');
      message.error(err?.message || '증명서 생성 중 오류가 발생했습니다.');
    }
  };

  // 증명서 다운로드
  const handleDownload = async (certificateId: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.certificates.download(user.id, certificateId);
      if (result.success) {
        message.success('증명서가 저장되었습니다.');
      } else if (result.error !== 'canceled') {
        message.error(result.error || '다운로드에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '다운로드 중 오류가 발생했습니다.');
    }
  };

  // 템플릿 업로드
  const handleTemplateUpload = async (typeId: string) => {
    if (!user?.id) return;
    try {
      const result = await (window as any).electronAPI.certificateTypes.uploadTemplate(user.id, typeId);
      if (result.success) {
        message.success('양식 템플릿이 업로드되었습니다.');
        fetchCertTypes();
      } else if (result.error !== 'canceled') {
        message.error(result.error || '업로드에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '템플릿 업로드 중 오류가 발생했습니다.');
    }
  };

  // 템플릿 삭제
  const handleTemplateRemove = async (typeId: string) => {
    if (!user?.id) return;
    try {
      const result = await (window as any).electronAPI.certificateTypes.removeTemplate(user.id, typeId);
      if (result.success) {
        message.success('양식 템플릿이 삭제되었습니다.');
        fetchCertTypes();
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '템플릿 삭제 중 오류가 발생했습니다.');
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
    } catch (err: any) {
      message.error(err?.message || '반려 중 오류가 발생했습니다.');
    }
  };

  // 증명서 종류 추가/수정
  const handleTypeSubmit = async (values: any) => {
    if (!user?.id) return;
    try {
      if (editingType) {
        const result = await (window as any).electronAPI.certificateTypes.update(user.id, editingType.id, {
          key: values.key,
          name: values.name,
          description: values.description,
          sort_order: values.sort_order || 0,
        });
        if (result.success) {
          message.success('증명서 종류가 수정되었습니다.');
        } else {
          message.error(result.error || '수정에 실패했습니다.');
          return;
        }
      } else {
        const result = await (window as any).electronAPI.certificateTypes.create(user.id, {
          key: values.key,
          name: values.name,
          description: values.description,
          sort_order: values.sort_order || 0,
        });
        if (result.success) {
          message.success('증명서 종류가 추가되었습니다.');
        } else {
          message.error(result.error || '추가에 실패했습니다.');
          return;
        }
      }
      setTypeModalVisible(false);
      setEditingType(null);
      typeForm.resetFields();
      fetchCertTypes();
    } catch (err: any) {
      message.error(err?.message || '증명서 종류 저장 중 오류가 발생했습니다.');
    }
  };

  const handleTypeDelete = async (typeId: string) => {
    if (!user?.id) return;
    try {
      const result = await (window as any).electronAPI.certificateTypes.delete(user.id, typeId);
      if (result.success) {
        message.success('증명서 종류가 삭제되었습니다.');
        fetchCertTypes();
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '삭제 중 오류가 발생했습니다.');
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
      render: (value: string) => certTypeLabelMap[value] || value,
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
    {
      title: '다운로드',
      key: 'download',
      width: 100,
      render: (_: any, record: any) => {
        if (record.status === 'issued') {
          return (
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record.id)}
            >
              다운로드
            </Button>
          );
        }
        return null;
      },
    },
    ...(isAdmin ? [{
      title: '관리',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => {
        return (
          <Space size="small">
            {record.status === 'pending' && (
              <>
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
              </>
            )}
            {record.status === 'approved' && (
              <Button
                type="link"
                size="small"
                icon={<FileDoneOutlined />}
                style={{ color: '#722ed1' }}
                onClick={() => handleGenerate(record.id)}
              >
                발급
              </Button>
            )}
          </Space>
        );
      },
    }] : []),
  ];

  // 증명서 종류 관리 테이블 컬럼
  const typeColumns = [
    { title: '키', dataIndex: 'key', key: 'key', width: 120 },
    { title: '증명서명', dataIndex: 'name', key: 'name', width: 150 },
    { title: '설명', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '정렬', dataIndex: 'sort_order', key: 'sort_order', width: 60 },
    {
      title: '양식',
      key: 'template',
      width: 180,
      render: (_: any, record: CertificateType) => (
        <Space size="small">
          {record.template_path ? (
            <>
              <Tag color="green" icon={<FileTextOutlined />}>양식 등록됨</Tag>
              <Popconfirm
                title="양식 삭제"
                description="등록된 양식을 삭제하시겠습니까?"
                onConfirm={() => handleTemplateRemove(record.id)}
                okText="삭제"
                cancelText="취소"
              >
                <Button type="link" size="small" danger>삭제</Button>
              </Popconfirm>
            </>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<UploadOutlined />}
              onClick={() => handleTemplateUpload(record.id)}
            >
              양식 업로드
            </Button>
          )}
        </Space>
      ),
    },
    {
      title: '관리',
      key: 'action',
      width: 120,
      render: (_: any, record: CertificateType) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingType(record);
              typeForm.setFieldsValue({
                key: record.key,
                name: record.name,
                description: record.description,
                sort_order: record.sort_order,
              });
              setTypeModalVisible(true);
            }}
          >
            수정
          </Button>
          <Popconfirm
            title="증명서 종류 삭제"
            description="이 증명서 종류를 삭제하시겠습니까?"
            onConfirm={() => handleTypeDelete(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>삭제</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 신청 가능한 증명서 종류 옵션
  const certTypeOptions = certTypes.length > 0
    ? certTypes.map(t => ({ value: t.key, label: t.name }))
    : [{ value: 'employment', label: '재직증명서' }, { value: 'career', label: '경력증명서' }];

  const tabItems = [
    {
      key: 'list',
      label: '증명서 신청/관리',
      children: (
        <>
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
        </>
      ),
    },
    ...(isAdmin ? [{
      key: 'types',
      label: (
        <span><SettingOutlined style={{ marginRight: 4 }} />증명서 종류 관리</span>
      ),
      children: (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text strong>발급 가능한 증명서 종류를 관리합니다.</Text>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingType(null);
                typeForm.resetFields();
                setTypeModalVisible(true);
              }}
            >
              종류 추가
            </Button>
          </div>
          {certTypes.length === 0 ? (
            <Empty description="등록된 증명서 종류가 없습니다. 기본값(재직증명서, 경력증명서)이 사용됩니다." />
          ) : (
            <Table
              columns={typeColumns}
              dataSource={certTypes}
              rowKey="id"
              pagination={false}
              size="small"
            />
          )}
        </Card>
      ),
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

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

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
              {certTypeOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
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
        destroyOnClose
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

      {/* 증명서 종류 추가/수정 모달 */}
      <Modal
        title={editingType ? '증명서 종류 수정' : '증명서 종류 추가'}
        open={typeModalVisible}
        onCancel={() => {
          setTypeModalVisible(false);
          setEditingType(null);
          typeForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={typeForm}
          layout="vertical"
          onFinish={handleTypeSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="key"
            label="키 (영문)"
            rules={[
              { required: true, message: '키를 입력해주세요.' },
              { pattern: /^[a-z][a-z0-9_]*$/, message: '영문 소문자, 숫자, 밑줄만 사용 가능합니다.' },
            ]}
            extra="시스템 내부 식별자입니다. 예: employment, career, income"
          >
            <Input placeholder="예: employment" disabled={!!editingType} />
          </Form.Item>

          <Form.Item
            name="name"
            label="증명서명"
            rules={[{ required: true, message: '증명서명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 재직증명서" />
          </Form.Item>

          <Form.Item name="description" label="설명">
            <TextArea rows={2} placeholder="증명서에 대한 설명 (선택)" />
          </Form.Item>

          <Form.Item name="sort_order" label="정렬 순서" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setTypeModalVisible(false); setEditingType(null); typeForm.resetFields(); }}>
                취소
              </Button>
              <Button type="primary" htmlType="submit">
                {editingType ? '수정' : '추가'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CertificatePage;
