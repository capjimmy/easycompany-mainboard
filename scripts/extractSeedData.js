/**
 * 벡터 인덱스 JSON에서 거래처, 계약번호 데이터를 추출하여
 * Supabase INSERT SQL을 생성하는 스크립트
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VECTOR_DIR = path.join(__dirname, '../../vector_index');
const OUTPUT_FILE = path.join(__dirname, 'seed_data.sql');

// UUID v4 생성 (crypto 기반)
function uuid() {
  return crypto.randomUUID();
}

// 회사 ID (기존 Supabase 데이터)
const COMPANY_ID = 'a0000000-0000-0000-0000-000000000001'; // (주)이지컨설턴트
const COMPANY_ID_2 = 'a0000000-0000-0000-0000-000000000002'; // (사)건설경제연구원

// 부서 매핑
const DEPT_MAP = {
  '건설사업부': 'b0000000-0000-0000-0000-000000000002',
  '학술사업부': 'b0000000-0000-0000-0000-000000000001',
  '개발사업부': 'b0000000-0000-0000-0000-000000000003',
  '경영지원부': 'b0000000-0000-0000-0000-000000000004',
};

function main() {
  console.log('벡터 인덱스 스캔 시작...');

  const files = fs.readdirSync(VECTOR_DIR)
    .filter(f => f.startsWith('vector_index_') && f.endsWith('.json'))
    .sort();

  console.log(`파일 수: ${files.length}`);

  // 거래처 수집 (이름 → { name, contracts: [] })
  const clientMap = new Map();
  // 계약 수집 (계약번호 → { number, company, year, amount, department, project })
  const contractMap = new Map();

  let processed = 0;

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(VECTOR_DIR, file), 'utf-8'));
      const chunks = data.chunks || [];

      for (const chunk of chunks) {
        const meta = chunk.metadata || {};

        // 거래처 추출
        if (meta.related_company && meta.related_company.trim()) {
          const name = meta.related_company.trim();
          // 너무 짧거나 의미없는 값 제외
          if (name.length >= 2 && !['없음', '미정', 'N/A', 'NA', '-', '.'].includes(name)) {
            if (!clientMap.has(name)) {
              clientMap.set(name, { name, contractNumbers: new Set() });
            }
            if (meta.related_contract_number) {
              clientMap.get(name).contractNumbers.add(meta.related_contract_number);
            }
          }
        }

        // 계약 추출
        if (meta.related_contract_number && meta.related_contract_number.trim()) {
          const num = meta.related_contract_number.trim();
          if (num.length >= 3 && !['없음', 'N/A', '-'].includes(num)) {
            if (!contractMap.has(num)) {
              contractMap.set(num, {
                number: num,
                company: meta.related_company || '',
                year: meta.year || 0,
                month: meta.month || 0,
                amount: meta.amount || 0,
                department: meta.department || '',
                project: meta.related_project || meta.title || '',
                docType: meta.document_type || '',
              });
            } else {
              // 기존보다 더 좋은 데이터가 있으면 업데이트
              const existing = contractMap.get(num);
              if (!existing.company && meta.related_company) existing.company = meta.related_company;
              if (!existing.project && (meta.related_project || meta.title)) existing.project = meta.related_project || meta.title;
              if (existing.amount === 0 && meta.amount > 0) existing.amount = meta.amount;
              if (existing.year === 0 && meta.year > 0) existing.year = meta.year;
            }
          }
        }
      }

      processed++;
      if (processed % 100 === 0) {
        console.log(`  ${processed}/${files.length} 처리 완료 (거래처: ${clientMap.size}, 계약: ${contractMap.size})`);
      }
    } catch (e) {
      // skip broken files
    }
  }

  console.log(`\n추출 완료:`);
  console.log(`  거래처: ${clientMap.size}개`);
  console.log(`  계약/견적 번호: ${contractMap.size}개`);

  // SQL 생성
  let sql = `-- ============================================\n`;
  sql += `-- 벡터 인덱스에서 추출한 시드 데이터\n`;
  sql += `-- 생성일: ${new Date().toISOString()}\n`;
  sql += `-- 거래처: ${clientMap.size}건, 계약번호: ${contractMap.size}건\n`;
  sql += `-- ============================================\n\n`;

  // 1. 거래처 INSERT
  sql += `-- ========== 거래처 (client_companies) ==========\n`;
  const clients = Array.from(clientMap.values());
  const clientIdMap = new Map(); // name → uuid

  for (const client of clients) {
    const id = uuid();
    clientIdMap.set(client.name, id);
    const escapedName = client.name.replace(/'/g, "''");
    sql += `INSERT INTO client_companies (id, company_id, name, created_at, updated_at) VALUES ('${id}', '${COMPANY_ID_2}', '${escapedName}', NOW(), NOW()) ON CONFLICT DO NOTHING;\n`;
  }

  // 2. 최근 3년 계약만 (2024~2026)
  sql += `\n-- ========== 계약 데이터 (contracts) - 최근 3년 ==========\n`;
  const recentContracts = Array.from(contractMap.values())
    .filter(c => c.year >= 2024 && c.year <= 2026)
    .sort((a, b) => b.year - a.year || a.number.localeCompare(b.number));

  console.log(`  최근 3년(2024-2026) 계약: ${recentContracts.length}건`);

  for (const c of recentContracts) {
    const id = uuid();
    const clientId = clientIdMap.get(c.company) || null;
    const deptId = DEPT_MAP[c.department] || null;
    const escapedProject = (c.project || c.number).replace(/'/g, "''").substring(0, 200);
    const escapedCompany = c.company.replace(/'/g, "''");
    const contractDate = c.year && c.month
      ? `${c.year}-${String(c.month).padStart(2, '0')}-01`
      : c.year ? `${c.year}-01-01` : null;

    sql += `INSERT INTO contracts (id, company_id, contract_number, service_name, client_company, total_amount, contract_date, progress, created_by, created_at, updated_at) VALUES (`;
    sql += `'${id}', '${COMPANY_ID_2}', '${c.number}', '${escapedProject}', '${escapedCompany}', ${c.amount || 0}, `;
    sql += contractDate ? `'${contractDate}', ` : `NULL, `;
    sql += `'completed', 'c0000000-0000-0000-0000-000000000001', NOW(), NOW()`;
    sql += `) ON CONFLICT DO NOTHING;\n`;
  }

  // 3. 이전 계약 (요약)
  const olderContracts = Array.from(contractMap.values())
    .filter(c => c.year > 0 && c.year < 2024)
    .sort((a, b) => b.year - a.year);

  console.log(`  2024 이전 계약: ${olderContracts.length}건 (SQL에 포함하지 않음)`);

  // 파일 저장
  fs.writeFileSync(OUTPUT_FILE, sql, 'utf-8');
  console.log(`\nSQL 파일 생성: ${OUTPUT_FILE}`);
  console.log(`파일 크기: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB`);
}

main();
