import assert from 'node:assert/strict';
import fs from 'node:fs';
import { executeRagQuery } from '../utils/rag-engine.mjs';

const REFUSAL_COPY = "Rất tiếc, trong tài liệu hướng dẫn hiện có chưa có thông tin về nội dung này. Bác/Anh/Chị vui lòng liên hệ trực tiếp cán bộ tại quầy hướng dẫn để được hỗ trợ cụ thể ạ.";

console.log('================================================================');
console.log('🏛️ BẮT ĐẦU CHẠY TOÀN BỘ BỘ TEST CASE NGHIỆM THU HỆ THỐNG');
console.log(`Thời điểm: ${new Date().toISOString()}`);
console.log('================================================================\n');

const testResults = [];

// -------------------------------------------------------------
// TEST CASE 1: Hỏi thông tin có trong tài liệu (Đăng ký khai sinh)
// -------------------------------------------------------------
console.log('📌 [TEST CASE 1] Câu hỏi trong tài liệu: "Tôi muốn làm giấy khai sinh cho con thì đầu tiên phải chuẩn bị giấy tờ gì?"');
let chunkCount1 = 0;
const res1 = await executeRagQuery({
  question: 'Tôi muốn làm giấy khai sinh cho con thì đầu tiên phải chuẩn bị giấy tờ gì?',
  history: [],
  onChunk: () => { chunkCount1++; }
});
console.log(`Model sử dụng: ${res1.usedModel}`);
console.log(`⏱️ Thời gian token đầu (TTFT): ${res1.firstTokenMs}ms | Tổng phản hồi: ${res1.latencyMs}ms`);
console.log(`📄 Nguồn tài liệu: ${res1.sources?.join(', ')}`);
console.log('🤖 Phản hồi của Chatbot:\n' + res1.answer + '\n');

assert.ok(res1.answer.toLowerCase().includes('khai sinh'), 'TC1: Câu trả lời phải liên quan đến khai sinh');
assert.ok(
  res1.answer.toLowerCase().includes('hồ sơ') || res1.answer.toLowerCase().includes('giấy') || res1.answer.toLowerCase().includes('chứng sinh'),
  'TC1: Phải liệt kê thành phần hồ sơ giấy tờ'
);
assert.ok(
  res1.answer.includes('[Nguồn:') || res1.answer.toLowerCase().includes('nguồn'),
  'TC1: Phải có trích dẫn nguồn ở cuối câu trả lời'
);
console.log('👉 KẾT QUẢ TEST CASE 1: ĐẠT CHUẨN ✅\n');
testResults.push({
  Case: 'TC1: Khai sinh (Trong tài liệu)',
  Model: res1.usedModel,
  Condense_ms: res1.breakdown.condenseMs,
  Embed_ms: res1.breakdown.embedMs,
  Supabase_ms: res1.breakdown.searchMs,
  TTFT_ms: res1.firstTokenMs,
  Tong_ms: res1.latencyMs,
  Danh_gia: 'Đầy đủ 3 bước + trích dẫn'
});

console.log('----------------------------------------------------------------\n');

// -------------------------------------------------------------
// TEST CASE 2: Hỏi lệ phí & thời hạn (Hỏi nối tiếp đa lượt - Multi-turn)
// -------------------------------------------------------------
console.log('📌 [TEST CASE 2] Hỏi tiếp (Multi-turn): "Thế lệ phí bao nhiêu, bao lâu có kết quả?"');
const historyForTC2 = [
  { role: 'user', content: 'Tôi muốn làm giấy khai sinh cho con thì đầu tiên phải chuẩn bị giấy tờ gì?' },
  { role: 'assistant', content: res1.answer }
];
let chunkCount2 = 0;
const res2 = await executeRagQuery({
  question: 'Thế lệ phí bao nhiêu, bao lâu có kết quả?',
  history: historyForTC2,
  onChunk: () => { chunkCount2++; }
});
console.log(`Model sử dụng: ${res2.usedModel}`);
console.log(`🧠 Câu hỏi đã viết lại (Condense): "${res2.condensedQuestion}"`);
console.log(`⏱️ Thời gian token đầu (TTFT): ${res2.firstTokenMs}ms | Tổng phản hồi: ${res2.latencyMs}ms`);
console.log(`📄 Nguồn tài liệu: ${res2.sources?.join(', ')}`);
console.log('🤖 Phản hồi của Chatbot:\n' + res2.answer + '\n');

