import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');

async function pageAll(table, cols) {
  const all = []; let f = 0;
  while (true) {
    const { data } = await sb.from(table).select(cols).order('id').range(f, f + 999);
    if (!data?.length) break;
    all.push(...data); if (data.length < 1000) break; f += 1000;
  }
  return all;
}

// 정리할 접미사 패턴 (정상 거래처명 + 잔재)
function cleanName(name) {
  if (!name) return name;
  let s = name.trim();
  // 잔재 접미사들
  const suffixes = [
    /참조$/, /발신$/, /제목$/, /TEL$/, /합계금액$/, /단가표$/,
    /제출일\d+.*$/, /번호참조$/, /계약번호$/, /원사업자명$/,
    /담당자참조$/, /현장대리인제$/, /대표이사참조$/, /현장대리인$/,
    /제목변경계약체결알림$/,
  ];
  let prev;
  do { prev = s; for (const re of suffixes) s = s.replace(re, '').trim(); } while (s !== prev);
  // 발주기관/발주부서/발주날짜로 시작하는 트래시는 그대로 (의심행)
  return s;
}

console.log('━━━ Phase 1.1: 거래처 잔재 접미사 정리 + 병합 ━━━\n');

const clients = await pageAll('client_companies', '*');
console.log('거래처 총: ' + clients.length);

// 1. 잔재 접미사 패턴 매칭
const cliBadPattern = /(참조|제목|발신|TEL|합계금액|단가표|발주기관|발주부서|발주날짜|담당자참조|대표이사참조|현장대리인)/;
const dirty = clients.filter(c => cliBadPattern.test(c.name || ''));
console.log('잔재 패턴 대상: ' + dirty.length + '건');

// 2. 각각 정리된 이름 계산
const cleanups = [];  // {id, oldName, newName, companyId}
for (const c of dirty) {
  const newName = cleanName(c.name);
  // 발주기관/발주부서/발주날짜로 시작하면 잔재가 너무 심해서 통째로 트래시 후보
  if (/^(발주기관|발주부서|발주날짜|업무\s*진행|업무진행|업무|제목변경)/.test(newName) || newName.length < 2) {
    cleanups.push({ ...c, newName, isTrash: true });
  } else {
    cleanups.push({ ...c, newName, isTrash: false });
  }
}

console.log('정상 정리 가능: ' + cleanups.filter(x => !x.isTrash).length);
console.log('너무 손상되어 삭제: ' + cleanups.filter(x => x.isTrash).length);

// 3. 회사별로 동명 거래처 찾기 (병합 대상)
const allByCoNames = new Map();  // `${companyId}::${name}` → [client...]
for (const c of clients) {
  if (!c.name) continue;
  const k = `${c.company_id}::${c.name.trim()}`;
  if (!allByCoNames.has(k)) allByCoNames.set(k, []);
  allByCoNames.get(k).push(c);
}

// 4. 정리/병합 실행
let renamed = 0, merged = 0, trashed = 0;
let tiUpd = 0, ccUpd = 0, ctrUpd = 0;

for (const c of cleanups) {
  if (c.isTrash) {
    // FK 정리 후 삭제
    const { error: e1 } = await sb.from('client_contacts').delete().eq('client_company_id', c.id);
    if (!e1) ccUpd++;
    await sb.from('tax_invoices').update({ client_company_id: null }).eq('client_company_id', c.id);
    await sb.from('client_companies').delete().eq('id', c.id);
    trashed++;
    continue;
  }

  // 정리된 이름과 동일한 정상 거래처가 같은 회사에 있는지
  const k = `${c.company_id}::${c.newName}`;
  const existing = allByCoNames.get(k);
  if (existing && existing.length > 0 && existing[0].id !== c.id) {
    // winner = existing[0] (정상)
    // loser = c (잔재)
    const winner = existing[0];
    // FK 이동
    const { count: ccCount } = await sb.from('client_contacts')
      .update({ client_company_id: winner.id }, { count: 'exact' })
      .eq('client_company_id', c.id);
    ccUpd += ccCount || 0;
    const { count: tiCount } = await sb.from('tax_invoices')
      .update({ client_company_id: winner.id }, { count: 'exact' })
      .eq('client_company_id', c.id);
    tiUpd += tiCount || 0;
    // contracts.client_company는 텍스트 — 잔재 이름을 winner 이름으로 변경
    const { count: ctCount } = await sb.from('contracts')
      .update({ client_company: winner.name }, { count: 'exact' })
      .eq('client_company', c.name);
    ctrUpd += ctCount || 0;
    // loser 삭제
    await sb.from('client_companies').delete().eq('id', c.id);
    merged++;
  } else {
    // 단순 이름 정리만 (병합 대상 없음)
    await sb.from('client_companies').update({ name: c.newName, updated_at: new Date().toISOString() }).eq('id', c.id);
    // contracts.client_company도 동일 변경
    const { count: ctCount } = await sb.from('contracts')
      .update({ client_company: c.newName }, { count: 'exact' })
      .eq('client_company', c.name);
    ctrUpd += ctCount || 0;
    renamed++;
  }
}

