import assert from 'node:assert/strict';
import fs from 'node:fs';

const pageContent = fs.readFileSync('app/page.tsx', 'utf8');
assert.ok(pageContent.includes('Bộ phận Một cửa'), 'Missing header branding for Bo phan Mot cua');
assert.ok(pageContent.includes('khai sinh'), 'Missing quick button for Khai sinh');
assert.ok(pageContent.includes('Bắt đầu lượt mới'), 'Missing reset button for Kiosk');
assert.ok(pageContent.includes('sources'), 'Missing source citation rendering');
assert.ok(pageContent.includes('latencyMs'), 'Missing latency display');
console.log('Task 6 UI components verification PASSED 100%');
