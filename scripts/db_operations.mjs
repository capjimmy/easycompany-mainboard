import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://silvsqcwearelrumtqqm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function restoreSoftDeletedUsers() {
  console.log('=== Restoring soft-deleted users ===');

  // First, find all inactive users
  const { data: inactiveUsers, error: fetchError } = await supabase
    .from('users')
    .select('id, name, username, is_active')
    .eq('is_active', false);

  if (fetchError) {
    console.error('Error fetching inactive users:', fetchError.message);
    return;
  }

  if (!inactiveUsers || inactiveUsers.length === 0) {
    console.log('No soft-deleted users found. Nothing to restore.');
    return;
  }

  console.log(`Found ${inactiveUsers.length} soft-deleted user(s):`);
  for (const user of inactiveUsers) {
    console.log(`  - ${user.name} (${user.username}) [${user.id}]`);
  }

  // Restore all inactive users
  const { data, error: updateError } = await supabase
    .from('users')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('is_active', false)
    .select('id, name, username');

  if (updateError) {
    console.error('Error restoring users:', updateError.message);
    return;
  }

  console.log(`Successfully restored ${data.length} user(s).`);
}

async function addNewCompanies() {
  console.log('\n=== Adding new companies ===');

  const now = new Date().toISOString();

  const newCompanies = [
    {
      id: crypto.randomUUID(),
      name: '이지건축사사무소',
      business_number: null,
      address: null,
      phone: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      name: '건설환경연구소',
      business_number: null,
      address: null,
      phone: null,
      created_at: now,
      updated_at: now,
    },
  ];

  for (const company of newCompanies) {
    const { data, error } = await supabase
      .from('companies')
      .insert(company)
      .select()
      .single();

    if (error) {
      console.error(`Error adding "${company.name}": ${error.message}`);
    } else {
      console.log(`Added company: ${data.name} [${data.id}]`);
    }
  }
}

async function main() {
  try {
    await restoreSoftDeletedUsers();
    await addNewCompanies();
    console.log('\nAll operations completed.');
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

main();
