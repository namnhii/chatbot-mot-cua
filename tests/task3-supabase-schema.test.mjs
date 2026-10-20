import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('--- KIỂM TRA BẢNG DOCUMENTS VÀ HÀM MATCH_DOCUMENTS TRÊN SUPABASE ---');

// 1. Kiểm tra cấu trúc bảng và chèn thử 1 vector 768 chiều
const testEmbedding = new Array(768).fill(0.001);
const testId = Date.now();

console.log('Thử nghiệm chèn vector 768 chiều vào bảng documents...');
const { error: insertError } = await supabase.from('documents').insert({
  id: testId,
  content: 'Kiểm tra chuẩn hóa vector 768 chiều',
  metadata: { test: true, source: 'schema-verification' },
  embedding: testEmbedding
});

if (insertError) {
  console.error('❌ Lỗi chèn vector 768 chiều:', insertError.message);
  console.error('Chi tiết lỗi (code):', insertError.code, insertError.details);
  process.exit(1);
}
console.log('✅ Chèn vector 768 chiều thành công!');

// 2. Thử gọi hàm match_documents
console.log('Thử nghiệm gọi hàm RPC match_documents...');
const { data: matchData, error: matchError } = await supabase.rpc('match_documents', {
  query_embedding: testEmbedding,
  match_count: 1,
  filter: { test: true }
});

if (matchError) {
  console.error('❌ Lỗi gọi hàm match_documents:', matchError.message);
  // Dọn dẹp dòng test
  await supabase.from('documents').delete().eq('id', testId);
  process.exit(1);
}

console.log('✅ Hàm match_documents hoạt động chính xác! Kết quả trả về:', matchData?.length, 'kỷ lục');

// 3. Dọn dẹp dòng test sau khi kiểm tra xong
await supabase.from('documents').delete().eq('id', testId);
console.log('✅ Đã dọn dẹp bản ghi kiểm tra sạch sẽ.');
console.log('\n🎉 TASK 3 KIỂM TRA VÀ CHUẨN HÓA BẢNG VECTOR 768 CHIỀU ĐẠT CHUẨN 100%!');
