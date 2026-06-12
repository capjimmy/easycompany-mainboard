import ResizableTable from '../../components/ResizableTable';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Typography, Row, Col, Statistic, Tag, Space, Select, Input,
  Switch, Tabs, Button, message, Avatar, Modal, Descriptions, Form, DatePicker,
} from 'antd';
import {
  TeamOutlined, BankOutlined, ApartmentOutlined, IdcardOutlined,
  DownloadOutlined, UserOutlined, EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const ROLE_LABELS: Record<string, string> = {
  super_admin: '슈퍼관리자',
  company_admin: '회사관리자',
  department_manager: '부서관리자',
  employee: '사원',
};

const HRRoster: React.FC = () => {
  const { user, selectedCompanyId } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const isCompanyAdmin = user?.role === 'company_admin';
  const canEdit = isSuperAdmin || isCompanyAdmin;

  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [filterRank, setFilterRank] = useState<string | undefined>(undefined);
  const [filterDept, setFilterDept] = useState<string | undefined>(undefined);
  const [filterCompany, setFilterCompany] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [view, setView] = useState<'roster' | 'summary'>('roster');

  // 상세/편집 모달
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm] = Form.useForm();

  const openDetail = (row: any) => {
    setSelectedUser(row);
    setEditMode(false);
    setDetailOpen(true);
  };

  const enterEditMode = () => {
    if (!selectedUser) return;
    editForm.setFieldsValue({
      name: selectedUser.name,
      employee_number: selectedUser.employee_number,
      rank: selectedUser.rank,
      position: selectedUser.position,
      role: selectedUser.role,
      hire_date: selectedUser.hire_date ? dayjs(selectedUser.hire_date) : null,
      birth_date: selectedUser.birth_date ? dayjs(selectedUser.birth_date) : null,
      address: selectedUser.address,
      phone: selectedUser.phone,
      direct_phone: selectedUser.direct_phone,
      email: selectedUser.email,
      emergency_contact_name: selectedUser.emergency_contact_name,
      emergency_contact_phone: selectedUser.emergency_contact_phone,
      emergency_contact_relation: selectedUser.emergency_contact_relation,
      bank_name: selectedUser.bank_name,
      bank_account: selectedUser.bank_account,
      department_id: selectedUser.department_id,
      company_id: selectedUser.company_id,
    });
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!user?.id || !selectedUser) return;
    try {
      const values = await editForm.validateFields();
      const payload: any = { ...values };
      if (payload.hire_date) payload.hire_date = payload.hire_date.format('YYYY-MM-DD');
      else payload.hire_date = null;
      if (payload.birth_date) payload.birth_date = payload.birth_date.format('YYYY-MM-DD');
      else payload.birth_date = null;
      // 슈퍼관리자가 아니면 role 변경 제거
      if (!isSuperAdmin) delete payload.role;
      setSaving(true);
      const result = await window.electronAPI.users.update(user.id, selectedUser.id, payload);
      if (result.success) {
        message.success('사용자 정보가 수정되었습니다.');
        setEditMode(false);
        setDetailOpen(false);
        loadAll();
      } else {
        message.error(result.error || '수정 실패');
      }
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.message || '수정 중 오류');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (user?.id) loadAll();
  }, [user?.id, selectedCompanyId]);

  const loadAll = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [u, c, d] = await Promise.all([
        window.electronAPI.users.getAll(user.id),
        window.electronAPI.companies.getAll(user.id),
        (window as any).electronAPI.departments.getAll(user.id),
      ]);
      if (u.success) setUsers(u.users || []);
      else message.error(u.error || '사용자 조회 실패');
      if (c.success) setCompanies(c.companies || []);
      if (d.success) setDepartments(d.departments || []);
    } catch (err: any) {
      message.error(err?.message || '조회 중 오류');
    } finally {
      setLoading(false);
    }
  };

  const companyMap = useMemo(() => {
    const m: Record<string, any> = {};
    companies.forEach((c: any) => { m[c.id] = c; });
    return m;
  }, [companies]);

  const deptMap = useMemo(() => {
    const m: Record<string, any> = {};
    departments.forEach((d: any) => { m[d.id] = d; });
    return m;
  }, [departments]);

  const filteredUsers = useMemo(() => {
    let list = users.slice();
    // 회사관리자: 자기 회사만 (selectedCompanyId 무시 — 권한 누설 방지)
    if (!isSuperAdmin && user?.company_id) {
      list = list.filter((u: any) => u.company_id === user.company_id);
    }
    // 슈퍼관리자: 회사 전환 시 해당 회사만
    else if (isSuperAdmin && selectedCompanyId) {
      list = list.filter((u: any) => u.company_id === selectedCompanyId);
    }
    if (showActiveOnly) {
      list = list.filter((u: any) => u.is_active);
    }
    if (filterCompany) list = list.filter((u: any) => u.company_id === filterCompany);
    if (filterDept) list = list.filter((u: any) => u.department_id === filterDept);
    if (filterRank) list = list.filter((u: any) => (u.rank || '') === filterRank);
    if (searchText.trim()) {
      const k = searchText.trim().toLowerCase();
      list = list.filter((u: any) =>
        (u.name || '').toLowerCase().includes(k) ||
        (u.username || '').toLowerCase().includes(k) ||
        (u.employee_number || '').toLowerCase().includes(k) ||
        (u.email || '').toLowerCase().includes(k)
      );
    }
    return list;
  }, [users, isSuperAdmin, user?.company_id, selectedCompanyId, showActiveOnly, filterCompany, filterDept, filterRank, searchText]);

  // 통계
  const stats = useMemo(() => {
    const active = filteredUsers.filter((u: any) => u.is_active).length;
    const total = filteredUsers.length;
    const resigned = total - active;
    const byCompany = new Map<string, number>();
    const byDept = new Map<string, number>();
    const byRank = new Map<string, number>();
    const byRole = new Map<string, number>();
    for (const u of filteredUsers) {
      if (!u.is_active && showActiveOnly) continue;
      const co = companyMap[u.company_id]?.name || '(미지정)';
      const dept = deptMap[u.department_id]?.name || '(부서 미지정)';
      const rank = u.rank || '(직급 미지정)';
      const role = ROLE_LABELS[u.role] || u.role;
      byCompany.set(co, (byCompany.get(co) || 0) + 1);
      byDept.set(dept, (byDept.get(dept) || 0) + 1);
      byRank.set(rank, (byRank.get(rank) || 0) + 1);
      byRole.set(role, (byRole.get(role) || 0) + 1);
    }
    return { total, active, resigned, byCompany, byDept, byRank, byRole };
  }, [filteredUsers, companyMap, deptMap, showActiveOnly]);

  const distinctRanks = useMemo(() => {
    const s = new Set<string>();
    users.forEach((u: any) => { if (u.rank) s.add(u.rank); });
    return Array.from(s).sort();
  }, [users]);

  const tenureYears = (hireDate?: string) => {
    if (!hireDate) return '';
    const d = dayjs(hireDate);
    if (!d.isValid()) return '';
    const years = dayjs().diff(d, 'year');
    const months = dayjs().diff(d.add(years, 'year'), 'month');
    return `${years}년 ${months}개월`;
  };

  const handleExport = async () => {
    if (!user?.id) return;
    try {
      const cols = [
        { title: '회사', key: 'company' },
        { title: '부서', key: 'department' },
        { title: '사번', key: 'employee_number' },
        { title: '이름', key: 'name' },
        { title: '직급', key: 'rank' },
        { title: '직책', key: 'position' },
        { title: '역할', key: 'role_label' },
        { title: '입사일', key: 'hire_date' },
        { title: '근속', key: 'tenure' },
        { title: '재직상태', key: 'status' },
        { title: '연락처', key: 'phone' },
        { title: '이메일', key: 'email' },
      ];
      const rows = filteredUsers.map((u: any) => ({
        company: companyMap[u.company_id]?.name || '-',
        department: deptMap[u.department_id]?.name || '-',
        employee_number: u.employee_number || '-',
        name: u.name || '',
        rank: u.rank || '-',
        position: u.position || '-',
        role_label: ROLE_LABELS[u.role] || u.role,
        hire_date: u.hire_date || '-',
        tenure: tenureYears(u.hire_date),
        status: u.is_active ? '재직' : (u.resignation_date ? `퇴사(${u.resignation_date})` : '비활성'),
        phone: u.phone || u.direct_phone || '-',
        email: u.email || '-',
      }));
      const result = await (window as any).electronAPI.export.financeGeneric(user.id, '인사명부', cols, rows);
      if (result?.success) message.success('엑셀 파일이 저장되었습니다.');
      else message.error(result?.error || '엑셀 저장 실패');
    } catch (err: any) {
      message.error(err?.message || '엑셀 저장 중 오류');
    }
  };

  const columns: any[] = [
    ...(isSuperAdmin ? [{
      title: '회사',
      dataIndex: 'company_id',
      key: 'company_id',
      width: 130,
      render: (v: string) => companyMap[v]?.name || '-',
      sorter: (a: any, b: any) => (companyMap[a.company_id]?.name || '').localeCompare(companyMap[b.company_id]?.name || ''),
    }] : []),
    {
      title: '부서',
      dataIndex: 'department_id',
      key: 'department_id',
      width: 140,
      render: (v: string) => deptMap[v]?.name || '-',
      sorter: (a: any, b: any) => (deptMap[a.department_id]?.name || '').localeCompare(deptMap[b.department_id]?.name || ''),
    },
    { title: '사번', dataIndex: 'employee_number', key: 'employee_number', width: 90, render: (v: string) => v || '-' },
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
      width: 110,
      render: (v: string, r: any) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <span>{v}</span>
          {!r.is_active && <Tag color="default">비활성</Tag>}
        </Space>
      ),
      sorter: (a: any, b: any) => (a.name || '').localeCompare(b.name || ''),
    },
    { title: '직급', dataIndex: 'rank', key: 'rank', width: 100, render: (v: string) => v || '-' },
    { title: '직책', dataIndex: 'position', key: 'position', width: 110, render: (v: string) => v || '-' },
    {
      title: '역할',
      dataIndex: 'role',
      key: 'role',
      width: 110,
      render: (v: string) => {
        const map: Record<string, string> = { super_admin: 'purple', company_admin: 'blue', department_manager: 'cyan', employee: 'green' };
        return <Tag color={map[v] || 'default'}>{ROLE_LABELS[v] || v}</Tag>;
      },
    },
    {
      title: '입사일',
      dataIndex: 'hire_date',
      key: 'hire_date',
      width: 110,
      render: (v: string) => v || '-',
      sorter: (a: any, b: any) => (a.hire_date || '').localeCompare(b.hire_date || ''),
    },
    {
      title: '근속',
      key: 'tenure',
      width: 110,
      render: (_: any, r: any) => tenureYears(r.hire_date) || '-',
    },
    {
      title: '재직상태',
      key: 'status',
      width: 110,
      render: (_: any, r: any) => r.is_active
        ? <Tag color="green">재직</Tag>
        : r.resignation_date
          ? <Tag color="red">퇴사 {r.resignation_date}</Tag>
          : <Tag>비활성</Tag>,
    },
    { title: '연락처', dataIndex: 'phone', key: 'phone', width: 130, render: (v: string, r: any) => v || r.direct_phone || '-' },
    { title: '이메일', dataIndex: 'email', key: 'email', ellipsis: true, render: (v: string) => v || '-' },
  ];

  const summaryRow = (label: string, m: Map<string, number>) => (
    <Card size="small" title={label} style={{ marginBottom: 12 }}>
      <Row gutter={[8, 8]}>
        {Array.from(m.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => (
            <Col key={k} xs={12} sm={8} md={6} lg={4}>
              <Card size="small" bodyStyle={{ padding: '8px 12px' }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{k}</Text>
                <Text strong style={{ fontSize: 16 }}>{v}명</Text>
              </Card>
            </Col>
          ))}
      </Row>
    </Card>
  );

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <IdcardOutlined style={{ marginRight: 8 }} />
            인사 명부
          </Title>
          <Text type="secondary">회사 · 부서 · 직급별 인원 현황</Text>
        </div>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>엑셀 다운로드</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="총 인원" value={stats.total} suffix="명" prefix={<TeamOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="재직" value={stats.active} suffix="명" valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="비활성/퇴사" value={stats.resigned} suffix="명" valueStyle={{ color: '#999' }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="회사 수" value={stats.byCompany.size} suffix="개" prefix={<BankOutlined />} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          {isSuperAdmin && (
            <Select
              placeholder="회사"
              value={filterCompany}
              onChange={setFilterCompany}
              allowClear
              style={{ width: 160 }}
              options={companies.map((c: any) => ({ value: c.id, label: c.name }))}
            />
          )}
          <Select
            placeholder="부서"
            value={filterDept}
            onChange={setFilterDept}
            allowClear
            style={{ width: 180 }}
            options={departments
              .filter((d: any) => !filterCompany || d.company_id === filterCompany)
              .map((d: any) => ({ value: d.id, label: d.name }))}
          />
          <Select
            placeholder="직급"
            value={filterRank}
            onChange={setFilterRank}
            allowClear
            style={{ width: 140 }}
            options={distinctRanks.map((r) => ({ value: r, label: r }))}
          />
          <Input
            placeholder="이름/사번/이메일 검색"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 220 }}
          />
          <Switch
            checked={showActiveOnly}
            onChange={setShowActiveOnly}
            checkedChildren="재직만"
            unCheckedChildren="전체"
          />
        </Space>
      </Card>

      <Tabs
        activeKey={view}
        onChange={(k) => setView(k as 'roster' | 'summary')}
        items={[
          { key: 'roster', label: '명부' },
          { key: 'summary', label: '집계' },
        ]}
      />

      {view === 'roster' && (
        <Card>
          <ResizableTable
            columns={columns as any}
            dataSource={filteredUsers}
            rowKey="id"
            loading={loading}
            pagination={{ showSizeChanger: true, showTotal: (t) => `총 ${t}명` }}
            scroll={{ x: 1200 }}
            onRow={(record: any) => ({
              onClick: () => openDetail(record),
              style: { cursor: 'pointer' },
            })}
          />
        </Card>
      )}

      <Modal
        title={
          <Space>
            <UserOutlined />
            <span>{editMode ? '인사정보 수정' : '인사정보 상세'}</span>
          </Space>
        }
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setEditMode(false); }}
        destroyOnClose
        width={780}
        footer={[
          <Button key="close" onClick={() => { setDetailOpen(false); setEditMode(false); }}>닫기</Button>,
          canEdit && !editMode && (
            <Button key="edit" type="primary" icon={<EditOutlined />} onClick={enterEditMode}>수정</Button>
          ),
          canEdit && editMode && (
            <Button key="save" type="primary" loading={saving} onClick={handleSave}>저장</Button>
          ),
        ].filter(Boolean) as any}
      >
        {selectedUser && !editMode && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="회사">{companyMap[selectedUser.company_id]?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="부서">{deptMap[selectedUser.department_id]?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="사번">{selectedUser.employee_number || '-'}</Descriptions.Item>
            <Descriptions.Item label="이름">{selectedUser.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="직급">{selectedUser.rank || '-'}</Descriptions.Item>
            <Descriptions.Item label="직책">{selectedUser.position || '-'}</Descriptions.Item>
            <Descriptions.Item label="역할">{ROLE_LABELS[selectedUser.role] || selectedUser.role || '-'}</Descriptions.Item>
            <Descriptions.Item label="재직상태">
              {selectedUser.is_active ? '재직' : (selectedUser.resignation_date ? `퇴사(${selectedUser.resignation_date})` : '비활성')}
            </Descriptions.Item>
            <Descriptions.Item label="입사일">{selectedUser.hire_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="근속">{tenureYears(selectedUser.hire_date) || '-'}</Descriptions.Item>
            <Descriptions.Item label="생일">{selectedUser.birth_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="주소" span={2}>{selectedUser.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="연락처">{selectedUser.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="직통전화">{selectedUser.direct_phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="이메일" span={2}>{selectedUser.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="비상연락(이름)">{selectedUser.emergency_contact_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="비상연락(전화)">{selectedUser.emergency_contact_phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="비상연락(관계)" span={2}>{selectedUser.emergency_contact_relation || '-'}</Descriptions.Item>
            {isSuperAdmin && (
              <>
                <Descriptions.Item label="🔒 은행">{selectedUser.bank_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="🔒 계좌번호">{selectedUser.bank_account || '-'}</Descriptions.Item>
              </>
            )}
          </Descriptions>
        )}

        {selectedUser && editMode && (
          <Form form={editForm} layout="vertical">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="name" label="이름" rules={[{ required: true, message: '이름을 입력해주세요.' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="employee_number" label="사번"><Input /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="rank" label="직급"><Input /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="position" label="직책"><Input /></Form.Item>
              </Col>
              {isSuperAdmin && (
                <Col span={12}>
                  <Form.Item name="role" label="역할">
                    <Select
                      options={Object.entries(ROLE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                    />
                  </Form.Item>
                </Col>
              )}
              {isSuperAdmin && (
                <Col span={12}>
                  <Form.Item name="company_id" label="회사">
                    <Select
                      options={companies.map((c: any) => ({ value: c.id, label: c.name }))}
                      allowClear
                    />
                  </Form.Item>
                </Col>
              )}
              <Col span={12}>
                <Form.Item name="department_id" label="부서">
                  <Select
                    options={departments.map((d: any) => ({ value: d.id, label: d.name }))}
                    allowClear
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="hire_date" label="입사일">
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="birth_date" label="생일">
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="address" label="주소"><Input /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="phone" label="연락처"><Input /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="direct_phone" label="직통전화"><Input /></Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="email" label="이메일" rules={[{ type: 'email', message: '올바른 이메일 형식이 아닙니다.' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="emergency_contact_name" label="비상연락(이름)"><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="emergency_contact_phone" label="비상연락(전화)"><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="emergency_contact_relation" label="비상연락(관계)"><Input /></Form.Item>
              </Col>
              {isSuperAdmin && (
                <>
                  <Col span={12}>
                    <Form.Item name="bank_name" label="🔒 은행 (슈퍼관리자 전용)"><Input /></Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="bank_account" label="🔒 계좌번호 (슈퍼관리자 전용)"><Input /></Form.Item>
                  </Col>
                </>
              )}
            </Row>
          </Form>
        )}
      </Modal>

      {view === 'summary' && (
        <div>
          {summaryRow('회사별 인원', stats.byCompany)}
          {summaryRow('부서별 인원', stats.byDept)}
          {summaryRow('직급별 인원', stats.byRank)}
          {summaryRow('역할별 인원', stats.byRole)}
        </div>
      )}
    </div>
  );
};

export default HRRoster;
