import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Tag,
  Popconfirm,
  Typography,
  Descriptions,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BankOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;

interface Company {
  id: string;
  name: string;
  business_number: string;
  address: string;
  phone: string;
  user_count?: number;
  department_count?: number;
  created_at: string;
}

const CompanyManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [form] = Form.useForm();

  const fetchCompanies = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.companies.getAll(user.id);
      if (result.success && result.companies) {
        // 각 회사별 사용자 수 조회
        const companiesWithCounts = await Promise.all(
          result.companies.map(async (c: any) => {
            let userCount = 0;
            let deptCount = 0;
            try {
              const usersResult = await window.electronAPI.companies.getUsers(user.id, c.id);
              if (usersResult.success) userCount = usersResult.users?.length || 0;
              const deptsResult = await window.electronAPI.companies.getDepartments(user.id, c.id);
              if (deptsResult.success) deptCount = deptsResult.departments?.length || 0;
            } catch (_) {}
            return {
              ...c,
              user_count: userCount,
              department_count: deptCount,
            };
          })
        );
        setCompanies(companiesWithCounts);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
      message.error('회사 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [user?.id]);

  const handleAdd = () => {
    setEditingCompany(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Company) => {
    setEditingCompany(record);
    form.setFieldsValue({
      name: record.name,
      business_number: record.business_number,
      address: record.address,
      phone: record.phone,
    });
    setModalVisible(true);
  };

  const handleView = (record: Company) => {
    setSelectedCompany(record);
    setDetailVisible(true);
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.companies.delete(user.id, id);
      if (result.success) {
        message.success('회사가 삭제되었습니다.');
        await fetchCompanies();
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to delete company:', err);
      message.error('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSubmit = async (values: any) => {
    if (!user?.id) return;
    try {
      if (editingCompany) {
        const result = await window.electronAPI.companies.update(user.id, editingCompany.id, values);
        if (result.success) {
          message.success('회사 정보가 수정되었습니다.');
          setModalVisible(false);
          await fetchCompanies();
        } else {
          message.error(result.error || '수정에 실패했습니다.');
        }
      } else {
        const result = await window.electronAPI.companies.create(user.id, values);
        if (result.success) {
          message.success('회사가 추가되었습니다.');
          setModalVisible(false);
          await fetchCompanies();
        } else {
          message.error(result.error || '추가에 실패했습니다.');
        }
      }
    } catch (err) {
      console.error('Failed to save company:', err);
      message.error('저장 중 오류가 발생했습니다.');
    }
  };

  const columns = [
    {
      title: '회사명',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <BankOutlined />
          {name}
        </Space>
      ),
    },
    {
      title: '사업자번호',
      dataIndex: 'business_number',
      key: 'business_number',
      width: 150,
      render: (v: string) => v || '-',
    },
    {
      title: '전화번호',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
      render: (v: string) => v || '-',
    },
    {
      title: '사용자 수',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 100,
      render: (count: number) => <Tag color="blue">{count || 0}명</Tag>,
    },
    {
      title: '부서 수',
      dataIndex: 'department_count',
      key: 'department_count',
      width: 100,
      render: (count: number) => <Tag color="green">{count || 0}개</Tag>,
    },
    {
      title: '관리',
      key: 'action',
      width: 150,
      render: (_: any, record: Company) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          />
          {(user?.role === 'super_admin' || (user?.role === 'company_admin' && user?.company_id === record.id)) && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          )}
          {user?.role === 'super_admin' && (
            <Popconfirm
              title="회사 삭제"
              description="이 회사를 삭제하시겠습니까? 모든 관련 데이터가 삭제됩니다."
              onConfirm={() => handleDelete(record.id)}
              okText="삭제"
              cancelText="취소"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>회사 관리</Title>
        {user?.role === 'super_admin' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            회사 추가
          </Button>
        )}
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={companies}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 회사 추가/수정 모달 */}
      <Modal
        title={editingCompany ? '회사 정보 수정' : '회사 추가'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="회사명"
            rules={[{ required: true, message: '회사명을 입력하세요' }]}
          >
            <Input placeholder="회사명을 입력하세요" />
          </Form.Item>

          <Form.Item
            name="business_number"
            label="사업자등록번호"
          >
            <Input placeholder="000-00-00000" />
          </Form.Item>

          <Form.Item
            name="address"
            label="주소"
          >
            <Input placeholder="회사 주소" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="전화번호"
          >
            <Input placeholder="02-0000-0000" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>취소</Button>
              <Button type="primary" htmlType="submit">
                {editingCompany ? '수정' : '추가'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 회사 상세 모달 */}
      <Modal
        title="회사 상세 정보"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            닫기
          </Button>,
        ]}
        width={600}
      >
        {selectedCompany && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="회사명">{selectedCompany.name}</Descriptions.Item>
            <Descriptions.Item label="사업자등록번호">{selectedCompany.business_number || '-'}</Descriptions.Item>
            <Descriptions.Item label="주소">{selectedCompany.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="전화번호">{selectedCompany.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="등록 사용자 수">{selectedCompany.user_count || 0}명</Descriptions.Item>
            <Descriptions.Item label="부서 수">{selectedCompany.department_count || 0}개</Descriptions.Item>
            <Descriptions.Item label="생성일">
              {selectedCompany.created_at ? new Date(selectedCompany.created_at).toLocaleDateString('ko-KR') : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default CompanyManagement;
