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
  const { user } = useAuthStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [form] = Form.useForm();

  const fetchDepartments = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.departments.getAll(user.id);
      if (result.success) {
        setDepartments(result.departments || []);
      } else {
        message.error(result.error || '부서 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
      message.error('부서 목록 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [user?.id]);

  const handleAdd = () => {
    setEditingDepartment(null);
    form.resetFields();
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
    } catch (err) {
      message.error('삭제 중 오류 발생');
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
    } catch (err) {
      message.error('처리 중 오류 발생');
    }
  };

  const columns = [
    {
      title: '부서코드',
      dataIndex: 'code',
      key: 'code',
      width: 120,
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
        <Table
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
            name="code"
            label="부서 코드"
            rules={[{ required: true, message: '부서 코드를 입력하세요' }]}
          >
            <Input placeholder="예: DEV, SALES" />
          </Form.Item>

          <Form.Item
            name="name"
            label="부서명"
            rules={[{ required: true, message: '부서명을 입력하세요' }]}
          >
            <Input placeholder="부서명을 입력하세요" />
          </Form.Item>

          <Form.Item
            name="parent_id"
            label="상위 부서"
          >
            <Select placeholder="상위 부서 선택 (선택사항)" allowClear>
              {departments
                .filter((d) => d.id !== editingDepartment?.id)
                .map((d) => (
                  <Select.Option key={d.id} value={d.id}>
                    {d.name}
                  </Select.Option>
                ))}
            </Select>
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
