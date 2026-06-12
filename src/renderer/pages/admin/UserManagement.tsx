import ResizableTable from '../../components/ResizableTable';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, Select, Tag, message,
  Card, Typography, Popconfirm, Switch, Avatar, Tabs, DatePicker, Row, Col, Divider, InputNumber,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined,
  ReloadOutlined, UploadOutlined, MinusCircleOutlined, ThunderboltOutlined, KeyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';
import type { User } from '../../../shared/types';

const { Title, Text } = Typography;
const { Option } = Select;

// 입사일 기준 연차 자동 계산 (백엔드 calculateAnnualLeave와 동일 로직)
function calcAutoAnnual(hireDateStr?: string | null): number {
  if (!hireDateStr) return 0;
  const hireDate = new Date(hireDateStr);
  if (isNaN(hireDate.getTime())) return 0;
  const diffMs = Date.now() - hireDate.getTime();
  if (diffMs < 0) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.floor(diffMs / msPerDay);
  const totalMonths = Math.floor(totalDays / 30.44);
  const totalYears = Math.floor(totalDays / 365.25);
  if (totalYears < 1) return Math.min(totalMonths, 11);
  const extraYears = Math.max(0, totalYears - 1);
  return Math.min(15 + Math.floor(extraYears / 2), 25);
}

