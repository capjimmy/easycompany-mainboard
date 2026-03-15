import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

let openaiClient: OpenAI | null = null;

export function initOCRClient(apiKey: string) {
  openaiClient = new OpenAI({ apiKey });
}

export function getOCRClient(): OpenAI | null {
  return openaiClient;
}

const DOC_TYPE_PROMPTS: Record<string, string> = {
  quote: `이 이미지는 견적서입니다. 다음 정보를 JSON 형식으로 추출해주세요:
{
  "recipient_company": "수신처 회사명",
  "recipient_contact": "담당자명",
  "recipient_phone": "연락처",
  "recipient_email": "이메일",
  "service_name": "용역명/프로젝트명",
  "title": "견적서 제목",
  "quote_date": "견적일자 (YYYY-MM-DD)",
  "total_amount": 총금액(숫자),
  "vat_amount": 부가세(숫자),
  "grand_total": 합계(숫자),
  "items": [
    {
      "name": "항목명",
      "quantity": 수량,
      "unit_price": 단가,
      "amount": 금액
    }
  ],
  "notes": "비고/특이사항"
}
값이 없으면 null로 표시해주세요. 금액은 숫자만 입력해주세요.`,

  contract: `이 이미지는 계약서입니다. 다음 정보를 JSON 형식으로 추출해주세요:
{
  "client_company": "발주기관/거래처명",
  "client_contact_name": "담당자명",
  "client_contact_phone": "연락처",
  "service_name": "용역명/프로젝트명",
  "contract_type": "계약유형 (service/research/consulting/maintenance/other)",
  "contract_start_date": "계약시작일 (YYYY-MM-DD)",
  "contract_end_date": "계약종료일 (YYYY-MM-DD)",
  "contract_amount": 계약금액(숫자),
  "vat_amount": 부가세(숫자),
  "total_amount": 총액(숫자),
  "description": "계약 설명",
  "notes": "비고/특이사항"
}
값이 없으면 null로 표시해주세요. 금액은 숫자만 입력해주세요.`,

  general: `이 문서의 내용을 분석하여 다음 정보를 JSON 형식으로 추출해주세요:
{
  "document_type": "문서 종류",
  "company_name": "회사/기관명",
  "contact_name": "담당자명",
  "contact_phone": "연락처",
  "contact_email": "이메일",
  "date": "문서 날짜",
  "amount": 금액(숫자),
  "description": "문서 내용 요약",
  "items": [관련 항목 목록],
  "notes": "비고/특이사항"
}
값이 없으면 null로 표시해주세요.`,
};

export async function processImageWithOCR(
  filePath: string,
  docType: string = 'general'
): Promise<{ success: boolean; data?: any; rawText?: string; error?: string }> {
  if (!openaiClient) {
    return { success: false, error: 'OpenAI API 키가 설정되어 있지 않습니다.' };
  }

  try {
    // 파일 읽기 및 base64 인코딩
    const fileBuffer = fs.readFileSync(filePath);
    const base64Image = fileBuffer.toString('base64');

    // 파일 확장자로 MIME 타입 결정
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.pdf') mimeType = 'application/pdf';

    const prompt = DOC_TYPE_PROMPTS[docType] || DOC_TYPE_PROMPTS['general'];

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const responseText = response.choices[0]?.message?.content || '';

    // JSON 추출 시도
    try {
      // 코드 블록 내의 JSON 추출
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
      const parsedData = JSON.parse(jsonStr);
      return { success: true, data: parsedData, rawText: responseText };
    } catch {
      // JSON 파싱 실패 시 원본 텍스트 반환
      return { success: true, data: null, rawText: responseText };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'OCR 처리에 실패했습니다.' };
  }
}
