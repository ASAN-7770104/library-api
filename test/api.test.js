// Smoke tests: start the real server on a spare port and call it over HTTP.
// They only read data or send invalid input, so data/books.json is not changed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4599;
const base = `http://localhost:${PORT}/api/books`;
let server;

before(async () => {
  server = spawn(process.execPath, ['app.js'], { cwd: root, env: { ...process.env, PORT: String(PORT) } });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (chunk) => String(chunk).includes('running') && resolve());
    server.on('exit', (code) => reject(new Error(`server exited with code ${code}`)));
  });
});

after(() => server.kill());

test('GET /api/books answers with JSON', async () => {
  const res = await fetch(base);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /json/);
});

test('POST with an empty body is rejected', async () => {
  const res = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 400);
});

test('unknown route returns 404', async () => {
  const res = await fetch(`http://localhost:${PORT}/nope`);
  assert.equal(res.status, 404);
});
