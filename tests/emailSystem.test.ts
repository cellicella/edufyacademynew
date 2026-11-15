/**
 * Email system tests: templates & placeholders, domain/environment validation, the Supabase Send Email
 * hook (signature + link building), and the outbox worker end-to-end against a local SMTP server
 * (idempotency, retries with backoff, permanent failures, disabled templates, missing variables).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import crypto from 'node:crypto';
import {
  TEMPLATE_DEFS, TEMPLATE_IDS, render, unknownPlaceholders, courseListHtml, paragraphsHtml, layout, missingRequired,
} from '../server/emailTemplates';
import { validateDomain, activeUrls, requiredRedirects, isAllowedRedirect, withDomainDefaults } from '../server/domain';
import { verifyStandardWebhook, emailsForHook, generateHookSecret, isHookSecret } from '../server/authHook';
import { createEmailService, backoffSeconds, redact, enrichVars } from '../server/email';
import { validateSection, withDefaults, publicSettings } from '../server/settingsSchema';
import { mergeAllowList, projectRefFromUrl, createManagementClient } from '../server/supabaseManagement';

// ---------------------------------------------------------------- templates
test('every default template only uses allowed placeholders and renders its required values', () => {
  assert.equal(TEMPLATE_DEFS.length, TEMPLATE_IDS.length);
  for (const t of TEMPLATE_DEFS) {
    assert.deepEqual(unknownPlaceholders(t.id, t.subject, t.html), [], `${t.id} uses unknown placeholders`);
    for (const r of t.required) assert.ok(t.html.includes(`{{${r}}}`) || t.subject.includes(`{{${r}}}`) || ['course_url'].includes(r), `${t.id} never shows required ${r}`);
  }
});

test('render escapes values, never evaluates code, ignores prototype keys', () => {
  const out = render('{{student_name}} {{constructor}} {{__proto__}} ${process.exit()} {{ course_name }}', { student_name: '<img src=x onerror=alert(1)>', course_name: 'A & B' }, 'html');
  assert.equal(out, '&lt;img src=x onerror=alert(1)&gt;   ${process.exit()} A &amp; B');
  assert.equal(render('{{course_list}}', { course_list: '<ul><li>x</li></ul>' }, 'html'), '<ul><li>x</li></ul>');
  assert.equal(render('Hi {{student_name}}', { student_name: '<b>P</b>' }, 'text'), 'Hi P');
});

test('admin template validation rejects unknown placeholders and scripts; legacy placeholders upgrade', () => {
  const bad = validateSection('email', { templates: { course_purchase: { enabled: true, subject: 'Order {{order_id}}', html: '<p>{{password}} {{env.SECRET}}</p>' } } });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(Object.values(bad.errors).join(' '), /password/);
  const ok = validateSection('email', { senderEmail: 'no-reply@edufy.example', templates: { course_purchase: { enabled: true, subject: 'Order {{order_id}}', html: '<p onclick="x()">Hi {{student_name}}</p><script>alert(1)</script>' } } });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.doesNotMatch(ok.value.templates.course_purchase.html, /script|onclick/);
  }
  const legacy = withDefaults({ email: { templates: { welcome: { enabled: true, subject: 'Hi {{name}}', html: '<p>{{name}} {{courseTitle}}</p>' } } } });
  assert.equal(legacy.email.templates.welcome.subject, 'Hi {{student_name}}');
});

test('course list / paragraphs are escaped; only https links survive; layout is responsive with footer', () => {
  const list = courseListHtml([{ title: '<b>Excel</b>', url: 'https://edufy.example/learn/1' }, { title: 'Word', url: 'javascript:alert(1)' }]);
  assert.match(list, /&lt;b&gt;Excel/);
  assert.match(list, /href="https:\/\/edufy\.example\/learn\/1"/);
  assert.doesNotMatch(list, /javascript:/);
  assert.equal(paragraphsHtml('a<b>\n\nc'), '<p>a&lt;b&gt;</p><p>c</p>');
  const html = layout('<p>x</p>', { siteName: 'Edufy', logoUrl: 'https://cdn.example/logo.png', brandColor: '#004AAD', footerText: '© 2026 Edufy', supportEmail: 'help@edufy.example', supportPhone: '', websiteUrl: 'https://edufy.example' }, 'Pre');
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /max-width:\s*600px/);
  assert.match(html, /help@edufy\.example/);
  assert.match(html, /© 2026 Edufy/);
  assert.deepEqual(missingRequired('course_purchase', { course_name: 'X', order_id: '', amount: '₹1' }), ['order_id']);
});

test('enrichVars builds course and dashboard links on the configured domain only', () => {
  const v = enrichVars({ course_id: 'excel-101', certificate_code: 'EDU-1' }, 'https://edufy.example') as any;
  assert.equal(v.course_url, 'https://edufy.example/learn/excel-101');
  assert.match(String(v.verification_url || v.certificate_url), /^https:\/\/edufy\.example\//);
});

test('backoff schedule and secret redaction', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(backoffSeconds), [60, 300, 900, 3600, 10800, 10800]);
  assert.equal(redact('535 auth failed for p4ss-w0rd!', ['p4ss-w0rd!', undefined]), '535 auth failed for [redacted]');
});

// ---------------------------------------------------------------- domain & environment
test('domain: production/staging need https and public hosts; development allows localhost http only', () => {
  const bad = validateDomain({ activeProfile: 'production', profiles: { production: { siteUrl: 'http://edufy.example' }, staging: { siteUrl: 'https://localhost:3000' }, development: { siteUrl: 'http://evil.example' } } });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.ok(bad.errors['profiles.production.siteUrl']);
    assert.ok(bad.errors['profiles.staging.siteUrl']);
    assert.ok(bad.errors['profiles.development.siteUrl']);
  }
  const unsafe = validateDomain({ profiles: { production: { siteUrl: 'javascript:alert(1)' } }, paths: { login: '//evil.example' } });
  assert.equal(unsafe.ok, false);
  const dev = validateDomain({ activeProfile: 'development', profiles: { development: { siteUrl: 'http://localhost:5173' } } });
  assert.equal(dev.ok, true);
  const devOnProd = validateDomain({ activeProfile: 'development', profiles: { development: { siteUrl: 'http://localhost:5173' } } }, { nodeEnv: 'production' });
  assert.equal(devOnProd.ok, false);
});

test('domain: active URLs, required Supabase redirects, open-redirect protection', () => {
  const d = withDomainDefaults({ activeProfile: 'production', profiles: { production: { siteUrl: 'https://edufy.example', apiUrl: 'https://api.edufy.example' }, development: { siteUrl: 'http://localhost:5173' } } });
  const u = activeUrls(d);
  assert.equal(u.authCallbackUrl, 'https://edufy.example/auth/callback');
  assert.equal(u.resetPasswordUrl, 'https://edufy.example/reset-password');
  assert.deepEqual(requiredRedirects(d), ['https://edufy.example/**', 'edufyacademy://**']);
  assert.equal(isAllowedRedirect('https://edufy.example/student', d, { production: true }), true);
  assert.equal(isAllowedRedirect('https://evil.example/', d, { production: true }), false);
  assert.equal(isAllowedRedirect('http://localhost:5173/', d, { production: true }), false);
  assert.equal(isAllowedRedirect('http://localhost:5173/', d, { production: false }), true);
  assert.equal(isAllowedRedirect('edufyacademy://auth/callback', d, { production: true }), true);
  assert.equal(isAllowedRedirect('edufyacademy://x"><script>', d, { production: true }), false);
  // public settings expose only the active profile's URLs, never other profiles
  const pub = publicSettings(withDefaults({ domain: d })) as any;
  assert.equal(pub.domain.siteUrl, 'https://edufy.example');
  assert.equal(JSON.stringify(pub).includes('localhost:5173'), false);
});

test('auth settings cannot lock admins out', () => {
  const none = validateSection('auth', { googleEnabled: false, emailPasswordEnabled: false, magicLinkEnabled: false });
  assert.equal(none.ok, false);
  const noEmail = validateSection('auth', { googleEnabled: false, emailPasswordEnabled: false, magicLinkEnabled: true, preferredMethod: 'email' });
  assert.equal(noEmail.ok, false, 'email/password can only be hidden while Google is on');
  const prefDisabled = validateSection('auth', { googleEnabled: false, emailPasswordEnabled: true, preferredMethod: 'google' });
  assert.equal(prefDisabled.ok, false);
  const oneTapNoId = validateSection('auth', { googleEnabled: true, oneTapEnabled: true, googleClientId: '' });
  assert.equal(oneTapNoId.ok, false);
  const ok = validateSection('auth', { googleEnabled: true, oneTapEnabled: true, googleClientId: '123456789012-abcdef.apps.googleusercontent.com', emailPasswordEnabled: true, preferredMethod: 'google' });
  assert.equal(ok.ok, true);
  const pub = publicSettings(withDefaults({ auth: ok.ok ? ok.value : {} })) as any;
  assert.equal(pub.auth.googleClientId, '123456789012-abcdef.apps.googleusercontent.com');
  assert.equal(JSON.stringify(pub).includes('clientSecret'), false);
});

// ---------------------------------------------------------------- Supabase Send Email hook
function sign(secret: string, body: string, ts = Math.floor(Date.now() / 1000), id = 'msg_1') {
  const key = Buffer.from(secret.replace(/^v1,whsec_/, ''), 'base64');
  const sig = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  return { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': `v1,${sig}` };
}

test('hook signature: valid, rotated secrets, tampered body, replay window', () => {
  const s1 = generateHookSecret();
  const s2 = generateHookSecret();
  assert.ok(isHookSecret(s1));
  const body = JSON.stringify({ a: 1 });
  assert.equal(verifyStandardWebhook(s1, sign(s1, body), body), true);
  assert.equal(verifyStandardWebhook(`${s2}|${s1}`, sign(s1, body), body), true);
  assert.equal(verifyStandardWebhook(s2, sign(s1, body), body), false);
  assert.equal(verifyStandardWebhook(s1, sign(s1, body), body + ' '), false);
  assert.equal(verifyStandardWebhook(s1, sign(s1, body, Math.floor(Date.now() / 1000) - 600), body), false);
  assert.equal(verifyStandardWebhook(s1, {}, body), false);
});

test('hook payloads → verification/reset links on the configured domain, never localhost in production', () => {
  const domain = withDomainDefaults({ activeProfile: 'production', profiles: { production: { siteUrl: 'https://edufy.example' }, development: { siteUrl: 'http://localhost:5173' } } });
  const o = { supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', domain, fallbackSiteUrl: '', production: true };
  const user = { id: 'u1', email: 'priya@example.org', user_metadata: { full_name: 'Priya' } };
  const signup = emailsForHook({ user, email_data: { email_action_type: 'signup', token: '123456', token_hash: 'hash1', redirect_to: 'http://localhost:3000', site_url: 'http://localhost:3000' } }, o);
  assert.equal(signup.emails.length, 1);
  const url = new URL(signup.emails[0].vars.verification_url);
  assert.equal(url.origin, 'https://abcdefghijklmnopqrst.supabase.co');
  assert.equal(url.searchParams.get('type'), 'signup');
  assert.equal(url.searchParams.get('token'), 'hash1');
  assert.equal(url.searchParams.get('redirect_to'), 'https://edufy.example/auth/callback', 'localhost redirect replaced by the production callback');
  assert.equal(signup.emails[0].template, 'email_verification');
  assert.equal(signup.emails[0].vars.student_name, 'Priya');

  const reset = emailsForHook({ user, email_data: { email_action_type: 'recovery', token_hash: 'h2', redirect_to: 'https://edufy.example/reset-password' } }, o);
  assert.equal(new URL(reset.emails[0].vars.reset_url).searchParams.get('redirect_to'), 'https://edufy.example/reset-password');
  const app = emailsForHook({ user, email_data: { email_action_type: 'recovery', token_hash: 'h3', redirect_to: 'edufyacademy://reset-password' } }, o);
  assert.equal(new URL(app.emails[0].vars.reset_url).searchParams.get('redirect_to'), 'edufyacademy://reset-password');
  const evil = emailsForHook({ user, email_data: { email_action_type: 'recovery', token_hash: 'h4', redirect_to: 'https://evil.example/steal' } }, o);
  assert.equal(new URL(evil.emails[0].vars.reset_url).searchParams.get('redirect_to'), 'https://edufy.example/reset-password');

  const change = emailsForHook({ user: { ...user, new_email: 'new@example.org' }, email_data: { email_action_type: 'email_change', token_hash: 'for-new', token_hash_new: 'for-current' } }, o);
  assert.deepEqual(change.emails.map((e) => [e.to, new URL(e.vars.confirm_url).searchParams.get('token')]), [['priya@example.org', 'for-current'], ['new@example.org', 'for-new']]);
  // same event twice → same idempotency key
  const again = emailsForHook({ user, email_data: { email_action_type: 'signup', token_hash: 'hash1' } }, o);
  assert.equal(again.emails[0].key, signup.emails[0].key);

  const noDomain = emailsForHook({ user, email_data: { email_action_type: 'signup', token_hash: 'x', site_url: 'http://localhost:3000' } }, { ...o, domain: withDomainDefaults({}) });
  assert.ok(noDomain.error, 'refuses to send a localhost link when no domain is configured');
});

// ---------------------------------------------------------------- Supabase Management API client
test('management client: only non-secret fields are returned; allow-list merge keeps existing entries', async () => {
  assert.equal(projectRefFromUrl('https://tyqdyfecdvclwsvcahod.supabase.co'), 'tyqdyfecdvclwsvcahod');
  assert.equal(mergeAllowList('https://a.example/**,edufyacademy://**', ['edufyacademy://**', 'https://b.example/**']), 'https://a.example/**,edufyacademy://**,https://b.example/**');
  const calls: any[] = [];
  const fakeFetch = (async (url: string, init: any) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ site_url: 'https://edufy.example', external_google_secret: 'SECRET', hook_send_email_secrets: 'v1,whsec_x', smtp_pass: 'p' }), { status: 200 });
  }) as any;
  const m = createManagementClient('sbp_token', 'https://tyqdyfecdvclwsvcahod.supabase.co', fakeFetch);
  const cfg = await m.getAuthConfig();
  assert.deepEqual(cfg, { site_url: 'https://edufy.example' });
  assert.equal(calls[0].url, 'https://api.supabase.com/v1/projects/tyqdyfecdvclwsvcahod/config/auth');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer sbp_token');
  assert.equal(createManagementClient(undefined, 'https://tyqdyfecdvclwsvcahod.supabase.co').enabled, false);
});

// ---------------------------------------------------------------- outbox worker end-to-end
function fakeOutboxDb() {
  const rows: any[] = [];
  let seq = 0;
  const db: any = {
    rows,
    from(table: string) {
      assert.equal(table, 'email_outbox');
      return {
        insert: async (r: any) => {
          if (rows.some((x) => x.event_key === r.event_key)) return { error: { message: 'duplicate key value violates unique constraint "email_outbox_event_key_key"' } };
          rows.push({ id: `row${++seq}`, attempts: 0, max_attempts: 5, created_at: new Date().toISOString(), ...r });
          return { error: null };
        },
        update: (patch: any) => ({
          eq: async (_c: string, id: string) => {
            Object.assign(rows.find((x) => x.id === id), patch);
            return { error: null };
          },
        }),
      };
    },
    async rpc(name: string, args: any) {
      assert.equal(name, 'claim_email_outbox');
      const due = rows.filter((r) => r.status === 'queued' && Date.parse(r.next_attempt_at) <= Date.now()).slice(0, args.p_limit);
      for (const r of due) Object.assign(r, { status: 'sending', attempts: r.attempts + 1 });
      return { data: due.map((r) => ({ ...r })), error: null };
    },
  };
  return db;
}

function smtpSink(behaviour: { rcpt?: string } = {}) {
  const got: { to: string; data: string }[] = [];
  const server = net.createServer((s) => {
    let buf = '';
    let data = false;
    let cur = { to: '', data: '' };
    const send = (l: string) => s.write(l + '\r\n');
    s.on('data', (c) => {
      buf += c.toString();
      let i: number;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (data) {
          if (line === '.') {
            data = false;
            got.push(cur);
            cur = { to: '', data: '' };
            send('250 OK id=SINK');
          } else cur.data += line + '\n';
          continue;
        }
        const up = line.toUpperCase();
        if (up.startsWith('EHLO')) send('250 localhost');
        else if (up.startsWith('MAIL')) send('250 OK');
        else if (up.startsWith('RCPT')) {
          cur.to = line.slice(8).replace(/[<>]/g, '');
          send(behaviour.rcpt || '250 OK');
        } else if (up === 'DATA') {
          data = true;
          send('354 go');
        } else if (up === 'QUIT') {
          send('221 bye');
          s.end();
        }
      }
    });
    s.on('error', () => undefined);
    send('220 sink');
  });
  return new Promise<{ port: number; got: typeof got; close: () => void }>((r) => server.listen(0, '127.0.0.1', () => r({ port: (server.address() as net.AddressInfo).port, got, close: () => server.close() })));
}

function service(db: any, port: number, settingsPatch: any = {}) {
  const domain = withDomainDefaults({ activeProfile: 'production', profiles: { production: { siteUrl: 'https://edufy.example' } } });
  const settings = withDefaults({ general: { siteName: 'Edufy Academy' }, email: { senderEmail: 'no-reply@edufy.example', supportEmail: 'help@edufy.example', ...settingsPatch.email }, domain });
  return createEmailService({
    db,
    credentials: { load: async () => null } as any,
    env: { smtpHost: '127.0.0.1', smtpPort: String(port), smtpSecurity: 'none' },
    getSettings: async () => settings,
    getUrls: async () => activeUrls(domain),
    workerEnabled: false,
  });
}

test('outbox: purchase email sent once with order details and course link; duplicates ignored', async () => {
  const sink = await smtpSink();
  const db = fakeOutboxDb();
  const svc = service(db, sink.port);
  try {
    const vars = { student_name: 'Priya', course_name: 'Advanced Excel', course_id: 'excel-101', order_id: 'order_ABC', amount: '₹1,499', payment_date: '13 Nov 2026', transaction_id: 'pay_XYZ', course_list: courseListHtml([{ title: 'Advanced Excel', url: 'https://edufy.example/learn/excel-101' }]) };
    assert.deepEqual(await svc.enqueue('course_purchase', { to: 'Priya@Example.org', userId: 'u1', eventKey: 'purchase:order_ABC', vars }), { queued: true });
    // verify endpoint + webhook both fire → second enqueue is a no-op
    assert.equal((await svc.enqueue('course_purchase', { to: 'priya@example.org', userId: 'u1', eventKey: 'purchase:order_ABC', vars })).queued, false);
    await svc.tick();
    assert.equal(db.rows.length, 1);
    assert.equal(db.rows[0].status, 'sent', db.rows[0].last_error);
    assert.equal(db.rows[0].provider, 'smtp');
    assert.match(db.rows[0].provider_response, /^250 /);
    assert.equal(sink.got.length, 1);
    assert.equal(sink.got[0].to, 'priya@example.org');
    const b64 = sink.got[0].data.split('Content-Type: text/html; charset=UTF-8\nContent-Transfer-Encoding: base64\n\n')[1].split('\n--')[0].replace(/\n/g, '');
    const html = Buffer.from(b64, 'base64').toString('utf8');
    for (const s of ['Priya', 'Advanced Excel', 'order_ABC', '₹1,499', 'pay_XYZ', 'https://edufy.example/learn/excel-101', 'help@edufy.example']) assert.ok(html.includes(s), `email contains ${s}`);
    assert.doesNotMatch(html, /localhost/);
  } finally {
    sink.close();
  }
});

test('outbox: temporary failure → requeued with backoff; permanent → failed; never blocks the caller', async () => {
  const tmp = await smtpSink({ rcpt: '451 4.7.1 Greylisted, try later' });
  const db = fakeOutboxDb();
  const svc = service(db, tmp.port);
  try {
    await svc.enqueue('welcome', { to: 'a@example.org', eventKey: 'welcome:u1', vars: { student_name: 'A' } });
    const t0 = Date.now();
    await svc.tick();
    const r = db.rows[0];
    assert.equal(r.status, 'queued');
    assert.equal(r.attempts, 1);
    assert.ok(Date.parse(r.next_attempt_at) - t0 >= 59_000, 'first retry after ~60 s');
    assert.match(r.last_error, /451/);
    // after the last allowed attempt it becomes failed
    Object.assign(r, { attempts: 4, next_attempt_at: new Date(0).toISOString() });
    await svc.tick();
    assert.equal(r.status, 'failed');
    assert.equal(r.attempts, 5);
  } finally {
    tmp.close();
  }
  const perm = await smtpSink({ rcpt: '550 5.1.1 No such user' });
  const db2 = fakeOutboxDb();
  const svc2 = service(db2, perm.port);
  try {
    await svc2.enqueue('welcome', { to: 'b@example.org', eventKey: 'welcome:u2', vars: {} });
    await svc2.tick();
    assert.equal(db2.rows[0].status, 'failed');
    assert.equal(db2.rows[0].attempts, 1);
  } finally {
    perm.close();
  }
});

test('outbox: disabled template → skipped; missing required values → failed (nothing sent); bad recipient refused', async () => {
  const sink = await smtpSink();
  const db = fakeOutboxDb();
  const svc = service(db, sink.port, { email: { templates: { enrollment: { enabled: false } } } });
  try {
    await svc.enqueue('enrollment', { to: 'c@example.org', eventKey: 'enrollment:u3:c1', vars: { course_name: 'X' } });
    await svc.enqueue('course_purchase', { to: 'c@example.org', eventKey: 'purchase:o2', vars: { course_name: 'X' } });
    assert.equal((await svc.enqueue('welcome', { to: 'not-an-email', eventKey: 'welcome:bad' })).queued, false);
    await svc.tick();
    assert.equal(db.rows[0].status, 'skipped');
    assert.equal(db.rows[1].status, 'failed');
    assert.match(db.rows[1].last_error, /order_id|amount/);
    assert.equal(sink.got.length, 0);
  } finally {
    sink.close();
  }
});

test('send test email: success only when the server accepts; reports provider response', async () => {
  const ok = await smtpSink();
  const bad = await smtpSink({ rcpt: '550 relay denied' });
  try {
    const a = await service(fakeOutboxDb(), ok.port).sendTest('admin@example.org');
    assert.equal(a.ok, true);
    assert.match(a.response, /^250/);
    const b = await service(fakeOutboxDb(), bad.port).sendTest('admin@example.org');
    assert.equal(b.ok, false);
    assert.match(b.response, /550 relay denied/);
    await assert.rejects(service(fakeOutboxDb(), ok.port, { email: { senderEmail: '' } }).sendTest('admin@example.org'), /sender email/i);
  } finally {
    ok.close();
    bad.close();
  }
});
