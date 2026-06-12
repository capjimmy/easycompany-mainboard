import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://silvsqcwearelrumtqqm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COMPANY_ID = 'a0000000-0000-0000-0000-000000000001';

const H2 = (t) => `<h2 style="color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px; margin-bottom: 16px;">${t}</h2>`;
const TIP = (t) => `<div style="background: #e6f7ff; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #1890ff; margin: 16px 0;"><strong>TIP</strong> ${t}</div>`;
const WARN = (t) => `<div style="background: #fffbe6; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #faad14; margin: 16px 0;"><strong>주의</strong> ${t}</div>`;
const WRAP = (body) => `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">${body}</div>`;

const manuals = [
  {
    menu_key: 'expense-request',
    title: '지출결의서 신청 및 승인',
    content: WRAP(`
${H2('지출결의서 신청 및 승인')}
<p>경비 지출 전에 사전 승인을 받는 결재 메뉴입니다. 승인되면 경비정산에 자동 등록됩니다.</p>

<h3>1. 지출결의서 신청 방법</h3>
<ol>
<li>우측 상단 <strong>"+ 신규 신청"</strong> 버튼 클릭</li>
<li><strong>카테고리</strong> 선택 (식대, 교통비, 접대비, 사무용품, 택배비, 제본비, 기타 등)</li>
<li><strong>금액</strong> 및 <strong>사용 예정일</strong> 입력</li>
<li><strong>사유</strong>에 구체적으로 어디서/무엇을/왜 사용하는지 작성</li>
<li><strong>첨부 파일</strong> 업로드 (견적서, 영수증 이미지 등 - 선택)</li>
<li>"신청" 버튼 클릭 → 회사관리자에게 승인 요청 전송</li>
</ol>

<h3>2. 승인 상태</h3>
<ul>
<li><strong style="color:#faad14;">승인 대기</strong> - 회사관리자 검토 중. 신청자는 이 상태에서만 수정/취소 가능</li>
<li><strong style="color:#52c41a;">승인</strong> - 승인 완료. 경비정산에 <strong>자동으로 등록</strong>됨</li>
<li><strong style="color:#ff4d4f;">반려</strong> - 반려됨. 반려 사유 확인 후 재신청 가능</li>
</ul>

<h3>3. 회사관리자 승인 절차</h3>
<ol>
<li>승인 대기 목록에서 신청 건 클릭 → 상세 확인</li>
<li>첨부파일, 사유, 금액 검토</li>
<li><strong>"승인"</strong> 또는 <strong>"반려"</strong> 버튼 클릭 (반려 시 사유 입력 필수)</li>
</ol>

${TIP('승인되면 경비정산 메뉴에 해당 건이 자동으로 생성되므로, 별도로 경비 등록을 다시 할 필요가 없습니다.')}
${WARN('승인된 지출결의서는 수정/삭제할 수 없습니다. 금액 정정이 필요하면 회사관리자에게 문의하세요.')}
`)
  },
  {
    menu_key: 'vehicle-manage',
    title: '법인 차량 등록 및 관리',
    content: WRAP(`
${H2('법인 차량 등록 및 관리')}
<p>회사 소유 법인 차량을 등록하고 관리하는 메뉴입니다. 등록된 차량은 운행일지 작성 시 선택 가능해집니다.</p>

<h3>1. 차량 등록 방법</h3>
<ol>
<li><strong>"+ 차량 등록"</strong> 버튼 클릭</li>
<li><strong>차량번호</strong> 입력 (예: 12가 3456)</li>
<li><strong>차종</strong> 선택 (승용/SUV/승합/화물 등)</li>
<li><strong>모델명</strong> 입력 (예: 쏘나타, 카니발)</li>
<li><strong>연식</strong>, <strong>구매일</strong> 등 추가 정보 입력 (선택)</li>
<li>"저장" 클릭</li>
</ol>

<h3>2. 차량 수정/삭제</h3>
<ul>
<li>차량 목록에서 해당 행의 <strong>"수정"</strong>/<strong>"삭제"</strong> 버튼 클릭</li>
<li>운행 이력이 있는 차량은 삭제 대신 <strong>비활성화</strong> 권장</li>
</ul>

${WARN('차량 등록/수정/삭제는 <strong>회사관리자 권한</strong>이 필요합니다. 일반 직원은 목록 조회만 가능합니다.')}

<h3>3. 운행일지와의 연동</h3>
<p>이 메뉴에 등록된 차량만 <strong>운행일지</strong> 작성 시 선택할 수 있습니다. 차량을 비활성화하면 새 운행일지 작성 시 목록에서 제외되지만, 기존 운행일지 기록은 그대로 유지됩니다.</p>

${TIP('새 차량을 구입했을 때 이 메뉴에서 먼저 등록해야 직원들이 운행일지를 작성할 수 있습니다.')}
`)
  },
  {
    menu_key: 'vehicle-logs',
    title: '법인 차량 운행일지 작성',
    content: WRAP(`
${H2('법인 차량 운행일지 작성')}
<p>법인 차량 사용 시 작성하는 운행 기록 메뉴입니다. 세무 및 차량 관리 목적으로 활용됩니다.</p>

<h3>1. 운행일지 작성 방법</h3>
<ol>
<li><strong>"+ 운행일지 작성"</strong> 버튼 클릭</li>
<li><strong>차량 선택</strong> (차량관리에 등록된 법인차량 목록에서 선택)</li>
<li><strong>출발지</strong> / <strong>도착지</strong> 입력</li>
<li><strong>출발 시각</strong> / <strong>도착 시각</strong> 입력</li>
<li><strong>출발 주행거리(km)</strong> / <strong>도착 주행거리(km)</strong> 입력 → 운행거리 자동 계산</li>
<li><strong>유류비</strong> 입력 (주유 시)</li>
<li><strong>운행 목적</strong> 작성 (예: 거래처 방문, 현장 답사)</li>
<li>"저장" 클릭</li>
</ol>

<h3>2. 조회 권한</h3>
<ul>
<li><strong>일반 직원</strong> - 본인이 작성한 운행일지만 조회/수정 가능</li>
<li><strong>회사관리자</strong> - 전 직원의 모든 운행일지 조회 가능</li>
</ul>

${TIP('도착 주행거리는 다음 운행일지의 출발 주행거리와 연속되어야 정확한 누적 관리가 됩니다.')}
${WARN('유류비는 영수증 기반으로 정확히 입력하세요. 차량별 유류비 합계는 월말 정산 시 집계됩니다.')}
`)
  },
  {
    menu_key: 'receivables',
    title: '미수금 관리 (간소화 버전)',
    content: WRAP(`
${H2('미수금 관리 (간소화 버전)')}
<p>프로젝트별 미수금을 간단하게 확인하고 관리하는 메뉴입니다. 자동 계산과 수동 등록을 분리한 탭 구조입니다.</p>

<h3>탭 구성</h3>
<ul>
<li><strong>자동 미수금</strong> - 계약 기반 자동 계산 (수정 불가)</li>
<li><strong>수동 미수금</strong> - 직접 추가/수정/삭제 가능</li>
</ul>

<h3>1. 자동 미수금 탭</h3>
<div style="background:#f5f5f5;padding:12px;border-radius:8px;margin:12px 0;">
<strong>자동 미수금 = 계약금액 - 입금금액</strong>
</div>
<ul>
<li>계약 관리에 등록된 계약금액에서 입금 관리에 등록된 입금액을 <strong>자동 차감</strong>하여 표시</li>
<li>직접 수정/삭제 불가 - 계약서나 입금 내역을 수정하면 자동 반영됨</li>
<li>프로젝트별, 거래처별로 필터링 가능</li>
</ul>

<h3>2. 수동 미수금 탭</h3>
<ul>
<li>계약과 무관한 미수금(예: 추가 요청 건, 수수료 등)을 직접 입력</li>
<li><strong>"+ 추가"</strong> 버튼으로 신규 등록 (거래처, 금액, 비고)</li>
<li>행의 <strong>수정</strong>/<strong>삭제</strong> 버튼으로 자유롭게 편집 가능</li>
</ul>

<h3>두 탭의 차이</h3>
<table style="width:100%;border-collapse:collapse;margin:12px 0;">
<tr style="background:#fafafa;"><th style="border:1px solid #e8e8e8;padding:8px;">구분</th><th style="border:1px solid #e8e8e8;padding:8px;">자동 미수금</th><th style="border:1px solid #e8e8e8;padding:8px;">수동 미수금</th></tr>
<tr><td style="border:1px solid #e8e8e8;padding:8px;">출처</td><td style="border:1px solid #e8e8e8;padding:8px;">계약 - 입금</td><td style="border:1px solid #e8e8e8;padding:8px;">직접 입력</td></tr>
<tr><td style="border:1px solid #e8e8e8;padding:8px;">수정</td><td style="border:1px solid #e8e8e8;padding:8px;">불가</td><td style="border:1px solid #e8e8e8;padding:8px;">가능</td></tr>
<tr><td style="border:1px solid #e8e8e8;padding:8px;">용도</td><td style="border:1px solid #e8e8e8;padding:8px;">정상 계약 미수</td><td style="border:1px solid #e8e8e8;padding:8px;">예외/추가 건</td></tr>
</table>

${TIP('대부분의 미수금은 자동 미수금 탭에서 관리되며, 수동 미수금 탭은 예외 상황에만 사용하세요.')}
`)
  },
  {
    menu_key: 'dashboard',
    title: '통합 대시보드 및 월/연간 통계',
    content: WRAP(`
${H2('통합 대시보드 및 월/연간 통계')}
<p>회사의 재무 현황과 통계를 한눈에 확인하는 메인 대시보드입니다. <strong>현황 탭</strong>과 <strong>통계 탭</strong>으로 구분됩니다.</p>

<h3>1. 현황 탭</h3>
<ul>
<li>오늘 기준 실시간 상태: 진행 중 프로젝트, 이번달 입금/지출, 최근 활동 등</li>
<li>업무 흐름에 따른 바로가기 카드 제공</li>
<li>승인 대기 중인 결재 건수 알림</li>
</ul>

<h3>2. 통계 탭 (신규)</h3>
<p>월별 또는 연도별로 6개 주요 지표를 집계하여 보여줍니다.</p>

<h4>6개 통계 지표</h4>
<ol>
<li><strong>미수금</strong> - 아직 받지 못한 금액</li>
<li><strong>미지급금</strong> - 아직 지급하지 않은 금액</li>
<li><strong>입금</strong> - 실제 입금된 금액</li>
<li><strong>프로젝트금액</strong> - 계약 체결된 총 프로젝트 금액</li>
<li><strong>지출</strong> - 외주/세금계산서 등 지출 총액</li>
<li><strong>경비</strong> - 경비정산 집계 금액</li>
</ol>

<h3>3. 월별/연도별 토글</h3>
<ul>
<li>상단 토글로 <strong>월별</strong> ↔ <strong>연도별</strong> 전환</li>
<li><strong>월별 모드</strong>: 해당 연도의 1월~12월 추이를 차트로 확인</li>
<li><strong>연도별 모드</strong>: 최근 여러 해의 연간 합계를 비교</li>
</ul>

${TIP('통계 탭의 지표들은 클릭하면 해당 메뉴로 바로 이동하여 상세 내역을 확인할 수 있습니다.')}
${WARN('통계 수치는 입력된 데이터 기준으로 실시간 집계되므로, 누락된 계약/입금 건이 있다면 정확도가 떨어질 수 있습니다.')}
`)
  },
  {
    menu_key: 'tax-invoices',
    title: '세금계산서 (프로젝트 연동)',
    content: WRAP(`
${H2('세금계산서 (프로젝트 연동)')}
<p>세금계산서 발행과 수취를 관리합니다. 프로젝트 및 거래처와 자동 연동됩니다.</p>

<h3>1. 세금계산서 등록</h3>
<ol>
<li><strong>"+ 등록"</strong> 버튼 클릭</li>
<li><strong>발행/수취</strong> 구분 선택</li>
<li><strong>거래처</strong> 입력 (자동완성) - 기존 거래처 입력 시 사업자번호 등 자동 채움</li>
<li><strong>프로젝트 선택</strong> (선택사항) - 연결할 프로젝트가 있다면 지정</li>
<li>공급가액, 세액, 발행일 등 입력</li>
<li>"저장" 클릭</li>
</ol>

<h3>2. 거래처 자동완성</h3>
<ul>
<li>거래처명 입력 시 기존에 등록된 거래처 목록이 드롭다운으로 표시됨</li>
<li>선택하면 사업자번호, 대표자, 주소 등이 자동 입력</li>
<li>신규 거래처는 직접 입력 후 자동으로 거래처 DB에 추가됨</li>
</ul>

<h3>3. 프로젝트 연동</h3>
<div style="background:#e6f7ff;padding:12px;border-radius:8px;margin:12px 0;">
프로젝트를 지정하여 발행한 세금계산서는 <strong>프로젝트 현황 화면</strong>에서 해당 프로젝트의 "세금계산서 이력"으로 조회할 수 있습니다.
</div>
<ul>
<li>프로젝트별 발행 금액 합계 자동 집계</li>
<li>프로젝트 상세 화면에서 관련 세금계산서 일괄 확인 가능</li>
</ul>

${TIP('프로젝트 선택은 선택사항이지만, 지정하면 프로젝트 현황에서 이력 추적이 가능하므로 가능한 연결하는 것을 권장합니다.')}
`)
  },
  {
    menu_key: 'messenger',
    title: '메신저 그룹 채팅 및 멤버 추가',
    content: WRAP(`
${H2('메신저 그룹 채팅 및 멤버 추가')}
<p>사내 직원 간 실시간 채팅 메뉴입니다. 1:1 채팅과 그룹 채팅을 지원합니다.</p>

<h3>1. 채팅 시작하기</h3>
<ul>
<li><strong>1:1 채팅</strong> - 좌측 직원 목록에서 상대방 클릭</li>
<li><strong>그룹 채팅</strong> - <strong>"+ 그룹 채팅"</strong> 버튼 → 참여자 여러 명 선택 → 그룹명 입력 → 생성</li>
</ul>

<h3>2. 멤버 추가 방법 (그룹 채팅)</h3>
<ol>
<li>그룹 채팅방 우측 상단 <strong>설정(⚙)</strong> 또는 <strong>"멤버 추가"</strong> 버튼 클릭</li>
<li>추가할 직원을 목록에서 선택</li>
<li>"확인" 클릭 → 해당 직원에게 채팅방 초대 알림 전송</li>
</ol>

${WARN('중요: 새로 추가된 멤버는 <strong>추가 시점 이후의 메시지만</strong> 조회할 수 있습니다. 이전 대화 기록은 보이지 않으므로, 기존 대화 내용 공유가 필요하면 별도로 전달하세요.')}

<h3>3. 주요 기능</h3>
<ul>
<li>텍스트 메시지, 파일 첨부, 이미지 공유</li>
<li>읽음 표시 및 안 읽은 메시지 뱃지</li>
<li>채팅방 검색</li>
</ul>

${TIP('부서별 공지나 프로젝트 팀 단위 협업에는 그룹 채팅을 활용하세요. 멤버 추가/제외로 유연하게 운영할 수 있습니다.')}
`)
  },
  {
    menu_key: 'expenses',
    title: '경비정산 (택배비/제본비 카테고리)',
    content: WRAP(`
${H2('경비정산 (택배비/제본비 카테고리)')}
<p>직원들이 업무상 사용한 경비를 등록하고 정산받는 메뉴입니다.</p>

<h3>1. 경비 등록 방법</h3>
<ol>
<li><strong>"+ 경비 등록"</strong> 버튼 클릭</li>
<li><strong>사용일</strong>, <strong>카테고리</strong>, <strong>금액</strong> 입력</li>
<li><strong>비고</strong>란에 상세 내용 작성 - 어디서/어디로/언제/무엇을 자유롭게 기재</li>
<li>영수증 이미지 첨부 (선택)</li>
<li>"저장" 클릭</li>
</ol>

<h3>2. 신규 카테고리 (Phase 추가)</h3>
<ul>
<li><strong>택배비</strong> - 택배 발송 비용 (예: "서울 → 부산 현장, 샘플 발송")</li>
<li><strong>제본비</strong> - 보고서/도면 제본 비용 (예: "A출력소, 최종 보고서 20부 제본")</li>
</ul>

<div style="background:#e6f7ff;padding:12px;border-radius:8px;margin:12px 0;">
<strong>비고란 작성 예시</strong><br/>
• 택배비: "2026-04-05, 우체국, 이지컨설턴트 → OO현장사무소, 도면 원본 발송"<br/>
• 제본비: "2026-04-06, B인쇄소, 중간보고서 10부 컬러 제본"
</div>

<h3>3. 월별 합계 카드</h3>
<ul>
<li>화면 상단에 <strong>이번달 합계</strong>, <strong>지난달 합계</strong>, <strong>카테고리별 합계</strong> 카드 표시</li>
<li>월을 변경하면 카드 수치도 함께 갱신됨</li>
</ul>

${TIP('비고란에 "누가/언제/어디서/무엇을" 구체적으로 기재해야 나중에 월말 정산 시 근거자료가 됩니다.')}
${WARN('지출결의서를 통해 사전 승인받은 건은 경비정산에 자동으로 등록되므로, 중복 입력하지 마세요.')}
`)
  },
  {
    menu_key: 'contracts',
    title: '계약 관리 (회의록 첨부)',
    content: WRAP(`
${H2('계약 관리 (회의록 첨부)')}
<p>수주 계약을 등록하고 관리하는 메뉴입니다. 회의록 및 기타 자료 업로드와 AI 요약 기능을 제공합니다.</p>

<h3>1. 계약 등록 기본 흐름</h3>
<ol>
<li><strong>"+ 계약 등록"</strong> 또는 기존 견적서에서 "계약 전환"</li>
<li>거래처, 계약금액, 계약기간, 결제 조건 입력</li>
<li>계약서 파일 업로드</li>
<li>"저장" 클릭</li>
</ol>

<h3>2. 회의록 및 기타 자료 첨부 (신규)</h3>
<ol>
<li>계약 상세 화면 → <strong>"회의록/기타 자료"</strong> 탭 또는 섹션</li>
<li><strong>"파일 업로드"</strong> 버튼 클릭</li>
<li>파일 선택 → 자료 유형(회의록/사양서/기타) 지정 → 업로드</li>
</ol>

<h4>지원 형식</h4>
<ul>
<li><strong>PDF</strong> - 스캔 문서, 전자 계약서</li>
<li><strong>DOCX</strong> - MS Word 문서</li>
<li><strong>TXT</strong> - 텍스트 메모, 미팅 기록</li>
</ul>

<h3>3. AI 요약 기능</h3>
<div style="background:#e6f7ff;padding:12px;border-radius:8px;margin:12px 0;">
업로드된 회의록/자료는 <strong>"AI 요약"</strong> 버튼 클릭 시 주요 내용을 자동으로 추출하여 핵심 포인트, 결정사항, 액션 아이템 형식으로 요약해줍니다.
</div>
<ul>
<li>긴 회의록도 수 초 내에 핵심 내용 파악 가능</li>
<li>요약 결과는 계약 상세에 저장되어 재활용 가능</li>
</ul>

<h3>4. 프로젝트 현황에서 조회</h3>
<p>계약에 첨부된 회의록/자료는 해당 계약과 연결된 <strong>프로젝트 현황</strong> 화면에서도 통합 조회할 수 있습니다. 프로젝트 관련 모든 문서를 한 곳에서 확인 가능합니다.</p>

${TIP('회의 직후 회의록을 바로 업로드하고 AI 요약을 실행하면, 의사결정 히스토리를 체계적으로 관리할 수 있습니다.')}
${WARN('민감 정보가 포함된 파일은 업로드 전 보안 정책을 확인하세요. 업로드된 파일은 해당 계약 접근 권한이 있는 사용자만 조회 가능합니다.')}
`)
  },
];

async function insertManuals() {
  console.log('Starting Phase 1-4 manual insertion...');
  console.log(`Total manuals to upsert: ${manuals.length}`);

  // Only delete the specific menu_keys we are inserting (preserve other manuals)
  const keys = manuals.map((m) => m.menu_key);
  const { error: deleteError } = await supabase
    .from('menu_manuals')
    .delete()
    .eq('company_id', COMPANY_ID)
    .in('menu_key', keys);

  if (deleteError) {
    console.error('Delete error:', deleteError.message);
    return;
  }
  console.log(`Deleted existing manuals for keys: ${keys.join(', ')}`);

  let successCount = 0;
  let errorCount = 0;

  for (const manual of manuals) {
    const { error } = await supabase
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
