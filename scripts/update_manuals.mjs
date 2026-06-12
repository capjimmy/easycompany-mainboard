import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://silvsqcwearelrumtqqm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COMPANY_ID = 'a0000000-0000-0000-0000-000000000001';

// 추가/업데이트할 매뉴얼
const manualUpdates = [
  {
    menu_key: 'settings',
    title: '설정 및 비밀번호 변경',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">

<h2 style="color: #1890ff; border-bottom: 3px solid #1890ff; padding-bottom: 10px;">
  설정 및 비밀번호 변경 가이드
</h2>

<div style="background: #fff7e6; border-left: 4px solid #faad14; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
<strong>⚠ 중요:</strong> 초기 비밀번호를 받으신 후 반드시 비밀번호를 변경해주세요.
</div>

<h3>🔐 비밀번호 변경 방법</h3>
<ol>
<li>좌측 메뉴에서 <strong>시스템 &gt; 설정</strong>을 클릭합니다.</li>
<li>"비밀번호 변경" 섹션에서 다음을 입력합니다:
  <ul>
    <li><strong>현재 비밀번호</strong>: 기존에 사용하던 비밀번호</li>
    <li><strong>새 비밀번호</strong>: 변경할 비밀번호 (8자 이상 권장)</li>
    <li><strong>비밀번호 확인</strong>: 새 비밀번호를 다시 입력</li>
  </ul>
</li>
<li>"비밀번호 변경" 버튼을 클릭합니다.</li>
<li>변경 완료 메시지가 표시되면 다음 로그인부터 새 비밀번호를 사용합니다.</li>
</ol>

<div style="background: #f0f5ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
<strong>💡 비밀번호를 잊었을 경우:</strong><br>
회사 관리자 또는 슈퍼관리자에게 비밀번호 초기화를 요청하세요.<br>
관리자는 <strong>관리 > 사용자관리</strong>에서 해당 사용자의 비밀번호를 초기화할 수 있습니다.
</div>

<h3>⚙ 기본 설정</h3>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
<tr style="background: #fafafa;"><th style="border: 1px solid #e8e8e8; padding: 10px; text-align: left; width: 30%;">설정 항목</th><th style="border: 1px solid #e8e8e8; padding: 10px; text-align: left;">설명</th></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">테마</td><td style="border: 1px solid #e8e8e8; padding: 10px;">라이트/다크 모드 전환</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">알림 설정</td><td style="border: 1px solid #e8e8e8; padding: 10px;">알림 수신 여부 및 소리 설정</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">내 정보</td><td style="border: 1px solid #e8e8e8; padding: 10px;">우측 상단 프로필 아이콘 클릭 → 내 정보에서 전화번호, 이메일 수정 가능</td></tr>
</table>

</div>`
  },
  {
    menu_key: 'dashboard',
    title: '전체 업무 프로세스 및 대시보드',
    content: `<div style="padding: 20px; font-family: 'Malgun Gothic', sans-serif; line-height: 1.9; color: #333;">

<h2 style="color: #1890ff; border-bottom: 3px solid #1890ff; padding-bottom: 10px; margin-bottom: 20px;">
  건설경제연구원 업무관리 시스템 - 전체 프로세스
</h2>

<div style="background: #f6ffed; border-left: 4px solid #52c41a; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
<h3 style="margin-top: 0; color: #52c41a;">🚀 처음 사용하시나요? (초기 셋팅 가이드)</h3>
<ol style="margin-bottom: 0;">
<li><strong>로그인</strong>: 관리자에게 받은 아이디와 초기 비밀번호로 로그인합니다.</li>
<li><strong>비밀번호 변경</strong>: <em>시스템 > 설정</em>에서 비밀번호를 반드시 변경합니다.</li>
<li><strong>내 정보 확인</strong>: 우측 상단 프로필 아이콘 → "내 정보"에서 연락처 정보를 확인/수정합니다.</li>
<li><strong>메뉴 탐색</strong>: 좌측 메뉴바에서 접근 가능한 메뉴를 확인합니다. (역할에 따라 표시되는 메뉴가 다릅니다)</li>
<li><strong>매뉴얼 확인</strong>: 상단 "?" 아이콘을 클릭하면 각 메뉴별 상세 매뉴얼을 확인할 수 있습니다.</li>
</ol>
</div>

<div style="background: #fff1f0; border-left: 4px solid #ff4d4f; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
<h3 style="margin-top: 0; color: #ff4d4f;">🔧 관리자 초기 셋팅 (필수)</h3>
<table style="width: 100%; border-collapse: collapse;">
<tr style="background: #fafafa;"><th style="border: 1px solid #e8e8e8; padding: 10px; text-align: left; width: 20%;">순서</th><th style="border: 1px solid #e8e8e8; padding: 10px; text-align: left; width: 30%;">작업</th><th style="border: 1px solid #e8e8e8; padding: 10px; text-align: left;">메뉴 위치</th></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">1</td><td style="border: 1px solid #e8e8e8; padding: 10px;">회사 정보 확인</td><td style="border: 1px solid #e8e8e8; padding: 10px;">관리 > 회사관리</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">2</td><td style="border: 1px solid #e8e8e8; padding: 10px;">부서 생성</td><td style="border: 1px solid #e8e8e8; padding: 10px;">관리 > 부서관리</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">3</td><td style="border: 1px solid #e8e8e8; padding: 10px;">사용자 등록 및 부서 배치</td><td style="border: 1px solid #e8e8e8; padding: 10px;">관리 > 사용자관리</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">4</td><td style="border: 1px solid #e8e8e8; padding: 10px;">권한 설정</td><td style="border: 1px solid #e8e8e8; padding: 10px;">관리 > 권한설정</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">5</td><td style="border: 1px solid #e8e8e8; padding: 10px;">인건비 단가표 등록</td><td style="border: 1px solid #e8e8e8; padding: 10px;">시스템 > 단가 설정</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">6</td><td style="border: 1px solid #e8e8e8; padding: 10px;">거래처 등록</td><td style="border: 1px solid #e8e8e8; padding: 10px;">계약/매출 > 거래처관리</td></tr>
</table>
</div>

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

<h3>역할별 접근 가능 메뉴</h3>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
<tr style="background: #fafafa;">
  <th style="border: 1px solid #e8e8e8; padding: 10px;">메뉴 카테고리</th>
  <th style="border: 1px solid #e8e8e8; padding: 10px;">슈퍼관리자</th>
  <th style="border: 1px solid #e8e8e8; padding: 10px;">회사관리자</th>
  <th style="border: 1px solid #e8e8e8; padding: 10px;">부서관리자</th>
  <th style="border: 1px solid #e8e8e8; padding: 10px;">사원</th>
</tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">홈/대시보드</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">계약/매출</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">재무/회계</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">❌</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">인사/총무</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td></tr>
<tr><td style="border: 1px solid #e8e8e8; padding: 10px;">관리 (사용자/부서/권한)</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">✅</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">❌</td><td style="border: 1px solid #e8e8e8; padding: 10px; text-align:center;">❌</td></tr>
</table>

<h3>문의사항</h3>
<p>시스템 사용 중 문의사항이 있으면 회사 관리자에게 문의하세요.</p>

</div>`
  }
];

async function updateManuals() {
  let updated = 0;
  let errors = 0;

  for (const manual of manualUpdates) {
    const { error } = await supabase
      .from('menu_manuals')
      .update({
        title: manual.title,
        content: manual.content,
        updated_at: new Date().toISOString(),
      })
      .eq('menu_key', manual.menu_key)
      .eq('company_id', COMPANY_ID);

    if (error) {
      console.error(`Error updating ${manual.menu_key}:`, error.message);
      errors++;
    } else {
      console.log(`Updated: ${manual.menu_key} - ${manual.title}`);
      updated++;
    }
  }

  console.log(`\nDone! Updated: ${updated}, Errors: ${errors}`);
}

updateManuals().catch(console.error);
