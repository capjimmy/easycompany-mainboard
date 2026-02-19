import React, { useState, useEffect } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, Select, Tag, message,
  Card, Typography, Popconfirm, Switch, Avatar
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined,
  SearchOutlined, ReloadOutlined
} from '@ant-design/icons';

import { useAuthStore } from '../../store/authStore';
import type { User } from '../../../shared/types';

const { Title } = Typography;
const { Option } = Select;

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  // 사용자 목록 로드
  const loadUsers = async () => {
    if (!currentUser?.id) return;

    setLoading(true);
    try {
      const result = await window.electronAPI.users.getAll(currentUser.id);
      if (result.success) {
        setUsers(result.users || []);
      } else {
        message.error(result.error || '사용자 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentUser?.id]);

  // 사용자 생성/수정
  const handleSubmit = async (values: any) => {
    if (!currentUser?.id) return;

    try {
      if (editingUser) {
        // 수정
        const result = await window.electronAPI.users.update(
          currentUser.id,
          editingUser.id,
          values
        );
        if (result.success) {
          message.success('사용자가 수정되었습니다.');
          setModalVisible(false);
          loadUsers();
        } else {
          message.error(result.error);
        }
      } else {
        // 생성
        const result = await window.electronAPI.users.create(currentUser.id, values);
        if (result.success) {
          message.success('사용자가 생성되었습니다.');
          setModalVisible(false);
          loadUsers();
        } else {
          message.error(result.error);
        }
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    }
  };

  // 사용자 삭제
  const handleDelete = async (userId: string) => {
    if (!currentUser?.id) return;

    try {
      const result = await window.electronAPI.users.delete(currentUser.id, userId);
      if (result.success) {
        message.success('사용자가 삭제되었습니다.');
        loadUsers();
      } else {
        message.error(result.error);
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    }
  };

  // 활성화 상태 변경
  const handleToggleActive = async (userId: string, isActive: boolean) => {
    if (!currentUser?.id) return;

    try {
      const result = await window.electronAPI.users.update(
        currentUser.id,
        userId,
        { is_active: isActive }
      );
      if (result.success) {
        message.success(isActive ? '사용자가 활성화되었습니다.' : '사용자가 비활성화되었습니다.');
        loadUsers();
      } else {
        message.error(result.error);
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    }
  };

  // 모달 열기
  const openModal = (user?: User) => {
    setEditingUser(user || null);
    if (user) {
      form.setFieldsValue({
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const roleLabels: Record<string, { label: string; color: string }> = {
    super_admin: { label: '슈퍼관리자', color: 'red' },
    admin: { label: '관리자', color: 'blue' },
    user: { label: '일반사원', color: 'default' },
  };

  const columns = [
    {
      title: '사용자',
      key: 'user',
      render: (_: any, record: User) => (
        <Space>
          <Avatar
            style={{
              background: record.role === 'super_admin' ? '#ff4d4f' :
                record.role === 'company_admin' ? '#1890ff' :
                record.role === 'department_admin' ? '#52c41a' : '#722ed1',
            }}
            icon={<UserOutlined />}
          />
          <div>
            <div style={{ fontWeight: 500 }}>{record.name}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{record.username}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => email || '-',
    },
    {
      title: '역할',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={roleLabels[role]?.color}>
          {roleLabels[role]?.label || role}
        </Tag>
      ),
    },
    {
      title: '회사',
      dataIndex: 'company_name',
      key: 'company_name',
      render: (name: string) => name || '-',
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean, record: User) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleToggleActive(record.id, checked)}
          disabled={record.role === 'super_admin'}
        />
      ),
    },
    {
      title: '마지막 로그인',
      dataIndex: 'last_login',
      key: 'last_login',
      render: (date: string) => date ? new Date(date).toLocaleString('ko-KR') : '-',
    },
    {
      title: '작업',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
            disabled={record.role === 'super_admin' && currentUser?.role !== 'super_admin'}
          />
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="삭제"
            cancelText="취소"
            disabled={record.role === 'super_admin'}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.role === 'super_admin'}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>사용자 관리</Title>
          <span style={{ color: '#888' }}>시스템 사용자를 관리합니다.</span>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadUsers}>
            새로고침
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            사용자 추가
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 사용자 추가/수정 모달 */}
      <Modal
        title={editingUser ? '사용자 수정' : '사용자 추가'}
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
            name="username"
            label="사용자명"
            rules={[{ required: true, message: '사용자명을 입력해주세요.' }]}
          >
            <Input
              placeholder="사용자명 (로그인 ID)"
              disabled={!!editingUser}
            />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              name="password"
              label="비밀번호"
              rules={[{ required: true, message: '비밀번호를 입력해주세요.' }]}
            >
              <Input.Password placeholder="비밀번호" />
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label="이름"
            rules={[{ required: true, message: '이름을 입력해주세요.' }]}
          >
            <Input placeholder="실명" />
          </Form.Item>

          <Form.Item
            name="email"
            label="이메일"
          >
            <Input placeholder="이메일 주소" />
          </Form.Item>

          <Form.Item
            name="role"
            label="역할"
            rules={[{ required: true, message: '역할을 선택해주세요.' }]}
            initialValue="user"
          >
            <Select>
              {currentUser?.role === 'super_admin' && (
                <Option value="super_admin">슈퍼관리자</Option>
              )}
              <Option value="admin">관리자</Option>
              <Option value="user">일반사원</Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>취소</Button>
              <Button type="primary" htmlType="submit">
                {editingUser ? '수정' : '추가'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
