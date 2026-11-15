/**
 * Edufy Academy — Secure, idempotent demo environment setup
 * -----------------------------------------------------------------------------
 * Creates 5 students, 3 instructors, 1 admin (via the Supabase Auth Admin API)
 * and 10 demo courses with sections and lessons.
 *
 * SERVER-SIDE ONLY. Requires these private variables (in `.env`, never VITE_):
 *   SUPABASE_URL                (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY   (Project Settings → API → service_role / secret key)
 *   DEMO_PASSWORD               (shared demo password, minimum 6 characters)
 *
 * Usage:   npx tsx scripts/seed-demo.ts
 * Re-running is safe: existing users/courses are detected and updated, never duplicated.
 * No payments, reviews or enrollments are created.
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env', quiet: true } as any);
dotenv.config({ path: '.env.local', override: true, quiet: true } as any);

const real = (v?: string) => (v && !/your-project|your-|placeholder/i.test(v) ? v.trim() : '');
const SUPABASE_URL = real(process.env.SUPABASE_URL) || real(process.env.VITE_SUPABASE_URL);
const SERVICE_KEY = real(process.env.SUPABASE_SERVICE_ROLE_KEY);
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || '';

function fail(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) fail('SUPABASE_URL / VITE_SUPABASE_URL is not set.');
if (!SERVICE_KEY) fail('SUPABASE_SERVICE_ROLE_KEY is not set. Add it to your private .env file (never a VITE_ variable).');

// Diagnose the key type without printing the key itself.
const keyKind = SERVICE_KEY.startsWith('sb_secret_')
  ? 'secret (sb_secret_…)'
  : SERVICE_KEY.startsWith('sb_publishable_')
  ? 'PUBLISHABLE'
  : SERVICE_KEY.startsWith('eyJ')
  ? (() => {
      try {
        const role = JSON.parse(Buffer.from(SERVICE_KEY.split('.')[1], 'base64url').toString()).role;
        return role === 'service_role' ? 'legacy service_role JWT' : `legacy JWT with role "${role}"`;
      } catch {
        return 'unreadable JWT';
      }
    })()
  : 'unknown format';
console.log(`Using key type: ${keyKind} (length ${SERVICE_KEY.length})`);
if (!/^secret|legacy service_role/.test(keyKind))
  fail(
    `SUPABASE_SERVICE_ROLE_KEY in .env is a ${keyKind} key, not a secret key.\n` +
      '  Copy the SECRET key (starts with "sb_secret_") from Supabase → Project Settings → API Keys → Secret keys,\n' +
      '  or the legacy "service_role" key, into SUPABASE_SERVICE_ROLE_KEY=… and run again.'
  );
if (Object.keys(process.env).some((k) => k.startsWith('VITE_') && process.env[k] === SERVICE_KEY))
  fail('The service role key is stored in a VITE_ variable. Move it to SUPABASE_SERVICE_ROLE_KEY immediately and rotate it.');
if (DEMO_PASSWORD.length < 6)
  fail('DEMO_PASSWORD must be at least 6 characters — Supabase Auth rejects shorter passwords (e.g. use "Edufy@123").');

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Role = 'student' | 'instructor' | 'admin';
interface DemoUser {
  key: string;
  email: string;
  name: string;
  role: Role;
  headline: string;
  bio: string;
}

const USERS: DemoUser[] = [
  { key: 's1', email: 'student1@edufyacademy.com', name: 'Aarav Sharma', role: 'student', headline: 'Aspiring full-stack developer', bio: 'Final-year B.Tech student learning modern web development.' },
  { key: 's2', email: 'student2@edufyacademy.com', name: 'Priya Nair', role: 'student', headline: 'Marketing associate', bio: 'Upskilling in digital marketing and analytics.' },
  { key: 's3', email: 'student3@edufyacademy.com', name: 'Rohan Mehta', role: 'student', headline: 'Junior data analyst', bio: 'Working with Excel and Python to make sense of business data.' },
  { key: 's4', email: 'student4@edufyacademy.com', name: 'Ananya Iyer', role: 'student', headline: 'Design enthusiast', bio: 'Exploring UI/UX design and prototyping in Figma.' },
  { key: 's5', email: 'student5@edufyacademy.com', name: 'Karthik Reddy', role: 'student', headline: 'Freelance web designer', bio: 'Building WordPress sites for small businesses.' },
  { key: 'i1', email: 'instructor1@edufyacademy.com', name: 'Vikram Rao', role: 'instructor', headline: 'Full-Stack Engineer & Educator', bio: 'Vikram has spent over a decade building web products with JavaScript, React and Node.js, and teaches practical, project-first web development.' },
  { key: 'i2', email: 'instructor2@edufyacademy.com', name: 'Dr. Meera Krishnan', role: 'instructor', headline: 'Data Scientist & Security Researcher', bio: 'Meera works across machine learning, analytics and application security, and focuses on making technical topics approachable.' },
  { key: 'i3', email: 'instructor3@edufyacademy.com', name: 'Sneha Kapoor', role: 'instructor', headline: 'Product Designer & Growth Marketer', bio: 'Sneha designs digital products and helps independent professionals grow their online business.' },
  { key: 'a1', email: 'admin@edufyacademy.com', name: 'Edufy Administrator', role: 'admin', headline: 'Platform Administrator', bio: 'Demo administrator account for Edufy Academy.' },
];

/* ------------------------------------------------------------------------ */
/* Courses                                                                  */
/* ------------------------------------------------------------------------ */
interface DemoCourse {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  categorySlug: string;
  instructor: string; // DemoUser.key
  price: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
  thumbnail: string;
  featured?: boolean;
  outcomes: string[];
  requirements: string[];
  audience: string[];
  sections: { title: string; lessons: string[] }[];
}

