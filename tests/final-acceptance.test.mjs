import assert from 'node:assert/strict';
import fs from 'node:fs';
import { executeRagQuery } from '../utils/rag-engine.mjs';

const REFUSAL_COPY = "Rất tiếc, trong tài liệu hướng dẫn hiện có chưa có thông tin về nội dung này. Bác/Anh/Chị vui lòng liên hệ trực tiếp cán bộ tại quầy hướng dẫn để được hỗ trợ cụ thể ạ.";

console.log('================================================================');
console.log('🏛️ BẮT ĐẦU CHẠY 4 TEST CASE NGHIỆM THU HỆ THỐNG CHATBOT MỘT CỬA');
console.log('================================================================\n');

// -------------------------------------------------------------
// TEST CASE 1: Hỏi thông tin có trong tài liệu (Đăng ký khai sinh)
// -------------------------------------------------------------
console.log('📌 [TEST CASE 1] Hỏi: "Tôi muốn làm giấy khai sinh cho con thì đầu tiên phải chuẩn bị giấy tờ gì?"');
const tc1Start = Date.now();
const res1 = await executeRagQuery({
  question: 'Tôi muốn làm giấy khai sinh cho con thì đầu tiên phải chuẩn bị giấy tờ gì?',
  history: []
});
console.log(`⏱️ Thời gian phản hồi: ${res1.latencyMs}ms`);
console.log(`📄 Nguồn tài liệu tìm thấy: ${res1.sources?.join(', ')}`);
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
console.log('----------------------------------------------------------------\n');

// -------------------------------------------------------------
// TEST CASE 2: Hỏi lệ phí & thời hạn (Hỏi nối tiếp đa lượt - Multi-turn)
// -------------------------------------------------------------
console.log('📌 [TEST CASE 2] Hỏi tiếp (Multi-turn): "Thế lệ phí bao nhiêu và mấy ngày có kết quả?"');
const historyForTC2 = [
  { role: 'user', content: 'Tôi muốn làm giấy khai sinh cho con thì đầu tiên phải chuẩn bị giấy tờ gì?' },
  { role: 'assistant', content: res1.answer }
];
const res2 = await executeRagQuery({
  question: 'Thế lệ phí bao nhiêu và mấy ngày có kết quả?',
  history: historyForTC2
});
console.log(`🧠 Câu hỏi đã viết lại theo ngữ cảnh: "${res2.condensedQuestion}"`);
console.log(`⏱️ Thời gian phản hồi: ${res2.latencyMs}ms`);
console.log(`📄 Nguồn tài liệu tìm thấy: ${res2.sources?.join(', ')}`);
console.log('🤖 Phản hồi của Chatbot:\n' + res2.answer + '\n');

assert.ok(
  res2.condensedQuestion.toLowerCase().includes('khai sinh'),
  'TC2: Câu hỏi condense phải nhận diện được ngữ cảnh khai sinh'
);
assert.ok(
  res2.answer.toLowerCase().includes('phí') || res2.answer.toLowerCase().includes('đồng') || res2.answer.toLowerCase().includes('miễn'),
  'TC2: Phải đề cập về lệ phí'
);
assert.ok(
  res2.answer.includes('[Nguồn:') || res2.answer.toLowerCase().includes('nguồn'),
  'TC2: Phải có trích dẫn nguồn ở cuối câu trả lời'
);
console.log('👉 KẾT QUẢ TEST CASE 2: ĐẠT CHUẨN ✅\n');
console.log('----------------------------------------------------------------\n');

// -------------------------------------------------------------
// TEST CASE 3: Hỏi câu ngoài tài liệu (Anti-Hallucination)
// -------------------------------------------------------------
console.log('📌 [TEST CASE 3] Hỏi ngoài tài liệu: "Ở đây có làm thủ tục xin cấp visa đi nước ngoài không?"');
const res3 = await executeRagQuery({
  question: 'Ở đây có làm thủ tục xin cấp visa đi nước ngoài không?',
  history: []
});
console.log(`⏱️ Thời gian phản hồi: ${res3.latencyMs}ms`);
console.log('🤖 Phản hồi của Chatbot:\n' + res3.answer + '\n');

assert.ok(
  res3.answer.includes(REFUSAL_COPY),
  `TC3: Phải trả về chính xác câu mẫu từ chối duy nhất.\nKỳ vọng: "${REFUSAL_COPY}"\nNhận được: "${res3.answer}"`
);
console.log('👉 KẾT QUẢ TEST CASE 3: ĐẠT CHUẨN ✅\n');
console.log('----------------------------------------------------------------\n');

// -------------------------------------------------------------
// TEST CASE 4: Kiểm tra Giao diện Kiosk Một cửa & Nút làm mới
// -------------------------------------------------------------
console.log('📌 [TEST CASE 4] Kiểm tra Giao diện Kiosk Phương án A & Logic Reset...');
const pageSource = fs.readFileSync('app/page.tsx', 'utf8');

assert.ok(pageSource.includes('Bộ phận Một cửa'), 'TC4: Phải có thương hiệu Bộ phận Một cửa');
assert.ok(pageSource.includes('quickPrompts'), 'TC4: Phải có danh sách gợi ý thủ tục nhanh');
assert.ok(pageSource.includes('handleReset'), 'TC4: Phải có hàm xử lý reset phiên phục vụ');
assert.ok(pageSource.includes('Bắt đầu lượt mới'), 'TC4: Phải có nút Bắt đầu lượt mới');
assert.ok(pageSource.includes('latencyMs'), 'TC4: Phải hiển thị thời gian phản hồi (độ trễ)');
assert.ok(pageSource.includes('sources'), 'TC4: Phải hiển thị trích dẫn nguồn văn bản');

console.log('👉 KẾT QUẢ TEST CASE 4: ĐẠT CHUẨN ✅\n');

console.log('================================================================');
console.log('🎉 TẤT CẢ 4/4 TEST CASE NGHIỆM THU ĐỀU ĐẠT CHUẨN XUẤT SẮC 100%!');
console.log('================================================================');
