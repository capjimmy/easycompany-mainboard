import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://silvsqcwearelrumtqqm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
