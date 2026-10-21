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

// Thứ tự ưu tiên model: gemini-3.5-flash-lite (chính thức, siêu tốc) -> gemini-3.1-flash-lite (dự phòng) -> gemini-3.8-flash (dự phòng tắt thinking)
export const CHAT_MODELS_CANDIDATE = [
  process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash'
];

export const EMBED_MODEL = 'gemini-embedding-001';

export const REFUSAL_COPY = 'Rất tiếc, trong tài liệu hướng dẫn hiện có chưa có thông tin về nội dung này. Bác/Anh/Chị vui lòng liên hệ trực tiếp cán bộ tại quầy hướng dẫn để được hỗ trợ cụ thể ạ.';

const SYSTEM_PROMPT = `Bạn là Trợ lý tra cứu thủ tục hành chính tại Bộ phận Một cửa - UBND phường Vinh Phú.
Nhiệm vụ của bạn là giải đáp thắc mắc về thủ tục hành chính bằng tiếng Việt bình dị, gần gũi, rõ ràng, dễ hiểu cho người dân mọi lứa tuổi (đặc biệt là người lớn tuổi tại địa phương).

Khi hướng dẫn về một thủ tục, bạn hãy trình bày câu trả lời thật rành mạch theo thứ tự từng bước:
- Bước 1: Chuẩn bị hồ sơ (liệt kê các giấy tờ, bản sao, bản chính cần mang theo).
- Bước 2: Nơi nộp hồ sơ (bộ phận, cơ quan tiếp nhận).
- Bước 3: Lệ phí (nếu có, hoặc ghi rõ miễn phí) và Thời hạn giải quyết, trả kết quả.

QUY TẮC HIỆU NĂNG CHO KIOSK:
Trả lời trực tiếp vào nội dung theo các bước, không chèn suy nghĩ ngầm (không dùng reasoning/thinking blocks) để tối ưu thời gian phản hồi cho công dân.

QUY TẮC BẮT BUỘC VỀ TRÍCH DẪN NGUỒN:
Ở cuối mỗi câu trả lời, bạn PHẢI ghi rõ trích dẫn tên văn bản nguồn và trang/điều căn cứ theo định dạng: [Nguồn: tên_file - Trang X].

QUY TẮC BẮT BUỘC VỀ TRẢ LỜI TỪNG PHẦN VÀ CHỐNG BỊA ĐẶT (ANTI-HALLUCINATION):
1. Chỉ sử dụng thông tin có trong phần TÀI LIỆU THAM KHẢO được cung cấp dưới đây. TUYỆT ĐỐI KHÔNG TỰ BỊA ĐẶT, không suy đoán ngoài đời.
2. NGUYÊN TẮC TRẢ LỜI TỪNG PHẦN (PARTIAL ANSWER):
- Khi câu hỏi của người dân gồm nhiều ý (ví dụ: vừa hỏi lệ phí, vừa hỏi thời hạn hoặc hồ sơ): Ý nào có thông tin trong tài liệu thì PHẢI trả lời cụ thể, rõ ràng ý đó.
- Ý nào trong tài liệu chưa có thông tin (ví dụ: văn bản chưa ghi mức lệ phí cụ thể): Bạn hãy nêu rõ "Về lệ phí: Hiện tài liệu chưa có thông tin cụ thể, Bác/Anh/Chị vui lòng hỏi cán bộ tại quầy để được hướng dẫn chi tiết".
- CẤM TUYỆT ĐỐI việc từ chối toàn bộ câu hỏi khi trong tài liệu vẫn có thông tin trả lời được một phần (như đã có thời hạn giải quyết 24 giờ hoặc 3 ngày làm việc).
3. Chỉ khi TOÀN BỘ câu hỏi của người dân HOÀN TOÀN KHÔNG CÓ THÔNG TIN trong tài liệu (ví dụ: hỏi thủ tục visa, hộ chiếu, xuất nhập cảnh...), bạn mới trả lời chính xác nguyên văn câu sau:
"${REFUSAL_COPY}"`;

/**
 * Viết lại câu hỏi tiếp nối dựa trên lịch sử hội thoại (Condense Question)
 * Bỏ qua hoàn toàn nếu không có lịch sử hội thoại.
 */
