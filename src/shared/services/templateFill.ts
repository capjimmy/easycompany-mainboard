/**
 * 양식 채우기 공용 모듈 (데스크톱 + 웹 공용, 브라우저/Node 모두 동작)
 *
 * 핵심 원칙: xlsx/docx 는 ZIP 파일이다.
 *  - ZIP 을 풀어 XML 안의 {{플레이스홀더}} 텍스트만 치환하고 다시 압축한다.
 *  - SheetJS 등으로 재직렬화하지 않으므로 셀 서식/레이아웃/이미지가 100% 보존된다.
 *  - JSZip 만 사용하므로 브라우저(웹)와 Node(데스크톱) 양쪽에서 동일하게 동작한다.
 *
 * AI 자동배치(플레이스홀더가 전혀 없는 양식)는 이 모듈 범위 밖이다. (데스크톱 전용)
 */

import JSZip from 'jszip';

// ===== 데이터 타입 (채우기에 필요한 필드만) =====

export interface ContractFillData {
  contract_number?: string;
  client_company?: string;
  client_business_number?: string;
  client_contact_name?: string;
  client_contact_phone?: string;
  service_name?: string;
  description?: string;
  contract_type?: string;
  contract_date?: string;
  contract_start_date?: string;
  contract_end_date?: string;
  contract_amount?: number;
  vat_amount?: number;
  total_amount?: number;
  outsource_company?: string;
  outsource_amount?: number;
  progress_rate?: number;
  manager_name?: string;
  notes?: string;
  received_amount?: number;
  remaining_amount?: number;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_ceo?: string;
}

export interface QuoteFillData {
  quote_number?: string;
  recipient_company?: string;
  recipient_contact?: string;
  recipient_phone?: string;
  recipient_email?: string;
  recipient_department?: string;
  recipient_address?: string;
  service_name?: string;
  title?: string;
  quote_date?: string;
  valid_until?: string;
  project_period_months?: number;
  labor_total?: number;
  expense_total?: number;
  total_amount?: number;
  vat_amount?: number;
  grand_total?: number;
  notes?: string;
  company_name?: string;
  company_representative?: string;
  company_business_number?: string;
  company_address?: string;
  company_phone?: string;
}

// ===== 포맷 유틸 =====

function formatMoney(amount: number | undefined | null): string {
  if (!amount) return '0';
  return amount.toLocaleString('ko-KR');
}

