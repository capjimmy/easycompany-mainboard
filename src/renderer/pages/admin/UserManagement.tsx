import React, { useState, useEffect } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, Select, Tag, message,
  Card, Typography, Popconfirm, Switch, Avatar, Tabs, DatePicker, Row, Col, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined,
  ReloadOutlined, UploadOutlined, MinusCircleOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';
import type { User } from '../../../shared/types';

const { Title, Text } = Typography;
const { Option } = Select;

const RANK_OPTIONS = [
  '사원', '주임', '대리', '과장', '차장', '부장', '이사', '상무', '전무', '부사장', '사장',
];

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

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

  useEffect(() => { loadUsers(); }, [currentUser?.id]);

  const handleSubmit = async (values: any) => {
    if (!currentUser?.id) return;

    // DatePicker dayjs → string 변환
    const data = { ...values };
    if (data.hire_date) data.hire_date = data.hire_date.format('YYYY-MM-DD');
    if (data.birth_date) data.birth_date = data.birth_date.format('YYYY-MM-DD');
    if (data.resignation_date) data.resignation_date = data.resignation_date.format('YYYY-MM-DD');

    try {
      if (editingUser) {
        const result = await window.electronAPI.users.update(currentUser.id, editingUser.id, data);
        if (result.success) {
          message.success('사용자가 수정되었습니다.');
          setModalVisible(false);
          loadUsers();
        } else {
          message.error(result.error);
        }
      } else {
        const result = await window.electronAPI.users.create(currentUser.id, data);
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
    } catch (err) {
      message.error('오류가 발생했습니다.');
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
    } catch (err) {
      message.error('오류가 발생했습니다.');
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
    } catch (err) {
      message.error('유저네임 생성 중 오류가 발생했습니다.');
    }
  };

  const openModal = (user?: User) => {
    setEditingUser(user || null);
    if (user) {
      form.setFieldsValue({
        ...user,
        hire_date: user.hire_date ? dayjs(user.hire_date) : undefined,
        birth_date: user.birth_date ? dayjs(user.birth_date) : undefined,
        resignation_date: user.resignation_date ? dayjs(user.resignation_date) : undefined,
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
      render: (v: string) => v || '-',
    },
    {
      title: '회사',
      dataIndex: 'company_name',
      key: 'company_name',
      render: (v: string) => v || '-',
    },
    {
      title: '부서',
      dataIndex: 'department_name',
      key: 'department_name',
      render: (v: string) => v || '-',
    },
    {
      title: '직급/직책',
      key: 'rank_position',
      render: (_: any, record: User) => {
        const parts = [record.rank, record.position].filter(Boolean);
        return parts.length > 0 ? parts.join(' / ') : '-';
      },
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
      title: '핸드폰번호',
      dataIndex: 'phone',
      key: 'phone',
      render: (v: string) => v || '-',
    },
    {
      title: '직통번호',
      dataIndex: 'direct_phone',
      key: 'direct_phone',
      render: (v: string) => v || '-',
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

          <Row gutter={16}>
            <Col span={12}>
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
                  {['super_admin', 'company_admin'].includes(currentUser?.role || '') && (
                    <Option value="company_admin">회사관리자</Option>
                  )}
                  <Option value="department_manager">부서관리자</Option>
                  <Option value="employee">사원</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rank" label="직급">
                <Select allowClear placeholder="직급 선택">
                  {RANK_OPTIONS.map(r => <Option key={r} value={r}>{r}</Option>)}
                </Select>
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

          {['super_admin', 'company_admin'].includes(currentUser?.role || '') && (
            <>
              <Divider orientation="left" plain>급여 정보</Divider>
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
