import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('--- TEST TASK 4: KIỂM TRA DỮ LIỆU ĐÃ NẠP TRÊN SUPABASE ---');

const { data, error } = await supabase.from('documents')
  .select('id, content, metadata')
  .limit(5);

assert.equal(error, null, error?.message);
assert.ok(data && data.length > 0, 'Chưa tìm thấy dữ liệu nào trong bảng documents! Cần chạy script nạp tài liệu.');

console.log(`✅ Đã tìm thấy ${data.length} đoạn trích mẫu trong CSDL.`);
console.log('Mẫu metadata:', data[0].metadata);
assert.ok(data[0].content && data[0].content.length > 20, 'Nội dung đoạn trích quá ngắn hoặc rỗng');

console.log('🎉 TASK 4 INGESTION TEST PASSED!');
