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

// Kiểm tra danh sách file đã có sẵn trên Supabase
const { data: existingData } = await supabase.from('documents').select('metadata->fileName');
const existingFiles = new Set((existingData || []).map(r => r.fileName));

console.log(`Tìm thấy ${pdfFiles.length} file PDF trong thư mục docs/:`);
pdfFiles.forEach((f, i) => {
  const isDone = existingFiles.has(f);
  console.log(`  ${i + 1}. ${f} ${isDone ? ' [ĐÃ CÓ TRÊN DATABASE - BỎ QUA]' : ' [MỚI - SẼ NẠP]'}`);
});
console.log('');

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 900,
  chunkOverlap: 150,
  separators: ['\n\n', '\n', '. ', '; ', ' ']
});

let grandTotalChunks = 0;

for (let fileIdx = 0; fileIdx < pdfFiles.length; fileIdx++) {
  const fileName = pdfFiles[fileIdx];
  const filePath = path.join(docsDir, fileName);

  // Nếu file đã được nạp trước đó, bỏ qua để tiết kiệm hạn mức
  if (existingFiles.has(fileName) && !process.argv.includes('--force')) {
    continue;
  }

  console.log(`--------------------------------------------------------`);
  console.log(`📄 [${fileIdx + 1}/${pdfFiles.length}] Đang xử lý: "${fileName}"`);

  // Đọc nội dung file PDF
  console.log(`  -> Đang trích xuất văn bản từ file PDF...`);
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  // Loại bỏ các ký tự null byte (\u0000) gây lỗi PostgreSQL
  const fullText = (pdfData.text || '').replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  const numPages = pdfData.numpages || 1;
  console.log(`  -> Trích xuất hoàn tất: ${numPages} trang, ${fullText.length} ký tự.`);

  if (fullText.trim().length === 0) {
    console.warn(`  ⚠️ File "${fileName}" không có văn bản có thể đọc được. Bỏ qua.`);
    continue;
  }

  // Phân đoạn văn bản (Chunking)
  const chunks = (await textSplitter.splitText(fullText)).map(c => c.replace(/\u0000/g, ''));
  console.log(`  -> Đã chia thành ${chunks.length} đoạn ngữ nghĩa (chunks).`);

  // Tạo vector embedding theo đợt (batch)
  const BATCH_SIZE = 15;
  console.log(`  -> Đang tạo vector 768 chiều và lưu vào Supabase...`);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batchChunks = chunks.slice(i, i + BATCH_SIZE);

    const requests = batchChunks.map(chunkText => ({
      content: { parts: [{ text: chunkText }] },
      outputDimensionality: 768
    }));

    let retryCount = 0;
    while (retryCount < 5) {
      try {
        const embedResponse = await embeddingModel.batchEmbedContents({ requests });
        const embeddings = embedResponse.embeddings;

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

        console.log(`    ✓ Đã nạp ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} đoạn...`);
        break; // Thành công, thoát vòng lặp retry
      } catch (batchErr) {
        retryCount++;
        if (batchErr.message.includes('429') || batchErr.message.includes('quota') || batchErr.message.includes('Quota')) {
          console.warn(`\n  ⏳ Chạm giới hạn 100 requests/phút của Gemini API. Đang tự động nghỉ 60 giây để phục hồi hạn mức...`);
          await new Promise(r => setTimeout(r, 62000));
          console.log(`  🔄 Tiếp tục nạp đợt này...`);
        } else {
          console.error(`\n  ❌ Lỗi ở đợt ${i} - ${i + batchChunks.length} (Lần thử ${retryCount}/5):`, batchErr.message);
          if (retryCount >= 5) {
            console.error(`  ⚠️ Bỏ qua đợt này sau 5 lần thử thất bại.`);
            break;
          }
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    // Nghỉ nhẹ 1000ms giữa các đợt để không bị dồn request
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`  ✅ Nạp thành công toàn bộ ${chunks.length} đoạn của file "${fileName}"!`);
  grandTotalChunks += chunks.length;
}

console.log(`\n========================================================`);
console.log(`🎉 HOÀN TẤT NẠP TÀI LIỆU! Tổng cộng đã nạp thêm: ${grandTotalChunks} đoạn vector lên Supabase.`);
console.log(`========================================================\n`);
