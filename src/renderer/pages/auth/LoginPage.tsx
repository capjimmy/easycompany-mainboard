import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Space, message, Checkbox } from 'antd';
import {
  UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone,
  MinusOutlined, BorderOutlined, BlockOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text } = Typography;

declare global {
  interface Window {
    electronAPI: any;
  }
}

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(true);
  const navigate = useNavigate();

  const { login, isAuthenticated, error, clearError } = useAuthStore();
  const { isDark } = useThemeStore();

  const handleMinimize = () => window.electronAPI.window.minimize();
  const handleMaximize = async () => {
    await window.electronAPI.window.maximize();
    const maximized = await window.electronAPI.window.isMaximized();
    setIsMaximized(maximized);
  };
  const handleClose = () => window.electronAPI.window.close();

  // 이미 로그인된 경우 대시보드로 이동
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // 에러 메시지 표시
  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleSubmit = async (values: { username: string; password: string; remember: boolean }) => {
    setLoading(true);

    try {
      const success = await login(values.username, values.password);

      if (success) {
        message.success('로그인되었습니다.');
        navigate('/dashboard');
      }
    } catch (err) {
      message.error('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark
          ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 24,
        position: 'relative',
      }}
    >
      {/* 투명 타이틀바 */}
      <div
        className="titlebar-drag"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 36,
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <div className="window-controls" style={{ height: 36 }}>
          <button className="window-btn" onClick={handleMinimize} title="최소화" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <MinusOutlined style={{ fontSize: 12 }} />
          </button>
          <button className="window-btn" onClick={handleMaximize} title="최대화" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {isMaximized ? <BlockOutlined style={{ fontSize: 12 }} /> : <BorderOutlined style={{ fontSize: 12 }} />}
          </button>
          <button className="window-btn close-btn" onClick={handleClose} title="닫기" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <CloseOutlined style={{ fontSize: 12 }} />
          </button>
        </div>
      </div>
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        styles={{ body: { padding: 40 } }}
      >
        {/* 로고 및 타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
            }}
          >
            <span style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>건</span>
          </div>
          <Title level={3} style={{ margin: 0 }}>
            건설경제연구원
          </Title>
          <Text type="secondary">업무 효율화 솔루션</Text>
        </div>

        {/* 로그인 폼 */}
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={handleSubmit}
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '사용자명을 입력해주세요.' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="사용자명"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '비밀번호를 입력해주세요.' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="비밀번호"
              autoComplete="current-password"
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
            />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>로그인 유지</Checkbox>
              </Form.Item>
              <a href="#">비밀번호 찾기</a>
            </Space>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: 48,
                borderRadius: 8,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
              }}
            >
              로그인
            </Button>
          </Form.Item>
        </Form>

        {/* 하단 정보 */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            건설경제연구원 업무관리 시스템
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
