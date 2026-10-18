#!/usr/bin/env node
/**
 * seed:lawyers — Seeds sample approved test lawyers for local testing.
 * Names are intentionally obviously fake (e.g. "Test Lawyer One").
 * Run: npm run seed:lawyers
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

const SEED_LAWYERS = [
  {
    email: 'test.lawyer.one@example.com',
    fullName: 'Test Lawyer One (Atty. Maria Santos)',
    rollNumber: '71001',
    ibpChapter: 'NCR — Makati',
    practiceAreas: ['Family Law', 'Corporate Law', 'Civil Litigation'],
    languages: ['Tagalog', 'English'],
    experienceYears: 12,
    barPasserYear: 2012,
    feeInitial30min: 1500,
    feeStandard60min: 2500,
    feeExtended120min: 4500,
    about: 'Experienced counsel specializing in Philippine corporate restructuring, cross-border family estates, and commercial dispute resolution before the RTC and Court of Appeals.',
  },
  {
    email: 'test.lawyer.two@example.com',
    fullName: 'Test Lawyer Two (Atty. Juan Dela Cruz)',
    rollNumber: '71002',
    ibpChapter: 'NCR — Quezon City',
    practiceAreas: ['Criminal Law', 'Labor & Employment', 'Civil Litigation'],
    languages: ['Tagalog', 'English', 'Ilocano'],
    experienceYears: 8,
    barPasserYear: 2016,
    feeInitial30min: 1000,
    feeStandard60min: 2000,
    feeExtended120min: 3500,
    about: 'Dedicated litigator representing clients in criminal defense proceedings, NLRC labor arbitrations, and contractual dispute enforcement.',
  },
  {
    email: 'test.lawyer.three@example.com',
    fullName: 'Test Lawyer Three (Atty. Clara Reyes)',
    rollNumber: '71003',
    ibpChapter: 'Cebu',
    practiceAreas: ['Real Estate & Property', 'Civil Litigation', 'Estate Planning'],
    languages: ['Cebuano', 'English', 'Tagalog'],
    experienceYears: 15,
    barPasserYear: 2009,
    feeInitial30min: 2000,
    feeStandard60min: 3500,
    feeExtended120min: 6000,
    about: 'Advising private individuals and developers on Land Registration Act compliance, Torrens title verification, and complex probate settlements in the Visayas.',
  },
  {
    email: 'test.lawyer.four@example.com',
    fullName: 'Test Lawyer Four (Atty. Roberto Tan)',
    rollNumber: '71004',
    ibpChapter: 'NCR — Manila',
    practiceAreas: ['Corporate Law', 'Taxation Law', 'Intellectual Property'],
    languages: ['Tagalog', 'English', 'Mandarin'],
    experienceYears: 6,
    barPasserYear: 2018,
    feeInitial30min: 1200,
    feeStandard60min: 2200,
    feeExtended120min: 4000,
    about: 'Focused on tech startups, SEC registration compliance, trademark filings with the Intellectual Property Office, and BIR tax audits.',
  },
  {
    email: 'test.lawyer.five@example.com',
    fullName: 'Test Lawyer Five (Atty. Liza Morales)',
    rollNumber: '71005',
    ibpChapter: 'Davao',
    practiceAreas: ['Family Law', 'Agrarian Reform', 'Environmental Law'],
    languages: ['Bisaya', 'English', 'Tagalog'],
    experienceYears: 10,
    barPasserYear: 2014,
    feeInitial30min: 800,
    feeStandard60min: 1500,
    feeExtended120min: 2800,
    about: 'Advocate for child custody settlements, adoption procedures under RA 11642, and ancestral domain title disputes in Mindanao.',
  },
];

async function seed() {
  console.log('🌱 Seeding test lawyers...');

  for (const lawyer of SEED_LAWYERS) {
    // 1. Check or create auth user
    const { data: userList } = await supabase.auth.admin.listUsers();
    let authUser = userList?.users?.find(u => u.email === lawyer.email);

    if (!authUser) {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: lawyer.email,
        password: 'Password123!',
        email_confirm: true,
        user_metadata: { full_name: lawyer.fullName, role: 'lawyer' },
      });
      if (createErr) {
        console.warn(`Could not create auth user for ${lawyer.email}:`, createErr.message);
        continue;
      }
      authUser = newUser.user;
    }

    if (!authUser) continue;

    // 2. Ensure user_accounts entry
    const { error: userAccErr } = await supabase.from('user_accounts').upsert({
      id: authUser.id,
      email: lawyer.email,
      role: 'lawyer',
      full_name: lawyer.fullName,
      verification_status: 'approved',
    });

    if (userAccErr) {
      // Fallback if 'approved' fails
      const { error: fallbackErr } = await supabase.from('user_accounts').upsert({
        id: authUser.id,
        email: lawyer.email,
        role: 'lawyer',
        full_name: lawyer.fullName,
        verification_status: 'pending',
      });
      if (fallbackErr) {
        console.error(`Failed to ensure user_accounts for ${lawyer.email}:`, fallbackErr.message);
        continue;
      }
    }

    // 3. Upsert lawyer_profiles
    const { error: profErr } = await supabase.from('lawyer_profiles').upsert({
      user_id: authUser.id,
      full_name: lawyer.fullName,
      roll_number: lawyer.rollNumber,
      ibp_chapter: lawyer.ibpChapter,
      practice_areas: lawyer.practiceAreas,
      languages: lawyer.languages,
      experience_years: lawyer.experienceYears,
      bar_passer_year: lawyer.barPasserYear,
      fee_initial_30min: lawyer.feeInitial30min,
      fee_standard_60min: lawyer.feeStandard60min,
      fee_extended_120min: lawyer.feeExtended120min,
      about: lawyer.about,
      verification_status: 'approved',
      is_available: true,
      is_visible: true,
      reviewed_at: new Date().toISOString(),
    });

    if (profErr) {
      console.error(`Failed to upsert profile for ${lawyer.fullName}:`, profErr.message);
    } else {
      console.log(`✅ Seeded: ${lawyer.fullName} (${lawyer.rollNumber})`);
    }
  }

  console.log('\n✨ Seeding completed.');
}

seed().catch(console.error);
