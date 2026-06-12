import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Button, Table, Space, Input, message, Modal, Form, Popconfirm, Select, Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;

const VehicleManagement: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  // 슈퍼관리자는 selectedCompanyId가 없으면 모든 회사 / company_admin 등은 자기 회사
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
      const res = await (window as any).electronAPI.vehicles.getAll(user.id, filters);
      if (res.success) setList(res.data || []);
      else message.error(res.error || '조회 실패');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user?.id, selectedCompanyId]);

  useEffect(() => {
    // 회사 목록 로드 (super_admin이 등록 시 회사 선택용)
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
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (!user?.id) return;
    try {
      // 등록 시: form에 'shared'면 NULL(공통), 그 외 값이면 해당 회사, 없으면 현재 사용자 회사
      let targetCompanyId: string | null;
      if (values.company_id === 'shared') {
        targetCompanyId = null;
      } else {
        targetCompanyId = values.company_id || companyId || user?.company_id || null;
      }
      const payload = { ...values };
      delete payload.company_id;
      const res = editing
        ? await (window as any).electronAPI.vehicles.update(user.id, editing.id, payload)
        : await (window as any).electronAPI.vehicles.create(user.id, { ...payload, company_id: targetCompanyId });
      if (res.success) {
        message.success(editing ? '수정되었습니다.' : '등록되었습니다.');
        setModalOpen(false);
        fetchData();
      } else message.error(res.error || '저장 실패');
    } catch (err: any) { message.error(err?.message || '저장 중 오류'); }
  };

  const handleDelete = async (id: string) => {
    const res = await (window as any).electronAPI.vehicles.delete(user!.id, id);
    if (res.success) { message.success('삭제되었습니다.'); fetchData(); }
    else message.error(res.error || '삭제 실패');
  };

  const columns = [
    ...(user?.role === 'super_admin' ? [{
      title: '회사', dataIndex: 'company_id', key: 'company_id', width: 140,
      render: (v: string | null) => v ? <Tag color="blue">{companyMap[v] || '-'}</Tag> : <Tag color="green">공통</Tag>,
    }] : []),
    { title: '차량번호', dataIndex: 'plate_number', key: 'plate_number', width: 140 },
    { title: '차종', dataIndex: 'vehicle_type', key: 'vehicle_type', width: 120 },
    { title: '모델', dataIndex: 'model', key: 'model', width: 160 },
    { title: '색상', dataIndex: 'color', key: 'color', width: 100 },
    { title: '비고', dataIndex: 'notes', key: 'notes', ellipsis: true },
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
          <Title level={4} style={{ margin: 0 }}>차량 관리</Title>
          <span style={{ color: '#888' }}>회사 차량을 등록하고 관리합니다.</span>
        </div>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>차량 등록</Button>
        )}
      </div>

      <Card>
        <ResizableTable columns={columns as any} dataSource={list} rowKey="id" loading={loading}
          pagination={{ showSizeChanger: true, showTotal: (t) => `총 ${t}건` }} />
      </Card>

      <Modal title={editing ? '차량 수정' : '차량 등록'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {user?.role === 'super_admin' && !editing && (
            <Form.Item name="company_id" label="소속 회사" rules={[{ required: true, message: '회사를 선택해주세요' }]} initialValue={companyId || 'shared'}>
              <Select placeholder="회사 선택">
                <Select.Option value="shared">🌐 공통 (전 회사 공유)</Select.Option>
                {companies.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="plate_number" label="차량번호" rules={[{ required: true }]}>
            <Input placeholder="예: 12가 3456" />
          </Form.Item>
          <Form.Item name="vehicle_type" label="차종">
            <Input placeholder="예: 승용/SUV/트럭" />
          </Form.Item>
          <Form.Item name="model" label="모델">
            <Input placeholder="예: 아반떼" />
          </Form.Item>
          <Form.Item name="color" label="색상">
            <Input placeholder="예: 흰색" />
          </Form.Item>
          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} />
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

export default VehicleManagement;
