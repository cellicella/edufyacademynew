/**
 * SMTP client tests against a local in-process SMTP server (no network access needed).
 * Covers: plain relay, STARTTLS upgrade + AUTH PLAIN, AUTH LOGIN, wrong password, temporary 4xx,
 * refusing to send a password unencrypted, dot-stuffing and MIME encoding.
 * TLS cases run only when `openssl` is available to create a throwaway self-signed certificate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { sendMail, buildMime, dotStuff, SmtpError } from '../server/smtp';
import { deliver, smtpTestSteps } from '../server/email';

interface Received { from: string; to: string[]; data: string; authed: string | null; secure: boolean }

function makeCert(): { key: string; cert: string } | null {
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smtp-test-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
    return { key: fs.readFileSync(path.join(dir, 'k.pem'), 'utf8'), cert: fs.readFileSync(path.join(dir, 'c.pem'), 'utf8') };
  } catch {
    return null;
  }
}
const CERT = makeCert();

/** Minimal SMTP server. opts.user/pass enable AUTH; opts.tls enables STARTTLS or implicit TLS. */
function startServer(opts: { user?: string; pass?: string; startTls?: boolean; implicitTls?: boolean; authMethods?: string; rcptReply?: string }) {
  const received: Received[] = [];
  const onConn = (sock: net.Socket | tls.TLSSocket, secureInitially: boolean) => {
    let secure = secureInitially;
    let buf = '';
    let mode: 'cmd' | 'data' | 'authLoginUser' | 'authLoginPass' = 'cmd';
    let cur: Received = { from: '', to: [], data: '', authed: null, secure };
    let loginUser = '';
    let s: net.Socket | tls.TLSSocket = sock;
    const send = (l: string) => s.write(l + '\r\n');
    const ehlo = () => {
      const lines = ['250-localhost'];
      if (opts.startTls && !secure) lines.push('250-STARTTLS');
      if (opts.user) lines.push(`250-AUTH ${opts.authMethods || 'PLAIN LOGIN'}`);
      lines.push('250 8BITMIME');
      s.write(lines.join('\r\n') + '\r\n');
    };
    const handle = (line: string) => {
      if (mode === 'data') {
        if (line === '.') {
          mode = 'cmd';
          received.push({ ...cur, secure });
          send('250 2.0.0 OK queued as TEST123');
          cur = { from: '', to: [], data: '', authed: cur.authed, secure };
        } else cur.data += line + '\n';
        return;
      }
      if (mode === 'authLoginUser') {
        loginUser = Buffer.from(line, 'base64').toString();
        mode = 'authLoginPass';
        return send('334 UGFzc3dvcmQ6');
      }
      if (mode === 'authLoginPass') {
        mode = 'cmd';
        const pw = Buffer.from(line, 'base64').toString();
        if (loginUser === opts.user && pw === opts.pass) {
          cur.authed = loginUser;
          return send('235 2.7.0 Authentication successful');
        }
        return send('535 5.7.8 Authentication credentials invalid');
      }
      const up = line.toUpperCase();
      if (up.startsWith('EHLO')) return ehlo();
      if (up === 'STARTTLS' && opts.startTls && CERT) {
        send('220 2.0.0 Ready to start TLS');
        s.removeAllListeners('data');
        const t = new tls.TLSSocket(s as net.Socket, { isServer: true, key: CERT.key, cert: CERT.cert });
        s = t;
        secure = true;
        buf = '';
        t.on('data', onData);
        t.on('error', () => undefined);
        return;
      }
      if (up.startsWith('AUTH PLAIN ')) {
        const [, u, p] = Buffer.from(line.slice(11), 'base64').toString().split('\u0000');
        if (u === opts.user && p === opts.pass) {
          cur.authed = u;
          return send('235 2.7.0 Authentication successful');
        }
        return send('535 5.7.8 Authentication credentials invalid');
      }
      if (up === 'AUTH LOGIN') {
        mode = 'authLoginUser';
        return send('334 VXNlcm5hbWU6');
      }
      if (up.startsWith('MAIL FROM:')) {
        if (opts.user && !cur.authed) return send('530 5.7.0 Authentication required');
        cur.from = line.slice(10).replace(/[<>]/g, '');
        return send('250 OK');
      }
      if (up.startsWith('RCPT TO:')) {
        if (opts.rcptReply) return send(opts.rcptReply);
        cur.to.push(line.slice(8).replace(/[<>]/g, ''));
        return send('250 OK');
      }
      if (up === 'DATA') {
        mode = 'data';
        return send('354 End data with <CR><LF>.<CR><LF>');
      }
      if (up === 'QUIT') {
        send('221 Bye');
        return s.end();
      }
      send('502 Command not implemented');
    };
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('utf8');
      let i: number;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        handle(line);
        if (s !== sock && buf === '' && mode === 'cmd' && !secureInitially && secure && line.toUpperCase() === 'STARTTLS') break;
      }
    };
    s.on('data', onData);
    s.on('error', () => undefined);
    send('220 localhost ESMTP test');
  };
  const server = opts.implicitTls && CERT
    ? tls.createServer({ key: CERT.key, cert: CERT.cert }, (sk) => onConn(sk, true))
    : net.createServer((sk) => onConn(sk, false));
  return new Promise<{ port: number; received: Received[]; close: () => void }>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ port: (server.address() as net.AddressInfo).port, received, close: () => server.close() }));
  });
}

