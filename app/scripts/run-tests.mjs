// Unit-test runner for the app's pure logic (src/logic) — no device or Metro needed.
// Transpiles TypeScript with the app's own `typescript` devDependency, then runs Node's built-in
// test runner. Usage:  npm test
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const ts = require(process.env.TS_PATH || 'typescript');
const out = join(root, '.test-build');

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
});

rmSync(out, { recursive: true, force: true });
const files = [...walk(join(root, 'src', 'logic')), join(root, 'src', 'lib', 'types.ts'), ...walk(join(root, 'tests'))];
for (const file of files) {
  const { outputText, diagnostics } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, verbatimModuleSyntax: false },
    fileName: file,
    reportDiagnostics: true,
  });
  if (diagnostics?.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: (f) => f, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
    process.exit(1);
  }
  const target = join(out, relative(root, file)).replace(/\.ts$/, '.js');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, outputText);
}

const testFiles = walk(join(root, 'tests')).map((f) => join(out, relative(root, f)).replace(/\.ts$/, '.js'));
const r = spawnSync(process.execPath, ['--test', ...testFiles], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });
process.exit(r.status ?? 1);
