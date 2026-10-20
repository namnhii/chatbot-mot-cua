import assert from 'node:assert/strict';
import { executeRagQuery, condenseQuestion } from '../utils/rag-engine.mjs';

const refusalPhrase = "Rất tiếc, trong tài liệu hướng dẫn hiện có chưa có thông tin về nội dung này. Bác/Anh/Chị vui lòng liên hệ trực tiếp cán bộ tại quầy hướng dẫn để được hỗ trợ cụ thể ạ.";

console.log('--- TEST TASK 5: KIỂM TRA RAG ENGINE VÀ CONDENSE QUESTION ---');

// 1. Kiểm tra Condense Question (viết lại câu hỏi)
console.log('1. Kiểm tra Condense Question với ngữ cảnh lịch sử...');
const history = [
  { role: 'user', content: 'Tôi muốn làm giấy khai sinh cho con' },
  { role: 'assistant', content: 'Chào bác/anh/chị, để làm giấy khai sinh cho con cần chuẩn bị Giấy chứng sinh...' }
];
const followUp = 'thế lệ phí bao nhiêu và mấy ngày xong?';
const condensed = await condenseQuestion(followUp, history);
console.log(`Câu hỏi gốc: "${followUp}"`);
console.log(`Câu hỏi sau condense: "${condensed}"`);
assert.ok(
  condensed.toLowerCase().includes('khai sinh'),
  'Condense question phải bổ sung được ngữ cảnh khai sinh'
);
console.log('✅ Condense Question PASSED!\n');

// 2. Kiểm tra câu hỏi ngoài phạm vi tài liệu (Anti-Hallucination)
console.log('2. Kiểm tra câu hỏi ngoài tài liệu (Thủ tục xin visa)...');
const outOfScopeRes = await executeRagQuery({
  question: 'Ở đây có làm thủ tục xin cấp visa đi nước ngoài không?',
  history: []
});
console.log('Phản hồi:', outOfScopeRes.answer);
console.log(`Độ trễ: ${outOfScopeRes.latencyMs}ms`);
assert.ok(
  outOfScopeRes.answer.includes(refusalPhrase),
  `Bắt buộc phải trả lời đúng câu mẫu từ chối duy nhất. Nhận được: ${outOfScopeRes.answer}`
);
assert.ok(outOfScopeRes.latencyMs > 0, 'Phải ghi nhận thời gian phản hồi (latencyMs)');
console.log('✅ Anti-Hallucination refusal PASSED!\n');

console.log('🎉 TASK 5 RAG ENGINE TEST PASSED 100%!');
