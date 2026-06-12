import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://silvsqcwearelrumtqqm.supabase.co', 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J');
const { data } = await sb.from('settings').select('*').eq('key', 'openai_api_key').single();
console.log('key 존재:', !!data?.value, data?.value ? `(${data.value.slice(0,10)}...)` : '');
