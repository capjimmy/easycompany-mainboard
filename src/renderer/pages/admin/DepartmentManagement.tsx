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

const { Title } = Typography;

interface Department {
  id: string;
  name: string;
  code: string;
  parent_id?: string;
  manager_id?: string;
  manager_name?: string;
  member_count: number;
  created_at: string;
}

const DepartmentManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [form] = Form.useForm();

  // 부서 목록 조회 (더미 데이터)
  const fetchDepartments = async () => {
    setLoading(true);
    // TODO: API 연동 시 실제 데이터로 교체
    const dummyData: Department[] = [
      {
        id: '1',
        name: '경영지원팀',
        code: 'MGMT',
        member_count: 5,
        created_at: '2024-01-01',
      },
      {
        id: '2',
        name: '개발팀',
        code: 'DEV',
        member_count: 12,
        created_at: '2024-01-01',
      },
      {
        id: '3',
        name: '연구팀',
        code: 'RND',
        member_count: 8,
        created_at: '2024-01-01',
      },
      {
        id: '4',
        name: '영업팀',
        code: 'SALES',
        member_count: 6,
        created_at: '2024-01-01',
      },
    ];
    setDepartments(dummyData);
    setLoading(false);
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

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
    // TODO: API 연동
    setDepartments(departments.filter((d) => d.id !== id));
    message.success('부서가 삭제되었습니다.');
  };

  const handleSubmit = async (values: any) => {
    if (editingDepartment) {
      // 수정
      setDepartments(
        departments.map((d) =>
          d.id === editingDepartment.id ? { ...d, ...values } : d
        )
      );
      message.success('부서 정보가 수정되었습니다.');
    } else {
      // 추가
      const newDepartment: Department = {
        id: Date.now().toString(),
        ...values,
        member_count: 0,
        created_at: new Date().toISOString().split('T')[0],
      };
      setDepartments([...departments, newDepartment]);
      message.success('부서가 추가되었습니다.');
    }
    setModalVisible(false);
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
          {count}명
        </Tag>
      ),
    },
    {
      title: '생성일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
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
