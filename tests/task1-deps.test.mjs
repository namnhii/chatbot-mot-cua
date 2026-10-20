import assert from 'node:assert/strict';
import fs from 'node:fs';

assert.ok(fs.existsSync('./package.json'), 'package.json does not exist yet');
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
assert.ok(pkg.dependencies['@langchain/google-genai'], 'Missing @langchain/google-genai dependency');
assert.ok(pkg.dependencies['@supabase/supabase-js'], 'Missing @supabase/supabase-js dependency');
assert.ok(pkg.dependencies['pdf-parse'], 'Missing pdf-parse dependency');
console.log('Task 1 dependencies check PASSED');
