import { createClient } from '@supabase/supabase-js';

// ====== 메인 프로세스 전용 — service_role key (RLS 우회)
// 빌드 시점에 esbuild가 process.env로부터 .env.local 값을 주입
// renderer/preload에는 노출되지 않음 (main process에서만 사용)
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  'https://silvsqcwearelrumtqqm.supabase.co';

// 우선순위: SERVICE_ROLE_KEY > ANON_KEY (개발 환경 폴백)
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
