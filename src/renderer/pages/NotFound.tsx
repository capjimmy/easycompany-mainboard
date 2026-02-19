import React from 'react';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      <Result
        status="404"
        title="404"
        subTitle="요청하신 페이지를 찾을 수 없습니다."
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            대시보드로 이동
          </Button>
        }
      />
    </div>
  );
};

export default NotFound;