const MSG = { fromName: 'Edufy Academy', fromEmail: 'no-reply@example.com', to: 'student@example.org', subject: 'Welcome to Edufy – ₹499 course', html: '<p>Hello</p>\n.\n<p>dot line</p>', text: 'Hello\n.\ndot line' };

test('plain relay on localhost: message accepted, stages reported, MIME decodes', async () => {
  const srv = await startServer({});
  try {
    const r = await sendMail({ host: '127.0.0.1', port: srv.port, security: 'none' }, MSG);
    assert.match(r.response, /^250 /);
    assert.deepEqual(r.stages, ['connect', 'greeting', 'ehlo', 'sender', 'recipient', 'data', 'accepted']);
    assert.equal(srv.received.length, 1);
    const got = srv.received[0];
    assert.equal(got.from, 'no-reply@example.com');
    assert.deepEqual(got.to, ['student@example.org']);
    assert.match(got.data, /Subject: =\?UTF-8\?B\?/);
    assert.match(got.data, /multipart\/alternative/);
    // the lone "." line was dot-stuffed on the wire and un-stuffed by the server (body is base64, so check the encoded part decodes)
    const b64 = got.data.split(/Content-Type: text\/plain[^\n]*\n(?:[^\n]+\n)*\n/)[1]?.split('\n--')[0]?.replace(/\n/g, '') || '';
    assert.equal(Buffer.from(b64, 'base64').toString('utf8'), MSG.text);
  } finally {
    srv.close();
  }
});

test('password is never sent over an unencrypted connection to a remote host', async () => {
  await assert.rejects(
    sendMail({ host: 'smtp.invalid.example', port: 1, security: 'none', username: 'u', password: 'p', timeoutMs: 1500 }, MSG),
    (e: any) => e instanceof SmtpError && ['connect', 'auth'].includes(e.stage)
  );
});

test('AUTH PLAIN on localhost (no TLS): wrong password → permanent auth error with clear message', async () => {
  const srv = await startServer({ user: 'mailer', pass: 'right-pass' });
  try {
    await assert.rejects(sendMail({ host: '127.0.0.1', port: srv.port, security: 'none', username: 'mailer', password: 'wrong' }, MSG), (e: any) => {
      assert.ok(e instanceof SmtpError);
      assert.equal(e.stage, 'auth');
      assert.equal(e.temporary, false);
      assert.match(e.message, /username or password was rejected/);
      assert.doesNotMatch(e.message, /wrong/);
      return true;
    });
    const ok = await sendMail({ host: '127.0.0.1', port: srv.port, security: 'none', username: 'mailer', password: 'right-pass' }, MSG);
    assert.ok(ok.stages.includes('auth'));
    assert.equal(srv.received[0].authed, 'mailer');
  } finally {
    srv.close();
  }
});

test('AUTH LOGIN is used when the server offers only LOGIN', async () => {
  const srv = await startServer({ user: 'mailer', pass: 'pw', authMethods: 'LOGIN' });
  try {
    const r = await sendMail({ host: '127.0.0.1', port: srv.port, security: 'none', username: 'mailer', password: 'pw' }, MSG);
    assert.ok(r.stages.includes('auth'));
  } finally {
    srv.close();
  }
});

