import React from 'react';
import OutsourcingManagement from './OutsourcingManagement';

// 경영진 전용 외주관리 — 일반 외주관리와 형식 동일, 데이터(executive_outsourcings)만 분리
const ExecutiveOutsourcingManagement: React.FC = () => {
  return <OutsourcingManagement apiKey="executiveOutsourcings" pageTitle="외주관리 (경영진)" />;
};

export default ExecutiveOutsourcingManagement;