const UserManagement: React.FC = () => {
  const { user: currentUser, selectedCompanyId } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [filterCompanyId, setFilterCompanyId] = useState<string | undefined>(undefined);
  const [filterDepartmentId, setFilterDepartmentId] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();

  const filteredUsers = useMemo(() => {
    let result = users;
    if (showActiveOnly) {
      result = result.filter((u: any) => u.is_active);
    }
    if (filterCompanyId) {
      result = result.filter((u: any) => u.company_id === filterCompanyId);
    }
    if (filterDepartmentId) {
      result = result.filter((u: any) => u.department_id === filterDepartmentId);
    }
    if (searchText.trim()) {
      const keyword = searchText.trim().toLowerCase();
      result = result.filter((u: any) =>
        (u.name || '').toLowerCase().includes(keyword) ||
        (u.username || '').toLowerCase().includes(keyword) ||
        (u.employee_number || '').toLowerCase().includes(keyword) ||
        (u.department_name || '').toLowerCase().includes(keyword) ||
        (u.phone || '').toLowerCase().includes(keyword)
      );
    }
    return result;
  }, [users, searchText, showActiveOnly, filterCompanyId, filterDepartmentId]);

  // 부서 드롭다운 옵션: 선택된 회사가 있으면 그 회사 부서만
  const departmentOptions = useMemo(() => {
    if (filterCompanyId) {
      return departments.filter((d: any) => d.company_id === filterCompanyId);
    }
    return departments;
  }, [departments, filterCompanyId]);

  const loadUsers = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const [userResult, compResult, deptResult] = await Promise.all([
        window.electronAPI.users.getAll(currentUser.id),
        window.electronAPI.companies.getAll(currentUser.id),
        (window as any).electronAPI.departments.getAll(currentUser.id),
      ]);
      if (userResult.success) {
        let allUsers = userResult.users || [];
        if (currentUser.role === 'super_admin' && selectedCompanyId) {
          allUsers = allUsers.filter((u: any) => u.company_id === selectedCompanyId);
        }
        setUsers(allUsers);
      } else message.error(userResult.error || '사용자 목록을 불러오는데 실패했습니다.');
      if (compResult.success) setCompanies(compResult.companies || []);
      if (deptResult.success) setDepartments(deptResult.departments || []);
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, [currentUser?.id, selectedCompanyId]);

  const handleSubmit = async (values: any) => {
    if (!currentUser?.id) return;

    // DatePicker dayjs → string 변환
    const data = { ...values };
    if (data.hire_date) data.hire_date = data.hire_date.format('YYYY-MM-DD');
    if (data.birth_date) data.birth_date = data.birth_date.format('YYYY-MM-DD');
    if (data.resignation_date) data.resignation_date = data.resignation_date.format('YYYY-MM-DD');

    // 월급은 별도 처리 (super_admin만, 별도 IPC)
    const salaryToSave = data.monthly_salary;
    delete data.monthly_salary;

    // Multi-select → set primary (first = primary) for backward compatibility
    if (data.company_ids && Array.isArray(data.company_ids) && data.company_ids.length > 0) {
      data.company_id = data.company_id || data.company_ids[0];
    }
    if (data.department_ids && Array.isArray(data.department_ids) && data.department_ids.length > 0) {
      data.department_id = data.department_id || data.department_ids[0];
    } else {
      data.department_id = null;
    }
    if (data.annual_leave_override === undefined || data.annual_leave_override === '') {
      data.annual_leave_override = null;
    }
    if (data.annual_leave_used_offset === undefined || data.annual_leave_used_offset === '') {
      data.annual_leave_used_offset = null;
    }

    try {
      let targetUserId = editingUser?.id;
      if (editingUser) {
        const result = await window.electronAPI.users.update(currentUser.id, editingUser.id, data);
        if (result.success) {
          message.success('사용자가 수정되었습니다.');
        } else {
          message.error(result.error);
          return;
        }
      } else {
        const result = await window.electronAPI.users.create(currentUser.id, data);
        if (result.success) {
          targetUserId = (result as any).id || (result as any).user?.id;
          message.success('사용자가 생성되었습니다.');
        } else {
          message.error(result.error);
          return;
        }
      }

      // 월급 저장 (super_admin만)
      if (currentUser.role === 'super_admin' && salaryToSave !== undefined && salaryToSave !== null && targetUserId) {
        const sRes = await (window as any).electronAPI.userSalary.set(currentUser.id, targetUserId, Number(salaryToSave));
        if (!sRes.success) message.warning('월급 저장 실패: ' + sRes.error);
      }

      setModalVisible(false);
      loadUsers();
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!currentUser?.id) return;
    try {
      const result = await window.electronAPI.users.delete(currentUser.id, userId);
      if (result.success) {
        // soft delete된 경우 warning 표시 (관련 데이터 있어서 비활성화만 됨)
        if ((result as any).warning) {
          message.warning((result as any).warning, 6);
        } else {
          message.success('사용자가 완전 삭제되었습니다.');
        }
        loadUsers();
      } else {
        message.error(result.error);
      }
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    }
  };

  // 회사별로 묶어서 CSV 파일 다운로드 (회의록: "회사별 권한별로 아이디 비밀번호 보내드리기")
  const exportAccountsCSV = () => {
    const sorted = [...users]
      .filter((u: any) => u.is_active !== false)
      .sort((a: any, b: any) => {
        const co = (a.company_name || '').localeCompare(b.company_name || '');
        if (co !== 0) return co;
        const dept = (a.department_name || '').localeCompare(b.department_name || '');
        if (dept !== 0) return dept;
        return (a.role || '').localeCompare(b.role || '');
      });
    const roleLabel: Record<string, string> = {
      super_admin: '슈퍼관리자',
      company_admin: '회사관리자',
      department_manager: '부서장',
      employee: '사원',
    };
    const rows = sorted.map((u: any) => ({
      회사: u.company_name || '',
      부서: u.department_name || '',
      권한: roleLabel[u.role] || u.role || '',
      이름: u.name || '',
      아이디: u.username || '',
      초기비밀번호: '000000',
      직급: u.position || '',
      이메일: u.email || '',
    }));
    const headers = ['회사', '부서', '권한', '이름', '아이디', '초기비밀번호', '직급', '이메일'];
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const v = String((r as any)[h] ?? '');
        return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')),
    ].join('\n');
    // BOM 포함 — 엑셀 한글 깨짐 방지
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `직원계정_${dayjs().format('YYYYMMDD')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`${rows.length}건 CSV 다운로드 완료`);
  };

  const handleResetPassword = async (userId: string, username: string) => {
    if (!currentUser?.id) return;
    try {
      const result = await (window.electronAPI as any).users.resetPassword(currentUser.id, userId, '000000');
      if (result.success) {
        const newPwd = result.newPassword || '000000';
        Modal.success({
          title: '비밀번호가 초기화되었습니다',
          content: (
            <div>
              <p><strong>{username}</strong> 사용자의 비밀번호가 다음 값으로 초기화되었습니다:</p>
              <p style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center', padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                {newPwd}
              </p>
              <p style={{ color: '#888', fontSize: 12 }}>사용자에게 안내한 후, 첫 로그인 시 비밀번호 변경을 권장하세요.</p>
            </div>
          ),
        });
      } else {
        message.error(result.error || '비밀번호 초기화에 실패했습니다.');
      }
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    if (!currentUser?.id) return;
    try {
      const result = await window.electronAPI.users.update(currentUser.id, userId, { is_active: isActive });
      if (result.success) {
        message.success(isActive ? '활성화되었습니다.' : '비활성화되었습니다.');
        loadUsers();
      } else {
        message.error(result.error);
      }
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    }
  };

  // 직원명부 가져오기
  const handleImportEmployees = async () => {
    if (!currentUser?.id) return;
    try {
      const result = await window.electronAPI.users.importEmployees(currentUser.id);
      if (result.success) {
        const { total, created, updated, skipped } = result.data;
        Modal.success({
          title: '직원명부 가져오기 완료',
          content: (
            <div>
              <p>총 {total}건 처리</p>
              <p>신규 생성: {created}건</p>
              <p>데이터 업데이트: {updated}건</p>
              <p>건너뜀: {skipped}건</p>
              {created > 0 && (
                <p style={{ color: '#888', marginTop: 8 }}>
                  초기 비밀번호: 사번 또는 "1234"
                </p>
              )}
            </div>
          ),
        });
        loadUsers();
      } else if (result.error !== '파일이 선택되지 않았습니다.') {
        message.error(result.error);
      }
    } catch (err: any) {
      message.error(err?.message || '오류가 발생했습니다.');
    }
  };

  // 유저네임 자동 생성
  const handleGenerateUsername = async () => {
    const name = form.getFieldValue('name');
    const hireDate = form.getFieldValue('hire_date');
    if (!name) {
      message.warning('이름을 먼저 입력해주세요.');
      return;
    }
    const hireYear = hireDate ? hireDate.format('YYYY') : new Date().getFullYear().toString();
    try {
      const result = await (window.electronAPI as any).users.generateUsername(name, hireYear);
      if (result.success) {
        form.setFieldValue('username', result.username);
        message.success(`유저네임 생성: ${result.username}`);
      } else {
        message.error(result.error || '유저네임 생성 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '유저네임 생성 중 오류가 발생했습니다.');
    }
  };

  const openModal = async (user?: User) => {
    setEditingUser(user || null);
    if (user) {
      const u = user as any;
      const companyIds = u.company_ids && u.company_ids.length > 0
        ? u.company_ids
        : u.company_id ? [u.company_id] : [];
      const departmentIds = u.department_ids && u.department_ids.length > 0
        ? u.department_ids
        : u.department_id ? [u.department_id] : [];

      // super_admin만 월급 미리 불러오기
      let monthlySalary: number | undefined;
      if (currentUser?.role === 'super_admin') {
        try {
          const sRes = await (window as any).electronAPI.userSalary.get(currentUser.id, user.id);
          if (sRes.success && sRes.data) monthlySalary = Number(sRes.data.monthly_salary);
        } catch { /* ignore */ }
      }

      form.setFieldsValue({
        ...user,
        company_ids: companyIds,
        department_ids: departmentIds,
        hire_date: user.hire_date ? dayjs(user.hire_date) : undefined,
        birth_date: user.birth_date ? dayjs(user.birth_date) : undefined,
        resignation_date: user.resignation_date ? dayjs(user.resignation_date) : undefined,
        monthly_salary: monthlySalary,
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const roleLabels: Record<string, { label: string; color: string }> = {
    super_admin: { label: '슈퍼관리자', color: 'red' },
    company_admin: { label: '회사관리자', color: 'blue' },
    department_manager: { label: '부서관리자', color: 'green' },
    employee: { label: '사원', color: 'default' },
  };

  const columns = [
    {
      title: '사용자',
      key: 'user',
      sorter: (a: User, b: User) => (a.name || '').localeCompare(b.name || ''),
      sortDirections: ['ascend', 'descend'] as const,
      render: (_: any, record: User) => (
        <Space>
          <Avatar
            style={{
              background: record.role === 'super_admin' ? '#ff4d4f' :
                record.role === 'company_admin' ? '#1890ff' :
                record.role === 'department_manager' ? '#52c41a' : '#722ed1',
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
      title: '사번',
      dataIndex: 'employee_number',
      key: 'employee_number',
      sorter: (a: any, b: any) => (a.employee_number || '').localeCompare(b.employee_number || ''),
      sortDirections: ['ascend', 'descend'] as const,
      render: (v: string) => v || '-',
    },
    {
      title: '회사',
      key: 'company_name',
      sorter: (a: any, b: any) => ((a.company_names || []).join(',') || a.company_name || '').localeCompare((b.company_names || []).join(',') || b.company_name || ''),
      sortDirections: ['ascend', 'descend'] as const,
      render: (_: any, record: any) => {
        const names: string[] = record.company_names && record.company_names.length > 0
          ? record.company_names
          : record.company_name ? [record.company_name] : [];
        if (names.length === 0) return '-';
        return (
          <Space size={[0, 4]} wrap>
            {names.map((n: string, i: number) => (
              <Tag key={i} color="blue">{n}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '부서',
      key: 'department_name',
      sorter: (a: any, b: any) => ((a.department_names || []).join(',') || a.department_name || '').localeCompare((b.department_names || []).join(',') || b.department_name || ''),
      sortDirections: ['ascend', 'descend'] as const,
      render: (_: any, record: any) => {
        const names: string[] = record.department_names && record.department_names.length > 0
          ? record.department_names
          : record.department_name ? [record.department_name] : [];
        if (names.length === 0) return '-';
        return (
          <Space size={[0, 4]} wrap>
            {names.map((n: string, i: number) => (
              <Tag key={i} color="green">{n}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '직책',
      dataIndex: 'position',
      key: 'position',
      sorter: (a: any, b: any) => (a.position || '').localeCompare(b.position || ''),
      sortDirections: ['ascend', 'descend'] as const,
      render: (v: string) => v || '-',
    },
    {
      title: '역할',
      dataIndex: 'role',
      key: 'role',
      sorter: (a: any, b: any) => (a.role || '').localeCompare(b.role || ''),
      sortDirections: ['ascend', 'descend'] as const,
      render: (role: string) => (
        <Tag color={roleLabels[role]?.color}>
          {roleLabels[role]?.label || role}
        </Tag>
      ),
    },
    {
      title: '핸드폰번호',
      dataIndex: 'phone',
      key: 'phone',
      sorter: (a: any, b: any) => (a.phone || '').localeCompare(b.phone || ''),
      sortDirections: ['ascend', 'descend'] as const,
      render: (v: string) => v || '-',
    },
    {
      title: '직통번호',
      dataIndex: 'direct_phone',
      key: 'direct_phone',
      render: (v: string) => v || '-',
    },
    {
      title: '총연차',
      key: 'annual_leave',
      render: (_: any, record: any) => {
        const override = record.annual_leave_override;
        const hasOverride = override !== null && override !== undefined && override !== '';
        const value = hasOverride ? Number(override) : calcAutoAnnual(record.hire_date);
        return (
          <span>
            {value}일{hasOverride && <Tag color="orange" style={{ marginLeft: 4 }}>수동</Tag>}
          </span>
        );
      },
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      sorter: (a: any, b: any) => Number(a.is_active) - Number(b.is_active),
      sortDirections: ['ascend', 'descend'] as const,
      render: (isActive: boolean, record: User) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleToggleActive(record.id, checked)}
          disabled={record.id === currentUser?.id}
        />
      ),
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
            title={`${record.name}의 비밀번호를 '000000'으로 초기화합니다.`}
            description="확인 후 사용자에게 새 비밀번호를 안내해주세요."
            onConfirm={() => handleResetPassword(record.id, record.username)}
            okText="초기화"
            cancelText="취소"
            disabled={record.role === 'super_admin' && currentUser?.role !== 'super_admin'}
          >
            <Button
              type="text"
              icon={<KeyOutlined />}
              title="비밀번호 초기화"
              disabled={record.role === 'super_admin' && currentUser?.role !== 'super_admin'}
            />
          </Popconfirm>
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="삭제"
            cancelText="취소"
            disabled={record.id === currentUser?.id || (record.role === 'super_admin' && currentUser?.role !== 'super_admin')}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.id === currentUser?.id || (record.role === 'super_admin' && currentUser?.role !== 'super_admin')}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'basic',
      label: '기본정보',
      children: (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="employee_number" label="사번">
                <Input placeholder="사번" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="username"
                label="아이디"
                rules={[{ required: !editingUser, message: '아이디를 입력하거나 자동생성해주세요.' }]}
              >
                <Input
                  placeholder="로그인 ID (자동생성 가능)"
                  addonAfter={
                    !editingUser ? (
                      <Button
                        type="link"
                        size="small"
                        icon={<ThunderboltOutlined />}
                        onClick={handleGenerateUsername}
                        style={{ padding: 0, height: 'auto' }}
                      >
                        자동생성
                      </Button>
                    ) : undefined
                  }
                />
              </Form.Item>
            </Col>
          </Row>

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
            name="role"
            label="역할"
            rules={[{ required: true }]}
            initialValue="employee"
          >
            <Select>
              {currentUser?.role === 'super_admin' && (
                <Option value="super_admin">슈퍼관리자</Option>
              )}
              {currentUser?.role === 'super_admin' && (
                <Option value="company_admin">회사관리자</Option>
              )}
              <Option value="department_manager">부서관리자</Option>
              <Option value="employee">사원</Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="company_ids" label="소속회사" rules={[{ required: true, message: '소속회사를 선택해주세요.' }]}>
                <Select mode="multiple" placeholder="회사 선택 (복수 가능)" allowClear>
                  {companies.map((c: any) => (
                    <Option key={c.id} value={c.id}>{c.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item noStyle dependencies={['company_ids']}>
                {() => (
                  <Form.Item name="department_ids" label="부서">
                    <Select mode="multiple" placeholder="부서 선택 (복수 가능)" allowClear>
                      {departments
                        .filter((d: any) => {
                          const selectedCompanies: string[] = form.getFieldValue('company_ids') || [];
                          return selectedCompanies.length === 0 || selectedCompanies.includes(d.company_id);
                        })
                        .map((d: any) => (
                          <Option key={d.id} value={d.id}>{d.name}</Option>
                        ))}
                    </Select>
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="position" label="직책">
                <Input placeholder="팀장, 실장 등" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="핸드폰번호">
                <Input placeholder="010-0000-0000" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="direct_phone" label="직통번호">
                <Input placeholder="02-0000-0000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="이메일">
                <Input placeholder="이메일" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="hire_date" label="입사일">
                <DatePicker style={{ width: '100%' }} placeholder="입사일" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="resignation_date" label="퇴사일">
                <DatePicker style={{ width: '100%' }} placeholder="퇴사일" />
              </Form.Item>
            </Col>
          </Row>

          {/* 월급 — 슈퍼관리자만. 다른 권한자는 필드 자체가 안 보임 */}
          {currentUser?.role === 'super_admin' && (
            <Row gutter={16} style={{ background: '#fff7e6', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #ffd591' }}>
              <Col span={24}>
                <Form.Item
                  name="monthly_salary"
                  label={<span>🔒 월급 (슈퍼관리자 전용 · 인건비 자동 계산)</span>}
                  help="이 값은 다른 사용자에게 노출되지 않습니다."
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    step={100000}
                    placeholder="월급 입력 (예: 3300000)"
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(v) => v!.replace(/,/g, '') as unknown as number}
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          {['super_admin', 'company_admin'].includes(currentUser?.role || '') && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="annual_leave_override"
                  label="총연차 (수동 설정)"
                  help="비워두면 입사일 기준 자동 계산"
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={365}
                    step={0.5}
                    placeholder="자동 계산"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="annual_leave_used_offset"
                  label="기존 사용 연차 (수동 추가)"
                  help="시스템 도입 전 사용한 연차 일수"
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={365}
                    step={0.5}
                    placeholder="0"
                  />
                </Form.Item>
              </Col>
            </Row>
          )}
        </>
      ),
    },
    {
      key: 'detail',
      label: '상세정보',
      children: (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="birth_date" label="생년월일">
                <DatePicker style={{ width: '100%' }} placeholder="생년월일" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label="주소">
            <Input placeholder="주소" />
          </Form.Item>

          <Divider orientation="left" plain>비상연락처</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="emergency_contact_name" label="이름">
                <Input placeholder="비상연락처 이름" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="emergency_contact_phone" label="전화번호">
                <Input placeholder="비상연락처 번호" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="emergency_contact_relation" label="관계">
                <Input placeholder="부모, 배우자 등" />
              </Form.Item>
            </Col>
          </Row>

          {currentUser?.role === 'super_admin' && (
            <>
              <Divider orientation="left" plain>🔒 급여 정보 (슈퍼관리자 전용)</Divider>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="bank_name" label="은행명">
                    <Input placeholder="은행명" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="bank_account" label="계좌번호">
                    <Input placeholder="계좌번호" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
        </>
      ),
    },
    {
      key: 'career',
      label: '경력정보',
      children: (
        <>
          <Divider orientation="left" plain>학력</Divider>
          <Form.List name="education">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={8} key={key} style={{ marginBottom: 8 }}>
                    <Col span={6}>
                      <Form.Item {...restField} name={[name, 'school']} noStyle>
                        <Input placeholder="학교명" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item {...restField} name={[name, 'major']} noStyle>
                        <Input placeholder="전공" />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item {...restField} name={[name, 'degree']} noStyle>
                        <Select placeholder="학위">
                          <Option value="고졸">고졸</Option>
                          <Option value="전문학사">전문학사</Option>
                          <Option value="학사">학사</Option>
                          <Option value="석사">석사</Option>
                          <Option value="박사">박사</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item {...restField} name={[name, 'graduation_year']} noStyle>
                        <Input placeholder="졸업연도" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  학력 추가
                </Button>
              </>
            )}
          </Form.List>

          <Divider orientation="left" plain style={{ marginTop: 24 }}>자격증</Divider>
          <Form.List name="certifications">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={8} key={key} style={{ marginBottom: 8 }}>
                    <Col span={8}>
                      <Form.Item {...restField} name={[name, 'name']} noStyle>
                        <Input placeholder="자격증명" />
                      </Form.Item>
                    </Col>
                    <Col span={7}>
                      <Form.Item {...restField} name={[name, 'issuer']} noStyle>
                        <Input placeholder="발급기관" />
                      </Form.Item>
                    </Col>
                    <Col span={7}>
                      <Form.Item {...restField} name={[name, 'acquired_date']} noStyle>
                        <Input placeholder="취득일 (2025-01)" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  자격증 추가
                </Button>
              </>
            )}
          </Form.List>

          <Divider orientation="left" plain style={{ marginTop: 24 }}>경력사항</Divider>
          <Form.List name="career_history">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={8} key={key} style={{ marginBottom: 8 }}>
                    <Col span={6}>
                      <Form.Item {...restField} name={[name, 'company']} noStyle>
                        <Input placeholder="회사명" />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item {...restField} name={[name, 'position']} noStyle>
                        <Input placeholder="직책" />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item {...restField} name={[name, 'period']} noStyle>
                        <Input placeholder="기간" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item {...restField} name={[name, 'description']} noStyle>
                        <Input placeholder="설명" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  경력 추가
                </Button>
              </>
            )}
          </Form.List>
        </>
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
          <Button icon={<UploadOutlined />} onClick={handleImportEmployees}>
            직원명부 가져오기
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadUsers}>
            새로고침
          </Button>
          {currentUser?.role === 'super_admin' && (
            <Button icon={<UploadOutlined />} onClick={() => exportAccountsCSV()}>
              회사별 계정 CSV
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            사용자 추가
          </Button>
        </Space>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <Space wrap>
            <Input.Search
              placeholder="이름, 아이디, 사번, 부서명, 연락처로 검색"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={setSearchText}
              allowClear
              style={{ width: 320 }}
            />
            {currentUser?.role === 'super_admin' && (
              <Select
                placeholder="회사"
                value={filterCompanyId}
                onChange={(v) => {
                  setFilterCompanyId(v);
                  setFilterDepartmentId(undefined);
                }}
                allowClear
                style={{ width: 160 }}
                options={companies.map((c: any) => ({ value: c.id, label: c.name }))}
              />
            )}
            <Select
              placeholder="부서"
              value={filterDepartmentId}
              onChange={setFilterDepartmentId}
              allowClear
              style={{ width: 180 }}
              options={departmentOptions.map((d: any) => ({ value: d.id, label: d.name }))}
            />
          </Space>
          <Space>
            <span>활성 사원만 보기</span>
            <Switch checked={showActiveOnly} onChange={setShowActiveOnly} />
          </Space>
        </div>
        <ResizableTable
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          showSorterTooltip
        />
      </Card>

      <Modal
        title={editingUser ? '사용자 수정' : '사용자 추가'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Tabs items={tabItems} />

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
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
