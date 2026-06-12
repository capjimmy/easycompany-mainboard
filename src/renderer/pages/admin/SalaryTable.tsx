import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Table, Input, InputNumber, Button, message, Space, Tag, Select, Modal,
} from 'antd';
import { LockOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

interface Row {
  id: string;
  name: string;
  username: string;
  position: string;
  department_name: string;
  company_name: string;
  monthly_salary: number;
  annual_salary: number;
}

const SalaryTable: React.FC = () => {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [filterCompany, setFilterCompany] = useState<string | undefined>();
  const [filterDept, setFilterDept] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [uRes, sRes] = await Promise.all([
        window.electronAPI.users.getAll(user.id),
        (window as any).electronAPI.userSalary.getAll(user.id),
      ]);
      if (!sRes.success) {
        message.error(sRes.error || '권한 없음');
        setLoading(false);
        return;
      }
      const salaryByUser: Record<string, number> = {};
      for (const s of sRes.data || []) salaryByUser[s.user_id] = Number(s.monthly_salary || 0);
      const allUsers = (uRes.users || []).filter((u: any) => u.is_active);
      const built: Row[] = allUsers.map((u: any) => ({
        id: u.id,
        name: u.name || '',
        username: u.username || '',
        position: u.position || '',
        department_name: u.department_name || '',
        company_name: u.company_name || '',
        monthly_salary: salaryByUser[u.id] || 0,
        annual_salary: (salaryByUser[u.id] || 0) * 12,
      }));
      setRows(built);
    } catch (e: any) {
      message.error(e?.message || '조회 실패');
    } finally { setLoading(false); }
  };

  const startEdit = (r: Row) => {
    setEditingId(r.id);
    setEditValue(r.monthly_salary);
  };

  const saveEdit = async (id: string) => {
    if (!user?.id) return;
    const res = await (window as any).electronAPI.userSalary.set(user.id, id, editValue);
    if (res.success) {
      message.success('저장됨');
      setEditingId(null);
      load();
    } else {
      message.error(res.error || '저장 실패');
    }
  };

  if (!isSuperAdmin) {
    return (
      <Card style={{ textAlign: 'center', padding: 60 }}>
        <LockOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />
        <Title level={4} style={{ marginTop: 16 }}>슈퍼관리자 전용 메뉴</Title>
        <Text type="secondary">이 페이지는 슈퍼관리자만 접근 가능합니다.</Text>
      </Card>
    );
  }

  // 필터 옵션
  const companies = Array.from(new Set(rows.map(r => r.company_name).filter(Boolean)));
  const departments = Array.from(new Set(rows.map(r => r.department_name).filter(Boolean)));

  const filtered = rows.filter(r => {
    if (filterCompany && r.company_name !== filterCompany) return false;
    if (filterDept && r.department_name !== filterDept) return false;
    if (searchText && !`${r.name} ${r.username} ${r.position}`.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const totalMonthly = filtered.reduce((s, r) => s + r.monthly_salary, 0);
  const totalAnnual = totalMonthly * 12;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <LockOutlined /> 연봉 테이블 <Tag color="purple">슈퍼관리자 전용</Tag>
          </Title>
          <Text type="secondary">직원별 월급/연봉 일괄 관리 · 행 클릭 후 수정</Text>
        </div>
        <Space wrap>
          <Input.Search placeholder="이름/직급 검색" allowClear style={{ width: 200 }}
            value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          <Select placeholder="회사" allowClear style={{ width: 160 }}
            value={filterCompany} onChange={setFilterCompany}
            options={companies.map(c => ({ value: c, label: c }))} />
          <Select placeholder="부서" allowClear style={{ width: 160 }}
            value={filterDept} onChange={setFilterDept}
            options={departments.map(d => ({ value: d, label: d }))} />
        </Space>
      </div>

      {/* 총합 카드 */}
      <Card size="small" style={{ marginBottom: 12, background: 'linear-gradient(135deg, #f0f5ff 0%, #f6ffed 100%)' }}>
        <Space size={48}>
          <div>
            <Text type="secondary">대상 직원 수</Text>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{filtered.length}명</div>
          </div>
          <div>
            <Text type="secondary">월 인건비 합계</Text>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1890ff' }}>{totalMonthly.toLocaleString()}원</div>
          </div>
          <div>
            <Text type="secondary">연 인건비 합계</Text>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#722ed1' }}>{totalAnnual.toLocaleString()}원</div>
          </div>
        </Space>
      </Card>

      <Card size="small">
        <Table
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 30 }}
          size="small"
          scroll={{ x: 1000 }}
          columns={[
            { title: '이름', dataIndex: 'name', width: 100, fixed: 'left' as const, sorter: (a, b) => a.name.localeCompare(b.name) },
            { title: 'ID', dataIndex: 'username', width: 100 },
            { title: '직급', dataIndex: 'position', width: 120 },
            { title: '부서', dataIndex: 'department_name', width: 140 },
            { title: '회사', dataIndex: 'company_name', width: 150 },
            {
              title: '월급',
              dataIndex: 'monthly_salary',
              width: 180,
              align: 'right' as const,
              sorter: (a, b) => a.monthly_salary - b.monthly_salary,
              render: (v: number, r: Row) => editingId === r.id ? (
                <Space.Compact style={{ width: '100%' }}>
                  <InputNumber
                    style={{ width: '100%' }}
                    value={editValue}
                    onChange={(n) => setEditValue(Number(n || 0))}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(v) => v!.replace(/,/g, '') as unknown as number}
                    autoFocus
                  />
                  <Button icon={<SaveOutlined />} type="primary" onClick={() => saveEdit(r.id)} />
                </Space.Compact>
              ) : (
                <span style={{ cursor: 'pointer', display: 'block', textAlign: 'right' }} onClick={() => startEdit(r)}>
                  {v > 0 ? `${v.toLocaleString()}원` : <Text type="secondary">미설정</Text>}
                </span>
              ),
            },
            {
              title: '연봉',
              dataIndex: 'annual_salary',
              width: 180,
              align: 'right' as const,
              render: (v: number) => v > 0 ? `${v.toLocaleString()}원` : '-',
            },
            {
              title: '',
              key: 'action',
              width: 60,
              render: (_: any, r: Row) => (
                <Button size="small" type="link" icon={<EditOutlined />} onClick={() => startEdit(r)}>수정</Button>
              ),
            },
          ]}
          summary={() => (
            <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 700 }}>
              <Table.Summary.Cell index={0} colSpan={5}>합계 ({filtered.length}명)</Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">{totalMonthly.toLocaleString()}원</Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">{totalAnnual.toLocaleString()}원</Table.Summary.Cell>
              <Table.Summary.Cell index={7}></Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </div>
  );
};

export default SalaryTable;