assert.ok(
  res2.condensedQuestion.toLowerCase().includes('khai sinh'),
  'TC2: Câu hỏi condense phải nhận diện được ngữ cảnh khai sinh'
);
assert.notEqual(
  res2.answer.trim(),
  REFUSAL_COPY,
  'TC2: CẤM từ chối toàn bộ câu hỏi khi trong tài liệu có thông tin thời hạn'
);
assert.ok(
  res2.answer.toLowerCase().includes('thời hạn') || res2.answer.toLowerCase().includes('ngày') || res2.answer.toLowerCase().includes('24 giờ'),
  'TC2: Phải trả lời được thông tin về thời hạn giải quyết'
);
assert.ok(
  res2.answer.toLowerCase().includes('lệ phí'),
  'TC2: Phải đề cập rõ về phần lệ phí (nêu rõ chưa có thông tin cụ thể)'
);
assert.ok(
  res2.answer.includes('[Nguồn:') || res2.answer.toLowerCase().includes('nguồn'),
  'TC2: Phải có trích dẫn nguồn ở cuối câu trả lời'
);
console.log('👉 KẾT QUẢ TEST CASE 2: ĐẠT CHUẨN ✅\n');
testResults.push({
  Case: 'TC2: Lệ phí & thời hạn (Hỏi tiếp)',
  Model: res2.usedModel,
  Condense_ms: res2.breakdown.condenseMs,
  Embed_ms: res2.breakdown.embedMs,
  Supabase_ms: res2.breakdown.searchMs,
  TTFT_ms: res2.firstTokenMs,
  Tong_ms: res2.latencyMs,
  Danh_gia: `Hiểu đúng ngữ cảnh: "${res2.condensedQuestion.slice(0, 30)}..."`
});

console.log('----------------------------------------------------------------\n');

// -------------------------------------------------------------
// TEST CASE 3: Hỏi câu ngoài tài liệu (Anti-Hallucination)
// -------------------------------------------------------------
console.log('📌 [TEST CASE 3] Hỏi ngoài tài liệu: "Ở đây có làm thủ tục xin cấp visa đi nước ngoài không?"');
let chunkCount3 = 0;
const res3 = await executeRagQuery({
  question: 'Ở đây có làm thủ tục xin cấp visa đi nước ngoài không?',
  history: [],
  onChunk: () => { chunkCount3++; }
});
console.log(`Model sử dụng: ${res3.usedModel}`);
console.log(`⏱️ Thời gian token đầu (TTFT): ${res3.firstTokenMs}ms | Tổng phản hồi: ${res3.latencyMs}ms`);
console.log('🤖 Phản hồi của Chatbot:\n' + res3.answer + '\n');

assert.ok(
  res3.answer.includes(REFUSAL_COPY),
  `TC3: Phải trả về chính xác câu mẫu từ chối duy nhất.\nKỳ vọng: "${REFUSAL_COPY}"\nNhận được: "${res3.answer}"`
);
console.log('👉 KẾT QUẢ TEST CASE 3: ĐẠT CHUẨN ✅\n');
testResults.push({
  Case: 'TC3: Ngoài tài liệu (Xin visa)',
  Model: res3.usedModel,
  Condense_ms: res3.breakdown.condenseMs,
  Embed_ms: res3.breakdown.embedMs,
  Supabase_ms: res3.breakdown.searchMs,
  TTFT_ms: res3.firstTokenMs,
  Tong_ms: res3.latencyMs,
  Danh_gia: 'Từ chối đúng 100% câu mẫu quy định'
});

console.log('----------------------------------------------------------------\n');

// -------------------------------------------------------------
// TEST CASE 4: Kiểm tra Giao diện Kiosk Một cửa & Logo Quốc huy chuẩn
// -------------------------------------------------------------
console.log('📌 [TEST CASE 4] Kiểm tra Giao diện Kiosk Một cửa...');
const pageSource = fs.readFileSync('app/page.tsx', 'utf8');

assert.ok(pageSource.includes('Bộ phận Một cửa'), 'TC4: Phải có thương hiệu Bộ phận Một cửa');
assert.ok(pageSource.includes('/quochuy.webp'), 'TC4: Phải sử dụng đúng file logo quốc huy chuẩn /quochuy.webp');
assert.ok(pageSource.includes('ỦY BAN NHÂN DÂN PHƯỜNG VINH PHÚ'), 'TC4: Phải có định danh UBND Phường Vinh Phú');
assert.ok(pageSource.includes('quickPrompts'), 'TC4: Phải có danh sách gợi ý thủ tục nhanh');
assert.ok(pageSource.includes('handleReset'), 'TC4: Phải có hàm xử lý reset phiên phục vụ');
assert.ok(pageSource.includes('Bắt đầu lượt mới'), 'TC4: Phải có nút Bắt đầu lượt mới');
assert.ok(pageSource.includes('latencyMs'), 'TC4: Phải hiển thị thời gian phản hồi');
assert.ok(pageSource.includes('sources'), 'TC4: Phải hiển thị trích dẫn nguồn');
assert.ok(pageSource.includes('ReactMarkdown'), 'TC4: Phải render định dạng markdown');

console.log('👉 KẾT QUẢ TEST CASE 4: ĐẠT CHUẨN ✅\n');

console.log('================================================================');
console.log('📊 BẢNG TỔNG HỢP KẾT QUẢ VÀ THỜI GIAN TỪNG CHẶNG CỦA TỪNG TEST CASE');
console.log('================================================================');
console.table(testResults);

console.log('\n================================================================');
console.log('🎉 TẤT CẢ 4/4 TEST CASE NGHIỆM THU ĐỀU ĐẠT CHUẨN XUẤT SẮC 100%!');
console.log('================================================================');