console.log('\n결과:');
console.log('  단순 rename: ' + renamed);
console.log('  병합 (기존과 통합): ' + merged);
console.log('  완전 손상 삭제: ' + trashed);
console.log('  client_contacts FK 이동/삭제: ' + ccUpd);
console.log('  tax_invoices FK 이동: ' + tiUpd);
console.log('  contracts.client_company 텍스트 갱신: ' + ctrUpd);

// 5. 잔재 짧은 이름 5건 삭제
console.log('\n━━━ Phase 1.3: 잔재 짧은 거래처명 삭제 ━━━');
const trashNames = ['상호', '발신', '참조', '결재', '조합'];
const { data: shortTrash } = await sb.from('client_companies').select('id, name').in('name', trashNames);
console.log('대상: ' + (shortTrash?.length || 0) + '건');
if (shortTrash?.length) {
  const ids = shortTrash.map(c => c.id);
  await sb.from('client_contacts').delete().in('client_company_id', ids);
  await sb.from('tax_invoices').update({ client_company_id: null }).in('client_company_id', ids);
  const { count } = await sb.from('client_companies').delete({ count: 'exact' }).in('id', ids);
  console.log('✅ ' + (count || 0) + '건 삭제');
}

// 6. 세금계산서 부호 정정 1건
console.log('\n━━━ Phase 1.4: 세금계산서 부호 정정 ━━━');
const { data: badTi } = await sb.from('tax_invoices').select('id, invoice_number, supply_amount, vat_amount, total_amount').eq('invoice_number', 'TI-2026-0576-건설').single();
if (badTi) {
  // total_amount를 음수로 정정
  const corrected = -Math.abs(Number(badTi.total_amount));
  await sb.from('tax_invoices').update({ total_amount: corrected }).eq('id', badTi.id);
  console.log('✅ ' + badTi.invoice_number + ': 합계 ' + badTi.total_amount + ' → ' + corrected);
}

// 7. 사업자번호 자리 이메일 정리
console.log('\n━━━ Phase 1.5: 사업자번호 자리 이메일 NULL 처리 ━━━');
const { data: badBiz } = await sb.from('client_companies').select('id, name, business_number');
let bizFixed = 0;
for (const c of badBiz || []) {
  if (!c.business_number) continue;
  // 사업자번호 형식 검사 (000-00-00000)
  if (!/^[0-9]{3}-[0-9]{2}-[0-9]{5}$/.test(c.business_number.trim())) {
    // 이메일/잘못된 값 → NULL
    if (/@/.test(c.business_number) || c.business_number.length > 20) {
      await sb.from('client_companies').update({ business_number: null }).eq('id', c.id);
      console.log('  NULL 처리: ' + c.name + ' (was: ' + c.business_number.slice(0, 40) + '...)');
      bizFixed++;
    } else if (/^[0-9]{10,11}$/.test(c.business_number.replace(/\D/g, ''))) {
      // 숫자만 있는데 하이픈 없음 → 포맷 정정
      const digits = c.business_number.replace(/\D/g, '').slice(0, 10);
      if (digits.length === 10) {
        const formatted = `${digits.slice(0,3)}-${digits.slice(3,5)}-${digits.slice(5)}`;
        await sb.from('client_companies').update({ business_number: formatted }).eq('id', c.id);
        bizFixed++;
      }
    }
  }
}
console.log('사업자번호 정정: ' + bizFixed + '건');

// 최종 카운트
const { count: finalC } = await sb.from('client_companies').select('*', { count: 'exact', head: true });
const { count: finalCt } = await sb.from('contracts').select('*', { count: 'exact', head: true });
console.log('\n📊 최종 카운트');
console.log('  거래처: ' + finalC);
console.log('  계약: ' + finalCt);
