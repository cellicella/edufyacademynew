/**
 * Edufy Academy — Demo environment verification
 * -----------------------------------------------------------------------------
 * Uses ONLY the public publishable key (exactly what the browser uses) to check:
 *   - connection + published demo courses with curriculum
 *   - every demo account can sign in and has the expected role
 *   - a student/instructor cannot promote themselves to admin
 *   - a student cannot create courses
 *
 * Usage:   npx tsx scripts/verify-demo.ts
 * Needs:   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (.env.local) and DEMO_PASSWORD (.env)
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env', quiet: true } as any);
dotenv.config({ path: '.env.local', override: true, quiet: true } as any);

const URL = process.env.VITE_SUPABASE_URL || '';
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const PASSWORD = process.env.DEMO_PASSWORD || '';

let failures = 0;
const ok = (m: string) => console.log(`  ✔ ${m}`);
const bad = (m: string) => {
  failures++;
  console.log(`  ✖ ${m}`);
};
const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const ACCOUNTS = [
  ...[1, 2, 3, 4, 5].map((n) => ({ email: `student${n}@edufyacademy.com`, role: 'student' })),
  ...[1, 2, 3].map((n) => ({ email: `instructor${n}@edufyacademy.com`, role: 'instructor' })),
  { email: 'admin@edufyacademy.com', role: 'admin' },
];

async function main() {
  if (!URL || !KEY) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing in .env.local');
  if (!PASSWORD) throw new Error('DEMO_PASSWORD missing in .env');

  console.log(`\nVerifying ${URL}\n\nPublic catalogue`);
  const anon = client();
  const { data: courses, error } = await anon
    .from('courses')
    .select('id,title,is_demo,course_sections(id,lessons(id))')
    .eq('is_published', true)
    .eq('is_demo', true);
  if (error) bad(`Course query failed: ${error.message}`);
  else {
    courses!.length === 10 ? ok('10 published demo courses visible') : bad(`Expected 10 demo courses, found ${courses!.length}`);
    const sections = courses!.reduce((n, c: any) => n + (c.course_sections?.length || 0), 0);
    sections > 0 ? ok(`${sections} sections readable`) : bad('No course sections readable');
  }

  console.log('\nAccounts');
  for (const acc of ACCOUNTS) {
    const c = client();
    const { data, error: loginErr } = await c.auth.signInWithPassword({ email: acc.email, password: PASSWORD });
    if (loginErr || !data.user) {
      bad(`${acc.email} cannot sign in (${loginErr?.message})`);
      continue;
    }
    const { data: profile } = await c.from('profiles').select('role').eq('id', data.user.id).single();
    profile?.role === acc.role ? ok(`${acc.email} → ${acc.role}`) : bad(`${acc.email} role is ${profile?.role}, expected ${acc.role}`);

    if (acc.role !== 'admin') {
      // Attempt privilege escalation — must be silently ignored by the trigger.
      await c.from('profiles').update({ role: 'admin' }).eq('id', data.user.id);
      const { data: after } = await c.from('profiles').select('role').eq('id', data.user.id).single();
      after?.role === acc.role ? ok(`${acc.email} cannot self-promote to admin`) : bad(`${acc.email} ESCALATED to ${after?.role}!`);
    }

    if (acc.role === 'student' && acc.email.startsWith('student1')) {
      const { error: insErr } = await c.from('courses').insert({
        id: 'rls-test-should-fail',
        slug: 'rls-test-should-fail',
        title: 'x',
        subtitle: 'x',
        description: 'x',
        category: 'x',
        category_slug: 'x',
        thumbnail_url: 'x',
        instructor_id: data.user.id,
      });
      insErr ? ok('student cannot create courses (RLS)') : bad('student was able to create a course!');
    }
    await c.auth.signOut();
  }

  console.log(failures === 0 ? '\n✔ All checks passed.\n' : `\n✖ ${failures} check(s) failed.\n`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}\n`);
  process.exit(1);
});
