// One-time migration: populate user_companies and user_departments junction tables
// from existing users.company_id and users.department_id columns.

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://silvsqcwearelrumtqqm.supabase.co',
  'sb_publishable_pAS3A3nCHvsuS0ew46MD5A_RpnMdt4J'
);

async function migrate() {
  console.log('Starting user affiliations migration...');

  // Fetch all users
  const { data: users, error: usersErr } = await sb.from('users').select('id, company_id, department_id');
  if (usersErr) {
    console.error('Failed to fetch users:', usersErr);
    process.exit(1);
  }

  console.log(`Found ${users.length} users`);

  let companyInserted = 0;
  let deptInserted = 0;
  let skipped = 0;

  for (const user of users) {
    // Insert into user_companies if company_id exists
    if (user.company_id) {
      const { error } = await sb.from('user_companies').upsert(
        {
          user_id: user.id,
          company_id: user.company_id,
          is_primary: true,
        },
        { onConflict: 'user_id,company_id' }
      );
      if (error) {
        console.error(`Error inserting user_companies for user ${user.id}:`, error.message);
      } else {
        companyInserted++;
      }
    }

    // Insert into user_departments if department_id exists
    if (user.department_id) {
      const { error } = await sb.from('user_departments').upsert(
        {
          user_id: user.id,
          department_id: user.department_id,
          is_primary: true,
        },
        { onConflict: 'user_id,department_id' }
      );
      if (error) {
        console.error(`Error inserting user_departments for user ${user.id}:`, error.message);
      } else {
        deptInserted++;
      }
    }

    if (!user.company_id && !user.department_id) {
      skipped++;
    }
  }

  console.log('Migration complete!');
  console.log(`  user_companies rows inserted/updated: ${companyInserted}`);
  console.log(`  user_departments rows inserted/updated: ${deptInserted}`);
  console.log(`  users skipped (no company/dept): ${skipped}`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
