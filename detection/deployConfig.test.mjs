import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

test('detection Dockerfile does not require bundled weights from gitignored files', () => {
  const dockerfile = readFileSync(path.join(__dirname, 'Dockerfile'), 'utf8');
  const gitignore = readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');

  assert.match(gitignore, /^\*\.pt$/m);
  assert.doesNotMatch(dockerfile, /^\s*COPY\s+weights\s+\.\/weights\s*$/m);
});

test('startup.sh accepts either service key env name for Supabase weight download', () => {
  const startup = readFileSync(path.join(__dirname, 'startup.sh'), 'utf8');

  assert.match(startup, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(startup, /SUPABASE_SERVICE_KEY/);
});
