import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Typography, Button, Table, Space, InputNumber, Select, Input,
  message, Tag, Empty, Collapse, Popconfirm, Row, Col, Switch, Modal, Tree, Spin, Checkbox
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, AppstoreOutlined, SubnodeOutlined, ImportOutlined
} from '@ant-design/icons';

import { useAuthStore } from '../../store/authStore';
import type { LaborGrade, ExpenseCategory } from '../../../shared/types';

const { Text } = Typography;
const { Option } = Select;

interface LaborItem {
  key: string;
  grade_id: string;
  grade_name: string;
  quantity: number;
  participation_rate: number;
  months: number;
  unit_price: number;
  subtotal: number;
}

interface ExpenseItem {
  key: string;
  category_id: string;
  category_name: string;
  calculation_type: 'manual' | 'percentage' | 'fixed';
  rate?: number;
  amount: number;
  note?: string;
}

interface SectionItem {
  id: string;
  parent_id: string | null;
  level: number;
  title: string;
  description?: string;
  amount: number;
  sort_order: number;
}

interface ContractItemsEditorProps {
  contractId?: string;
  laborItems: LaborItem[];
  expenseItems: ExpenseItem[];
  sections: SectionItem[];
  onLaborChange: (items: LaborItem[]) => void;
  onExpenseChange: (items: ExpenseItem[]) => void;
  onSectionChange: (items: SectionItem[]) => void;
  vatEnabled?: boolean;
  onVatEnabledChange?: (enabled: boolean) => void;
}

