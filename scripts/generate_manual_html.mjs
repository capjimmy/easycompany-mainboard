import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://silvsqcwearelrumtqqm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COMPANY_ID = 'a0000000-0000-0000-0000-000000000001';

// 메뉴 카테고리 순서
const CATEGORIES = [
  { key: 'home', label: '홈', menus: ['dashboard', 'project-status', 'search', 'ai-search'] },
  { key: 'contracts', label: '계약/매출', menus: ['quote-list', 'contract-list', 'monthly', 'history', 'subcontract', 'client-list'] },
  { key: 'finance', label: '재무/회계', menus: ['receivables', 'billing', 'payables', 'deposits', 'tax-invoices', 'expenses', 'provisional'] },
  { key: 'hr', label: '인사/총무', menus: ['leave', 'leave-admin', 'email-approvals', 'certificates'] },
  { key: 'calendar', label: '캘린더', menus: ['calendar-contract', 'calendar-hr', 'calendar-space'] },
  { key: 'project', label: '프로젝트', menus: ['project-dashboard', 'project-timeline'] },
  { key: 'admin', label: '관리', menus: ['user-manage', 'department-manage', 'permission-manage', 'company-manage'] },
  { key: 'system', label: '시스템', menus: ['settings', 'price-settings', 'doc-templates', 'backup', 'manuals'] },
];

async function generateManualHTML() {
  const { data: manuals, error } = await supabase
    .from('menu_manuals')
    .select('*')
    .eq('company_id', COMPANY_ID);

  if (error) {
    console.error('Error fetching manuals:', error.message);
    return;
  }

  const manualMap = {};
  for (const m of manuals) {
    manualMap[m.menu_key] = m;
  }

  let tocHTML = '';
  let contentHTML = '';
  let index = 1;

  for (const cat of CATEGORIES) {
    const catManuals = cat.menus
      .filter(key => manualMap[key])
      .map(key => manualMap[key]);

    if (catManuals.length === 0) continue;

    tocHTML += `<li style="margin-top: 12px;"><strong style="color: #1890ff;">${cat.label}</strong><ul style="list-style: none; padding-left: 16px;">`;

    for (const m of catManuals) {
      tocHTML += `<li><a href="#manual-${m.menu_key}" style="color: #333; text-decoration: none;">${index}. ${m.title}</a></li>`;
      contentHTML += `
        <div id="manual-${m.menu_key}" style="page-break-before: always; margin-top: 40px;">
          <div style="background: #f0f5ff; padding: 8px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 12px; color: #666;">
            ${cat.label} > ${m.title}
          </div>
          ${m.content}
        </div>
        <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 32px 0;">
      `;
      index++;
    }

    tocHTML += '</ul></li>';
  }

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>건설경제연구원 통합관리시스템 - 전체 매뉴얼</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
      line-height: 1.8;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 24px;
      background: #fff;
    }
    a { color: #1890ff; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #e8e8e8; padding: 8px 12px; text-align: left; }
    th { background: #fafafa; }
    @media print {
      body { max-width: none; padding: 20px; font-size: 11px; }
      a { color: #333; text-decoration: none; }
    }
  </style>
</head>
<body>

<div style="text-align: center; padding: 40px 0; border-bottom: 3px solid #1890ff; margin-bottom: 40px;">
  <h1 style="color: #1890ff; margin-bottom: 8px;">건설경제연구원 통합관리시스템</h1>
  <h2 style="color: #666; font-weight: normal;">전체 매뉴얼</h2>
  <p style="color: #999;">생성일: ${new Date().toISOString().split('T')[0]}</p>
</div>

<div style="background: #f9f9f9; padding: 24px; border-radius: 8px; margin-bottom: 40px;">
  <h2 style="margin-top: 0;">목차</h2>
  <ul style="list-style: none; padding: 0;">
    ${tocHTML}
  </ul>
</div>

${contentHTML}

<div style="text-align: center; padding: 40px 0; color: #999; border-top: 1px solid #e8e8e8; margin-top: 40px;">
  <p>건설경제연구원 통합관리시스템 v1.3.0</p>
</div>

</body>
</html>`;

  const outputPath = path.join(__dirname, '..', 'docs', '전체매뉴얼.html');
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`Generated: ${outputPath}`);
  console.log(`Total manuals: ${index - 1}`);
}

generateManualHTML().catch(console.error);
