#!/usr/bin/env node
/**
 * seed:admin — Creates or updates a default administrator account.
 * Run: npm run seed:admin
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const k = trimmed.slice(0, eqIdx).trim();
        let v = trimmed.slice(eqIdx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
} catch {
  // ignore
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = 'admin@justicia.ph';
const ADMIN_PASSWORD = 'Password123!';
const ADMIN_NAME = 'System Administrator';

async function seedAdmin() {
  console.log(`🛡️ Ensuring admin account: ${ADMIN_EMAIL}...`);

  // 1. Check if auth user exists
  const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('Failed to list auth users:', listErr.message);
    process.exit(1);
  }

  let authUser = userList?.users?.find(u => u.email === ADMIN_EMAIL);

  if (!authUser) {
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME, role: 'admin' },
    });

    if (createErr) {
      console.error(`Failed to create admin auth user:`, createErr.message);
      process.exit(1);
    }
    authUser = newUser.user;
    console.log(`✅ Created auth user for ${ADMIN_EMAIL}`);
  } else {
    // Ensure password and metadata
    await supabase.auth.admin.updateUserById(authUser.id, {
      password: ADMIN_PASSWORD,
      user_metadata: { full_name: ADMIN_NAME, role: 'admin' },
    });
    console.log(`ℹ️ Auth user ${ADMIN_EMAIL} already exists — updated credentials.`);
  }

  // 2. Upsert in user_accounts with role = 'admin'
  let { error: accErr } = await supabase.from('user_accounts').upsert({
    id: authUser.id,
    email: ADMIN_EMAIL,
    full_name: ADMIN_NAME,
    role: 'admin',
    verification_status: 'approved',
  });

  if (accErr) {
    // Fallback if 'approved' is not permitted
    const { error: fallbackErr } = await supabase.from('user_accounts').upsert({
      id: authUser.id,
      email: ADMIN_EMAIL,
      full_name: ADMIN_NAME,
      role: 'admin',
      verification_status: 'pending',
    });
    if (fallbackErr) {
      console.error('Failed to upsert admin user_accounts:', fallbackErr.message);
      process.exit(1);
    }
  }

  console.log('\n🎉 Admin account ready!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Email:    ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
  console.log(`Role:     admin`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

seedAdmin();
