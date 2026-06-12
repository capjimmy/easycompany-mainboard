import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Button, Table, Space, Input, message, Modal, Form, Popconfirm,
  InputNumber, Switch, Tag, Select,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;

const SpaceManagement: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const companyId = user?.role === 'super_admin' ? selectedCompanyId : user?.company_id;
  const isAdmin = user?.role === 'super_admin' || user?.role === 'company_admin';

  const [list, setList] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form] = Form.useForm();

  const companyMap: Record<string, string> = {};
  companies.forEach(c => { companyMap[c.id] = c.name; });

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (companyId) filters.company_id = companyId;
      const res = await (window as any).electronAPI.spaces.getAll(user.id, filters);
      if (res.success) setList(res.data || []);
      else message.error(res.error || '조회 실패');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user?.id, selectedCompanyId]);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      (window as any).electronAPI.companies.getAll(user.id).then((res: any) => {
        if (res.success) setCompanies(res.companies || []);
      });
    }
  }, [user?.id]);

  const handleOpen = (record?: any) => {
    setEditing(record || null);
    form.resetFields();
    if (record) form.setFieldsValue(record);
    else form.setFieldsValue({ is_active: true, capacity: 0 });
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (!user?.id) return;
    try {
      let targetCompanyId: string | null;
      if (values.company_id === 'shared') {
        targetCompanyId = null;
      } else {
        targetCompanyId = values.company_id || companyId || user?.company_id || null;
      }
      const payload = { ...values };
      delete payload.company_id;
      const res = editing
        ? await (window as any).electronAPI.spaces.update(user.id, editing.id, payload)
        : await (window as any).electronAPI.spaces.create(user.id, { ...payload, company_id: targetCompanyId });
      if (res.success) {
        message.success(editing ? '수정되었습니다.' : '등록되었습니다.');
        setModalOpen(false);
        fetchData();
      } else message.error(res.error || '저장 실패');
    } catch (err: any) { message.error(err?.message || '저장 중 오류'); }
  };

  const handleDelete = async (id: string) => {
    const res = await (window as any).electronAPI.spaces.delete(user!.id, id);
    if (res.success) { message.success('삭제되었습니다.'); fetchData(); }
    else message.error(res.error || '삭제 실패');
  };

  const columns = [
    ...(user?.role === 'super_admin' ? [{
      title: '회사', dataIndex: 'company_id', key: 'company_id', width: 140,
      render: (v: string | null) => v ? <Tag color="blue">{companyMap[v] || '-'}</Tag> : <Tag color="green">공통</Tag>,
    }] : []),
    { title: '공간명', dataIndex: 'name', key: 'name', width: 180 },
    { title: '위치', dataIndex: 'location', key: 'location', width: 160 },
    { title: '수용인원', dataIndex: 'capacity', key: 'capacity', width: 100, render: (v: number) => `${v || 0}명` },
    { title: '비고', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '상태', dataIndex: 'is_active', key: 'is_active', width: 90,
      render: (v: boolean) => v ? <Tag color="green">활성</Tag> : <Tag>비활성</Tag>,
    },
    ...(isAdmin ? [{
      title: '작업', key: 'action', width: 120,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpen(record)} />
          <Popconfirm title="삭제하시겠습니까?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <EnvironmentOutlined style={{ marginRight: 8 }} />
            공간 관리
          </Title>
          <span style={{ color: '#888' }}>회의실/공간을 등록하면 공간 캘린더에서 예약할 수 있습니다.</span>
        </div>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>공간 등록</Button>
        )}
      </div>

      <Card>
        <ResizableTable columns={columns as any} dataSource={list} rowKey="id" loading={loading}
          pagination={{ showSizeChanger: true, showTotal: (t) => `총 ${t}건` }} />
      </Card>

      <Modal title={editing ? '공간 수정' : '공간 등록'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {user?.role === 'super_admin' && !editing && (
            <Form.Item name="company_id" label="소속 회사" rules={[{ required: true, message: '회사를 선택해주세요' }]} initialValue={companyId || 'shared'}>
              <Select placeholder="회사 선택">
                <Select.Option value="shared">🌐 공통 (전 회사 공유)</Select.Option>
                {companies.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="name" label="공간명" rules={[{ required: true, message: '공간명을 입력하세요' }]}>
            <Input placeholder="예: 대회의실" />
          </Form.Item>
          <Form.Item name="location" label="위치">
            <Input placeholder="예: 본사 3층" />
          </Form.Item>
          <Form.Item name="capacity" label="수용인원">
            <InputNumber min={0} max={500} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="비고">
            <Input.TextArea rows={3} placeholder="장비/특이사항 등" />
          </Form.Item>
          <Form.Item name="is_active" label="활성 상태" valuePropName="checked">
            <Switch checkedChildren="활성" unCheckedChildren="비활성" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>취소</Button>
              <Button type="primary" htmlType="submit">{editing ? '수정' : '등록'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SpaceManagement;
