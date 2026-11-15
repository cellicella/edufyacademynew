/**
 * Minimal, dependency-free SMTP client for transactional email.
 *
 * Supports implicit TLS (port 465, "ssl"), STARTTLS (port 587, "starttls") and plain (local relays only),
 * AUTH PLAIN / AUTH LOGIN, multi-line replies, dot-stuffing and UTF-8 multipart (text + HTML) messages.
 * Success is reported only when the server answers 250 to the end of DATA, i.e. the provider accepted
 * the message for delivery. Passwords are never included in errors or logs.
 * Tested against a local SMTP server in tests/smtp.test.ts.
 */
import net from 'net';
import tls from 'tls';
import crypto from 'crypto';
import os from 'os';

export type SmtpSecurity = 'ssl' | 'starttls' | 'none';

export interface SmtpConfig {
  host: string;
  port: number;
  security: SmtpSecurity;
  username?: string;
  password?: string;
  /** Only for tests / private relays with self-signed certificates. */
  rejectUnauthorized?: boolean;
  timeoutMs?: number;
  clientName?: string;
}

export interface MailMessage {
  fromName: string;
  fromEmail: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export type SmtpStage = 'connect' | 'tls' | 'greeting' | 'ehlo' | 'starttls' | 'auth' | 'sender' | 'recipient' | 'data' | 'accepted';

export class SmtpError extends Error {
  constructor(message: string, public stage: SmtpStage, public code: number | null, public temporary: boolean) {
    super(message);
    this.name = 'SmtpError';
  }
}

export interface SmtpResult { messageId: string; response: string; stages: SmtpStage[] }

const CRLF = '\r\n';

/** Temporary failure? 4xx replies and network problems are retried; 5xx are permanent. */
export const isTemporaryCode = (code: number | null) => code === null || (code >= 400 && code < 500);

function encodeHeader(v: string): string {
  // RFC 2047 encoded-word for non-ASCII header values
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`;
}
const cleanHeader = (v: string) => String(v || '').replace(/[\r\n]+/g, ' ').trim();
const wrap76 = (b64: string) => b64.replace(/.{1,76}/g, (m) => m + CRLF).trimEnd();

/** Builds a multipart/alternative MIME message. Header values are stripped of CR/LF (no header injection). */
export function buildMime(m: MailMessage, messageId: string, date = new Date()): string {
  const boundary = `=_edufy_${crypto.randomBytes(12).toString('hex')}`;
  const fromName = cleanHeader(m.fromName);
  const headers: string[] = [
    `From: ${fromName ? `"${encodeHeader(fromName).replace(/"/g, '')}" ` : ''}<${cleanHeader(m.fromEmail)}>`,
    `To: <${cleanHeader(m.to)}>`,
    ...(m.replyTo ? [`Reply-To: <${cleanHeader(m.replyTo)}>`] : []),
    `Subject: ${encodeHeader(cleanHeader(m.subject))}`,
    `Date: ${date.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    ...Object.entries(m.headers || {}).map(([k, v]) => `${cleanHeader(k).replace(/[^A-Za-z0-9-]/g, '')}: ${encodeHeader(cleanHeader(v))}`),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const part = (type: string, body: string) =>
    [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', wrap76(Buffer.from(body, 'utf8').toString('base64'))].join(CRLF);
  return [...headers, '', part('text/plain', m.text), part('text/html', m.html), `--${boundary}--`, ''].join(CRLF);
}

/** Dot-stuffing (RFC 5321 4.5.2) + terminator. */
export const dotStuff = (data: string) => data.replace(/\r?\n/g, CRLF).replace(/^\./gm, '..') + `${CRLF}.${CRLF}`;

class Connection {
  private buf = '';
  private waiters: ((line: { code: number; text: string } | Error) => void)[] = [];
  private pending: ({ code: number; text: string } | Error)[] = [];
  private lines: string[] = [];
  socket: net.Socket | tls.TLSSocket;

  constructor(socket: net.Socket | tls.TLSSocket, private timeoutMs: number) {
    this.socket = socket;
    this.attach(socket);
  }

  attach(socket: net.Socket | tls.TLSSocket) {
    this.socket = socket;
    this.buf = '';
    socket.setTimeout(this.timeoutMs);
    socket.on('data', (d) => this.onData(d.toString('utf8')));
    socket.on('timeout', () => this.fail(new SmtpError('The SMTP server did not respond in time.', 'connect', null, true)));
    socket.on('error', (e: any) => this.fail(new SmtpError(`Connection error: ${e?.code || e?.message || e}`, 'connect', null, true)));
    socket.on('close', () => this.fail(new SmtpError('The SMTP server closed the connection.', 'connect', null, true)));
  }

  private onData(chunk: string) {
    this.buf += chunk;
    let i: number;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i).replace(/\r$/, '');
      this.buf = this.buf.slice(i + 1);
      this.lines.push(line);
      // Multi-line replies use "250-" until the last "250 " line
      if (/^\d{3}(?: |$)/.test(line)) {
        const code = parseInt(line.slice(0, 3), 10);
        const text = this.lines.map((l) => l.slice(4)).join('\n');
        this.lines = [];
        this.deliver({ code, text });
      }
    }
  }

  private deliver(v: { code: number; text: string } | Error) {
    const w = this.waiters.shift();
    if (w) w(v);
    else this.pending.push(v);
  }
  private fail(e: Error) {
    this.deliver(e);
  }

  read(): Promise<{ code: number; text: string }> {
    const p = this.pending.shift();
    if (p) return p instanceof Error ? Promise.reject(p) : Promise.resolve(p);
    return new Promise((resolve, reject) => this.waiters.push((v) => (v instanceof Error ? reject(v) : resolve(v))));
  }

  async cmd(line: string, expect: number[], stage: SmtpStage, label?: string) {
    this.socket.write(line + CRLF);
    return this.expect(expect, stage, label);
  }

  async expect(expect: number[], stage: SmtpStage, label?: string) {
    const r = await this.read();
    if (!expect.includes(r.code)) {
      throw new SmtpError(`${label || stage}: server replied ${r.code} ${r.text.split('\n')[0].slice(0, 200)}`, stage, r.code, isTemporaryCode(r.code));
    }
    return r;
  }
}

function connect(cfg: SmtpConfig): Promise<net.Socket | tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new SmtpError(`Could not connect to ${cfg.host}:${cfg.port} (timeout).`, 'connect', null, true)), cfg.timeoutMs || 15000);
    const done = (s: net.Socket | tls.TLSSocket) => {
      clearTimeout(timer);
      resolve(s);
    };
    const onErr = (e: any) => {
      clearTimeout(timer);
      const code = e?.code || '';
      const hint = code === 'ENOTFOUND' ? ' (host not found)' : code === 'ECONNREFUSED' ? ' (connection refused; check the port)' : /CERT|SSL|TLS/i.test(code + e?.message) ? ' (TLS problem; check the encryption type)' : '';
      reject(new SmtpError(`Could not connect to ${cfg.host}:${cfg.port}${hint}.`, cfg.security === 'ssl' ? 'tls' : 'connect', null, !/ENOTFOUND/.test(code)));
    };
    if (cfg.security === 'ssl') {
      const s = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: cfg.rejectUnauthorized !== false }, () => done(s));
      s.once('error', onErr);
    } else {
      const s = net.connect({ host: cfg.host, port: cfg.port }, () => done(s));
      s.once('error', onErr);
    }
  });
}

