import React, { useState, useEffect } from 'react';
import {
  Table, Card, Typography, Select, Checkbox, Button, Space, message, Tag, Segmented, Divider
} from 'antd';
import { SaveOutlined, ReloadOutlined, UserOutlined, TableOutlined, TeamOutlined } from '@ant-design/icons';

import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';
import { MENU_STRUCTURE, DEFAULT_PERMISSIONS } from '../../../shared/constants/menu';
import type { User, MenuPermission } from '../../../shared/types';

const { Title, Text } = Typography;
const { Option } = Select;

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  super_admin: { label: '슈퍼관리자', color: 'red' },
  company_admin: { label: '회사관리자', color: 'blue' },
  department_manager: { label: '부서관리자', color: 'green' },
  employee: { label: '사원', color: 'default' },
};

type ModeType = '역할별 기본권한' | '사용자별 세부권한';

const PermissionManagement: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Record<string, MenuPermission>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<ModeType>('사용자별 세부권한');
  const [selectedRole, setSelectedRole] = useState<string>('employee');

  // 사용자 목록 로드
  const loadUsers = async () => {
    if (!currentUser?.id) return;

    setLoading(true);
    try {
      const result = await window.electronAPI.users.getAll(currentUser.id);
      if (result.success) {
        // 슈퍼관리자 제외, 비활성화 사용자 제외
        const filteredUsers = (result.users || []).filter(
          (u: User) => u.role !== 'super_admin' && u.is_active !== false
        );
        setUsers(filteredUsers);
      }
    } catch (err: any) {
      message.error(err?.message || '사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentUser?.id]);

  // 역할별 모드: 역할 선택 시 해당 역할 사용자의 실제 DB 권한 로드
  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    // 해당 역할의 첫 번째 사용자가 DB에 커스텀 권한이 있으면 그걸 로드
    const roleUser = users.find((u) => u.role === role && u.permissions && Object.keys(u.permissions).length > 0);
    if (roleUser) {
      setPermissions({ ...roleUser.permissions });
    } else {
      // DB에 저장된 게 없으면 코드 기본값
      const defaultPerms = (DEFAULT_PERMISSIONS as any)[role] || DEFAULT_PERMISSIONS.employee;
      setPermissions({ ...defaultPerms });
    }
  };

  // 사용자별 모드: 여러 사용자 선택
  const handleUserSelect = (userIds: string[]) => {
    // 선택이 변경되어 권한이 재설정될 때 경고
    if (selectedUserIds.length > 0 && userIds.length !== selectedUserIds.length) {
      message.warning('선택한 사용자가 변경되어 권한이 재설정됩니다.');
    }
    setSelectedUserIds(userIds);

    if (userIds.length === 1) {
      // 단일 사용자: 기존 권한 로드
      const user = users.find((u) => u.id === userIds[0]);
      if (user) {
        if (user.permissions && Object.keys(user.permissions).length > 0) {
          setPermissions({ ...user.permissions });
        } else {
          const defaultPerms = (DEFAULT_PERMISSIONS as any)[user.role] || DEFAULT_PERMISSIONS.employee;
          setPermissions({ ...defaultPerms });
        }
      }
    } else if (userIds.length > 1) {
      // 다중 사용자: 선택된 사용자들의 권한 합집합
      const merged: Record<string, any> = {};
      for (const uid of userIds) {
        const u = users.find((x) => x.id === uid);
        const perms = (u?.permissions && Object.keys(u.permissions).length > 0)
          ? u.permissions
          : (DEFAULT_PERMISSIONS as any)[u?.role || 'employee'] || DEFAULT_PERMISSIONS.employee;
        for (const [key, val] of Object.entries(perms) as [string, any][]) {
          if (!merged[key]) {
            merged[key] = { view: false, create: false, edit: false, delete: false };
          }
          if (val.view) merged[key].view = true;
          if (val.create) merged[key].create = true;
          if (val.edit) merged[key].edit = true;
          if (val.delete) merged[key].delete = true;
        }
      }
      setPermissions(merged);
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

  // 역할별 기본권한 저장: 해당 역할의 모든 사용자에게 일괄 적용
  const { checkAuth } = useAuthStore();

  const handleSaveRoleDefaults = async () => {
    if (!currentUser?.id) return;

    const targetUsers = users.filter((u) => u.role === selectedRole);
    if (targetUsers.length === 0) {
      message.warning('해당 역할의 사용자가 없습니다.');
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const user of targetUsers) {
      try {
        const result = await window.electronAPI.users.setPermissions(
          currentUser.id,
          user.id,
          permissions
        );
        if (result.success) successCount++;
        else errorCount++;
      } catch {
        errorCount++;
      }
    }

    if (errorCount === 0) {
      message.success(`${selectedRole === 'company_admin' ? '회사관리자' : selectedRole === 'department_manager' ? '부서관리자' : '사원'} ${successCount}명에게 권한이 적용되었습니다.`);
    } else {
      message.warning(`${successCount}명 성공, ${errorCount}명 실패`);
    }

    loadUsers();
    // 현재 로그인 사용자의 권한도 갱신 (메뉴 가시성 즉시 반영)
    await checkAuth();
    setSaving(false);
  };

  // 사용자별 세부권한 저장 (다중 선택 지원)
  const handleSaveUserPermissions = async () => {
    if (!currentUser?.id || selectedUserIds.length === 0) return;

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const userId of selectedUserIds) {
      try {
        const result = await window.electronAPI.users.setPermissions(
          currentUser.id,
          userId,
          permissions
        );
        if (result.success) successCount++;
        else errorCount++;
      } catch {
        errorCount++;
      }
    }

    if (errorCount === 0) {
      message.success(`${successCount}명의 권한이 저장되었습니다.`);
    } else {
      message.warning(`${successCount}명 성공, ${errorCount}명 실패`);
    }

    loadUsers();
    setSelectedUserIds([]);
    // 현재 로그인 사용자의 권한도 갱신
    await checkAuth();
    setSaving(false);
  };

  // 코드 기본값으로 초기화 (DB 저장 내용을 덮어씀)
  const handleReset = () => {
    if (mode === '역할별 기본권한') {
      const defaultPerms = (DEFAULT_PERMISSIONS as any)[selectedRole] || DEFAULT_PERMISSIONS.employee;
      setPermissions({ ...defaultPerms });
    } else {
      if (selectedUserIds.length === 1) {
        const user = users.find((u) => u.id === selectedUserIds[0]);
        const role = user?.role || 'employee';
        const defaultPerms = (DEFAULT_PERMISSIONS as any)[role] || DEFAULT_PERMISSIONS.employee;
        setPermissions({ ...defaultPerms });
      }
    }
    message.info('시스템 기본 권한으로 초기화되었습니다. 저장을 눌러야 적용됩니다.');
  };

  // 현재 편집 대상의 역할 (역할별 모드: selectedRole, 사용자별: 선택된 사용자들의 역할)
  const getEditingRole = (): string => {
    if (mode === '역할별 기본권한') return selectedRole;
    if (selectedUserIds.length === 1) {
      const user = users.find((u) => u.id === selectedUserIds[0]);
      return user?.role || 'employee';
    }
    // 다중 선택: 첫 사용자의 역할
    const first = users.find((u) => u.id === selectedUserIds[0]);
    return first?.role || 'employee';
  };

  // 메뉴 아이템 펼치기 (역할로 접근 불가능한 메뉴는 필터링)
  const flattenMenuItems = () => {
    const role = getEditingRole();
    const items: { key: string; label: string; parent: string }[] = [];
    MENU_STRUCTURE.forEach((menu) => {
      // 부모 메뉴의 roles 체크
      if (menu.roles && !menu.roles.includes(role)) return;
      if (menu.children) {
        menu.children.forEach((child) => {
          // 자식 메뉴의 roles 체크
          if (child.roles && !child.roles.includes(role)) return;
          items.push({ key: child.key, label: child.label, parent: menu.label });
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

  const canShowTable = mode === '역할별 기본권한' || selectedUserIds.length > 0;

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>권한 설정</Title>
          <span style={{ color: '#888' }}>역할별 기본권한 또는 사용자별 세부권한을 설정합니다.</span>
        </div>
        <Button
          icon={<TableOutlined />}
          onClick={() => navigate('/admin/permissions/matrix')}
        >
          권한 매트릭스 보기
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Segmented
            value={mode}
            onChange={(v) => {
              setMode(v as ModeType);
              setSelectedUserIds([]);
              if (v === '역할별 기본권한') {
                handleRoleSelect(selectedRole);
              }
            }}
            options={[
              { label: '역할별 기본권한', value: '역할별 기본권한', icon: <TeamOutlined /> },
              { label: '사용자별 세부권한', value: '사용자별 세부권한', icon: <UserOutlined /> },
            ]}
            size="large"
          />
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {mode === '역할별 기본권한' ? (
          <Space size="large" style={{ width: '100%' }} wrap>
            <div style={{ minWidth: 250 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>
                <TeamOutlined style={{ marginRight: 8 }} />
                역할 선택
              </div>
              <Select
                value={selectedRole}
                style={{ width: '100%' }}
                onChange={handleRoleSelect}
              >
                <Option value="company_admin">
                  <Tag color="blue">회사관리자</Tag>
                  <span style={{ color: '#888' }}>({users.filter(u => u.role === 'company_admin').length}명)</span>
                </Option>
                <Option value="department_manager">
                  <Tag color="green">부서관리자</Tag>
                  <span style={{ color: '#888' }}>({users.filter(u => u.role === 'department_manager').length}명)</span>
                </Option>
                <Option value="employee">
                  <Tag color="default">사원</Tag>
                  <span style={{ color: '#888' }}>({users.filter(u => u.role === 'employee').length}명)</span>
                </Option>
              </Select>
              <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                저장 시 해당 역할의 모든 활성 사용자에게 일괄 적용됩니다.
              </div>
            </div>

            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                초기화
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveRoleDefaults}
                loading={saving}
              >
                {ROLE_LABELS[selectedRole]?.label} 전체 적용
              </Button>
            </Space>
          </Space>
        ) : (
          <Space size="large" style={{ width: '100%' }} wrap>
            <div style={{ minWidth: 400, flex: 1 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>
                <UserOutlined style={{ marginRight: 8 }} />
                사용자 선택 (여러명 선택 가능)
              </div>
              <Select
                mode="multiple"
                placeholder="권한을 설정할 사용자를 선택하세요"
                style={{ width: '100%' }}
                onChange={handleUserSelect}
                loading={loading}
                value={selectedUserIds}
                optionFilterProp="label"
                maxTagCount={5}
                maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}명`}
              >
                {users.map((user) => (
                  <Option key={user.id} value={user.id} label={`${user.name} ${user.username}`}>
                    <Space>
                      <span>{user.name}</span>
                      <Tag color={ROLE_LABELS[user.role]?.color}>
                        {ROLE_LABELS[user.role]?.label || user.role}
                      </Tag>
                      <span style={{ color: '#888' }}>({user.username})</span>
                    </Space>
                  </Option>
                ))}
              </Select>
            </div>

            {selectedUserIds.length > 0 && (
              <Space>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  초기화
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveUserPermissions}
                  loading={saving}
                >
                  {selectedUserIds.length}명 저장
                </Button>
              </Space>
            )}
          </Space>
        )}
      </Card>

      {canShowTable && (
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
