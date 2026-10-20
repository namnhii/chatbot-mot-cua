import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const googleKey = process.env.GOOGLE_API_KEY?.trim();
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (supabaseUrl && supabaseUrl.endsWith('/rest/v1/')) supabaseUrl = supabaseUrl.slice(0, -9);
else if (supabaseUrl && supabaseUrl.endsWith('/rest/v1')) supabaseUrl = supabaseUrl.slice(0, -8);
if (supabaseUrl && supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1);

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(googleKey);

console.log('====================================================');
console.log('📊 ĐO THỜI GIAN TỪNG CHẶNG CỦA HỆ THỐNG RAG');
console.log('====================================================\n');

const sampleQuestion = 'Tôi muốn làm giấy khai sinh cho con thì đầu tiên phải chuẩn bị giấy tờ gì?';
const sampleFollowUp = 'Thế lệ phí bao nhiêu và mấy ngày có kết quả?';
const sampleHistory = [
  { role: 'user', content: sampleQuestion },
  { role: 'assistant', content: 'Chào bác, để làm khai sinh cần Giấy chứng sinh, đăng ký kết hôn...' }
];

// CHẶNG 1: CONDENSE QUESTION
console.log('--- 1. CHẶNG CONDENSE QUESTION ---');
const t0 = performance.now();
const condenseModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
  generationConfig: {
    // Tắt thinking nếu có
    thinkingConfig: { thinkingBudget: 0 }
  }
});
const condensePrompt = `Lịch sử:
Người dân: ${sampleQuestion}
Cán bộ: Chào bác, để làm khai sinh cần Giấy chứng sinh...

Câu hỏi tiếp theo: "${sampleFollowUp}"
Viết lại thành câu hỏi độc lập, đủ ngữ cảnh thủ tục:`;

let condensedText = '';
try {
  const cRes = await condenseModel.generateContent(condensePrompt);
  condensedText = cRes.response.text().trim();
} catch (e) {
  condensedText = e.message;
}
const t1 = performance.now();
const condenseDuration = (t1 - t0).toFixed(0);
console.log(`⏱️ Thời gian Condense Question: ${condenseDuration} ms`);
console.log(`Kết quả: "${condensedText}"\n`);

// CHẶNG 2: EMBEDDING MODEL
console.log('--- 2. CHẶNG EMBEDDING (gemini-embedding-001) ---');
const t2 = performance.now();
const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
const embedRes = await embedModel.embedContent({
  content: { parts: [{ text: sampleQuestion }] },
  outputDimensionality: 768
});
const queryVector = embedRes.embedding.values;
const t3 = performance.now();
const embedDuration = (t3 - t2).toFixed(0);
console.log(`⏱️ Thời gian tạo Embedding: ${embedDuration} ms (Vector: ${queryVector.length} chiều)\n`);

// CHẶNG 3: TRUY VẤN SUPABASE
console.log('--- 3. CHẶNG TRUY VẤN VECTOR SUPABASE ---');
const t4 = performance.now();
const { data: matchedDocs, error: matchError } = await supabase.rpc('match_documents', {
  query_embedding: queryVector,
  match_count: 5,
  filter: {}
});
const t5 = performance.now();
const supabaseDuration = (t5 - t4).toFixed(0);
console.log(`⏱️ Thời gian truy vấn Supabase RPC: ${supabaseDuration} ms (Tìm thấy: ${matchedDocs?.length} đoạn)\n`);

const contextText = (matchedDocs || []).map(d => d.content).join('\n---\n');

// CHẶNG 4: SO SÁNH CÁC MODEL CHAT (STREAMING, TTFT, TOTAL TIME)
console.log('--- 4. CHẶNG SINH CÂU TRẢ LỜI (STREAMING & TTFT) ---');

const testModels = [
  { name: 'gemini-2.5-flash-lite', thinking: 0 },
  { name: 'gemini-3.8-flash', thinking: 0 },
  { name: 'gemini-3.8-flash (mặc định thinking)', thinking: undefined },
];

for (const m of testModels) {
  console.log(`\nKiểm thử Model: ${m.name}...`);
  const genConfig = m.thinking !== undefined ? { thinkingConfig: { thinkingBudget: m.thinking } } : {};
  const chatModel = genAI.getGenerativeModel({
    model: m.name.split(' ')[0],
    generationConfig: genConfig,
    systemInstruction: 'Bạn là cán bộ Một cửa. Trả lời ngắn gọn, rành mạch từng bước.'
  });

  const prompt = `TÀI LIỆU:\n${contextText}\n\nCÂU HỎI:\n${sampleQuestion}\n\nTrả lời:`;

  const startGen = performance.now();
  let firstTokenTime = null;
  let answerLength = 0;

  try {
    const streamRes = await chatModel.generateContentStream(prompt);
    for await (const chunk of streamRes.stream) {
      if (!firstTokenTime) {
        firstTokenTime = performance.now();
      }
      answerLength += chunk.text().length;
    }
    const endGen = performance.now();
    const ttft = (firstTokenTime - startGen).toFixed(0);
    const totalGen = (endGen - startGen).toFixed(0);
    console.log(`  ⏱️ Token đầu tiên (TTFT): ${ttft} ms`);
    console.log(`  ⏱️ Tổng thời gian sinh câu trả lời: ${totalGen} ms (Độ dài: ${answerLength} ký tự)`);
  } catch (err) {
    console.error(`  ❌ Lỗi khi test ${m.name}:`, err.message);
  }
}
