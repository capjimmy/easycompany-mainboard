import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Table, Button, Modal, Form, Input, Select, message, Space, Tag, Empty
} from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, BookOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { MENU_STRUCTURE } from '../../../shared/constants/menu';

const { Title } = Typography;
const { TextArea } = Input;

declare global {
  interface Window {
    electronAPI: any;
  }
}

// 메뉴 키 목록 추출 (flat)
const getAllMenuKeys = () => {
  const keys: { key: string; label: string; group: string }[] = [];
  for (const group of MENU_STRUCTURE) {
    if (group.children) {
      for (const child of group.children) {
        keys.push({ key: child.key, label: child.label, group: group.label });
      }
    } else if (group.path) {
      keys.push({ key: group.key, label: group.label, group: '' });
    }
  }
  return keys;
};

const ManualManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [manuals, setManuals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingManual, setEditingManual] = useState<any>(null);
  const [form] = Form.useForm();

  const menuKeys = getAllMenuKeys();

  const fetchManuals = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.menuManuals.getAll(user.id, user.company_id);
      if (result.success) {
        setManuals(result.manuals || []);
      }
    } catch {
      message.error('매뉴얼 목록 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManuals();
  }, [user?.company_id]);

  const handleAdd = () => {
    setEditingManual(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingManual(record);
    form.setFieldsValue({
      menu_key: record.menu_key,
      title: record.title,
      content: record.content,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await window.electronAPI.menuManuals.delete(user!.id, id);
      message.success('삭제되었습니다.');
      fetchManuals();
    } catch {
      message.error('삭제 실패');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await window.electronAPI.menuManuals.save(user!.id, {
        company_id: user!.company_id,
        menu_key: values.menu_key,
        title: values.title,
        content: values.content,
        updated_by: user!.id,
      });
      message.success('저장되었습니다.');
      setModalVisible(false);
      fetchManuals();
    } catch {
      // validation error
    }
  };

  // 메뉴 키에 대한 레이블 찾기
  const getMenuLabel = (menuKey: string) => {
    const item = menuKeys.find(m => m.key === menuKey);
    return item ? `${item.group} > ${item.label}` : menuKey;
  };

  // 매뉴얼이 등록된 메뉴 키 셋
  const registeredKeys = new Set(manuals.map(m => m.menu_key));

  const columns = [
    {
      title: '메뉴',
      dataIndex: 'menu_key',
      key: 'menu_key',
      render: (key: string) => <Tag color="blue">{getMenuLabel(key)}</Tag>,
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '내용 미리보기',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text: string) => {
        const plain = text.replace(/<[^>]*>/g, '');
        return plain.length > 80 ? plain.slice(0, 80) + '...' : plain;
      },
    },
    {
      title: '수정일',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (d: string) => d ? new Date(d).toLocaleString('ko-KR') : '-',
    },
    {
      title: '작업',
      key: 'actions',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            수정
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
            삭제
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <BookOutlined style={{ marginRight: 8 }} />
          메뉴별 매뉴얼 관리
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          매뉴얼 추가
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={manuals}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{ emptyText: <Empty description="등록된 매뉴얼이 없습니다." /> }}
        />
      </Card>

      <Modal
        title={editingManual ? '매뉴얼 수정' : '매뉴얼 추가'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        okText="저장"
        cancelText="취소"
        width={800}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="menu_key"
            label="대상 메뉴"
            rules={[{ required: true, message: '메뉴를 선택해주세요.' }]}
          >
            <Select
              placeholder="메뉴를 선택하세요"
              showSearch
              optionFilterProp="label"
              disabled={!!editingManual}
              options={menuKeys
                .filter(m => !registeredKeys.has(m.key) || editingManual?.menu_key === m.key)
                .map(m => ({
                  value: m.key,
                  label: `${m.group} > ${m.label}`,
                }))}
            />
          </Form.Item>

          <Form.Item
            name="title"
            label="제목"
            rules={[{ required: true, message: '제목을 입력해주세요.' }]}
          >
            <Input placeholder="매뉴얼 제목" />
          </Form.Item>

          <Form.Item
            name="content"
            label="내용 (HTML 지원)"
            rules={[{ required: true, message: '내용을 입력해주세요.' }]}
          >
            <TextArea
              rows={15}
              placeholder="매뉴얼 내용을 입력하세요. HTML 태그를 사용할 수 있습니다."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ManualManagement;
