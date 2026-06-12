import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env', 'utf-8').split('\n').reduce((a,l)=>{const[k,v]=l.split('=');if(k)a[k.trim()]=v?.trim();return a;},{});
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY);
const { data, error } = await sb.from('departments').select('id, name, code, company_id');
console.log('count:', data?.length, 'error:', error?.message);
console.log(JSON.stringify(data, null, 2));