const img = (id: string) => `https://images.unsplash.com/${id}?w=1200&auto=format&fit=crop&q=80`;

const COURSES: DemoCourse[] = [
  {
    id: 'demo-complete-web-development',
    title: 'Complete Web Development',
    subtitle: 'Build responsive websites from scratch with HTML, CSS and JavaScript.',
    description: 'A structured introduction to building for the web. You will learn semantic HTML, modern CSS layout with Flexbox and Grid, and JavaScript fundamentals, then bring them together to build and publish a responsive multi-page website.',
    category: 'Web Development', categorySlug: 'web-development', instructor: 'i1', price: 999, level: 'Beginner',
    thumbnail: img('photo-1498050108023-c5249f4df085'), featured: true,
    outcomes: ['Write semantic, accessible HTML', 'Lay out pages with Flexbox and CSS Grid', 'Add interactivity with JavaScript and the DOM', 'Publish a responsive website'],
    requirements: ['A computer with internet access', 'No prior coding experience required'],
    audience: ['Complete beginners', 'Students starting a tech career', 'Designers who want to code'],
    sections: [
      { title: 'Getting started with the web', lessons: ['How the web works', 'Setting up your editor', 'Your first HTML page'] },
      { title: 'Styling with CSS', lessons: ['Selectors and the box model', 'Flexbox layouts', 'CSS Grid and responsive design'] },
      { title: 'JavaScript essentials', lessons: ['Variables, functions and arrays', 'Working with the DOM', 'Handling events'] },
      { title: 'Project: portfolio website', lessons: ['Planning the site', 'Building the pages', 'Deploying your site'] },
    ],
  },
  {
    id: 'demo-full-stack-mern',
    title: 'Full Stack MERN Development',
    subtitle: 'Create complete web applications with MongoDB, Express, React and Node.js.',
    description: 'Go from front end to back end. Build a REST API with Node.js and Express, model data in MongoDB, create a React interface, add authentication and deploy a production-ready full-stack application.',
    category: 'Web Development', categorySlug: 'web-development', instructor: 'i1', price: 1499, level: 'Intermediate',
    thumbnail: img('photo-1555066931-4365d14bab8c'),
    outcomes: ['Design and build REST APIs with Express', 'Model data with MongoDB and Mongoose', 'Build React interfaces with hooks', 'Implement authentication and deploy'],
    requirements: ['Comfortable with HTML, CSS and JavaScript basics'],
    audience: ['Front-end developers moving to full stack', 'Graduates preparing for developer roles'],
    sections: [
      { title: 'Node.js and Express', lessons: ['Node.js fundamentals', 'Routing and middleware', 'Building a REST API'] },
      { title: 'MongoDB', lessons: ['Documents and collections', 'Mongoose models', 'Queries and relationships'] },
      { title: 'React front end', lessons: ['Components and props', 'State and hooks', 'Calling your API'] },
      { title: 'Shipping the app', lessons: ['JWT authentication', 'Environment configuration', 'Deployment'] },
    ],
  },
  {
    id: 'demo-ai-fundamentals',
    title: 'Artificial Intelligence Fundamentals',
    subtitle: 'Understand how modern AI works — from machine learning to generative models.',
    description: 'A clear, non-hype introduction to artificial intelligence. Learn core machine-learning ideas, how neural networks are trained, what large language models can and cannot do, and how to think about responsible AI.',
    category: 'Artificial Intelligence', categorySlug: 'ai-data-science', instructor: 'i2', price: 1299, level: 'Beginner',
    thumbnail: img('photo-1677442136019-21780ecad995'), featured: true,
    outcomes: ['Explain supervised and unsupervised learning', 'Understand how neural networks learn', 'Use generative AI tools effectively', 'Evaluate AI risks and limitations'],
    requirements: ['Curiosity — no maths background required'],
    audience: ['Professionals working alongside AI', 'Students exploring AI careers'],
    sections: [
      { title: 'What is AI?', lessons: ['A short history of AI', 'Types of machine learning', 'Data and features'] },
      { title: 'Neural networks', lessons: ['Neurons and layers', 'Training and loss', 'Overfitting and evaluation'] },
      { title: 'Generative AI', lessons: ['How language models work', 'Prompting effectively', 'Responsible and ethical AI'] },
    ],
  },
  {
    id: 'demo-python-masterclass',
    title: 'Python Programming Masterclass',
    subtitle: 'Learn Python from the ground up and automate everyday tasks.',
    description: 'Master Python step by step: syntax, data structures, functions, files and object-oriented programming. Finish by writing scripts that automate real work such as renaming files, processing spreadsheets and calling web APIs.',
    category: 'Artificial Intelligence', categorySlug: 'ai-data-science', instructor: 'i1', price: 799, level: 'Beginner',
    thumbnail: img('photo-1526379095098-d400fd0bf935'),
    outcomes: ['Write clean, idiomatic Python', 'Use lists, dictionaries and sets', 'Work with files and modules', 'Automate repetitive tasks'],
    requirements: ['No programming experience needed'],
    audience: ['Beginners learning their first language', 'Analysts who want to automate work'],
    sections: [
      { title: 'Python basics', lessons: ['Installing Python', 'Variables and types', 'Control flow'] },
      { title: 'Data structures and functions', lessons: ['Lists and dictionaries', 'Writing functions', 'Error handling'] },
      { title: 'Practical Python', lessons: ['Reading and writing files', 'Object-oriented programming', 'Automation project'] },
    ],
  },
  {
    id: 'demo-digital-marketing',
    title: 'Digital Marketing Masterclass',
    subtitle: 'Plan and run effective campaigns across search, social and email.',
    description: 'Learn how to reach and convert customers online. Cover marketing strategy, SEO, social media, paid advertising, email marketing and analytics, and build a complete campaign plan for a real or sample business.',
    category: 'Business & Leadership', categorySlug: 'business-leadership', instructor: 'i3', price: 999, level: 'All Levels',
    thumbnail: img('photo-1460925895917-afdab827c52f'),
    outcomes: ['Build a digital marketing strategy', 'Improve search rankings with SEO', 'Run social and paid campaigns', 'Measure results with analytics'],
    requirements: ['No prior marketing experience required'],
    audience: ['Small business owners', 'Marketing beginners', 'Career switchers'],
    sections: [
      { title: 'Strategy foundations', lessons: ['Understanding your audience', 'Setting goals and KPIs', 'The marketing funnel'] },
      { title: 'Channels', lessons: ['Search engine optimisation', 'Social media marketing', 'Email marketing'] },
      { title: 'Measure and improve', lessons: ['Paid advertising basics', 'Analytics and reporting', 'Your campaign plan'] },
    ],
  },
  {
    id: 'demo-ethical-hacking',
    title: 'Ethical Hacking Masterclass',
    subtitle: 'Learn how attackers think so you can defend systems responsibly.',
    description: 'A hands-on introduction to ethical hacking within a legal lab environment. Understand networking, reconnaissance, common web vulnerabilities and how to report and remediate findings professionally.',
    category: 'Cybersecurity', categorySlug: 'cybersecurity', instructor: 'i2', price: 1499, level: 'Intermediate',
    thumbnail: img('photo-1550751827-4bd374c3f58b'),
    outcomes: ['Set up a safe practice lab', 'Understand common web vulnerabilities', 'Perform authorised reconnaissance', 'Write a professional security report'],
    requirements: ['Basic networking and command-line familiarity'],
    audience: ['IT professionals moving into security', 'Developers who want to write safer code'],
    sections: [
      { title: 'Foundations', lessons: ['Ethics and the law', 'Building a lab', 'Networking refresher'] },
      { title: 'Assessment techniques', lessons: ['Reconnaissance', 'Common web vulnerabilities', 'Password security'] },
      { title: 'Defence and reporting', lessons: ['Remediation strategies', 'Writing the report', 'Careers in security'] },
    ],
  },
  {
    id: 'demo-ui-ux-figma',
    title: 'UI/UX Design with Figma',
    subtitle: 'Design user-friendly interfaces and interactive prototypes in Figma.',
    description: 'Learn the full design process: user research, information architecture, wireframing, visual design and prototyping. Build a reusable component library and present a polished case study for your portfolio.',
    category: 'UI/UX Design', categorySlug: 'ui-ux-design', instructor: 'i3', price: 899, level: 'Beginner',
    thumbnail: img('photo-1561070791-2526d30994b5'),
    outcomes: ['Run simple user research', 'Create wireframes and user flows', 'Build components and auto layout in Figma', 'Prototype and present a case study'],
    requirements: ['A free Figma account'],
    audience: ['Aspiring UI/UX designers', 'Developers and product managers'],
    sections: [
      { title: 'Design thinking', lessons: ['What is UX?', 'User research basics', 'Personas and journeys'] },
      { title: 'Figma essentials', lessons: ['Frames and layout', 'Components and variants', 'Auto layout'] },
      { title: 'Prototype and present', lessons: ['Interactive prototypes', 'Usability testing', 'Portfolio case study'] },
    ],
  },
  {
    id: 'demo-data-analytics-excel',
    title: 'Data Analytics with Excel',
    subtitle: 'Turn raw data into clear insights with formulas, PivotTables and dashboards.',
    description: 'Become confident with data in Excel. Clean messy datasets, use lookup and logical functions, summarise with PivotTables, visualise trends with charts and build an interactive dashboard for decision-makers.',
    category: 'Artificial Intelligence', categorySlug: 'ai-data-science', instructor: 'i2', price: 1199, level: 'Intermediate',
    thumbnail: img('photo-1551288049-bebda4e38f71'),
    outcomes: ['Clean and prepare data', 'Use XLOOKUP, IF and aggregation functions', 'Analyse with PivotTables', 'Build interactive dashboards'],
    requirements: ['Microsoft Excel (2019 or Microsoft 365 recommended)'],
    audience: ['Business and finance professionals', 'Aspiring data analysts'],
    sections: [
      { title: 'Preparing data', lessons: ['Excel tables', 'Cleaning techniques', 'Text and date functions'] },
      { title: 'Analysis', lessons: ['Lookup functions', 'PivotTables', 'What-if analysis'] },
      { title: 'Communicating insights', lessons: ['Effective charts', 'Dashboard design', 'Dashboard project'] },
    ],
  },
  {
    id: 'demo-wordpress-development',
    title: 'WordPress Website Development',
    subtitle: 'Build professional websites with WordPress — no coding required.',
    description: 'Create and manage modern websites with WordPress. Set up hosting, choose and customise themes, build pages with the block editor, add essential plugins and launch a fast, secure site.',
    category: 'Web Development', categorySlug: 'web-development', instructor: 'i1', price: 699, level: 'Beginner',
    thumbnail: img('photo-1467232004584-a241de8bcf5d'),
    outcomes: ['Install and configure WordPress', 'Customise themes and layouts', 'Use essential plugins safely', 'Launch and maintain a website'],
    requirements: ['No coding experience required'],
    audience: ['Small business owners', 'Freelancers offering website services'],
    sections: [
      { title: 'Setting up', lessons: ['Domains and hosting', 'Installing WordPress', 'Dashboard tour'] },
      { title: 'Building the site', lessons: ['Themes and the block editor', 'Pages, posts and menus', 'Essential plugins'] },
      { title: 'Launch', lessons: ['Performance and SEO basics', 'Security and backups', 'Going live'] },
    ],
  },
  {
    id: 'demo-freelancing-online-business',
    title: 'Freelancing and Online Business',
    subtitle: 'Start, price and grow a sustainable freelance career online.',
    description: 'A practical guide to working independently. Define your offer, build a portfolio, find clients on platforms and through referrals, price your services, manage projects and handle invoicing and taxes.',
    category: 'Business & Leadership', categorySlug: 'business-leadership', instructor: 'i3', price: 599, level: 'All Levels',
    thumbnail: img('photo-1521737604893-d14cc237f11d'),
    outcomes: ['Define a clear service offering', 'Build a client-winning portfolio', 'Price and propose with confidence', 'Manage clients, projects and payments'],
    requirements: ['A skill you can offer (design, writing, development, etc.)'],
    audience: ['Students and graduates', 'Professionals planning to go independent'],
    sections: [
      { title: 'Foundations', lessons: ['Choosing your niche', 'Building your portfolio', 'Your online presence'] },
      { title: 'Winning clients', lessons: ['Freelance platforms', 'Writing proposals', 'Pricing your work'] },
      { title: 'Running the business', lessons: ['Managing projects', 'Contracts and invoicing', 'Growing through referrals'] },
    ],
  },
];

