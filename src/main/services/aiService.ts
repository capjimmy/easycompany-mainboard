import OpenAI from 'openai';
import { db } from '../database';

let openaiClient: OpenAI | null = null;

// OpenAI 클라이언트 초기화
async function getOpenAIClient(): Promise<OpenAI | null> {
  const apiKey = await db.getSetting('openai_api_key');
  if (!apiKey) {
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

// API 키 설정 시 클라이언트 재초기화
export function resetOpenAIClient(): void {
  openaiClient = null;
}

// AI를 사용하여 문서 내용 생성
export async function generateDocumentContent(
  contract: any,
  template: any,
  company: any
): Promise<{ success: boolean; content?: string; error?: string }> {
  const client = await getOpenAIClient();

  if (!client) {
    return { success: false, error: 'OpenAI API 키가 설정되지 않았습니다.' };
  }

  try {
    // 계약 정보를 한국어로 정리
    const contractInfo = `
## 계약 정보
- 계약번호: ${contract.contract_number || '미정'}
- 용역명: ${contract.service_name || ''}
- 계약유형: ${getContractTypeLabel(contract.contract_type)}
- 계약금액: ${formatKoreanMoney(contract.contract_amount)}
- VAT: ${formatKoreanMoney(Math.round((contract.contract_amount || 0) * 0.1))}
- 총액(VAT포함): ${formatKoreanMoney(Math.round((contract.contract_amount || 0) * 1.1))}
- 계약 시작일: ${contract.contract_start_date || ''}
- 계약 종료일: ${contract.contract_end_date || ''}
- 계약 설명: ${contract.description || ''}

## 발주기관 정보
- 기관명: ${contract.client_company || ''}
- 사업자번호: ${contract.client_business_number || ''}
- 담당자: ${contract.client_contact_name || ''}
- 연락처: ${contract.client_contact_phone || ''}
- 이메일: ${contract.client_contact_email || ''}

## 수급기관 정보 (우리 회사)
- 회사명: ${company?.name || '(주)이지컨설턴트'}
- 사업자번호: ${company?.business_number || ''}
- 주소: ${company?.address || ''}
- 연락처: ${company?.phone || ''}

## 비고
${contract.notes || '없음'}
`;

    const prompt = `당신은 한국 기업의 계약 관련 문서 작성 전문가입니다.

아래 계약 정보를 바탕으로 "${template.name}" 문서의 주요 내용을 작성해주세요.

${contractInfo}

문서 작성 시 주의사항:
1. 공식적이고 격식있는 한국어를 사용하세요
2. 금액은 "금 OO원정 (₩OO)" 형식으로 표기하세요
3. 날짜는 "YYYY년 MM월 DD일" 형식으로 표기하세요
4. 계약 당사자 간의 관계를 명확히 하세요 (갑: 발주기관, 을: 수급기관)
5. 문서 유형에 맞는 적절한 구조와 조항을 포함하세요

문서 내용을 작성해주세요:`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 한국 기업의 공식 문서 작성을 돕는 전문 비서입니다. 정확하고 전문적인 한국어로 문서를 작성합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return { success: false, error: 'AI 응답이 비어있습니다.' };
    }

    return { success: true, content };

  } catch (error: any) {
    console.error('OpenAI API Error:', error);

    if (error.code === 'invalid_api_key') {
      return { success: false, error: 'OpenAI API 키가 유효하지 않습니다.' };
    }

    if (error.code === 'insufficient_quota') {
      return { success: false, error: 'OpenAI API 사용량을 초과했습니다.' };
    }

    return { success: false, error: `AI 분석 오류: ${error.message}` };
  }
}

// 템플릿 필드 매핑 분석
export async function analyzeTemplateFields(
  templateContent: string,
  contract: any
): Promise<{ success: boolean; mappings?: Record<string, string>; error?: string }> {
  const client = await getOpenAIClient();

  if (!client) {
    return { success: false, error: 'OpenAI API 키가 설정되지 않았습니다.' };
  }

  try {
    const prompt = `다음 문서 템플릿에서 {{변수명}} 형식의 플레이스홀더를 찾아 계약 정보로 채워주세요.

템플릿 내용:
${templateContent}

계약 정보:
- 계약번호: ${contract.contract_number}
- 용역명: ${contract.service_name}
- 계약금액: ${contract.contract_amount}
- 발주기관: ${contract.client_company}
- 담당자: ${contract.client_contact_name}
- 시작일: ${contract.contract_start_date}
- 종료일: ${contract.contract_end_date}

각 플레이스홀더에 대해 적절한 값을 JSON 형식으로 반환해주세요.
예: {"{{계약번호}}": "C-2024-0001", "{{금액}}": "10,000,000원"}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '템플릿 변수를 분석하여 JSON으로 반환합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return { success: false, error: 'AI 응답이 비어있습니다.' };
    }

    // JSON 파싱 시도
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const mappings = JSON.parse(jsonMatch[0]);
        return { success: true, mappings };
      }
    } catch (e) {
      // JSON 파싱 실패 시 원본 반환
    }

    return { success: true, mappings: {} };

  } catch (error: any) {
    console.error('Template analysis error:', error);
    return { success: false, error: error.message };
  }
}

// API 키 유효성 테스트
export async function testApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const testClient = new OpenAI({ apiKey });

    await testClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5,
    });

    return { success: true };
  } catch (error: any) {
    if (error.code === 'invalid_api_key') {
      return { success: false, error: 'API 키가 유효하지 않습니다.' };
    }
    return { success: false, error: error.message };
  }
}

// 헬퍼 함수들
function getContractTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    service: '용역계약',
    research: '연구용역',
    consulting: '컨설팅',
    maintenance: '유지보수',
    other: '기타',
  };
  return labels[type] || type;
}

function formatKoreanMoney(amount: number): string {
  if (!amount) return '0원';

  const formatted = amount.toLocaleString('ko-KR');
  const koreanUnits = ['', '만', '억', '조'];
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

  // 금 OO원정 형식
  let koreanText = '';
  const amountStr = amount.toString();
  const len = amountStr.length;

  if (amount >= 100000000) { // 억 이상
    const eok = Math.floor(amount / 100000000);
    const man = Math.floor((amount % 100000000) / 10000);
    const rest = amount % 10000;

    if (eok > 0) koreanText += eok.toLocaleString() + '억';
    if (man > 0) koreanText += man.toLocaleString() + '만';
    if (rest > 0) koreanText += rest.toLocaleString();
    koreanText += '원';
  } else if (amount >= 10000) { // 만 이상
    const man = Math.floor(amount / 10000);
    const rest = amount % 10000;

    if (man > 0) koreanText += man.toLocaleString() + '만';
    if (rest > 0) koreanText += rest.toLocaleString();
    koreanText += '원';
  } else {
    koreanText = formatted + '원';
  }

  return `금 ${koreanText}정 (₩${formatted})`;
}