export async function condenseQuestion(question, history = []) {
  if (!history || history.length === 0) {
    return question;
  }

  const formattedHistory = history
    .map(msg => `${msg.role === 'user' ? 'Người dân' : 'Cán bộ Một cửa'}: ${msg.content}`)
    .join('\n');

  const prompt = `Dưới đây là lịch sử hội thoại giữa Người dân và Cán bộ tại Bộ phận Một cửa phường Vinh Phú:
${formattedHistory}

Người dân vừa hỏi tiếp câu sau: "${question}"

Nhiệm vụ của bạn: Hãy viết lại câu hỏi tiếp theo này thành một câu hỏi độc lập, BẮT BUỘC PHẢI CHỨA RÕ TÊN THỦ TỤC HÀNH CHÍNH đang được nói tới (ví dụ: đăng ký khai sinh, đăng ký khai tử, kết hôn...) và giữ nguyên các ý người dân đang hỏi (như lệ phí, thời hạn, giấy tờ hồ sơ...).
Quy tắc: Chỉ trả về duy nhất 1 câu hỏi hoàn chỉnh, không thêm bất kỳ lời dẫn hay giải thích nào khác.`;

  for (const modelName of CHAT_MODELS_CANDIDATE) {
    try {
      const genConfig = { temperature: 0.1 };
      if (modelName.includes('3.8')) {
        genConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const chatModel = genAI.getGenerativeModel(
        {
          model: modelName,
          generationConfig: genConfig
        },
        { timeout: 7000 }
      );
      const res = await chatModel.generateContent(prompt);
      let condensed = res.response.text().trim();
      if (condensed.includes('\n')) {
        const lines = condensed.split('\n').map(l => l.trim()).filter(Boolean);
        const questionLine = lines.find(l => l.includes('?') && (l.includes('"') || l.includes('**')));
        if (questionLine) {
          condensed = questionLine.replace(/[*"]/g, '').trim();
        }
      }
      return condensed || question;
    } catch (err) {
      // nếu model lỗi hoặc timeout, thử model tiếp theo
      continue;
    }
  }

  return question;
}

/**
 * Thực thi RAG truy vấn vector và sinh câu trả lời với đo đạc chi tiết từng chặng
 */
export async function executeRagQuery({ question, history = [], onChunk = null }) {
  const tTotalStart = performance.now();

  // CHẶNG 1: Viết lại câu hỏi (chỉ chạy khi có lịch sử, nếu không có history thì 0ms)
  const tCondenseStart = performance.now();
  let condensed = question;
  let condenseMs = 0;
  if (history && history.length > 0) {
    condensed = await condenseQuestion(question, history);
    condenseMs = Math.round(performance.now() - tCondenseStart);
  }

  // CHẶNG 2: Tạo vector 768 chiều cho câu hỏi
  const tEmbedStart = performance.now();
  const embedModel = genAI.getGenerativeModel({ model: EMBED_MODEL });
  const embedRes = await embedModel.embedContent({
    content: { parts: [{ text: condensed }] },
    outputDimensionality: 768
  });
  const queryVector = embedRes.embedding.values;
  const embedMs = Math.round(performance.now() - tEmbedStart);

  // CHẶNG 3: Tìm kiếm vector trên Supabase (top-k = 8)
  const tSearchStart = performance.now();
  const { data: matchedDocs, error: matchError } = await supabase.rpc('match_documents', {
    query_embedding: queryVector,
    match_count: 8,
    filter: {}
  });

  if (matchError) {
    throw new Error(`Lỗi truy vấn vector Supabase: ${matchError.message}`);
  }
  const searchMs = Math.round(performance.now() - tSearchStart);

  const sources = [];
  const contextParts = (matchedDocs || []).map(doc => {
    const meta = doc.metadata || {};
    const srcStr = `${meta.fileName || 'Tài liệu TTHC'} (Trang ${meta.pageCount ? '1-' + meta.pageCount : '1'})`;
    if (!sources.includes(srcStr)) sources.push(srcStr);
    return `[Nguồn: ${srcStr}]\n${doc.content}`;
  });

  const contextText = contextParts.join('\n\n---\n\n');

  // CHẶNG 4: Gọi Gemini sinh câu trả lời (thử candidate models)
  const tGenStart = performance.now();
  let firstTokenTime = null;
  let fullAnswer = '';
  let usedModel = null;

  const promptContent = `TÀI LIỆU THAM KHẢO TỪ CSDL:\n${contextText}\n\nCÂU HỎI CỦA NGƯỜI DÂN:\n${question}\n(Câu hỏi ngữ cảnh đầy đủ: ${condensed})\n\nHãy trả lời người dân theo đúng quy định tại Bộ phận Một cửa:`;

  for (const modelName of CHAT_MODELS_CANDIDATE) {
    try {
      const genConfig = { temperature: 0.2 };
      if (modelName.includes('3.8')) {
        genConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const chatModel = genAI.getGenerativeModel(
        {
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: genConfig
        },
        { timeout: 8000 }
      );

      if (onChunk) {
        const streamResult = await chatModel.generateContentStream(promptContent);
        for await (const chunk of streamResult.stream) {
          if (!firstTokenTime) {
            firstTokenTime = performance.now();
          }
          const chunkText = chunk.text();
          fullAnswer += chunkText;
          onChunk(chunkText);
        }
      } else {
        const res = await chatModel.generateContent(promptContent);
        firstTokenTime = performance.now();
        fullAnswer = res.response.text();
      }

      usedModel = modelName;
      break;
    } catch (err) {
      console.warn(`Model ${modelName} lỗi hoặc quá hạn: ${err.message}. Thử model dự phòng...`);
      continue;
    }
  }

  if (!usedModel) {
    throw new Error('Không thể tạo phản hồi từ bất kỳ model Gemini nào.');
  }

  const tTotalEnd = performance.now();
  const totalGenMs = Math.round(tTotalEnd - tGenStart);
  const ttftMs = firstTokenTime ? Math.round(firstTokenTime - tGenStart) : totalGenMs;
  const latencyMs = Math.round(tTotalEnd - tTotalStart);

  return {
    answer: fullAnswer.trim(),
    sources,
    condensedQuestion: condensed,
    usedModel,
    latencyMs,
    firstTokenMs: ttftMs,
    breakdown: {
      condenseMs,
      embedMs,
      searchMs,
      ttftMs,
      totalGenMs,
      totalPipelineMs: latencyMs
    }
  };
}