/* ------------------------------------------------------------------------ */
async function findUserByEmail(email: string) {
  // Page through users (fine for small projects)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      if (/not allowed|not_admin|invalid api key|unauthorized/i.test(error.message))
        fail(
          `Supabase refused admin access ("${error.message}").\n` +
            '  The key in SUPABASE_SERVICE_ROLE_KEY does not have admin rights for this project — it is the wrong key,\n' +
            '  belongs to another project, or was rotated/deleted. Copy the current secret key from\n' +
            '  Project Settings → API Keys → Secret keys and run again.'
        );
      throw error;
    }
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(u: DemoUser): Promise<string> {
  const existing = await findUserByEmail(u.email);
  let id: string;

  if (existing) {
    id = existing.id;
    const { error } = await admin.auth.admin.updateUserById(id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });
    if (error) throw new Error(`Update ${u.email}: ${error.message}`);
    console.log(`  • exists   ${u.email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      // Role is deliberately NOT put in user metadata; it is set on the profile below.
      user_metadata: { full_name: u.name },
    });
    if (error || !data.user) throw new Error(`Create ${u.email}: ${error?.message}`);
    id = data.user.id;
    console.log(`  • created  ${u.email}`);
  }

  // Service role bypasses RLS and the role-protection trigger allows it.
  const { error: pErr } = await admin.from('profiles').upsert(
    {
      id,
      email: u.email,
      full_name: u.name,
      role: u.role,
      headline: u.headline,
      bio: u.bio,
      is_demo: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (pErr) throw new Error(`Profile ${u.email}: ${pErr.message}`);
  return id;
}

async function ensureSingleAdmin(adminId: string) {
  // Guarantee exactly one *demo* admin; never touch non-demo (real) admins.
  const { data, error } = await admin.from('profiles').select('id,email').eq('role', 'admin').eq('is_demo', true);
  if (error) throw error;
  for (const p of data || []) {
    if (p.id !== adminId) {
      await admin.from('profiles').update({ role: 'student' }).eq('id', p.id);
      console.log(`  • demoted extra demo admin ${p.email}`);
    }
  }
}

async function seedCourses(userIds: Record<string, string>) {
  for (const c of COURSES) {
    const totalLessons = c.sections.reduce((n, s) => n + s.lessons.length, 0);
    const minutesPerLesson = 15;
    const durationHours = Math.max(0.5, Math.round(((totalLessons * minutesPerLesson) / 60) * 10) / 10);

    const { error } = await admin.from('courses').upsert(
      {
        id: c.id,
        slug: c.id.replace(/^demo-/, ''),
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        category: c.category,
        category_slug: c.categorySlug,
        level: c.level,
        language: 'English',
        price: c.price,
        original_price: c.price, // no invented discounts
        rating: 0,
        review_count: 0,
        duration_hours: durationHours,
        total_lessons: totalLessons,
        thumbnail_url: c.thumbnail,
        instructor_id: userIds[c.instructor],
        learning_outcomes: c.outcomes,
        prerequisites: c.requirements,
        target_audience: c.audience,
        featured: !!c.featured,
        bestseller: false,
        trending: false,
        is_published: true,
        is_demo: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) throw new Error(`Course ${c.title}: ${error.message}`);

    for (let s = 0; s < c.sections.length; s++) {
      const sec = c.sections[s];
      const secId = `${c.id}-s${s + 1}`;
      const { error: sErr } = await admin
        .from('course_sections')
        .upsert({ id: secId, course_id: c.id, title: sec.title, section_order: s + 1 }, { onConflict: 'id' });
      if (sErr) throw new Error(`Section ${secId}: ${sErr.message}`);

      const lessonRows = sec.lessons.map((title, l) => ({
        id: `${secId}-l${l + 1}`,
        section_id: secId,
        course_id: c.id,
        title,
        duration_minutes: minutesPerLesson,
        type: 'article',
        video_url: null,
        content_text: `${title}\n\n[Demo lesson content] This lesson is part of "${c.title}". Replace this placeholder with the real lesson notes or upload a video from the instructor course studio.`,
        is_free_preview: s === 0 && l === 0,
        lesson_order: l + 1,
      }));
      const { error: lErr } = await admin.from('lessons').upsert(lessonRows, { onConflict: 'id' });
      if (lErr) throw new Error(`Lessons ${secId}: ${lErr.message}`);
    }
    console.log(`  • course   ${c.title} (₹${c.price}, ${totalLessons} lessons)`);
  }
}

async function main() {
  console.log(`\nEdufy demo setup → ${SUPABASE_URL}\n`);

  // Pre-flight: schema must exist
  const { error: schemaErr } = await admin.from('courses').select('id').limit(1);
  if (schemaErr) fail(`Database schema not found (${schemaErr.message}). Run the SQL migrations first — see SUPABASE_DEMO_SETUP.md.`);
  const { error: colErr } = await admin.from('profiles').select('is_demo').limit(1);
  if (colErr) fail('The security hardening migration (20261107000001) has not been applied yet.');

  console.log('Accounts');
  const ids: Record<string, string> = {};
  for (const u of USERS) ids[u.key] = await ensureUser(u);
  await ensureSingleAdmin(ids['a1']);

  console.log('\nCourses');
  await seedCourses(ids);

  console.log('\n✔ Demo environment ready.');
  console.log('  Accounts: 5 students, 3 instructors, 1 admin (password = DEMO_PASSWORD from your .env)');
  console.log('  Next: npx tsx scripts/verify-demo.ts\n');
}

main().catch((e) => fail(e?.message || String(e)));