test('temporary 4xx at RCPT is marked temporary (will be retried); 5xx is permanent', async () => {
  const t = await startServer({ rcptReply: '451 4.3.0 Try again later' });
  const p = await startServer({ rcptReply: '550 5.1.1 No such user' });
  try {
    const a = await deliver({ provider: 'smtp', source: 'admin', host: '127.0.0.1', port: t.port, security: 'none' } as any, MSG);
    assert.equal(a.ok, false);
    assert.equal(a.temporary, true);
    assert.match(a.response, /^recipient: /);
    const b = await deliver({ provider: 'smtp', source: 'admin', host: '127.0.0.1', port: p.port, security: 'none' } as any, MSG);
    assert.equal(b.ok, false);
    assert.equal(b.temporary, false);
    const steps = smtpTestSteps({ ...b, provider: 'smtp', security: 'none', auth: false });
    assert.deepEqual(steps.map((s) => s.status), ['pass', 'manual', 'manual', 'pass', 'fail', 'manual']);
  } finally {
    t.close();
    p.close();
  }
});

test('connection refused → temporary connect failure', async () => {
  const srv = await startServer({});
  const port = srv.port;
  srv.close();
  await new Promise((r) => setTimeout(r, 50));
  const r = await deliver({ provider: 'smtp', source: 'admin', host: '127.0.0.1', port, security: 'none' } as any, MSG);
  assert.equal(r.ok, false);
  assert.equal(r.temporary, true);
  assert.match(r.response, /connection refused/);
});

test('STARTTLS upgrade, then AUTH over TLS (self-signed cert rejected by default)', { skip: !CERT && 'openssl not available' }, async () => {
  const srv = await startServer({ user: 'mailer', pass: 's3cret', startTls: true });
  try {
    // Default: certificate must be valid → a self-signed test cert is refused
    await assert.rejects(sendMail({ host: 'localhost', port: srv.port, security: 'starttls', username: 'mailer', password: 's3cret' }, MSG), (e: any) => e.stage === 'starttls');
    const r = await sendMail({ host: 'localhost', port: srv.port, security: 'starttls', username: 'mailer', password: 's3cret', rejectUnauthorized: false }, MSG);
    assert.ok(r.stages.includes('starttls') && r.stages.includes('auth'));
    const got = srv.received.at(-1)!;
    assert.equal(got.secure, true);
    assert.equal(got.authed, 'mailer');
  } finally {
    srv.close();
  }
});

test('implicit TLS (port 465 style)', { skip: !CERT && 'openssl not available' }, async () => {
  const srv = await startServer({ user: 'mailer', pass: 'pw', implicitTls: true });
  try {
    const r = await deliver({ provider: 'smtp', source: 'admin', host: 'localhost', port: srv.port, security: 'ssl', username: 'mailer', password: 'pw' } as any, MSG, { rejectUnauthorized: false });
    assert.equal(r.ok, true, r.response);
    assert.ok(srv.received[0].secure);
    const steps = smtpTestSteps({ ...r, provider: 'smtp', security: 'ssl', auth: true });
    assert.ok(steps.every((s) => s.status === 'pass'));
  } finally {
    srv.close();
  }
});

test('STARTTLS required but not offered → clear error', async () => {
  const srv = await startServer({});
  try {
    await assert.rejects(sendMail({ host: '127.0.0.1', port: srv.port, security: 'starttls' }, MSG), (e: any) => e.stage === 'starttls' && /does not offer STARTTLS/.test(e.message));
  } finally {
    srv.close();
  }
});

test('MIME: header injection stripped, dot-stuffing', () => {
  const mime = buildMime({ ...MSG, subject: 'Hi\r\nBcc: evil@x.com', replyTo: 'help@example.com\r\nX: y' }, '<id@example.com>');
  assert.doesNotMatch(mime, /\r\nBcc:/);
  assert.doesNotMatch(mime, /\r\nX: y/);
  assert.equal(dotStuff('a\r\n.\r\nb'), 'a\r\n..\r\nb\r\n.\r\n');
});
