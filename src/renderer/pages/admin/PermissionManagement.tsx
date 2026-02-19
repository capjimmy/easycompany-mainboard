import React, { useState, useEffect } from 'react';
import {
  Table, Card, Typography, Select, Checkbox, Button, Space, message, Tag
} from 'antd';
import { SaveOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';

import { useAuthStore } from '../../store/authStore';
import { MENU_STRUCTURE, DEFAULT_PERMISSIONS } from '../../../shared/constants/menu';
import type { User, MenuPermission } from '../../../shared/types';

const { Title } = Typography;
const { Option } = Select;

const PermissionManagement: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Record<string, MenuPermission>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 사용자 목록 로드
  const loadUsers = async () => {
    if (!currentUser?.id) return;

    setLoading(true);
    try {
      const result = await window.electronAPI.users.getAll(currentUser.id);
      if (result.success) {
        // 슈퍼관리자 제외 (권한 설정 불필요)
        const filteredUsers = (result.users || []).filter((u: User) => u.role !== 'super_admin');
        setUsers(filteredUsers);
      }
    } catch (err) {
      message.error('사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentUser?.id]);

  // 사용자 선택 시 권한 로드
  const handleUserSelect = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setSelectedUser(user);

    // 기존 권한이 있으면 사용, 없으면 기본 권한 사용
    if (user.permissions && Object.keys(user.permissions).length > 0) {
      setPermissions(user.permissions);
    } else {
      // 역할에 따른 기본 권한
      const defaultPerms = DEFAULT_PERMISSIONS[user.role] || DEFAULT_PERMISSIONS.employee;
      setPermissions(defaultPerms);
    }
  };

  // 권한 변경
  const handlePermissionChange = (menuKey: string, permType: keyof MenuPermission, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [menuKey]: {
        ...prev[menuKey],
        [permType]: checked,
      },
    }));
  };

  // 전체 선택/해제
  const handleSelectAll = (menuKey: string, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [menuKey]: {
        view: checked,
        create: checked,
        edit: checked,
        delete: checked,
      },
    }));
  };

  // 권한 저장
  const handleSave = async () => {
    if (!currentUser?.id || !selectedUser) return;

    setSaving(true);
    try {
      const result = await window.electronAPI.users.setPermissions(
        currentUser.id,
        selectedUser.id,
        permissions
      );

      if (result.success) {
        message.success('권한이 저장되었습니다.');
        loadUsers();
      } else {
        message.error(result.error || '권한 저장에 실패했습니다.');
      }
    } catch (err) {
      message.error('오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 기본 권한으로 초기화
  const handleReset = () => {
    if (!selectedUser) return;

    const defaultPerms = DEFAULT_PERMISSIONS[selectedUser.role] || DEFAULT_PERMISSIONS.employee;
    setPermissions(defaultPerms);
    message.info('기본 권한으로 초기화되었습니다.');
  };

  // 메뉴 아이템 플랫하게 펼치기
  const flattenMenuItems = () => {
    const items: { key: string; label: string; parent: string }[] = [];

    MENU_STRUCTURE.forEach((menu) => {
      if (menu.children) {
        menu.children.forEach((child) => {
          items.push({
            key: child.key,
            label: child.label,
            parent: menu.label,
          });
        });
      }
    });

    return items;
  };

  const menuItems = flattenMenuItems();

  const columns = [
    {
      title: '메뉴',
      key: 'menu',
      render: (_: any, record: any) => (
        <div>
          <Tag color="blue">{record.parent}</Tag>
          <span style={{ marginLeft: 8 }}>{record.label}</span>
        </div>
      ),
    },
    {
      title: '조회',
      dataIndex: 'view',
      key: 'view',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Checkbox
          checked={permissions[record.key]?.view || false}
          onChange={(e) => handlePermissionChange(record.key, 'view', e.target.checked)}
        />
      ),
    },
    {
      title: '생성',
      dataIndex: 'create',
      key: 'create',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Checkbox
          checked={permissions[record.key]?.create || false}
          onChange={(e) => handlePermissionChange(record.key, 'create', e.target.checked)}
        />
      ),
    },
    {
      title: '수정',
      dataIndex: 'edit',
      key: 'edit',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Checkbox
          checked={permissions[record.key]?.edit || false}
          onChange={(e) => handlePermissionChange(record.key, 'edit', e.target.checked)}
        />
      ),
    },
    {
      title: '삭제',
      dataIndex: 'delete',
      key: 'delete',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Checkbox
          checked={permissions[record.key]?.delete || false}
          onChange={(e) => handlePermissionChange(record.key, 'delete', e.target.checked)}
        />
      ),
    },
    {
      title: '전체',
      key: 'all',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const perm = permissions[record.key];
        const allChecked = perm?.view && perm?.create && perm?.edit && perm?.delete;
        const someChecked = perm?.view || perm?.create || perm?.edit || perm?.delete;

        return (
          <Checkbox
            checked={allChecked}
            indeterminate={someChecked && !allChecked}
            onChange={(e) => handleSelectAll(record.key, e.target.checked)}
          />
        );
      },
    },
  ];

  const roleLabels: Record<string, { label: string; color: string }> = {
    admin: { label: '관리자', color: 'blue' },
    user: { label: '일반사원', color: 'default' },
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>권한 설정</Title>
        <span style={{ color: '#888' }}>사용자별 메뉴 접근 권한을 설정합니다.</span>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" style={{ width: '100%' }}>
          <div style={{ minWidth: 300 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              <UserOutlined style={{ marginRight: 8 }} />
              사용자 선택
            </div>
            <Select
              placeholder="권한을 설정할 사용자를 선택하세요"
              style={{ width: '100%' }}
              onChange={handleUserSelect}
              loading={loading}
              value={selectedUser?.id}
            >
              {users.map((user) => (
                <Option key={user.id} value={user.id}>
                  <Space>
                    <span>{user.name}</span>
                    <Tag color={roleLabels[user.role]?.color}>
                      {roleLabels[user.role]?.label || user.role}
                    </Tag>
                    <span style={{ color: '#888' }}>({user.username})</span>
                  </Space>
                </Option>
              ))}
            </Select>
          </div>

          {selectedUser && (
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                초기화
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
              >
                저장
              </Button>
            </Space>
          )}
        </Space>
      </Card>

      {selectedUser && (
        <Card>
          <Table
            columns={columns}
            dataSource={menuItems}
            rowKey="key"
            pagination={false}
            size="middle"
          />
        </Card>
      )}
    </div>
  );
};

export default PermissionManagement;
