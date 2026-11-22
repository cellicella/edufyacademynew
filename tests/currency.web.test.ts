import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatINR } from '../src/utils/currency';

test('formatINR shows rupees with Indian digit grouping', () => {
  assert.equal(formatINR(499), '₹499');
  assert.equal(formatINR(1299.5), '₹1,299.50');
  assert.equal(formatINR(129999), '₹1,29,999');
  assert.equal(formatINR(499, 2), '₹499.00');
  assert.equal(formatINR(1234567.891, 2), '₹12,34,567.89');
  assert.equal(formatINR('7999.00', 2), '₹7,999.00', 'numeric strings from the database');
  assert.equal(formatINR(0, 2), '₹0.00');
  assert.equal(formatINR(null), '₹0');
  assert.equal(formatINR('abc'), '₹0');
});

test('no dollar prices are shown anywhere in the website code', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
    }
  };
  walk(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src'));
  const offenders: string[] = [];
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const jsxDollar = !line.includes('`') && /\$\{/.test(line); // JSX text "$" in front of an amount
      const literal = /\$\$\{|\$\d|\bUSD\b|DollarSign/.test(line);
      if (jsxDollar || literal) offenders.push(`${path.relative(process.cwd(), f)}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, []);
});