/** Sends one message. Throws SmtpError with the failing stage; resolves only after the server accepted the message. */
export async function sendMail(cfg: SmtpConfig, msg: MailMessage): Promise<SmtpResult> {
  const stages: SmtpStage[] = [];
  const timeout = cfg.timeoutMs || 20000;
  const socket = await connect(cfg);
  stages.push('connect');
  const conn = new Connection(socket, timeout);
  const name = cfg.clientName || os.hostname() || 'edufy.local';
  try {
    await conn.expect([220], 'greeting', 'Greeting');
    stages.push('greeting');
    let ehlo = await conn.cmd(`EHLO ${name}`, [250], 'ehlo', 'EHLO');
    stages.push('ehlo');

    if (cfg.security === 'starttls') {
      if (!/\bSTARTTLS\b/i.test(ehlo.text)) throw new SmtpError('The server does not offer STARTTLS on this port. Use SSL (port 465) or check the port.', 'starttls', null, false);
      await conn.cmd('STARTTLS', [220], 'starttls', 'STARTTLS');
      const secure = await new Promise<tls.TLSSocket>((resolve, reject) => {
        socket.removeAllListeners('data');
        socket.removeAllListeners('timeout');
        socket.removeAllListeners('error');
        socket.removeAllListeners('close');
        const t = tls.connect({ socket: socket as net.Socket, servername: cfg.host, rejectUnauthorized: cfg.rejectUnauthorized !== false }, () => resolve(t));
        t.once('error', (e: any) => reject(new SmtpError(`TLS upgrade failed: ${e?.code || e?.message}`, 'starttls', null, false)));
      });
      conn.attach(secure);
      stages.push('starttls');
      ehlo = await conn.cmd(`EHLO ${name}`, [250], 'ehlo', 'EHLO after STARTTLS');
    }

    if (cfg.username) {
      const encrypted = cfg.security !== 'none';
      if (!encrypted && !/^(localhost|127\.0\.0\.1|::1)$/.test(cfg.host)) {
        throw new SmtpError('Refusing to send the SMTP password over an unencrypted connection. Choose SSL or STARTTLS.', 'auth', null, false);
      }
      const methods = (ehlo.text.match(/AUTH[ =]([^\n]*)/i)?.[1] || '').toUpperCase();
      try {
        if (methods.includes('PLAIN') || !methods.includes('LOGIN')) {
          const token = Buffer.from(`\u0000${cfg.username}\u0000${cfg.password || ''}`, 'utf8').toString('base64');
          await conn.cmd(`AUTH PLAIN ${token}`, [235], 'auth', 'Authentication');
        } else {
          await conn.cmd('AUTH LOGIN', [334], 'auth', 'Authentication');
          await conn.cmd(Buffer.from(cfg.username, 'utf8').toString('base64'), [334], 'auth', 'Authentication (username)');
          await conn.cmd(Buffer.from(cfg.password || '', 'utf8').toString('base64'), [235], 'auth', 'Authentication (password)');
        }
      } catch (e: any) {
        if (e instanceof SmtpError && e.code && e.code >= 500) {
          throw new SmtpError('Authentication failed: the SMTP username or password was rejected.', 'auth', e.code, false);
        }
        throw e;
      }
      stages.push('auth');
    }

    await conn.cmd(`MAIL FROM:<${cleanHeader(msg.fromEmail)}>`, [250], 'sender', 'Sender (MAIL FROM)');
    stages.push('sender');
    await conn.cmd(`RCPT TO:<${cleanHeader(msg.to)}>`, [250, 251], 'recipient', 'Recipient (RCPT TO)');
    stages.push('recipient');
    await conn.cmd('DATA', [354], 'data', 'DATA');
    const domain = (msg.fromEmail.split('@')[1] || 'edufy.local').replace(/[^A-Za-z0-9.-]/g, '');
    const messageId = `<${Date.now().toString(36)}.${crypto.randomBytes(8).toString('hex')}@${domain}>`;
    conn.socket.write(dotStuff(buildMime(msg, messageId)));
    const accepted = await conn.expect([250], 'data', 'Message delivery');
    stages.push('data', 'accepted');
    conn.socket.write(`QUIT${CRLF}`);
    return { messageId, response: `${accepted.code} ${accepted.text.split('\n')[0]}`.slice(0, 300), stages };
  } finally {
    setTimeout(() => conn.socket.destroy(), 200).unref?.();
  }
}
