import React from 'react';
import { Table, Card, Typography, Tag, Space, Button } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { MENU_STRUCTURE, DEFAULT_PERMISSIONS, ROLE_LABELS } from '../../../shared/constants/menu';

const { Title, Text } = Typography;

// 역할 목록
const ROLES = ['super_admin', 'company_admin', 'department_manager', 'employee'] as const;
const PERM_TYPES = ['view', 'create', 'edit', 'delete'] as const;
const PERM_LABELS: Record<string, string> = {
  view: '조회',
  create: '생성',
  edit: '수정',
  delete: '삭제',
};

// 메뉴 아이템 플랫하게 펼치기
function flattenMenuItems() {
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
}

// 권한 아이콘 렌더
function PermIcon({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
  ) : (
    <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 16 }} />
  );
}

const PermissionMatrix: React.FC = () => {
  const navigate = useNavigate();
  const menuItems = flattenMenuItems();

  // 데이터소스 구축: 각 메뉴 아이템 x 각 역할 x 각 권한 타입
  const dataSource = menuItems.map((item) => {
    const row: any = {
      key: item.key,
      menuLabel: item.label,
      parentLabel: item.parent,
    };

    ROLES.forEach((role) => {
      const perms = (DEFAULT_PERMISSIONS as any)[role]?.[item.key];
      PERM_TYPES.forEach((pt) => {
        row[`${role}_${pt}`] = perms?.[pt] || false;
      });
    });

    return row;
  });

  const columns: any[] = [
    {
      title: '메뉴',
      key: 'menu',
      fixed: 'left' as const,
      width: 220,
      render: (_: any, record: any) => (
        <div>
          <Tag color="blue" style={{ marginRight: 6 }}>{record.parentLabel}</Tag>
          <Text strong>{record.menuLabel}</Text>
        </div>
      ),
    },
    ...ROLES.map((role) => ({
      title: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {ROLE_LABELS[role] || role}
          </div>
        </div>
      ),
      children: PERM_TYPES.map((pt) => ({
        title: <span style={{ fontSize: 12 }}>{PERM_LABELS[pt]}</span>,
        dataIndex: `${role}_${pt}`,
        key: `${role}_${pt}`,
        width: 60,
        align: 'center' as const,
        render: (allowed: boolean) => <PermIcon allowed={allowed} />,
        onCell: (record: any) => ({
          style: {
            backgroundColor: record[`${role}_${pt}`]
              ? 'rgba(82, 196, 26, 0.06)'
              : 'rgba(255, 77, 79, 0.04)',
          },
        }),
      })),
    })),
  ];

  return (
    <div className="fade-in">
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/admin/permissions')}
            />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                권한 매트릭스
              </Title>
              <Text type="secondary">
                역할별 메뉴 접근 권한을 한눈에 확인할 수 있습니다. (기본 권한 기준, 읽기 전용)
              </Text>
            </div>
          </Space>
        </div>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space size="large">
            <Space size={4}>
              <CheckCircleFilled style={{ color: '#52c41a' }} />
              <Text type="secondary">허용</Text>
            </Space>
            <Space size={4}>
              <CloseCircleFilled style={{ color: '#ff4d4f' }} />
              <Text type="secondary">거부</Text>
            </Space>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey="key"
          pagination={false}
          size="small"
          bordered
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default PermissionMatrix;
