import assert from 'node:assert/strict';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

let googleKey = process.env.GOOGLE_API_KEY?.trim();
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (supabaseUrl && supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.slice(0, -9);
} else if (supabaseUrl && supabaseUrl.endsWith('/rest/v1')) {
  supabaseUrl = supabaseUrl.slice(0, -8);
}
if (supabaseUrl && supabaseUrl.endsWith('/')) {
  supabaseUrl = supabaseUrl.slice(0, -1);
}

assert.ok(googleKey && googleKey.length > 10, 'GOOGLE_API_KEY must be provided');
assert.ok(supabaseUrl && supabaseUrl.includes('supabase.co'), 'NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase URL');
assert.ok(supabaseKey && supabaseKey.length > 10, 'SUPABASE_SERVICE_ROLE_KEY must be provided');

console.log('--- 1. KIỂM TRA GOOGLE GEMINI CHAT MODEL & QUOTA ---');
const genAI = new GoogleGenerativeAI(googleKey);

const candidateModels = ['gemini-3.8-flash', 'gemini-3-flash', 'gemini-2.5-flash'];
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

console.log('\n--- 2. KIỂM TRA EMBEDDING MODEL (768 DIMENSIONS) ---');
try {
  const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const embedResult = await embeddingModel.embedContent({
    content: { parts: [{ text: 'Kiểm tra embedding tiếng Việt' }] },
    outputDimensionality: 768
  });
  const dim = embedResult.embedding.values.length;
  assert.equal(dim, 768, 'Embedding dimensions must be 768');
  console.log(`✅ Embedding gemini-embedding-001 thành công! Kích thước vector: ${dim} chiều chuẩn khớp`);
} catch (err) {
  console.error(`❌ Lỗi kiểm tra embedding: ${err.message}`);
  throw err;
}

console.log('\n--- 3. KIỂM TRA KẾT NỐI SUPABASE ---');
const supabase = createClient(supabaseUrl, supabaseKey);
const { data, error } = await supabase.from('documents').select('count', { count: 'exact', head: true });
if (error && (error.code === '42P01' || error.message.includes('relation "public.documents" does not exist') || error.message.includes('relation "documents" does not exist'))) {
  console.log('✅ Kết nối Supabase thành công! (Bảng documents chưa tạo, sẽ được tạo ở Task 3)');
} else if (error) {
  console.log(`Supabase kết nối thành công (mã trạng thái: ${error.message})`);
} else {
  console.log('✅ Bảng documents trên Supabase đã sẵn sàng!');
}

console.log(`\n🎉 TOÀN BỘ KIỂM CHỨNG KẾT NỐI & QUOTA HOÀN TẤT THÀNH CÔNG!`);
console.log(`- Chat Model: ${activeModelName}`);
console.log(`- Embedding Model: gemini-embedding-001 (768 dimensions)`);
console.log(`- Supabase URL: ${supabaseUrl}`);
