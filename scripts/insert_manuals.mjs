import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://silvsqcwearelrumtqqm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COMPANY_ID = 'a0000000-0000-0000-0000-000000000001';

const manuals = [
  {
    menu_key: 'dashboard',
    title: '전체 업무 프로세스 및 대시보드',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">

<h2 style="color: #1890ff; border-bottom: 3px solid #1890ff; padding-bottom: 10px; margin-bottom: 20px;">
  건설경제연구원 업무관리 시스템 - 전체 프로세스
</h2>

<div style="background: linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px;">
<h3 style="margin-top: 0;">전체 업무 흐름</h3>
<div style="background: #fff; padding: 16px; border-radius: 8px; text-align: center; font-size: 14px;">
  <strong style="color: #722ed1;">① 단가설정</strong>
  <span style="color: #999; margin: 0 8px;">→</span>
  <strong style="color: #1890ff;">② 견적서 작성</strong>
  <span style="color: #999; margin: 0 8px;">→</span>
  <strong style="color: #52c41a;">③ 계약서 작성</strong>
  <span style="color: #999; margin: 0 8px;">→</span>
  <strong style="color: #faad14;">④ 외주관리</strong>
  <span style="color: #999; margin: 0 8px;">→</span>
  <strong style="color: #ff4d4f;">⑤ 재무/회계</strong>
  <span style="color: #999; margin: 0 8px;">→</span>
  <strong style="color: #13c2c2;">⑥ 프로젝트 관리</strong>
</div>
</div>

<h3>① 초기 설정 (관리자)</h3>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
<tr style="background: #fafafa;"><th style="border: 1px solid #e8e8e8; padding: 10px; text-align: left; width: 30%;">작업</th><th style="border: 1px solid #e8e8e8; padding: 10px; text-align: left;">메뉴 위치</th><th style="border: 1px solid #e8e8e8; padding: 10px; text-align: left;">설명</th></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">사용자 등록</td><td style="border: 1px solid #e8e8e8; padding: 10px;">관리 > 사용자관리</td><td style="border: 1px solid #e8e8e8; padding: 10px;">직원 계정 생성, 역할(사원/부서장/관리자) 부여</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">부서 설정</td><td style="border: 1px solid #e8e8e8; padding: 10px;">관리 > 부서관리</td><td style="border: 1px solid #e8e8e8; padding: 10px;">부서 생성 및 직원 배치</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">권한 설정</td><td style="border: 1px solid #e8e8e8; padding: 10px;">관리 > 권한설정</td><td style="border: 1px solid #e8e8e8; padding: 10px;">사용자별 메뉴 접근 권한 커스터마이즈</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">인건비 단가표</td><td style="border: 1px solid #e8e8e8; padding: 10px;">시스템 > 단가 설정</td><td style="border: 1px solid #e8e8e8; padding: 10px;">기술등급별 월/일 단가 등록</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">경비 항목</td><td style="border: 1px solid #e8e8e8; padding: 10px;">시스템 > 단가 설정</td><td style="border: 1px solid #e8e8e8; padding: 10px;">경비 항목 및 비율 설정</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">사전 항목</td><td style="border: 1px solid #e8e8e8; padding: 10px;">시스템 > 단가 설정</td><td style="border: 1px solid #e8e8e8; padding: 10px;">견적/계약 작성 시 불러올 항목 프리셋 등록 (대분류/세분류/세세분류)</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">거래처 등록</td><td style="border: 1px solid #e8e8e8; padding: 10px;">계약/매출 > 거래처관리</td><td style="border: 1px solid #e8e8e8; padding: 10px;">발주처/외주업체 정보 사전 등록</td></tr>
</table>

<h3>② 영업/견적 단계</h3>
<ol>
<li><strong>견적서 작성</strong> (계약/매출 > 견적관리 > 견적서 작성)
  <ul>
    <li>거래처 선택 → 인건비 "단가표 불러오기" → 경비 "경비항목 불러오기" → 상세내역 "사전항목 불러오기"</li>
    <li>VAT 설정, 총액 직접 입력 모드, 목표값 찾기(Goal Seek) 활용 가능</li>
  </ul>
</li>
<li><strong>견적서 출력</strong> - 견적서/공문/용역비산출 3종 문서 생성</li>
<li><strong>견적서 제출</strong> - 상태를 "제출"로 변경</li>
</ol>

<h3>③ 계약 단계</h3>
<ol>
<li><strong>견적서 → 계약 전환</strong> 또는 <strong>계약서 직접 작성</strong> (계약/매출 > 계약관리)
  <ul>
    <li>견적서에서 전환 시 항목/금액 자동 입력</li>
    <li>인건비/경비/상세내역도 "사전항목 불러오기" 가능</li>
  </ul>
</li>
<li><strong>계약서 출력</strong> - 계약서/공문/용역비산출 문서 생성</li>
<li><strong>대금지급조건 설정</strong> - 기성, 선급금, 잔금 등 지급 조건</li>
</ol>

<h3>④ 프로젝트 수행</h3>
<ol>
<li><strong>프로젝트 관리</strong> (프로젝트 > 프로젝트 현황/보드/타임라인)
  <ul><li>업무 배분, 진행률 관리, 일정 추적</li></ul>
</li>
<li><strong>외주 관리</strong> (계약/매출 > 외주관리) - 하도급 계약 등록 및 관리</li>
</ol>

<h3>⑤ 재무/회계</h3>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
<tr style="background: #fafafa;"><th style="border: 1px solid #e8e8e8; padding: 10px; width: 25%;">메뉴</th><th style="border: 1px solid #e8e8e8; padding: 10px;">업무 흐름</th></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;"><strong>미수금관리</strong></td><td style="border: 1px solid #e8e8e8; padding: 10px;">계약 → 자동 미수금 생성 (페이지 로드 시 자동 동기화)</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;"><strong>청구/입금</strong></td><td style="border: 1px solid #e8e8e8; padding: 10px;">미수금 기반 청구서 발행 → 입금 등록 → 미수금 자동 차감</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;"><strong>미지급금</strong></td><td style="border: 1px solid #e8e8e8; padding: 10px;">외주계약 → "외주 동기화"로 미지급금 자동 생성</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;"><strong>세금계산서</strong></td><td style="border: 1px solid #e8e8e8; padding: 10px;">청구서/미지급금과 연결하여 발행/수취 관리</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;"><strong>보증금</strong></td><td style="border: 1px solid #e8e8e8; padding: 10px;">계약보증금, 하자보증금 등 만기 관리</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;"><strong>경비정산</strong></td><td style="border: 1px solid #e8e8e8; padding: 10px;">직원 경비 신청 → 부서장/관리자 승인 → 지급</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;"><strong>가수금</strong></td><td style="border: 1px solid #e8e8e8; padding: 10px;">불명 입금 등록 → AI 매칭으로 미수금/청구서 연결</td></tr>
</table>

<h3>⑥ 인사/총무</h3>
<ul>
<li><strong>연차 신청/승인</strong> - 직원 연차 신청 → 부서장 승인</li>
<li><strong>증명서 발급</strong> - 재직/경력 증명서 자동 생성</li>
<li><strong>메일 승인</strong> - 외부 발송 메일 승인 워크플로</li>
</ul>

<h3>⑦ 커뮤니케이션</h3>
<ul>
<li><strong>사내 메신저</strong> - 실시간 1:1/그룹 채팅</li>
<li><strong>캘린더</strong> - 계약/인사/공간 캘린더로 일정 통합 관리</li>
</ul>

<hr style="margin: 24px 0; border-color: #e8e8e8;" />

<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">대시보드</h2>
<p>회사 전체 현황을 한눈에 파악할 수 있는 종합 대시보드입니다.</p>
<h3>주요 기능</h3>
<ul>
<li><strong>매출 현황</strong> - 월별/분기별 매출 추이를 차트로 확인</li>
<li><strong>계약 현황</strong> - 진행중/완료/예정 계약 건수 및 금액 표시</li>
<li><strong>미수금 현황</strong> - 미수금 총액 및 연체 현황</li>
<li><strong>최근 활동</strong> - 최근 등록/수정된 계약, 견적 목록</li>
</ul>
<p><strong>접근 권한:</strong> 총괄관리자, 회사 관리자만 접근 가능합니다.</p>
</div>`
  },
  {
    menu_key: 'project-status',
    title: '프로젝트 현황 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">프로젝트 현황</h2>
<p>현재 진행 중인 모든 프로젝트의 상태를 한눈에 확인할 수 있습니다. 사원/부서장은 로그인 후 이 페이지가 기본 화면입니다.</p>
<h3>주요 기능</h3>
<ul>
<li><strong>프로젝트 카드</strong> - 각 프로젝트의 진행률, 담당자, 기한 표시</li>
<li><strong>상태 필터</strong> - 진행중/완료/지연 상태별 필터링</li>
<li><strong>담당자 필터</strong> - 특정 담당자의 프로젝트만 조회</li>
<li><strong>기간 필터</strong> - 시작일/종료일 기준 조회</li>
</ul>
<h3>사용 방법</h3>
<ol>
<li>상단 필터를 사용하여 원하는 조건의 프로젝트를 검색합니다.</li>
<li>프로젝트 카드를 클릭하면 상세 정보를 확인할 수 있습니다.</li>
<li>진행률 바를 통해 각 프로젝트의 완료 정도를 파악합니다.</li>
</ol>
</div>`
  },
  {
    menu_key: 'search',
    title: '통합검색 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">통합검색</h2>
<p>계약, 견적, 거래처, 프로젝트 등 모든 데이터를 한번에 검색할 수 있습니다.</p>
<h3>검색 범위</h3>
<ul>
<li><strong>계약서</strong> - 계약명, 계약번호, 발주처명</li>
<li><strong>견적서</strong> - 견적명, 견적번호, 거래처명</li>
<li><strong>거래처</strong> - 거래처명, 사업자번호, 담당자</li>
<li><strong>프로젝트</strong> - 프로젝트명, 담당자명</li>
</ul>
<h3>사용 방법</h3>
<ol>
<li>검색창에 키워드를 입력합니다 (2자 이상).</li>
<li>검색 결과가 카테고리별로 분류되어 표시됩니다.</li>
<li>결과 항목을 클릭하면 해당 상세 페이지로 이동합니다.</li>
</ol>
</div>`
  },
  {
    menu_key: 'ai-search',
    title: 'AI 검색 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">AI 검색</h2>
<p>OpenAI 기반 자연어 검색으로 복잡한 질문에도 답변을 받을 수 있습니다.</p>
<h3>사용 예시</h3>
<ul>
<li>"지난달 매출이 가장 높은 거래처는?"</li>
<li>"올해 미수금이 가장 많은 계약은?"</li>
<li>"진행중인 계약 중 만기가 가장 빠른 건?"</li>
</ul>
<div style="background: #fff7e6; padding: 12px; border-radius: 8px; border-left: 4px solid #faad14; margin: 16px 0;">
<strong>사전 설정 필요:</strong> 시스템 > 설정에서 OpenAI API 키를 먼저 등록해야 합니다.
</div>
<p><strong>접근 권한:</strong> 총괄관리자, 회사 관리자만 사용 가능합니다.</p>
</div>`
  },
  {
    menu_key: 'quote-list',
    title: '견적관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">견적관리</h2>
<p>견적서 작성, 조회, 수정, 삭제 및 문서 출력을 관리합니다.</p>

<h3>견적서 작성 순서</h3>
<div style="background: #f0f5ff; padding: 16px; border-radius: 8px; margin: 12px 0;">
<ol style="margin: 0;">
<li><strong>기본정보 입력</strong> - 견적명, 거래처(발주처), 견적일, 유효기간</li>
<li><strong>인건비 입력</strong>
  <ul>
    <li>"<strong>단가표 불러오기</strong>" 버튼 → 단가 설정에서 등록한 인건비 등급 일괄 추가</li>
    <li>또는 "인건비 항목 추가"로 개별 추가</li>
    <li>등급 선택 → 인원 × 투입률 × 개월 × 단가 = 자동 계산</li>
  </ul>
</li>
<li><strong>경비 입력</strong>
  <ul>
    <li>"<strong>경비항목 불러오기</strong>" 버튼 → 등록된 경비 항목 일괄 추가</li>
    <li>비율 계산(인건비 × %) 또는 직접 입력 방식</li>
  </ul>
</li>
<li><strong>상세내역 입력</strong>
  <ul>
    <li>"<strong>사전 항목 불러오기</strong>" 버튼 → 미리 등록한 대분류/세분류/세세분류 프리셋 가져오기</li>
    <li>기본 금액이 설정된 항목은 금액 자동 입력</li>
    <li>또는 "대분류 추가"로 수동 구성</li>
  </ul>
</li>
<li><strong>VAT/총액 설정</strong> - VAT 포함 여부, 비율(기본 10%) 설정</li>
<li><strong>저장 및 출력</strong></li>
</ol>
</div>

<h3>특수 기능</h3>
<ul>
<li><strong>총금액만 입력 모드</strong> - 상세 항목 없이 총액만 직접 입력</li>
<li><strong>총액 직접 편집</strong> - 계산된 총액을 수동으로 덮어쓰기</li>
<li><strong>목표값 찾기 (Goal Seek)</strong> - 원하는 총액에 맞춰 항목 금액 자동 조정</li>
<li><strong>견적서 복사</strong> - 기존 견적서를 복사하여 새 견적서 생성</li>
<li><strong>계약 전환</strong> - 견적서에서 바로 계약서로 전환</li>
</ul>

<h3>문서 출력 (3종)</h3>
<ul>
<li><strong>견적서</strong> - 표준 견적서 양식</li>
<li><strong>공문</strong> - 공문 양식으로 출력</li>
<li><strong>용역비산출</strong> - 용역비 산출 근거 문서</li>
</ul>

<h3>견적 상태</h3>
<ul>
<li><span style="color: #999;">● 임시저장</span> → <span style="color: #1890ff;">● 제출</span> → <span style="color: #52c41a;">● 승인</span> / <span style="color: #ff4d4f;">● 반려</span></li>
</ul>
</div>`
  },
  {
    menu_key: 'contract-list',
    title: '계약관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">계약관리</h2>
<p>계약서 작성, 조회, 수정 및 문서 출력을 관리합니다.</p>

<h3>계약서 작성 순서</h3>
<div style="background: #f0f5ff; padding: 16px; border-radius: 8px; margin: 12px 0;">
<ol style="margin: 0;">
<li><strong>기본정보</strong> - 계약명, 계약번호, 발주처, 계약유형, 계약기간</li>
<li><strong>인건비</strong> - "<strong>단가표 불러오기</strong>"로 인건비 등급 일괄 추가 또는 개별 추가</li>
<li><strong>경비</strong> - "<strong>경비항목 불러오기</strong>"로 경비 항목 일괄 추가 또는 개별 추가</li>
<li><strong>상세내역</strong> - "<strong>사전항목 불러오기</strong>"로 프리셋 가져오기 또는 수동 구성</li>
<li><strong>대금지급조건</strong> - 기성, 선급금, 잔금 등 지급 스케줄 설정</li>
<li><strong>저장</strong></li>
</ol>
</div>

<h3>계약 상태</h3>
<ul>
<li><span style="color: #52c41a;">● 진행중</span> - 현재 수행 중인 계약</li>
<li><span style="color: #1890ff;">● 완료</span> - 수행 완료된 계약</li>
<li><span style="color: #faad14;">● 보류</span> - 일시 중단된 계약</li>
<li><span style="color: #ff4d4f;">● 해지</span> - 해지된 계약</li>
</ul>

<h3>문서 출력 (3종)</h3>
<ul><li><strong>계약서</strong> / <strong>공문</strong> / <strong>용역비산출</strong></li></ul>

<h3>부가 기능</h3>
<ul>
<li><strong>견적서 연결</strong> - 기존 견적서와 계약서 연결</li>
<li><strong>OCR 스캔</strong> - 종이 계약서 스캔하여 자동 데이터 입력</li>
<li><strong>이벤트/일정</strong> - 계약 관련 주요 일정 등록</li>
<li><strong>변경 이력</strong> - 계약 수정 시 자동 이력 기록</li>
<li><strong>첨부 문서</strong> - 관련 파일 첨부 관리</li>
</ul>

<div style="background: #e6f7ff; padding: 12px; border-radius: 8px; border-left: 4px solid #1890ff; margin: 16px 0;">
<strong>TIP:</strong> 견적서에서 "계약 전환" 시 모든 항목(인건비/경비/상세내역)이 자동으로 계약서에 복사됩니다.
</div>
</div>`
  },
  {
    menu_key: 'monthly',
    title: '월별현황 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">월별현황</h2>
<p>계약 및 매출을 월별로 집계하여 확인할 수 있습니다.</p>
<h3>주요 기능</h3>
<ul>
<li><strong>월별 매출</strong> - 월별 계약금액 및 실제 입금액 비교</li>
<li><strong>연도 선택</strong> - 특정 연도의 월별 데이터 조회</li>
<li><strong>차트 보기</strong> - 막대/꺾은선 차트로 추이 확인</li>
<li><strong>엑셀 내보내기</strong> - 데이터를 엑셀 파일로 내보내기</li>
</ul>
</div>`
  },
  {
    menu_key: 'history',
    title: '계약변경이력 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">계약변경이력</h2>
<p>계약의 변경 이력을 추적하고 관리합니다.</p>
<h3>주요 기능</h3>
<ul>
<li><strong>변경 이력 조회</strong> - 계약별 모든 변경 내역 시간순 표시</li>
<li><strong>변경 비교</strong> - 변경 전/후 데이터 비교</li>
<li><strong>변경 사유</strong> - 각 변경에 대한 사유 기록</li>
</ul>
<p>계약서를 수정할 때마다 자동으로 이력이 기록됩니다.</p>
</div>`
  },
  {
    menu_key: 'subcontract',
    title: '외주관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">외주관리</h2>
<p>외주(하도급) 계약을 등록하고 관리합니다.</p>
<h3>외주 등록 순서</h3>
<ol>
<li>원도급 계약을 선택합니다.</li>
<li>외주 업체(거래처)를 선택합니다.</li>
<li>외주 금액, 기간, 항목을 입력합니다.</li>
<li>저장하면 원도급 계약과 자동 연결됩니다.</li>
</ol>
<h3>재무 연동</h3>
<div style="background: #e6f7ff; padding: 12px; border-radius: 8px; border-left: 4px solid #1890ff; margin: 16px 0;">
재무/회계 > 미지급금관리에서 "<strong>외주 동기화</strong>" 버튼을 클릭하면 외주 계약이 미지급금으로 자동 등록됩니다.
</div>
</div>`
  },
  {
    menu_key: 'client-list',
    title: '거래처관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">거래처관리</h2>
<p>발주처, 외주업체 등 모든 거래처 정보를 통합 관리합니다.</p>
<h3>거래처 등록</h3>
<ol>
<li>"거래처 추가" 버튼 클릭</li>
<li>거래처명, 사업자번호(10자리), 대표자명 입력</li>
<li>연락처, 이메일, 주소 입력</li>
<li>거래처 유형(발주처/외주업체/기타) 선택 후 저장</li>
</ol>
<h3>거래처 상세</h3>
<ul>
<li><strong>기본 정보</strong> - 사업자등록번호, 대표자, 연락처</li>
<li><strong>거래 이력</strong> - 해당 거래처의 모든 계약/견적 이력</li>
<li><strong>재무 현황</strong> - 미수금/미지급금 현황</li>
<li><strong>담당자</strong> - 거래처별 담당자 정보</li>
</ul>
</div>`
  },
  {
    menu_key: 'receivables',
    title: '미수금관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">미수금관리</h2>
<p>계약에 따른 미수금을 관리하고 입금 현황을 추적합니다.</p>
<h3>자동 동기화</h3>
<div style="background: #f6ffed; padding: 12px; border-radius: 8px; border-left: 4px solid #52c41a; margin: 16px 0;">
<strong>페이지 진입 시 자동 동기화:</strong> 잔금이 있는 모든 계약에서 미수금이 자동으로 생성됩니다. 수동으로 "계약 동기화" 버튼을 눌러 추가 동기화도 가능합니다.
</div>
<h3>통계 카드</h3>
<ul>
<li><strong>총 미수금</strong> - 전체 미수 잔액</li>
<li><strong>연체금액</strong> - 만기일 초과 미수금</li>
<li><strong>이번달 만기</strong> - 금월 입금 예정액</li>
<li><strong>회수율</strong> - 총 발행 대비 수금 비율</li>
</ul>
<h3>미수금 수동 등록</h3>
<ol>
<li>"미수금 등록" 버튼 클릭</li>
<li>관련 계약 선택 (선택 시 금액/만기일 자동 입력)</li>
<li>설명, 금액, 만기일 입력 후 저장</li>
</ol>
<h3>청구/입금 연동</h3>
<p>청구/입금 메뉴에서 입금 등록 시 미수금이 자동 차감됩니다.</p>
</div>`
  },
  {
    menu_key: 'billing',
    title: '청구/입금 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">청구/입금</h2>
<p>청구서 발행과 입금 내역을 관리합니다.</p>
<h3>탭 구성</h3>
<ul>
<li><strong>청구 관리</strong> - 청구서 발행, 상태 관리</li>
<li><strong>입금 관리</strong> - 입금 내역 등록 및 조회</li>
</ul>
<h3>청구서 발행</h3>
<ol>
<li>"청구서 발행" 클릭 → 관련 미수금 또는 계약 선택</li>
<li>청구금액, 납부기한 입력 → 저장</li>
</ol>
<h3>입금 등록</h3>
<ol>
<li>입금 관리 탭 → "입금 등록" 클릭</li>
<li>해당 청구서 선택 → 입금액, 입금일 입력</li>
<li>저장하면 청구서 입금상태 + 미수금 잔액이 <strong>자동 갱신</strong></li>
</ol>
</div>`
  },
  {
    menu_key: 'payables',
    title: '미지급금관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">미지급금관리</h2>
<p>외주업체 등에 지급해야 할 미지급금을 관리합니다.</p>
<h3>외주 동기화</h3>
<div style="background: #f6ffed; padding: 12px; border-radius: 8px; border-left: 4px solid #52c41a; margin: 16px 0;">
"<strong>외주 동기화</strong>" 버튼 클릭 → 등록된 외주 계약에서 미지급금이 자동 생성됩니다.
</div>
<h3>통계 카드</h3>
<ul><li><strong>총 미지급금</strong> / <strong>이번달 지급예정</strong> / <strong>연체금액</strong></li></ul>
<h3>상태</h3>
<ul><li>미지급 → 부분지급 → 완료 / 연체</li></ul>
</div>`
  },
  {
    menu_key: 'deposits',
    title: '보증금관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">보증금관리</h2>
<p>계약 관련 각종 보증금을 관리합니다.</p>
<h3>보증금 유형</h3>
<ul>
<li><strong>계약보증금</strong> - 계약 이행 보증</li>
<li><strong>하자보증금</strong> - 하자 보수 보증</li>
<li><strong>선급금보증</strong> - 선급금 지급 보증</li>
<li><strong>입찰보증금</strong> - 입찰 참여 보증</li>
<li><strong>기타보증금</strong></li>
</ul>
<h3>주요 기능</h3>
<ul>
<li>보증금 등록 (유형, 금액, 기간, 관련 계약)</li>
<li>만기일 관리 및 알림</li>
<li>반환 처리 및 이력 관리</li>
</ul>
</div>`
  },
  {
    menu_key: 'tax-invoices',
    title: '세금계산서 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">세금계산서</h2>
<p>매출/매입 세금계산서를 관리합니다.</p>
<h3>탭 구성</h3>
<ul>
<li><strong>발행 (매출)</strong> - 우리가 발행한 세금계산서</li>
<li><strong>수취 (매입)</strong> - 우리가 수취한 세금계산서</li>
</ul>
<h3>등록 방법</h3>
<ol>
<li>"세금계산서 등록" 클릭</li>
<li>발행/수취 구분 선택</li>
<li>거래처, 공급가액 입력 → <strong>부가세 자동 계산 (10%)</strong></li>
<li>관련 청구서 또는 미지급금 연결 (선택)</li>
<li>저장</li>
</ol>
<h3>상태</h3>
<ul>
<li><span style="color: #faad14;">● 대기</span> → <span style="color: #52c41a;">● 발행완료</span> / <span style="color: #ff4d4f;">● 취소</span></li>
</ul>
</div>`
  },
  {
    menu_key: 'expenses',
    title: '경비정산 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">경비정산</h2>
<p>업무 관련 경비를 신청하고 승인받을 수 있습니다.</p>
<h3>경비정산 흐름</h3>
<div style="background: #f0f5ff; padding: 16px; border-radius: 8px; text-align: center; margin: 12px 0; font-size: 15px;">
<strong>경비 신청</strong> → <strong>부서장 검토</strong> → <strong>관리자 승인</strong> → <strong>지급 완료</strong>
</div>
<h3>경비 신청</h3>
<ol>
<li>"경비정산 신청" 클릭</li>
<li>제목, 설명 입력</li>
<li>경비 항목 추가 (항목명, 금액, 일자) - 여러 항목 가능</li>
<li>제출 → 승인 절차 시작</li>
</ol>
<h3>승인 권한</h3>
<ul>
<li><strong>부서 관리자</strong> - 부서원의 경비 검토/승인</li>
<li><strong>회사 관리자</strong> - 최종 승인 및 지급 처리</li>
</ul>
</div>`
  },
  {
    menu_key: 'provisional',
    title: '가수금관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">가수금관리</h2>
<p>입금처가 불분명한 가수금을 관리하고 AI로 자동 매칭합니다.</p>
<h3>주요 기능</h3>
<ul>
<li><strong>가수금 등록</strong> - 불명 입금 내역 등록</li>
<li><strong>수동 매칭</strong> - 미수금/청구서와 수동 연결</li>
<li><strong>AI 매칭</strong> - OpenAI로 관련 미수금/청구서 자동 추천</li>
</ul>
<h3>AI 매칭 사용법</h3>
<ol>
<li>가수금 항목의 "AI 추천" 버튼 클릭</li>
<li>AI가 금액/거래처/시기 분석 → 관련 항목 추천</li>
<li>적합한 항목 선택하여 매칭</li>
</ol>
<div style="background: #fff7e6; padding: 12px; border-radius: 8px; border-left: 4px solid #faad14; margin: 16px 0;">
<strong>필수:</strong> AI 매칭은 시스템 > 설정에서 OpenAI API 키가 등록되어 있어야 합니다.
</div>
</div>`
  },
  {
    menu_key: 'leave',
    title: '연차 신청 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">연차 신청</h2>
<h3>휴가 유형</h3>
<ul>
<li><strong>연차</strong> (1일) / <strong>오전 반차</strong> / <strong>오후 반차</strong> / <strong>특별 휴가</strong> (경조사 등)</li>
</ul>
<h3>신청 방법</h3>
<ol>
<li>"연차 신청" 버튼 클릭</li>
<li>휴가 유형, 기간(시작일~종료일), 사유 입력</li>
<li>제출 → 부서장에게 승인 요청 전달</li>
</ol>
<h3>잔여 연차</h3>
<p>상단에 총 연차/사용일수/잔여일수가 표시됩니다.</p>
<div style="background: #f0f5ff; padding: 12px; border-radius: 8px; text-align: center; margin: 12px 0;">
<strong>연차 신청</strong> → <strong>부서장 승인</strong> → <strong>사용</strong>
</div>
</div>`
  },
  {
    menu_key: 'leave-admin',
    title: '연차 승인관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">연차 승인관리</h2>
<p>부서원의 연차 신청을 검토하고 승인/반려합니다.</p>
<h3>승인 방법</h3>
<ol>
<li>대기중인 신청 목록에서 건 선택</li>
<li>내용(기간, 사유) 확인</li>
<li>"승인" 또는 "반려" 클릭 (반려 시 사유 입력)</li>
</ol>
<h3>부서원 현황</h3>
<p>부서원별 연차 사용 현황과 잔여 연차를 확인할 수 있습니다.</p>
<p><strong>접근 권한:</strong> 부서 관리자 이상</p>
</div>`
  },
  {
    menu_key: 'email-approvals',
    title: '메일 승인 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">메일 승인</h2>
<p>외부 발송 메일의 승인 요청 및 처리를 관리합니다.</p>
<h3>흐름</h3>
<ol>
<li>메일 작성 후 "승인 요청"</li>
<li>관리자가 내용 검토</li>
<li>승인 시 메일 발송 / 반려 시 수정 후 재요청</li>
</ol>
</div>`
  },
  {
    menu_key: 'certificates',
    title: '증명서 발급 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">증명서 발급</h2>
<h3>발급 가능 증명서</h3>
<ul>
<li><strong>재직증명서</strong> - 현재 재직 중임을 증명</li>
<li><strong>경력증명서</strong> - 경력 사항 증명</li>
</ul>
<h3>발급 방법</h3>
<ol>
<li>증명서 유형 선택</li>
<li>용도 입력 (예: 은행제출용, 관공서 제출용)</li>
<li>"발급" 클릭 → 문서 생성 → 인쇄/저장</li>
</ol>
</div>`
  },
  {
    menu_key: 'calendar-contract',
    title: '계약 캘린더 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">계약 캘린더</h2>
<p>계약 관련 주요 일정을 캘린더에서 확인합니다.</p>
<h3>표시 내용</h3>
<ul>
<li>계약 시작일/종료일</li>
<li>입금 예정일 (미수금)</li>
<li>보증금 만기일</li>
</ul>
<p>월/주/일 보기 전환 가능. 일정 클릭 시 상세 정보로 이동합니다.</p>
</div>`
  },
  {
    menu_key: 'calendar-hr',
    title: '인사 캘린더 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">인사 캘린더</h2>
<p>직원 휴가, 출장, 생일 등 인사 관련 일정을 캘린더에서 확인합니다.</p>
<h3>표시 내용</h3>
<ul>
<li>승인된 연차/휴가</li>
<li>출장 일정</li>
<li>직원 생일</li>
</ul>
<p>부서별 필터로 특정 부서 일정만 조회 가능합니다.</p>
</div>`
  },
  {
    menu_key: 'calendar-space',
    title: '공간 캘린더 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">공간 캘린더</h2>
<p>회의실, 차량 등 공용 자원의 예약을 관리합니다.</p>
<h3>예약 방법</h3>
<ol>
<li>캘린더에서 원하는 날짜/시간 클릭</li>
<li>자원 유형(회의실/차량) 선택</li>
<li>사용 시간, 목적 입력 → 저장</li>
</ol>
<p>이미 예약된 시간대는 자동 차단됩니다.</p>
</div>`
  },
  {
    menu_key: 'project-dashboard',
    title: '프로젝트 현황 대시보드 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">프로젝트 현황</h2>
<p>진행 중인 프로젝트의 전체 현황을 대시보드 형태로 확인합니다.</p>
<h3>주요 기능</h3>
<ul>
<li>프로젝트 통계 (총 수, 진행중/완료/지연)</li>
<li>프로젝트별 진행률 차트</li>
<li>담당자별 현황</li>
<li>마감 임박 프로젝트 목록</li>
</ul>
</div>`
  },
  {
    menu_key: 'project-board',
    title: '프로젝트 보드 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">프로젝트 보드 (칸반)</h2>
<p>칸반(Kanban) 보드 형태로 업무를 관리합니다.</p>
<h3>보드 구성</h3>
<ul><li><strong>할 일</strong> → <strong>진행 중</strong> → <strong>완료</strong></li></ul>
<h3>사용 방법</h3>
<ol>
<li>"업무 추가"로 새 업무 생성</li>
<li>카드를 드래그하여 상태 변경</li>
<li>카드 클릭 → 상세 수정 (담당자, 우선순위, 마감일)</li>
</ol>
</div>`
  },
  {
    menu_key: 'project-timeline',
    title: '일정관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">일정관리 (타임라인)</h2>
<p>프로젝트별 업무 일정을 타임라인(간트차트) 형태로 관리합니다.</p>
<h3>주요 기능</h3>
<ul>
<li>간트차트로 프로젝트/업무 기간 시각화</li>
<li>업무 간 의존성 표시</li>
<li>드래그로 일정 변경</li>
<li>마일스톤 표시</li>
</ul>
</div>`
  },
  {
    menu_key: 'messenger',
    title: '사내 메신저 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">사내 메신저</h2>
<p>사내 직원들과 실시간으로 메시지를 주고받을 수 있습니다.</p>
<h3>주요 기능</h3>
<ul>
<li><strong>1:1 대화</strong> / <strong>그룹 대화</strong></li>
<li>실시간 알림, 읽음 확인</li>
</ul>
<h3>사용 방법</h3>
<ol>
<li>좌측 대화 목록에서 대화방 선택</li>
<li>하단 입력창에 메시지 작성 → Enter로 전송</li>
<li>"+" 버튼으로 새 대화 시작</li>
</ol>
</div>`
  },
  {
    menu_key: 'user-manage',
    title: '사용자관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">사용자관리</h2>
<p>시스템 사용자를 등록, 수정, 삭제하고 역할을 부여합니다.</p>
<h3>역할 체계 (4단계)</h3>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
<tr style="background: #fafafa;"><th style="border: 1px solid #e8e8e8; padding: 8px;">역할</th><th style="border: 1px solid #e8e8e8; padding: 8px;">설명</th></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 8px;"><strong>총괄관리자</strong></td><td style="border: 1px solid #e8e8e8; padding: 8px;">전체 시스템, 모든 회사 데이터 접근</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 8px;"><strong>회사 관리자</strong></td><td style="border: 1px solid #e8e8e8; padding: 8px;">소속 회사 전체 관리</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 8px;"><strong>부서 관리자</strong></td><td style="border: 1px solid #e8e8e8; padding: 8px;">소속 부서 관리, 승인 처리</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 8px;"><strong>사원</strong></td><td style="border: 1px solid #e8e8e8; padding: 8px;">기본 업무 기능</td></tr>
</table>
<h3>사용자 등록</h3>
<ol>
<li>"사용자 추가" 클릭</li>
<li>이름, 아이디, 비밀번호, 소속 회사/부서, 역할 설정</li>
<li>저장</li>
</ol>
<div style="background: #fff1f0; padding: 12px; border-radius: 8px; border-left: 4px solid #ff4d4f; margin: 16px 0;">
<strong>주의:</strong> 역할 변경 시 해당 사용자의 접근 권한이 즉시 변경됩니다.
</div>
</div>`
  },
  {
    menu_key: 'department-manage',
    title: '부서관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">부서관리</h2>
<p>회사의 부서를 생성, 수정, 삭제합니다.</p>
<h3>부서 등록</h3>
<ol>
<li>"부서 추가" 클릭</li>
<li>부서명, 설명(선택) 입력</li>
<li>저장</li>
</ol>
<p>사용자관리에서 직원을 부서에 배치합니다.</p>
</div>`
  },
  {
    menu_key: 'permission-manage',
    title: '권한설정 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">권한설정</h2>
<p>사용자별 메뉴 접근 권한을 세밀하게 설정합니다.</p>
<h3>권한 체계</h3>
<ul>
<li><strong>기본 권한</strong> - 역할(사원/부서장/관리자)에 따라 자동 부여</li>
<li><strong>개별 권한</strong> - 사용자별로 메뉴 접근을 커스터마이즈</li>
</ul>
<h3>권한 유형 (메뉴별)</h3>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
<tr style="background: #fafafa;"><th style="border: 1px solid #e8e8e8; padding: 8px;">권한</th><th style="border: 1px solid #e8e8e8; padding: 8px;">설명</th></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 8px;">조회 (view)</td><td style="border: 1px solid #e8e8e8; padding: 8px;">메뉴 접근 및 데이터 조회</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 8px;">생성 (create)</td><td style="border: 1px solid #e8e8e8; padding: 8px;">새 데이터 등록</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 8px;">수정 (edit)</td><td style="border: 1px solid #e8e8e8; padding: 8px;">기존 데이터 수정</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 8px;">삭제 (delete)</td><td style="border: 1px solid #e8e8e8; padding: 8px;">데이터 삭제</td></tr>
</table>
<h3>사용 방법</h3>
<ol>
<li>사용자 선택</li>
<li>메뉴별 조회/생성/수정/삭제 체크</li>
<li>저장 → 즉시 적용</li>
</ol>
<p>"<strong>권한 매트릭스</strong>" 버튼으로 전체 사용자 권한을 한눈에 비교할 수 있습니다.</p>
</div>`
  },
  {
    menu_key: 'company-manage',
    title: '회사관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">회사관리</h2>
<p>시스템에 등록된 회사 정보를 관리합니다.</p>
<h3>주요 기능</h3>
<ul>
<li>회사 정보 조회/수정 (회사명, 사업자번호, 주소)</li>
<li>회사별 직원 현황 확인</li>
</ul>
<p><strong>접근 권한:</strong> 총괄관리자(super_admin)만 접근 가능합니다.</p>
</div>`
  },
  {
    menu_key: 'settings',
    title: '설정 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">설정</h2>
<h3>설정 항목</h3>
<ul>
<li><strong>OpenAI API 키</strong> - AI 검색, 가수금 AI 매칭에 사용</li>
<li><strong>이메일(SMTP) 설정</strong> - 메일 발송 서버 설정</li>
<li><strong>테마</strong> - 라이트/다크 모드 전환</li>
<li><strong>앱 정보</strong> - 현재 버전 및 업데이트 확인</li>
</ul>
</div>`
  },
  {
    menu_key: 'price-settings',
    title: '단가 설정 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">단가 설정</h2>
<p>견적서/계약서 작성에 사용하는 단가표, 경비, 사전항목을 관리합니다.</p>
<h3>탭 구성</h3>
<h4>1. 인건비 등급 (단가표)</h4>
<ul>
<li>기술등급별 월 단가, 일 단가 설정</li>
<li>등급 추가/수정/삭제</li>
<li>견적서/계약서 작성 시 "단가표 불러오기"로 일괄 추가</li>
</ul>
<h4>2. 경비 항목</h4>
<ul>
<li>경비 항목 등록 (수동입력/비율계산/고정금액)</li>
<li>비율 계산: 인건비 총액 × 비율(%)로 자동 계산</li>
<li>견적서/계약서 작성 시 "경비항목 불러오기"로 일괄 추가</li>
</ul>
<h4>3. 견적 항목 관리 (사전 항목)</h4>
<ul>
<li><strong>대분류</strong> → <strong>세분류</strong> → <strong>세세분류</strong> 3단계 계층</li>
<li>세분류/세세분류에 <strong>기본 금액</strong> 설정 가능 (선택사항)</li>
<li>기본 금액이 설정되면 불러오기 시 금액 자동 입력</li>
<li>견적서/계약서 작성 시 "사전 항목 불러오기"로 선택 추가</li>
</ul>
<h4>4. 견적서 양식</h4>
<ul>
<li>견적서 출력에 사용할 양식 파일 업로드 (docx, xlsx, hwp)</li>
<li>양식 없으면 기본 형식으로 출력</li>
</ul>
</div>`
  },
  {
    menu_key: 'doc-templates',
    title: '문서 템플릿 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">문서 템플릿</h2>
<p>견적서, 계약서 등 문서 출력에 사용되는 HTML 템플릿을 관리합니다.</p>
<h3>지원 문서 유형</h3>
<ul><li>견적서 / 계약서 / 공문 / 용역비산출</li></ul>
<h3>템플릿 편집</h3>
<ol>
<li>문서 유형 선택</li>
<li>HTML 에디터에서 수정</li>
<li>변수({{계약명}}, {{발주처}}, {{계약금액}} 등)로 동적 데이터 삽입</li>
<li>미리보기 확인 후 저장</li>
</ol>
</div>`
  },
  {
    menu_key: 'backup',
    title: '백업관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">백업관리</h2>
<h3>주요 기능</h3>
<ul>
<li><strong>수동 백업</strong> - 현재 데이터를 파일로 백업</li>
<li><strong>백업 이력</strong> - 과거 백업 목록 및 다운로드</li>
<li><strong>복원</strong> - 백업 파일에서 데이터 복원</li>
</ul>
<div style="background: #fff1f0; padding: 12px; border-radius: 8px; border-left: 4px solid #ff4d4f; margin: 16px 0;">
<strong>주의:</strong> 복원 시 현재 데이터가 백업 시점으로 대체됩니다. 복원 전 현재 데이터를 먼저 백업하세요.
</div>
</div>`
  },
  {
    menu_key: 'manuals',
    title: '매뉴얼 관리 매뉴얼',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">
<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px;">매뉴얼 관리</h2>
<p>각 메뉴별 사용자 매뉴얼을 등록하고 관리합니다.</p>
<h3>사용 방법</h3>
<ol>
<li>"매뉴얼 추가" 클릭</li>
<li>대상 메뉴 선택</li>
<li>제목과 내용(HTML) 입력</li>
<li>저장 → 해당 메뉴에서 매뉴얼 버튼 클릭 시 표시</li>
</ol>
<h3>매뉴얼 표시 방식</h3>
<p>앱 우측 상단 "<strong>매뉴얼</strong>" 버튼 클릭 시:</p>
<ul>
<li>좌측: 사용자 권한에 따른 접근 가능 메뉴 목록</li>
<li>우측: 선택한 메뉴의 매뉴얼 내용</li>
<li>현재 보고 있는 메뉴가 자동 선택됨</li>
<li>매뉴얼이 등록된 메뉴는 초록색 ● 표시</li>
</ul>
</div>`
  },
];

async function insertManuals() {
  console.log('Starting manual insertion...');

  // First delete existing manuals for this company
  const { error: deleteError } = await supabase
    .from('menu_manuals')
    .delete()
    .eq('company_id', COMPANY_ID);

  if (deleteError) {
    console.error('Delete error:', deleteError.message);
    return;
  }
  console.log('Deleted existing manuals.');

  let successCount = 0;
  let errorCount = 0;

  for (const manual of manuals) {
    const { data, error } = await supabase
      .from('menu_manuals')
      .upsert({
        company_id: COMPANY_ID,
        menu_key: manual.menu_key,
        title: manual.title,
        content: manual.content,
      }, { onConflict: 'company_id,menu_key' })
      .select();

    if (error) {
      console.error(`ERROR [${manual.menu_key}]: ${error.message}`);
      errorCount++;
    } else {
      console.log(`OK [${manual.menu_key}] - ${manual.title}`);
      successCount++;
    }
  }

  console.log(`\nDone! Success: ${successCount}, Errors: ${errorCount}, Total: ${manuals.length}`);
}

insertManuals();
