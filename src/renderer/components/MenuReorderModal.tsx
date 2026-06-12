import React, { useState, useEffect, useMemo } from 'react';
import { Modal, List, Button, Space, Typography, message, Tooltip } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined, MenuOutlined,
} from '@ant-design/icons';
import { MENU_STRUCTURE } from '../../shared/constants/menu';
import { useAuthStore } from '../store/authStore';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;  // 저장 후 부모에 알림 (메뉴 즉시 재렌더용)
}

const MenuReorderModal: React.FC<Props> = ({ open, onClose, onSaved }) => {
  const { user, updateUserMenuOrder } = useAuthStore() as any;
  const defaultOrder = useMemo(() => MENU_STRUCTURE.map((g) => g.key), []);
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [saving, setSaving] = useState(false);

  // 모달 열릴 때마다 현재 사용자의 순서 로드 (없으면 기본값)
  useEffect(() => {
    if (!open) return;
    const userOrder = (user as any)?.menu_order;
    if (Array.isArray(userOrder) && userOrder.length > 0) {
      // 알 수 없는 키 제거 + 빠진 키는 뒤에 추가
      const known = userOrder.filter((k: string) => defaultOrder.includes(k));
      const missing = defaultOrder.filter((k) => !known.includes(k));
      setOrder([...known, ...missing]);
    } else {
      setOrder(defaultOrder);
    }
  }, [open, user, defaultOrder]);

  const move = (idx: number, delta: -1 | 1) => {
    const next = idx + delta;
    if (next < 0 || next >= order.length) return;
    const newOrder = [...order];
    [newOrder[idx], newOrder[next]] = [newOrder[next], newOrder[idx]];
    setOrder(newOrder);
  };

  const reset = () => setOrder(defaultOrder);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const res = await (window as any).electronAPI.users.updateMenuOrder(user.id, order);
      if (res?.success) {
        // store 갱신
        if (typeof updateUserMenuOrder === 'function') {
          updateUserMenuOrder(order);
        }
        message.success('메뉴 순서가 저장되었습니다.');
        onSaved?.();
        onClose();
      } else {
        message.error(res?.error || '저장 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '저장 중 오류');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const res = await (window as any).electronAPI.users.updateMenuOrder(user.id, null);
      if (res?.success) {
        if (typeof updateUserMenuOrder === 'function') updateUserMenuOrder(null);
        message.success('기본 순서로 초기화되었습니다.');
        setOrder(defaultOrder);
        onSaved?.();
        onClose();
      } else {
        message.error(res?.error || '초기화 실패');
      }
    } catch (err: any) {
      message.error(err?.message || '초기화 중 오류');
    } finally {
      setSaving(false);
    }
  };

  const groupMap = useMemo(() => {
    const m: Record<string, any> = {};
    MENU_STRUCTURE.forEach((g) => { m[g.key] = g; });
    return m;
  }, []);

  return (
    <Modal
      title="좌측 메뉴 대분류 순서 변경"
      open={open}
      onCancel={onClose}
      width={460}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Tooltip title="DB에 저장된 사용자 설정 삭제 → 기본 순서로 복원">
            <Button icon={<ReloadOutlined />} onClick={handleResetAll} loading={saving}>
              기본값 복원
            </Button>
          </Tooltip>
          <Space>
            <Button onClick={onClose}>취소</Button>
            <Button type="primary" onClick={handleSave} loading={saving}>저장</Button>
          </Space>
        </Space>
      }
    >
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        위·아래 화살표로 순서를 조정하세요. 권한이 없는 메뉴는 자동으로 숨겨집니다.
      </Text>
      <List
        size="small"
        bordered
        dataSource={order}
        renderItem={(key, idx) => {
          const g = groupMap[key];
          if (!g) return null;
          return (
            <List.Item
              actions={[
                <Button
                  key="up"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                />,
                <Button
                  key="down"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  disabled={idx === order.length - 1}
                  onClick={() => move(idx, 1)}
                />,
              ]}
            >
              <Space>
                <MenuOutlined style={{ color: '#bbb' }} />
                <Text strong>{g.label}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>({g.key})</Text>
              </Space>
            </List.Item>
          );
        }}
      />
    </Modal>
  );
};

export default MenuReorderModal;
