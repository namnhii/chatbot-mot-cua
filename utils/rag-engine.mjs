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

const CHAT_MODEL = 'gemini-3.8-flash';
const EMBED_MODEL = 'gemini-embedding-001';

const REFUSAL_COPY = 'Rất tiếc, trong tài liệu hướng dẫn hiện có chưa có thông tin về nội dung này. Bác/Anh/Chị vui lòng liên hệ trực tiếp cán bộ tại quầy hướng dẫn để được hỗ trợ cụ thể ạ.';

const SYSTEM_PROMPT = `Bạn là cán bộ tiếp đón và hướng dẫn người dân tại Bộ phận Một cửa.
Nhiệm vụ của bạn là giải đáp thắc mắc về thủ tục hành chính bằng tiếng Việt bình dị, gần gũi, rõ ràng, dễ hiểu cho người dân mọi lứa tuổi (đặc biệt là người lớn tuổi).

Khi hướng dẫn về một thủ tục, bạn hãy trình bày câu trả lời thật rành mạch theo thứ tự từng bước:
- Bước 1: Chuẩn bị hồ sơ (liệt kê các giấy tờ, bản sao, bản chính cần mang theo).
- Bước 2: Nơi nộp hồ sơ (bộ phận, cơ quan tiếp nhận).
- Bước 3: Lệ phí (nếu có, hoặc ghi rõ miễn phí) và Thời hạn giải quyết, trả kết quả.

QUY TẮC BẮT BUỘC VỀ TRÍCH DẪN NGUỒN:
Ở cuối mỗi câu trả lời, bạn PHẢI ghi rõ trích dẫn tên văn bản nguồn và trang/điều căn cứ theo định dạng: [Nguồn: tên_file - Trang X].

QUY TẮC BẮT BUỘC VỀ CHỐNG BỊA ĐẶT (ANTI-HALLUCINATION):
Chỉ sử dụng thông tin có trong phần TÀI LIỆU THAM KHẢO được cung cấp dưới đây.
Nếu thông tin người dân hỏi KHÔNG có trong tài liệu, bạn TUYỆT ĐỐI KHÔNG TỰ BỊA ĐẶT, không suy đoán ngoài đời, và PHẢI trả lời chính xác câu sau:
"${REFUSAL_COPY}"`;

/**
 * Viết lại câu hỏi tiếp nối dựa trên lịch sử hội thoại (Condense Question)
 */
export async function condenseQuestion(question, history = []) {
  if (!history || history.length === 0) {
    return question;
  }

  const chatModel = genAI.getGenerativeModel({ model: CHAT_MODEL });
  const formattedHistory = history
    .map(msg => `${msg.role === 'user' ? 'Người dân' : 'Cán bộ'}: ${msg.content}`)
    .join('\n');

  const prompt = `Dưới đây là lịch sử hội thoại giữa Người dân và Cán bộ tại Bộ phận Một cửa:
${formattedHistory}

Người dân vừa hỏi tiếp câu sau: "${question}"

Nhiệm vụ của bạn: Hãy viết lại câu hỏi tiếp theo này thành một câu hỏi độc lập, đầy đủ chủ ngữ và ngữ cảnh (nêu rõ tên thủ tục hành chính đang được nói tới) để có thể tra cứu chính xác trong tài liệu mà không cần xem lại lịch sử.
Quy tắc: Chỉ trả về duy nhất 1 câu hỏi hoàn chỉnh, không thêm bất kỳ lời dẫn hay giải thích nào khác.`;

  try {
    const res = await chatModel.generateContent(prompt);
    const condensed = res.response.text().trim();
    return condensed || question;
  } catch (err) {
    console.warn('Lỗi condense question, dùng câu hỏi gốc:', err.message);
    return question;
  }
}

/**
 * Thực thi RAG truy vấn vector và sinh câu trả lời
 */
export async function executeRagQuery({ question, history = [], onChunk = null }) {
  const startTime = Date.now();
  let firstTokenTime = null;

  // Bước 1: Viết lại câu hỏi nếu có ngữ cảnh lịch sử
  const condensed = await condenseQuestion(question, history);

  // Bước 2: Tạo vector 768 chiều cho câu hỏi đã chuẩn hóa
  const embedModel = genAI.getGenerativeModel({ model: EMBED_MODEL });
  const embedRes = await embedModel.embedContent({
    content: { parts: [{ text: condensed }] },
    outputDimensionality: 768
  });
  const queryVector = embedRes.embedding.values;

  // Bước 3: Tìm kiếm vector trên Supabase
  const { data: matchedDocs, error: matchError } = await supabase.rpc('match_documents', {
    query_embedding: queryVector,
    match_count: 5,
    filter: {}
  });

  if (matchError) {
    throw new Error(`Lỗi truy vấn vector Supabase: ${matchError.message}`);
  }

  const sources = [];
  const contextParts = (matchedDocs || []).map(doc => {
    const meta = doc.metadata || {};
    const srcStr = `${meta.fileName || 'Tài liệu TTHC'} (Trang ${meta.pageCount ? '1-' + meta.pageCount : '1'})`;
    if (!sources.includes(srcStr)) sources.push(srcStr);
    return `[Nguồn: ${srcStr}]\n${doc.content}`;
  });

  const contextText = contextParts.join('\n\n---\n\n');

  // Bước 4: Gọi Gemini sinh câu trả lời
  const chatModel = genAI.getGenerativeModel({
    model: CHAT_MODEL,
    systemInstruction: SYSTEM_PROMPT
  });

  const promptContent = `TÀI LIỆU THAM KHẢO TỪ CSDL:\n${contextText}\n\nCÂU HỎI CỦA NGƯỜI DÂN:\n${question}\n(Câu hỏi ngữ cảnh đầy đủ: ${condensed})\n\nHãy trả lời người dân theo đúng quy định tại Bộ phận Một cửa:`;

  let fullAnswer = '';

  if (onChunk) {
    // Chế độ streaming
    const streamResult = await chatModel.generateContentStream(promptContent);
    for await (const chunk of streamResult.stream) {
      if (!firstTokenTime) firstTokenTime = Date.now();
      const chunkText = chunk.text();
      fullAnswer += chunkText;
      onChunk(chunkText);
    }
  } else {
    // Chế độ hoàn tất một lần
    const res = await chatModel.generateContent(promptContent);
    firstTokenTime = Date.now();
    fullAnswer = res.response.text();
  }

  const endTime = Date.now();
  const latencyMs = endTime - startTime;
  const firstTokenMs = firstTokenTime ? firstTokenTime - startTime : latencyMs;

  return {
    answer: fullAnswer.trim(),
    sources,
    condensedQuestion: condensed,
    latencyMs,
    firstTokenMs
  };
}
