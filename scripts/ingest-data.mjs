import fs from 'node:fs';
import path from 'node:path';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
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

if (!googleKey || !supabaseUrl || !supabaseKey) {
  console.error('❌ Thiếu biến môi trường trong .env.local!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(googleKey);
const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

const docsDir = './docs';

console.log('========================================================');
console.log('🚀 BẮT ĐẦU QUY TRÌNH NẠP TÀI LIỆU PDF VÀO SUPABASE');
console.log('Embedding Model: gemini-embedding-001 (768 chiều)');
console.log('========================================================\n');

if (!fs.existsSync(docsDir)) {
  console.error(`❌ Thư mục ${docsDir} không tồn tại!`);
  process.exit(1);
}

const allFiles = fs.readdirSync(docsDir);
const pdfFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));

if (pdfFiles.length === 0) {
  console.log(`ℹ️ Không tìm thấy file PDF nào trong ${docsDir}.`);
  process.exit(0);
}

console.log(`Tìm thấy ${pdfFiles.length} file PDF cần xử lý:\n${pdfFiles.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}\n`);

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 900,
  chunkOverlap: 150,
  separators: ['\n\n', '\n', '. ', '; ', ' ']
});

let grandTotalChunks = 0;

for (let fileIdx = 0; fileIdx < pdfFiles.length; fileIdx++) {
  const fileName = pdfFiles[fileIdx];
  const filePath = path.join(docsDir, fileName);
  console.log(`--------------------------------------------------------`);
  console.log(`📄 [${fileIdx + 1}/${pdfFiles.length}] Đang xử lý: "${fileName}"`);

  // 1. Xóa các vector cũ của file này nếu có (Purge on re-ingest)
  console.log(`  -> Đang kiểm tra và xóa dữ liệu cũ của file "${fileName}" trên Supabase...`);
  const { error: purgeError } = await supabase
    .from('documents')
    .delete()
    .filter('metadata->>fileName', 'eq', fileName);

  if (purgeError) {
    console.warn(`  ⚠️ Cảnh báo khi xóa dữ liệu cũ: ${purgeError.message}`);
  } else {
    console.log(`  -> Đã làm sạch dữ liệu cũ của file này thành công.`);
  }

  // 2. Đọc nội dung file PDF
  console.log(`  -> Đang trích xuất văn bản từ file PDF...`);
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  const fullText = pdfData.text || '';
  const numPages = pdfData.numpages || 1;
  console.log(`  -> Trích xuất hoàn tất: ${numPages} trang, ${fullText.length} ký tự.`);

  if (fullText.trim().length === 0) {
    console.warn(`  ⚠️ File "${fileName}" không có văn bản có thể đọc được (có thể là file scan ảnh thuần). Bỏ qua.`);
    continue;
  }

  // 3. Phân đoạn văn bản (Chunking)
  const chunks = await textSplitter.splitText(fullText);
  console.log(`  -> Đã chia thành ${chunks.length} đoạn ngữ nghĩa (chunks).`);

  // 4. Tạo vector embedding theo đợt (batch) và chèn vào Supabase
  const BATCH_SIZE = 25;
  console.log(`  -> Đang tạo vector 768 chiều và lưu vào Supabase (mỗi đợt ${BATCH_SIZE} đoạn)...`);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batchChunks = chunks.slice(i, i + BATCH_SIZE);
    
    // Tạo request batch embedding cho Gemini
    const requests = batchChunks.map(chunkText => ({
      content: { parts: [{ text: chunkText }] },
      outputDimensionality: 768
    }));

    try {
      const embedResponse = await embeddingModel.batchEmbedContents({ requests });
      const embeddings = embedResponse.embeddings;

      // Chuẩn bị dữ liệu chèn vào Supabase
      const rowsToInsert = batchChunks.map((chunkText, idx) => ({
        content: chunkText,
        metadata: {
          fileName: fileName,
          source: filePath,
          pageCount: numPages,
          chunkIndex: i + idx,
          totalChunks: chunks.length,
          ingestedAt: new Date().toISOString()
        },
        embedding: embeddings[idx].values
      }));

      const { error: insertError } = await supabase.from('documents').insert(rowsToInsert);
      if (insertError) {
        throw new Error(`Lỗi khi chèn dữ liệu vào Supabase: ${insertError.message}`);
      }

      process.stdout.write(`    Đã nạp ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} đoạn...\r`);
    } catch (batchErr) {
      console.error(`\n  ❌ Lỗi ở đợt ${i} - ${i + batchChunks.length}:`, batchErr.message);
      // Chờ 2 giây nếu chạm rate limit và thử lại đợt này
      await new Promise(r => setTimeout(r, 2000));
      i -= BATCH_SIZE; // thử lại
      continue;
    }

    // Nghỉ nhẹ 300ms giữa các đợt để đảm bảo an toàn hạn mức
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n  ✅ Nạp thành công toàn bộ ${chunks.length} đoạn của file "${fileName}"!`);
  grandTotalChunks += chunks.length;
}

console.log(`\n========================================================`);
console.log(`🎉 HOÀN TẤT NẠP TÀI LIỆU! Tổng cộng: ${grandTotalChunks} đoạn vector đã sẵn sàng trên Supabase.`);
console.log(`========================================================\n`);
