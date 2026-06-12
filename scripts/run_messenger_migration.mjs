import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
// Try via RPC if exists, else just verify column existence
const { data, error } = await sb.from('messenger_conversations').select('participant_joined_at').limit(1);
if (error) {
  console.log('❌ 컬럼 미존재 - SQL Editor에서 수동 실행 필요:');
  console.log('---');
  console.log("ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS participant_joined_at jsonb NOT NULL DEFAULT '{}'::jsonb;");
  console.log("UPDATE messenger_conversations c SET participant_joined_at = (SELECT COALESCE(jsonb_object_agg(p, to_jsonb(c.created_at)), '{}'::jsonb) FROM jsonb_array_elements_text(to_jsonb(c.participants)) AS p) WHERE participant_joined_at = '{}'::jsonb AND participants IS NOT NULL;");
} else {
  console.log('✅ participant_joined_at 컬럼 존재');
}
