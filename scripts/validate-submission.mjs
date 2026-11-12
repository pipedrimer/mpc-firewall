#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_SIZES = new Set(['1', '2 - 4', '4 - 6', '6 - 8', '8+']);
const ALLOWED_TRACKS = new Set([
  'defi',
  'thesis',
  'privacy',
  'business',
  'swarms',
  'security',
  'agents',
  'realworld',
  'games',
  'nfts',
  'memecoins',
  'social',
  'open'
]);
const ALLOWED_KEYS = new Set([
  'requestId',
  'projectName',
  'leadName',
  'email',
  'size',
  'tracks',
  'nearAddress',
  'projectUrl',
  'demoUrl',
  'idea',
  'consent'
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEAR_ADDR_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

const targetArg = process.argv[2] || 'submission-payload.json';
const filePath = path.resolve(process.cwd(), targetArg);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  console.error('Copy submission-template.json to submission-payload.json and fill in your real details first.');
  process.exit(1);
}

const raw = fs.readFileSync(filePath, 'utf8');
const byteLength = Buffer.byteLength(raw, 'utf8');
const payload = JSON.parse(raw);

const errors = [];

if (byteLength > 12000) {
  errors.push(`Payload exceeds 12000 bytes (got ${byteLength}).`);
}

for (const key of Object.keys(payload)) {
  if (!ALLOWED_KEYS.has(key)) {
    errors.push(`Unexpected field "${key}". Do not add extra fields (especially "website", which triggers spam rejection).`);
  }
}
for (const reqKey of ALLOWED_KEYS) {
  if (!(reqKey in payload)) {
    errors.push(`Missing required field "${reqKey}".`);
  }
}

if (typeof payload.requestId !== 'string' || !UUID_RE.test(payload.requestId)) {
  errors.push('requestId must be a valid UUID.');
}
if (typeof payload.projectName !== 'string' || payload.projectName.length < 2 || payload.projectName.length > 80) {
  errors.push('projectName must be 2-80 characters.');
}
if (
  typeof payload.leadName !== 'string' ||
  payload.leadName.length < 2 ||
  payload.leadName.length > 80 ||
  payload.leadName.includes('REPLACE_')
) {
  errors.push('leadName must be 2-80 characters and contain your real name.');
}
if (
  typeof payload.email !== 'string' ||
  payload.email.length > 160 ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
  payload.email.includes('REPLACE_')
) {
  errors.push('email must be a valid unique email (max 160 chars).');
}
if (!ALLOWED_SIZES.has(payload.size)) {
  errors.push(`size must be one of: ${Array.from(ALLOWED_SIZES).join(', ')}`);
}
if (!Array.isArray(payload.tracks) || payload.tracks.length === 0) {
  errors.push('tracks must be a non-empty array.');
} else {
  const seen = new Set();
  for (const t of payload.tracks) {
    if (!ALLOWED_TRACKS.has(t)) errors.push(`Invalid track id: ${t}`);
    if (seen.has(t)) errors.push(`Duplicate track id: ${t}`);
    seen.add(t);
  }
}
if (
  typeof payload.nearAddress !== 'string' ||
  payload.nearAddress.length < 2 ||
  payload.nearAddress.length > 64 ||
  !NEAR_ADDR_RE.test(payload.nearAddress) ||
  payload.nearAddress.includes('REPLACE_')
) {
  errors.push('nearAddress must be a lowercase 2-64 char NEAR mainnet account matching HACKATHON.md regex.');
}
for (const urlField of ['projectUrl', 'demoUrl']) {
  const val = payload[urlField];
  if (
    typeof val !== 'string' ||
    val.length > 300 ||
    !/^https?:\/\/.+/i.test(val) ||
    val.includes('REPLACE_')
  ) {
    errors.push(`${urlField} must be a valid http(s) URL (max 300 chars) without placeholders.`);
  }
}
if (typeof payload.idea !== 'string' || payload.idea.length < 20 || payload.idea.length > 2000) {
  errors.push('idea must be 20-2000 characters.');
}
if (payload.consent !== true) {
  errors.push('consent must be boolean true after reading and agreeing to the contact notice.');
}

if (errors.length > 0) {
  console.error('❌ Submission payload validation failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log('✅ Submission payload matches HACKATHON.md API contract!');
console.log(`   Payload size: ${byteLength} / 12000 bytes`);
console.log(`   Idea length:  ${payload.idea.length} / 2000 chars`);
console.log(`   Tracks (${payload.tracks.length}): ${payload.tracks.join(', ')}`);

