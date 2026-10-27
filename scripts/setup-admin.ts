/**
 * Edufy Academy - Secure Administrator Role Assignment Script
 * Usage: npx tsx scripts/setup-admin.ts <admin-email>
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in environment.');
  process.exit(1);
}

// Privileged server-side client
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const emailArg = process.argv[2];

  if (!emailArg) {
    console.error('Error: Please provide the admin email address.');
    console.log('Usage: npx tsx scripts/setup-admin.ts <email>');
    process.exit(1);
  }

  const cleanEmail = emailArg.trim().toLowerCase();
  console.log(`[Admin Setup] Searching for user with email: ${cleanEmail}...`);

  // 1. Fetch user from auth.users
  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

  if (listError) {
    console.error('[Admin Setup] Failed to query auth users:', listError.message);
    process.exit(1);
  }

  const user = usersData.users.find((u) => u.email?.toLowerCase() === cleanEmail);

  if (!user) {
    console.error(`[Admin Setup] User "${cleanEmail}" does not exist in auth.users.`);
    console.log('[Admin Setup] Please create or register the user first, then re-run this setup script.');
    process.exit(1);
  }

  console.log(`[Admin Setup] Found user ID: ${user.id}`);

  // 2. Update user metadata in auth.users
  const existingMetadata = user.user_metadata || {};
  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...existingMetadata,
      role: 'admin',
    },
  });

  if (authUpdateError) {
    console.error('[Admin Setup] Failed to update auth metadata:', authUpdateError.message);
    process.exit(1);
  }

  // 3. Upsert profile in public.profiles with admin role
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: cleanEmail,
        full_name: existingMetadata.full_name || 'Platform Administrator',
        avatar_url:
          existingMetadata.avatar_url ||
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
        role: 'admin',
        headline: 'Platform Administrator',
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (profileError) {
    console.error('[Admin Setup] Failed to update public.profiles:', profileError.message);
    process.exit(1);
  }

  console.log('------------------------------------------------------------');
  console.log(`SUCCESS: Administrator privileges assigned!`);
  console.log(`User Email : ${cleanEmail}`);
  console.log(`User ID    : ${user.id}`);
  console.log(`Role       : ${profile.role}`);
  console.log(`Dashboard  : /admin`);
  console.log('------------------------------------------------------------');
}

main().catch((err) => {
  console.error('[Admin Setup] Unexpected error:', err);
  process.exit(1);
});
