// Reads `eas build:view --json` output (argv[2]) and downloads that build's log files as plain text (argv[3]).
import { readFileSync, writeFileSync } from 'node:fs';
const raw = readFileSync(process.argv[2], 'utf8');
const json = JSON.parse(raw.slice(raw.indexOf('{')));
const out = [];
out.push(`build ${json.id} status=${json.status} profile=${json.buildProfile}`);
if (json.error) out.push(`ERROR: ${json.error.errorCode || ''} ${json.error.message || ''}`);
for (const url of json.logFiles || []) {
  const res = await fetch(url);
  const text = await res.text();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const l = JSON.parse(line);
      if (l.msg) out.push(`[${l.phase || ''}] ${l.msg}`);
    } catch { out.push(line); }
  }
}
writeFileSync(process.argv[3], out.join('\n'));
console.log(`wrote ${out.length} lines`);