const ContractItemsEditor: React.FC<ContractItemsEditorProps> = ({
  contractId,
  laborItems,
  expenseItems,
  sections,
  onLaborChange,
  onExpenseChange,
  onSectionChange,
  vatEnabled = true,
  onVatEnabledChange,
}) => {
  const { user } = useAuthStore();
  const [laborGrades, setLaborGrades] = useState<LaborGrade[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);

  // 사전항목 불러오기
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [presetSections, setPresetSections] = useState<any[]>([]);
  const [presetCheckedKeys, setPresetCheckedKeys] = useState<React.Key[]>([]);
  const [presetLoading, setPresetLoading] = useState(false);

  // 단가/경비 설정 로드
  const { selectedCompanyId } = useAuthStore();
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;
      let companyId = selectedCompanyId || user.company_id;
      if (!companyId && user.role === 'super_admin') {
        try {
          const result = await window.electronAPI.companies.getAll(user.id);
          if (result.success && result.companies?.length > 0) {
            companyId = result.companies[0].id;
          }
        } catch {}
      }
      if (!companyId) return;

      try {
        const result = await window.electronAPI.priceSettings.getAll(user.id, companyId);
        if (result.success) {
          setLaborGrades(result.laborGrades || []);
          setExpenseCategories(result.expenseCategories || []);
        }
      } catch {}
    };
    loadSettings();
  }, [user?.id, selectedCompanyId]);

  const laborTotal = laborItems.reduce((sum, item) => sum + item.subtotal, 0);
  const expenseTotal = expenseItems.reduce((sum, item) => sum + item.amount, 0);

  // 상세내역 합계 (최상위 레벨만)
  const level1Sections = sections.filter(s => s.level === 1);
  const sectionTotal = level1Sections.reduce((sum, s) => sum + (s.amount || 0), 0);

  const totalAmount = laborTotal + expenseTotal + sectionTotal;
  const vatAmount = vatEnabled ? Math.round(totalAmount * 0.1) : 0;
  const grandTotal = totalAmount + vatAmount;

  // ========== 인건비 ==========
  const addLaborItem = () => {
    const newItem: LaborItem = {
      key: `labor-${Date.now()}`,
      grade_id: '',
      grade_name: '',
      quantity: 1,
      participation_rate: 1,
      months: 1,
      unit_price: 0,
      subtotal: 0,
    };
    onLaborChange([...laborItems, newItem]);
  };

  const updateLaborItem = (key: string, field: string, value: any) => {
    const updated = laborItems.map(item => {
      if (item.key !== key) return item;
      const newItem = { ...item, [field]: value };

      if (field === 'grade_id') {
        const grade = laborGrades.find(g => g.id === value);
        if (grade) {
          newItem.grade_name = grade.name;
          newItem.unit_price = grade.unit_price;
        }
      }

      newItem.subtotal = (newItem.quantity || 0) * (newItem.participation_rate || 1) * (newItem.months || 0) * (newItem.unit_price || 0);
      return newItem;
    });
    onLaborChange(updated);
  };

  const removeLaborItem = (key: string) => {
    onLaborChange(laborItems.filter(item => item.key !== key));
  };

  const laborColumns = [
    {
      title: '등급',
      dataIndex: 'grade_id',
      width: 160,
      render: (_: any, record: LaborItem) => (
        <Select
          value={record.grade_id || undefined}
          onChange={(value) => updateLaborItem(record.key, 'grade_id', value)}
          placeholder="등급 선택"
          style={{ width: '100%' }}
          size="small"
        >
          {laborGrades.map(grade => (
            <Option key={grade.id} value={grade.id}>
              {grade.name} ({grade.unit_price?.toLocaleString()}원)
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: '인원',
      dataIndex: 'quantity',
      width: 80,
      render: (_: any, record: LaborItem) => (
        <InputNumber
          value={record.quantity}
          onChange={(val) => updateLaborItem(record.key, 'quantity', val || 0)}
          min={0}
          size="small"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '투입률',
      dataIndex: 'participation_rate',
      width: 90,
      render: (_: any, record: LaborItem) => (
        <InputNumber
          value={record.participation_rate}
          onChange={(val) => updateLaborItem(record.key, 'participation_rate', val || 0)}
          min={0}
          max={1}
          step={0.1}
          size="small"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '개월',
      dataIndex: 'months',
      width: 80,
      render: (_: any, record: LaborItem) => (
        <InputNumber
          value={record.months}
          onChange={(val) => updateLaborItem(record.key, 'months', val || 0)}
          min={0}
          step={0.5}
          size="small"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '단가',
      dataIndex: 'unit_price',
      width: 120,
      render: (_: any, record: LaborItem) => (
        <InputNumber
          value={record.unit_price}
          onChange={(val) => updateLaborItem(record.key, 'unit_price', val || 0)}
          min={0}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(v) => v!.replace(/,/g, '') as unknown as number}
          size="small"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '소계',
      dataIndex: 'subtotal',
      width: 120,
      render: (_: any, record: LaborItem) => (
        <Text strong>{record.subtotal.toLocaleString()}원</Text>
      ),
    },
    {
      title: '',
      width: 40,
      render: (_: any, record: LaborItem) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeLaborItem(record.key)} />
      ),
    },
  ];

  // ========== 경비 ==========
  const addExpenseItem = () => {
    const newItem: ExpenseItem = {
      key: `expense-${Date.now()}`,
      category_id: '',
      category_name: '',
      calculation_type: 'manual',
      amount: 0,
    };
    onExpenseChange([...expenseItems, newItem]);
  };

  const updateExpenseItem = (key: string, field: string, value: any) => {
    const updated = expenseItems.map(item => {
      if (item.key !== key) return item;
      const newItem = { ...item, [field]: value };

      if (field === 'category_id') {
        const cat = expenseCategories.find(c => c.id === value);
        if (cat) {
          newItem.category_name = cat.name;
          if (cat.calculation_type === 'percentage') {
            newItem.calculation_type = 'percentage';
            newItem.rate = cat.default_rate || 0;
            newItem.amount = Math.round(laborTotal * (cat.default_rate || 0));
          } else if (cat.calculation_type === 'fixed') {
            newItem.calculation_type = 'fixed';
            newItem.amount = cat.default_amount || 0;
          }
        }
      }

      if (field === 'calculation_type' && value === 'percentage' && newItem.rate) {
        newItem.amount = Math.round(laborTotal * newItem.rate);
      }
      if (field === 'rate' && newItem.calculation_type === 'percentage') {
        newItem.amount = Math.round(laborTotal * (value || 0));
      }

      return newItem;
    });
    onExpenseChange(updated);
  };

  const removeExpenseItem = (key: string) => {
    onExpenseChange(expenseItems.filter(item => item.key !== key));
  };

  // 인건비 합계 변경 시 비율 기반 경비 재계산
  useEffect(() => {
    const needsUpdate = expenseItems.some(item => item.calculation_type === 'percentage');
    if (needsUpdate) {
      const updated = expenseItems.map(item => {
        if (item.calculation_type === 'percentage' && item.rate) {
          return { ...item, amount: Math.round(laborTotal * item.rate) };
        }
        return item;
      });
      onExpenseChange(updated);
    }
  }, [laborTotal]);

  const expenseColumns = [
    {
      title: '항목',
      dataIndex: 'category_id',
      width: 160,
      render: (_: any, record: ExpenseItem) => (
        <Select
          value={record.category_id || undefined}
          onChange={(value) => updateExpenseItem(record.key, 'category_id', value)}
          placeholder="항목 선택"
          style={{ width: '100%' }}
          size="small"
        >
          {expenseCategories.map(cat => (
            <Option key={cat.id} value={cat.id}>{cat.name}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: '계산방식',
      dataIndex: 'calculation_type',
      width: 120,
      render: (_: any, record: ExpenseItem) => (
        <Select
          value={record.calculation_type}
          onChange={(value) => updateExpenseItem(record.key, 'calculation_type', value)}
          size="small"
          style={{ width: '100%' }}
        >
          <Option value="manual">직접입력</Option>
          <Option value="percentage">인건비 비율</Option>
          <Option value="fixed">고정금액</Option>
        </Select>
      ),
    },
    {
      title: '비율',
      dataIndex: 'rate',
      width: 90,
      render: (_: any, record: ExpenseItem) => record.calculation_type === 'percentage' ? (
        <InputNumber
          value={record.rate ? record.rate * 100 : 0}
          onChange={(val) => updateExpenseItem(record.key, 'rate', (val || 0) / 100)}
          min={0}
          max={100}
          formatter={(v) => `${v}%`}
          parser={(v) => v!.replace('%', '') as unknown as number}
          size="small"
          style={{ width: '100%' }}
        />
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: '금액',
      dataIndex: 'amount',
      width: 130,
      render: (_: any, record: ExpenseItem) => (
        <InputNumber
          value={record.amount}
          onChange={(val) => updateExpenseItem(record.key, 'amount', val || 0)}
          min={0}
          disabled={record.calculation_type === 'percentage'}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(v) => v!.replace(/,/g, '') as unknown as number}
          size="small"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '비고',
      dataIndex: 'note',
      render: (_: any, record: ExpenseItem) => (
        <Input
          value={record.note}
          onChange={(e) => updateExpenseItem(record.key, 'note', e.target.value)}
          size="small"
          placeholder="비고"
        />
      ),
    },
    {
      title: '',
      width: 40,
      render: (_: any, record: ExpenseItem) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeExpenseItem(record.key)} />
      ),
    },
  ];

  // ========== 상세내역 (섹션) ==========
  const addSection = (level: number, parentId: string | null = null) => {
    const newSection: SectionItem = {
      id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      parent_id: parentId,
      level,
      title: '',
      amount: 0,
      sort_order: sections.filter(s => s.parent_id === parentId).length,
    };
    onSectionChange([...sections, newSection]);
  };

  const updateSection = (id: string, field: string, value: any) => {
    const updated = sections.map(s => s.id === id ? { ...s, [field]: value } : s);

    // 하위 항목 합계로 상위 금액 자동 계산
    if (field === 'amount') {
      const recalc = (items: SectionItem[]): SectionItem[] => {
        return items.map(item => {
          const children = items.filter(c => c.parent_id === item.id);
          if (children.length > 0) {
            return { ...item, amount: children.reduce((sum, c) => sum + (c.amount || 0), 0) };
          }
          return item;
        });
      };
      onSectionChange(recalc(updated));
    } else {
      onSectionChange(updated);
    }
  };

  const removeSection = (id: string) => {
    // 하위 항목도 삭제
    const toRemove = new Set<string>();
    const collectChildren = (parentId: string) => {
      toRemove.add(parentId);
      sections.filter(s => s.parent_id === parentId).forEach(child => collectChildren(child.id));
    };
    collectChildren(id);
    onSectionChange(sections.filter(s => !toRemove.has(s.id)));
  };

  // ========== 사전항목 불러오기 ==========
  const openPresetModal = async () => {
    if (!user?.id) return;
    setPresetLoading(true);
    setPresetCheckedKeys([]);
    let companyId = user.company_id;
    if (!companyId && user.role === 'super_admin') {
      try {
        const result = await window.electronAPI.companies.getAll(user.id);
        if (result.success && result.companies?.length > 0) companyId = result.companies[0].id;
      } catch {}
    }
    if (!companyId) { setPresetLoading(false); return; }
    try {
      const result = await window.electronAPI.quotePresetSections.getByCompany(user.id, companyId);
      if (result.success) setPresetSections(result.sections || []);
      else message.error(result.error || '사전 항목을 불러올 수 없습니다.');
    } catch { message.error('사전 항목을 불러오는 중 오류가 발생했습니다.'); }
    setPresetLoading(false);
    setPresetModalVisible(true);
  };

  const buildPresetTreeData = () => {
    const buildLevel = (parentId: string | null, level: number): any[] => {
      return presetSections
        .filter(s => s.parent_id === parentId && s.level === level)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(s => ({
          key: s.id,
          title: s.title + (s.default_amount ? ` (${s.default_amount.toLocaleString()}원)` : ''),
          children: buildLevel(s.id, level + 1),
          presetData: s,
        }));
    };
    return buildLevel(null, 1);
  };

  const handlePresetImport = () => {
    if (presetCheckedKeys.length === 0) {
      message.warning('불러올 항목을 선택해주세요.');
      return;
    }
    const selectedIds = new Set(presetCheckedKeys.map(k => String(k)));
    // Include parents of selected items
    const ensureParents = (id: string) => {
      const item = presetSections.find(s => s.id === id);
      if (item?.parent_id && !selectedIds.has(item.parent_id)) {
        selectedIds.add(item.parent_id);
        ensureParents(item.parent_id);
      }
    };
    presetCheckedKeys.forEach(k => ensureParents(String(k)));

    const newSections: SectionItem[] = [];
    const idMap = new Map<string, string>();

    const processLevel = (parentPresetId: string | null, level: number, newParentId: string | null) => {
      const items = presetSections
        .filter(s => {
          if (parentPresetId) return s.parent_id === parentPresetId && selectedIds.has(s.id);
          return s.level === 1 && !s.parent_id && selectedIds.has(s.id);
        })
        .sort((a, b) => a.sort_order - b.sort_order);

      items.forEach((item, idx) => {
        const newId = `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        idMap.set(item.id, newId);
        newSections.push({
          id: newId,
          parent_id: newParentId,
          level,
          title: item.title,
          amount: item.default_amount || 0,
          sort_order: sections.filter(s => s.parent_id === newParentId).length + idx,
        });
        processLevel(item.id, level + 1, newId);
      });
    };
    processLevel(null, 1, null);
    onSectionChange([...sections, ...newSections]);
    setPresetModalVisible(false);
    message.success(`${newSections.length}개 항목이 추가되었습니다.`);
  };

  // ========== 일괄 불러오기 ==========
  const loadAllLaborGrades = () => {
    if (laborGrades.length === 0) {
      message.warning('등록된 인건비 등급이 없습니다. 단가 설정에서 먼저 등록해주세요.');
      return;
    }
    const newItems: LaborItem[] = laborGrades.map((grade, idx) => ({
      key: `labor-${Date.now()}-${idx}`,
      grade_id: grade.id,
      grade_name: grade.name,
      quantity: 1,
      participation_rate: 1,
      months: 1,
      unit_price: grade.unit_price || grade.monthly_rate || 0,
      subtotal: grade.unit_price || grade.monthly_rate || 0,
    }));
    onLaborChange([...laborItems, ...newItems]);
    message.success(`${newItems.length}개 인건비 등급이 추가되었습니다.`);
  };

  const loadAllExpenseCategories = () => {
    if (expenseCategories.length === 0) {
      message.warning('등록된 경비 항목이 없습니다. 단가 설정에서 먼저 등록해주세요.');
      return;
    }
    const currentLaborTotal = laborItems.reduce((sum, item) => sum + item.subtotal, 0);
    const newItems: ExpenseItem[] = expenseCategories.map((cat, idx) => {
      let amount = 0;
      if (cat.calculation_type === 'percentage' && cat.default_rate) {
        amount = Math.round(currentLaborTotal * cat.default_rate);
      } else if (cat.calculation_type === 'fixed' && cat.default_amount) {
        amount = cat.default_amount;
      }
      return {
        key: `expense-${Date.now()}-${idx}`,
        category_id: cat.id,
        category_name: cat.name,
        calculation_type: cat.calculation_type || 'manual',
        rate: cat.default_rate || undefined,
        amount,
      };
    });
    onExpenseChange([...expenseItems, ...newItems]);
    message.success(`${newItems.length}개 경비 항목이 추가되었습니다.`);
  };

  const renderSections = (parentId: string | null, level: number) => {
    const items = sections.filter(s => s.parent_id === parentId && s.level === level);
    if (items.length === 0 && level === 1) {
      return <Empty description="상세내역이 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    const levelLabels: Record<number, string> = { 1: '대분류', 2: '세부', 3: '세세부' };

    return items.map((item, idx) => {
      const children = sections.filter(s => s.parent_id === item.id);
      const hasChildren = children.length > 0;
      const childSum = hasChildren ? children.reduce((sum, c) => sum + (c.amount || 0), 0) : 0;

      return (
        <div key={item.id} style={{ marginBottom: 8, marginLeft: (level - 1) * 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <Tag color={level === 1 ? 'blue' : level === 2 ? 'cyan' : 'default'}>
              {levelLabels[level]}
            </Tag>
            <Input
              value={item.title}
              onChange={(e) => updateSection(item.id, 'title', e.target.value)}
              placeholder={`${levelLabels[level]} 항목명`}
              size="small"
              style={{ width: 250 }}
            />
            <InputNumber
              value={hasChildren ? childSum : item.amount}
              onChange={(val) => updateSection(item.id, 'amount', val || 0)}
              disabled={hasChildren}
              min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => v!.replace(/,/g, '') as unknown as number}
              size="small"
              style={{ width: 140 }}
              addonAfter="원"
            />
            {level < 3 && (
              <Button
                type="text"
                size="small"
                icon={<SubnodeOutlined />}
                onClick={() => addSection(level + 1, item.id)}
              >
                {level === 1 ? '세부' : '세세부'}
              </Button>
            )}
            <Popconfirm title="삭제하시겠습니까?" onConfirm={() => removeSection(item.id)}>
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>
          {renderSections(item.id, level + 1)}
        </div>
      );
    });
  };

  return (
    <>
      {/* 인건비 */}
      <Card
        title={
          <Space>
            <span>인건비</span>
            <Tag color="blue">{laborTotal.toLocaleString()}원</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button type="default" size="small" icon={<ImportOutlined />} onClick={loadAllLaborGrades}>
              단가표 불러오기
            </Button>
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addLaborItem}>
              인건비 추가
            </Button>
          </Space>
        }
      >
        {laborItems.length === 0 ? (
          <Empty description="인건비 항목이 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            columns={laborColumns}
            dataSource={laborItems}
            rowKey="key"
            pagination={false}
            size="small"
          />
        )}
      </Card>

      {/* 경비 */}
      <Card
        title={
          <Space>
            <span>경비</span>
            <Tag color="green">{expenseTotal.toLocaleString()}원</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button type="default" size="small" icon={<ImportOutlined />} onClick={loadAllExpenseCategories}>
              경비항목 불러오기
            </Button>
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addExpenseItem}>
              경비 추가
            </Button>
          </Space>
        }
      >
        {expenseItems.length === 0 ? (
          <Empty description="경비 항목이 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            columns={expenseColumns}
            dataSource={expenseItems}
            rowKey="key"
            pagination={false}
            size="small"
          />
        )}
      </Card>

      {/* 상세내역 */}
      <Card
        title={
          <Space>
            <AppstoreOutlined />
            <span>상세내역</span>
            <Tag color="purple">{sectionTotal.toLocaleString()}원</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button type="default" size="small" icon={<ImportOutlined />} onClick={openPresetModal}>
              사전항목 불러오기
            </Button>
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addSection(1)}>
              대분류 추가
            </Button>
          </Space>
        }
      >
        {renderSections(null, 1)}
      </Card>

      {/* 합계 카드 */}
      <Card style={{ marginBottom: 16, background: '#f6ffed' }}>
        <Row gutter={16}>
          <Col span={6}>
            <Text type="secondary">인건비</Text>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{laborTotal.toLocaleString()}원</div>
          </Col>
          <Col span={6}>
            <Text type="secondary">경비</Text>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{expenseTotal.toLocaleString()}원</div>
          </Col>
          <Col span={6}>
            <Text type="secondary">상세내역</Text>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{sectionTotal.toLocaleString()}원</div>
          </Col>
          <Col span={6}>
            <Text type="secondary">합계 (VAT 별도)</Text>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1890ff' }}>{totalAmount.toLocaleString()}원</div>
          </Col>
        </Row>
        <Row gutter={16} style={{ marginTop: 8 }} align="middle">
          <Col span={12}>
            <Space>
              <Switch
                checked={vatEnabled}
                onChange={(checked) => onVatEnabledChange?.(checked)}
                checkedChildren="VAT 포함"
                unCheckedChildren="VAT 없음"
              />
              <Text type="secondary">VAT{vatEnabled ? ' (10%)' : ''}: {vatAmount.toLocaleString()}원</Text>
            </Space>
          </Col>
          <Col span={6} />
          <Col span={6}>
            <Text type="secondary">총액 (VAT 포함)</Text>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#722ed1' }}>{grandTotal.toLocaleString()}원</div>
          </Col>
        </Row>
      </Card>

      {/* 사전 항목 불러오기 모달 */}
      <Modal
        title="사전 항목 불러오기"
        open={presetModalVisible}
        onCancel={() => setPresetModalVisible(false)}
        onOk={handlePresetImport}
        okText="선택 항목 추가"
        cancelText="취소"
        width={600}
        destroyOnClose
      >
        {presetLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : buildPresetTreeData().length === 0 ? (
          <Empty description="등록된 사전 항목이 없습니다. 설정 > 단가 설정 > 견적 항목 관리에서 추가해주세요." />
        ) : (
          <Tree
            checkable
            defaultExpandAll
            checkedKeys={presetCheckedKeys}
            onCheck={(checked: any) => {
              if (Array.isArray(checked)) setPresetCheckedKeys(checked);
              else setPresetCheckedKeys(checked.checked);
            }}
            treeData={buildPresetTreeData()}
          />
        )}
      </Modal>
    </>
  );
};

export default ContractItemsEditor;
