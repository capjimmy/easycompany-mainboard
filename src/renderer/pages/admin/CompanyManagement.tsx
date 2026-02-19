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
  representative: string;
  address: string;
  phone: string;
  email: string;
  user_count: number;
  created_at: string;
  status: 'active' | 'inactive';
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

  // 회사 목록 조회 (더미 데이터)
  const fetchCompanies = async () => {
    setLoading(true);
    // TODO: API 연동 시 실제 데이터로 교체
    const dummyData: Company[] = [
      {
        id: '1',
        name: '이지컨설턴트',
        business_number: '123-45-67890',
        representative: '홍길동',
        address: '서울시 강남구 테헤란로 123',
        phone: '02-1234-5678',
        email: 'contact@easyconsultant.co.kr',
        user_count: 25,
        created_at: '2024-01-01',
        status: 'active',
      },
      {
        id: '2',
        name: '테스트회사',
        business_number: '987-65-43210',
        representative: '김철수',
        address: '서울시 서초구 서초대로 456',
        phone: '02-9876-5432',
        email: 'test@testcompany.co.kr',
        user_count: 10,
        created_at: '2024-06-01',
        status: 'active',
      },
    ];
    setCompanies(dummyData);
    setLoading(false);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleAdd = () => {
    setEditingCompany(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Company) => {
    setEditingCompany(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleView = (record: Company) => {
    setSelectedCompany(record);
    setDetailVisible(true);
  };

  const handleDelete = async (id: string) => {
    // TODO: API 연동
    setCompanies(companies.filter((c) => c.id !== id));
    message.success('회사가 삭제되었습니다.');
  };

  const handleSubmit = async (values: any) => {
    if (editingCompany) {
      // 수정
      setCompanies(
        companies.map((c) =>
          c.id === editingCompany.id ? { ...c, ...values } : c
        )
      );
      message.success('회사 정보가 수정되었습니다.');
    } else {
      // 추가
      const newCompany: Company = {
        id: Date.now().toString(),
        ...values,
        user_count: 0,
        created_at: new Date().toISOString().split('T')[0],
        status: 'active',
      };
      setCompanies([...companies, newCompany]);
      message.success('회사가 추가되었습니다.');
    }
    setModalVisible(false);
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
    },
    {
      title: '대표자',
      dataIndex: 'representative',
      key: 'representative',
      width: 100,
    },
    {
      title: '사용자 수',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 100,
      render: (count: number) => <Tag color="blue">{count}명</Tag>,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '활성' : '비활성'}
        </Tag>
      ),
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
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="회사 삭제"
            description="이 회사를 삭제하시겠습니까? 모든 관련 데이터가 삭제됩니다."
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
            rules={[{ required: true, message: '사업자등록번호를 입력하세요' }]}
          >
            <Input placeholder="000-00-00000" />
          </Form.Item>

          <Form.Item
            name="representative"
            label="대표자"
            rules={[{ required: true, message: '대표자명을 입력하세요' }]}
          >
            <Input placeholder="대표자명" />
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

          <Form.Item
            name="email"
            label="이메일"
          >
            <Input placeholder="company@example.com" />
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
            <Descriptions.Item label="사업자등록번호">{selectedCompany.business_number}</Descriptions.Item>
            <Descriptions.Item label="대표자">{selectedCompany.representative}</Descriptions.Item>
            <Descriptions.Item label="주소">{selectedCompany.address}</Descriptions.Item>
            <Descriptions.Item label="전화번호">{selectedCompany.phone}</Descriptions.Item>
            <Descriptions.Item label="이메일">{selectedCompany.email}</Descriptions.Item>
            <Descriptions.Item label="등록 사용자 수">{selectedCompany.user_count}명</Descriptions.Item>
            <Descriptions.Item label="생성일">{selectedCompany.created_at}</Descriptions.Item>
            <Descriptions.Item label="상태">
              <Tag color={selectedCompany.status === 'active' ? 'green' : 'red'}>
                {selectedCompany.status === 'active' ? '활성' : '비활성'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default CompanyManagement;
