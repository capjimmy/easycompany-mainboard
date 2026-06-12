import ResizableTable from '../../components/ResizableTable';
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tag,
  Popconfirm,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { Title } = Typography;

interface Department {
  id: string;
  name: string;
  code: string;
  parent_id?: string;
  company_id?: string;
  company_name?: string;
  manager_id?: string;
  manager_name?: string;
  member_count?: number;
  created_at: string;
}

const DepartmentManagement: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [form] = Form.useForm();

  const fetchDepartments = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const filterCompanyId = user.role === 'super_admin' ? selectedCompanyId : undefined;
      const [depResult, compResult] = await Promise.all([
        (window as any).electronAPI.departments.getAll(user.id, filterCompanyId),
        (window as any).electronAPI.companies.getAll(user.id),
      ]);
      if (depResult.success) setDepartments(depResult.departments || []);
      else message.error(depResult.error || '부서 목록을 불러올 수 없습니다.');
      if (compResult.success) setCompanies(compResult.companies || []);
    } catch (err: any) {
      console.error('Failed to load departments:', err);
      message.error(err?.message || '부서 목록 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [user?.id, selectedCompanyId]);

  const defaultCompanyId = selectedCompanyId || user?.company_id || companies[0]?.id;

  const handleAdd = () => {
    setEditingDepartment(null);
    form.resetFields();
    form.setFieldsValue({ company_id: defaultCompanyId });
    setModalVisible(true);
  };

  const handleEdit = (record: Department) => {
    setEditingDepartment(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) return;
    try {
      const result = await (window as any).electronAPI.departments.delete(user.id, id);
      if (result.success) {
        message.success('부서가 삭제되었습니다.');
        fetchDepartments();
      } else {
        message.error(result.error || '삭제 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '삭제 중 오류 발생');
    }
  };

  const handleSubmit = async (values: any) => {
    if (!user?.id) return;
    try {
      if (editingDepartment) {
        const result = await (window as any).electronAPI.departments.update(user.id, editingDepartment.id, values);
        if (result.success) {
          message.success('부서 정보가 수정되었습니다.');
          fetchDepartments();
        } else {
          message.error(result.error || '수정 실패');
        }
      } else {
        const result = await (window as any).electronAPI.departments.create(user.id, values);
        if (result.success) {
          message.success('부서가 추가되었습니다.');
          fetchDepartments();
        } else {
          message.error(result.error || '추가 실패');
        }
      }
      setModalVisible(false);
    } catch (err: any) {
      message.error(err?.message || '처리 중 오류 발생');
    }
  };

  const columns = [
    {
      title: '회사',
      dataIndex: 'company_name',
      key: 'company_name',
      width: 160,
      render: (v: string) => v || '-',
    },
    {
      title: '부서명',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '인원수',
      dataIndex: 'member_count',
      key: 'member_count',
      width: 100,
      render: (count: number) => (
        <Tag icon={<TeamOutlined />} color="blue">
          {count ?? 0}명
        </Tag>
      ),
    },
    {
      title: '생성일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '관리',
      key: 'action',
      width: 150,
      render: (_: any, record: Department) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="부서 삭제"
            description="이 부서를 삭제하시겠습니까? 소속 직원이 있으면 삭제할 수 없습니다."
            onConfirm={() => handleDelete(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>부서 관리</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          부서 추가
        </Button>
      </div>

      <Card>
        <ResizableTable
          columns={columns}
          dataSource={departments}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingDepartment ? '부서 수정' : '부서 추가'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="company_id"
            label="소속 회사"
            rules={[{ required: true, message: '회사를 선택하세요' }]}
          >
            <Select
              placeholder="회사 선택"
              disabled={user?.role !== 'super_admin'}
            >
              {companies.map((c: any) => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="부서명"
            rules={[{ required: true, message: '부서명을 입력하세요' }]}
          >
            <Input placeholder="부서명을 입력하세요" />
          </Form.Item>

          <Form.Item
            name="description"
            label="설명"
          >
            <Input placeholder="부서 설명 (선택사항)" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>취소</Button>
              <Button type="primary" htmlType="submit">
                {editingDepartment ? '수정' : '추가'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DepartmentManagement;