function formatDateDot(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function formatDateKr(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`;
}

function numberToKorean(amount: number): string {
  if (!amount) return '영';
  const units = ['', '만', '억', '조'];
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const subUnits = ['', '십', '백', '천'];

  let result = '';
  let unitIndex = 0;
  let remaining = amount;

  while (remaining > 0) {
    const chunk = remaining % 10000;
    if (chunk > 0) {
      let chunkStr = '';
      let c = chunk;
      for (let i = 0; i < 4 && c > 0; i++) {
        const d = c % 10;
        if (d > 0) {
          chunkStr = digits[d] + subUnits[i] + chunkStr;
        }
        c = Math.floor(c / 10);
      }
      result = chunkStr + units[unitIndex] + result;
    }
    remaining = Math.floor(remaining / 10000);
    unitIndex++;
  }

  return result;
}

/** XML 특수문자 이스케이프 (치환값 삽입 시) */
function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ===== 플레이스홀더 맵 =====

export function buildContractPlaceholderMap(data: ContractFillData): Record<string, string> {
  const totalAmt = data.total_amount || (data.contract_amount || 0) + Math.round((data.contract_amount || 0) * 0.1);
  const vatAmt = data.vat_amount || Math.round((data.contract_amount || 0) * 0.1);

  return {
    '거래처': data.client_company || '',
    '발주처': data.client_company || '',
    '발주기관': data.client_company || '',
    '거래처_사업자번호': data.client_business_number || '',
    '발주처_사업자번호': data.client_business_number || '',
    '거래처_담당자': data.client_contact_name || '',
    '발주처_담당자': data.client_contact_name || '',
    '거래처_연락처': data.client_contact_phone || '',
    '발주처_연락처': data.client_contact_phone || '',

    '용역명': data.service_name || '',
    '계약번호': data.contract_number || '',
    '계약유형': data.contract_type || '',
    '설명': data.description || '',
    '비고': data.notes || '',

    '계약금액': formatMoney(data.contract_amount),
    '부가세': formatMoney(vatAmt),
    '총액': formatMoney(totalAmt),
    '총계약금액': formatMoney(totalAmt),
    '계약금액_숫자': String(data.contract_amount || 0),
    '부가세_숫자': String(vatAmt),
    '총액_숫자': String(totalAmt),
    '계약금액_한글': `금${numberToKorean(data.contract_amount || 0)}원정`,
    '총액_한글': `금${numberToKorean(totalAmt)}원정`,

    '외주업체': data.outsource_company || '',
    '외주금액': formatMoney(data.outsource_amount),

    '수금액': formatMoney(data.received_amount),
    '잔액': formatMoney(data.remaining_amount),

    '계약일': formatDateDot(data.contract_date),
    '착수일': formatDateDot(data.contract_start_date),
    '준공일': formatDateDot(data.contract_end_date),
    '계약기간': `${formatDateDot(data.contract_start_date)} ~ ${formatDateDot(data.contract_end_date)}`,
    '계약일_한글': formatDateKr(data.contract_date),
    '착수일_한글': formatDateKr(data.contract_start_date),
    '준공일_한글': formatDateKr(data.contract_end_date),
    '오늘': formatDateDot(new Date().toISOString()),
    '오늘_한글': formatDateKr(new Date().toISOString()),

    '담당자': data.manager_name || '',
    '진행률': data.progress_rate ? `${data.progress_rate}%` : '',

    '회사명': data.company_name || '',
    '회사주소': data.company_address || '',
    '회사전화': data.company_phone || '',
    '대표자': data.company_ceo || '',
  };
}

export function buildQuotePlaceholderMap(data: QuoteFillData): Record<string, string> {
  return {
    '견적번호': data.quote_number || '',
    '수신사': data.recipient_company || '',
    '거래처': data.recipient_company || '',
    '수신_담당자': data.recipient_contact || '',
    '수신_연락처': data.recipient_phone || '',
    '수신_이메일': data.recipient_email || '',
    '수신_부서': data.recipient_department || '',
    '수신_주소': data.recipient_address || '',
    '용역명': data.service_name || '',
    '제목': data.title || '',
    '견적일': formatDateDot(data.quote_date),
    '유효기한': formatDateDot(data.valid_until),
    '사업기간': data.project_period_months ? `${data.project_period_months}개월` : '',
    '인건비': formatMoney(data.labor_total),
    '경비': formatMoney(data.expense_total),
    '합계': formatMoney(data.total_amount),
    '부가세': formatMoney(data.vat_amount),
    '총액': formatMoney(data.grand_total),
    '총견적금액': formatMoney(data.grand_total),
    '비고': data.notes || '',
    '회사명': data.company_name || '',
    '대표자': data.company_representative || '',
    '사업자번호': data.company_business_number || '',
    '회사주소': data.company_address || '',
    '회사전화': data.company_phone || '',
    '오늘': formatDateDot(new Date().toISOString()),
    '오늘_한글': formatDateKr(new Date().toISOString()),
  };
}

// ===== XML 치환 코어 =====

/**
 * 여러 텍스트 노드(run)에 걸쳐 분할된 {{플레이스홀더}}를 컨테이너 단위로 통합 치환.
 * - containerRe: 단락/문자열 컨테이너 (docx: <w:p>, xlsx: <si>)
 * - textRe: 텍스트 노드 (docx: <w:t>, xlsx: <t>)
 * 컨테이너 안의 모든 텍스트를 이어붙여 치환한 뒤, 첫 텍스트 노드에 결과를 넣고
 * 나머지 텍스트 노드는 비운다. (서식/노드 구조는 그대로 보존)
 */
function fillSplitContainers(
  xml: string,
  map: Record<string, string>,
  containerRe: RegExp,
  textOpen: string, // 'w:t' | 't'
): { xml: string; count: number } {
  let count = 0;
  const tNodeRe = new RegExp(`(<${textOpen}(?:\\s[^>]*)?>)([\\s\\S]*?)(</${textOpen}>)`, 'g');

  const out = xml.replace(containerRe, (container) => {
    // 텍스트 노드 내용 수집
    const inners: string[] = [];
    let m: RegExpExecArray | null;
    tNodeRe.lastIndex = 0;
    while ((m = tNodeRe.exec(container)) !== null) {
      inners.push(m[2]);
    }
    if (inners.length === 0) return container;

    const joined = inners.join('');
    if (joined.indexOf('{{') === -1) return container;

    let localCount = 0;
    const replaced = joined.replace(/\{\{([^}]+)\}\}/g, (full, key) => {
      const k = String(key).trim();
      if (k in map) {
        localCount++;
        return escapeXml(map[k]);
      }
      return full;
    });
    if (localCount === 0) return container;
    count += localCount;

    // 첫 텍스트 노드에 결과 삽입, 나머지는 비움
    let idx = 0;
    tNodeRe.lastIndex = 0;
    const newContainer = container.replace(tNodeRe, (full, open, _inner, close) => {
      if (idx === 0) {
        idx++;
        // 공백 보존 속성 보강
        const openOut = / xml:space=/.test(open) ? open : open.replace('>', ' xml:space="preserve">');
        return `${openOut}${replaced}${close}`;
      }
      idx++;
      return `${open}${close}`;
    });
    return newContainer;
  });

  return { xml: out, count };
}

/** 단순 직접 치환 (단일 노드 내 플레이스홀더용) */
function fillDirect(xml: string, map: Record<string, string>): { xml: string; count: number } {
  let count = 0;
  const out = xml.replace(/\{\{([^}]+)\}\}/g, (full, key) => {
    const k = String(key).trim();
    if (k in map) {
      count++;
      return escapeXml(map[k]);
    }
    return full;
  });
  return { xml: out, count };
}

// ===== 메인 진입점 =====

export type TemplateExt = 'xlsx' | 'docx';

/**
 * 양식 바이트를 받아 플레이스홀더를 치환한 새 바이트를 반환.
 * 서식은 보존된다. count = 치환된 플레이스홀더 수 (0이면 채울 게 없었던 것).
 */
export async function fillTemplateBytes(
  bytes: Uint8Array | ArrayBuffer,
  ext: TemplateExt,
  map: Record<string, string>,
): Promise<{ bytes: Uint8Array; count: number }> {
  const zip = await JSZip.loadAsync(bytes);
  let count = 0;

  if (ext === 'docx') {
    // 본문 + 머리글/바닥글 등 모든 word/*.xml 대상
    const targets = Object.keys(zip.files).filter(
      (n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n),
    );
    for (const name of targets) {
      let xml = await zip.files[name].async('string');
      const split = fillSplitContainers(xml, map, /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, 'w:t');
      xml = split.xml;
      count += split.count;
      const direct = fillDirect(xml, map);
      xml = direct.xml;
      count += direct.count;
      zip.file(name, xml);
    }
  } else {
    // xlsx: 공유 문자열 + 워크시트 인라인 문자열
    const shared = 'xl/sharedStrings.xml';
    if (zip.files[shared]) {
      let xml = await zip.files[shared].async('string');
      const split = fillSplitContainers(xml, map, /<si>[\s\S]*?<\/si>/g, 't');
      xml = split.xml;
      count += split.count;
      zip.file(shared, xml);
    }
    const sheets = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    for (const name of sheets) {
      let xml = await zip.files[name].async('string');
      const direct = fillDirect(xml, map);
      if (direct.count > 0) {
        xml = direct.xml;
        count += direct.count;
        zip.file(name, xml);
      }
    }
  }

  const out = (await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
  })) as Uint8Array;

  return { bytes: out, count };
}
