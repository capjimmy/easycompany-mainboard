import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data } = await sb.from('settings').select('value').eq('key', 'openai_api_key').single();
const openai = new OpenAI({ apiKey: data.value });
try {
  const r = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'say "ok" only' }],
    max_tokens: 5,
  });
  console.log('✅ OpenAI 응답:', r.choices[0].message.content);
} catch (e) {
  console.log('❌', e.message);
}
