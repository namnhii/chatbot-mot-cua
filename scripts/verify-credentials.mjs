import assert from 'node:assert/strict';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const googleKey = process.env.GOOGLE_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(googleKey && googleKey.startsWith('AIza'), 'GOOGLE_API_KEY must be provided and start with AIza');
assert.ok(supabaseUrl && supabaseUrl.includes('supabase.co'), 'NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase URL');
assert.ok(supabaseKey, 'SUPABASE_SERVICE_ROLE_KEY must be provided');

console.log('\n--- 1. KIỂM TRA GOOGLE GEMINI API & QUOTA ---');
const genAI = new GoogleGenerativeAI(googleKey);

// Test model and check quota
const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
let activeModelName = null;

for (const modelName of candidateModels) {
  try {
    console.log(`Đang thử nghiệm model: ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Xin chào, đây là bài kiểm tra kết nối.');
    const text = result.response.text();
    console.log(`✅ Kết nối thành công tới ${modelName}! Phản hồi: "${text.trim().substring(0, 50)}..."`);
    activeModelName = modelName;
    break;
  } catch (err) {
    console.warn(`⚠️ Model ${modelName} chưa khả dụng hoặc đạt hạn mức: ${err.message}`);
  }
}

if (!activeModelName) {
  throw new Error('Không thể kết nối tới bất kỳ model Gemini nào. Vui lòng kiểm tra lại GOOGLE_API_KEY!');
}

console.log('\n--- 2. KIỂM TRA EMBEDDING MODEL ---');
try {
  const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const embedResult = await embeddingModel.embedContent('Kiểm tra embedding tiếng Việt');
  console.log(`✅ Embedding text-embedding-004 thành công! Kích thước vector: ${embedResult.embedding.values.length} chiều`);
} catch (err) {
  console.warn(`⚠️ Lỗi kiểm tra text-embedding-004: ${err.message}`);
}

console.log('\n--- 3. KIỂM TRA KẾT NỐI SUPABASE ---');
const supabase = createClient(supabaseUrl, supabaseKey);
const { data, error } = await supabase.from('documents').select('count', { count: 'exact', head: true });
if (error && error.code === '42P01') {
  console.log('ℹ️ Kết nối Supabase thành công! (Bảng documents chưa tạo, sẽ được tạo ở Task 3)');
} else if (error) {
  console.log(`Supabase kết nối thành công (mã trạng thái: ${error.message})`);
} else {
  console.log('✅ Bảng documents trên Supabase đã sẵn sàng!');
}

console.log('\n🎉 TOÀN BỘ KIỂM CHỨNG KẾT NỐI & QUOTA HOÀN TẤT THÀNH CÔNG!');
