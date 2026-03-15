import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Table, Space, Input, message, Popconfirm,
  Modal, Form, Tag, Select,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, DeleteOutlined, TeamOutlined, EyeOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const CLIENT_TYPE_OPTIONS = [
  { value: 'sales', label: '매출거래처' },
  { value: 'purchase', label: '매입거래처' },
  { value: 'both', label: '겸용' },
];

const CLIENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  sales: { label: '매출', color: 'blue' },
  purchase: { label: '매입', color: 'orange' },
  both: { label: '겸용', color: 'green' },
};

const ClientList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterClientType, setFilterClientType] = useState<string | undefined>(undefined);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();

  const loadClients = async (search?: string, clientType?: string) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (search) filters.search = search;
      if (clientType) filters.client_type = clientType;
      const result = await window.electronAPI.clients.getAll(user.id, filters);
      if (result.success) {
        setClients(result.clients || []);
      } else {
        message.error(result.error || '거래처 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
      message.error('거래처 목록 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [user?.id]);

  const handleSearch = () => {
    loadClients(searchText, filterClientType);
  };

  const handleReset = () => {
    setSearchText('');
    setFilterClientType(undefined);
    loadClients();
  };

  const handleCreate = async (values: any) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.clients.create(user.id, values);
      if (result.success) {
        message.success('거래처가 등록되었습니다.');
        setCreateModalVisible(false);
        createForm.resetFields();
        loadClients(searchText, filterClientType);
      } else {
        message.error(result.error || '등록에 실패했습니다.');
      }
    } catch (err) {
      message.error('거래처 등록 실패');
    }
  };

  const handleDelete = async (clientId: string) => {
    if (!user?.id) return;
    try {
      const result = await window.electronAPI.clients.delete(user.id, clientId);
      if (result.success) {
        message.success('거래처가 삭제되었습니다.');
        loadClients(searchText, filterClientType);
      } else {
        message.error(result.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      message.error('거래처 삭제 실패');
    }
  };

  const handleExportCSV = () => {
    if (clients.length === 0) {
      message.warning('내보낼 데이터가 없습니다.');
      return;
    }

    const BOM = '\uFEFF';
    const headers = ['거래처명', '사업자번호', '거래처유형', '주소', '전화', '총계약금', '기성금(수금액)', '미수금', '수금률(%)','비고'];
    const rows = clients.map((c: any) => {
      const totalContract = c.total_contract_amount || 0;
      const received = c.received_amount || 0;
      const outstanding = c.outstanding_amount || 0;
      const rate = c.collection_rate || 0;
      const typeLabel = CLIENT_TYPE_CONFIG[c.client_type]?.label || c.client_type || '겸용';
      return [
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.business_number || '').replace(/"/g, '""')}"`,
        `"${typeLabel}"`,
        `"${(c.address || '').replace(/"/g, '""')}"`,
        `"${(c.phone || '').replace(/"/g, '""')}"`,
        totalContract,
        received,
        outstanding,
        rate.toFixed(1),
        `"${(c.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csv = BOM + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `거래처목록_${dayjs().format('YYYYMMDD')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('CSV 파일이 다운로드되었습니다.');
  };

  const columns = [
    {
      title: '거래처명',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <a onClick={() => navigate(`/clients/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '유형',
      dataIndex: 'client_type',
      key: 'client_type',
      width: 90,
      render: (v: string) => {
        const config = CLIENT_TYPE_CONFIG[v] || { label: v || '겸용', color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '사업자번호',
      dataIndex: 'business_number',
      key: 'business_number',
      width: 150,
      render: (v: string) => v || '-',
    },
    {
      title: '대표담당자',
      key: 'primary_contact',
      width: 150,
      render: (_: any, record: any) => {
        const pc = record.primary_contact;
        if (!pc) return <Text type="secondary">-</Text>;
        return (
          <Space direction="vertical" size={0}>
            <Text>{pc.name}</Text>
            {pc.phone && <Text type="secondary" style={{ fontSize: 12 }}>{pc.phone}</Text>}
          </Space>
        );
      },
    },
    {
      title: '전화',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (v: string) => v || '-',
    },
    {
      title: '총계약금',
      key: 'total_contract_amount',
      width: 130,
      align: 'right' as const,
      render: (_: any, record: any) => {
        const v = record.total_contract_amount || 0;
        return v > 0 ? `${v.toLocaleString()}원` : '-';
      },
    },
    {
      title: '기성금',
      key: 'received_amount',
      width: 130,
      align: 'right' as const,
      render: (_: any, record: any) => {
        const v = record.received_amount || 0;
        return v > 0 ? `${v.toLocaleString()}원` : '-';
      },
    },
    {
      title: '미수금',
      key: 'outstanding_amount',
      width: 130,
      align: 'right' as const,
      render: (_: any, record: any) => {
        const v = record.outstanding_amount || 0;
        return v > 0 ? <Text type="danger">{v.toLocaleString()}원</Text> : '-';
      },
    },
    {
      title: '수금률',
      key: 'collection_rate',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const rate = record.collection_rate || 0;
        if ((record.total_contract_amount || 0) === 0) return '-';
        const color = rate >= 100 ? 'green' : rate >= 50 ? 'blue' : 'red';
        return <Tag color={color}>{rate.toFixed(0)}%</Tag>;
      },
    },
    {
      title: '비고',
      dataIndex: 'notes',
      key: 'notes',
      width: 120,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '작업',
      key: 'actions',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/clients/${record.id}`)}
          >
            상세
          </Button>
          <Popconfirm
            title="이 거래처를 삭제하시겠습니까?"
            description="담당자 정보도 함께 삭제됩니다."
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 8 }} />
            거래처 관리
          </Title>
          <span style={{ color: '#888' }}>거래처 및 담당자 정보를 관리합니다.</span>
        </div>
        <Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportCSV}
          >
            Excel 내보내기
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            거래처 추가
          </Button>
        </Space>
      </div>

      {/* 검색 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="거래처명, 사업자번호, 전화번호 검색"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
            allowClear
          />
          <Select
            placeholder="거래처 유형"
            value={filterClientType}
            onChange={(v) => setFilterClientType(v)}
            allowClear
            style={{ width: 140 }}
            options={CLIENT_TYPE_OPTIONS}
          />
          <Button type="primary" onClick={handleSearch}>검색</Button>
          <Button onClick={handleReset}>초기화</Button>
        </Space>
      </Card>

      {/* 테이블 */}
      <Card>
        <Table
          dataSource={clients}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}개`,
          }}
          size="middle"
          scroll={{ x: 1400 }}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onDoubleClick: () => navigate(`/clients/${record.id}`),
          })}
        />
      </Card>

      {/* 거래처 추가 모달 */}
      <Modal
        title="거래처 추가"
        open={createModalVisible}
        onCancel={() => { setCreateModalVisible(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        okText="등록"
        cancelText="취소"
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ client_type: 'both' }}
        >
          <Form.Item
            name="name"
            label="거래처명"
            rules={[{ required: true, message: '거래처명을 입력하세요' }]}
          >
            <Input placeholder="예: 한국토지주택공사" />
          </Form.Item>
          <Form.Item
            name="client_type"
            label="거래처 유형"
            rules={[{ required: true, message: '거래처 유형을 선택하세요' }]}
          >
            <Select options={CLIENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="business_number" label="사업자번호">
            <Input placeholder="000-00-00000" />
          </Form.Item>
          <Form.Item name="phone" label="대표전화">
            <Input placeholder="02-0000-0000" />
          </Form.Item>
          <Form.Item name="address" label="주소">
            <Input placeholder="주소를 입력하세요" />
          </Form.Item>
          <Form.Item name="industry" label="업종">
            <Input placeholder="예: 건설, 공공기관, 금융" />
          </Form.Item>
          <Form.Item name="business_registration_file" label="사업자등록증 파일 경로">
            <Input placeholder="예: C:\문서\사업자등록증.pdf" />
          </Form.Item>
          <Form.Item name="bank_copy_file" label="통장사본 파일 경로">
            <Input placeholder="예: C:\문서\통장사본.pdf" />
          </Form.Item>
          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} placeholder="메모" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientList;
