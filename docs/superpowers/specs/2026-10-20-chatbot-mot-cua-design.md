# Bản Thiết Kế Hệ Thống: Chatbot Tra Cứu Thủ Tục Hành Chính Tại Bộ Phận Một Cửa

**Ngày lập:** 20/10/2026  
**Trạng thái:** Đã phê duyệt (kèm bổ sung kiểm chứng hạn mức API & tiêu chí nghiệm thu)  
**Tài liệu tham chiếu:** Repo mẫu `mayooear/ai-pdf-chatbot-langchain` (Next.js, LangChain, Supabase)  

---

## 1. Bối cảnh & Mục đích (Intent & The Why)

Người dân khi đến giao dịch tại Bộ phận Một cửa thường có nhiều thắc mắc về quy trình thực hiện các thủ tục hành chính: bắt đầu từ đâu, thứ tự các bước ra sao, cần giấy tờ gì, lệ phí bao nhiêu, nộp tại bộ phận nào và bao lâu nhận kết quả. Các văn bản quy định hành chính thường dài, phức tạp và sử dụng nhiều thuật ngữ pháp lý khó hiểu với đa số người dân, đặc biệt là người lớn tuổi.

Mục đích của dự án là xây dựng một trang web chatbot thông minh, được đặt cố định trên máy tính có kết nối mạng tại Bộ phận Một cửa (kiosk tra cứu công cộng):
- Đóng vai trò như một cán bộ tiếp đón ban đầu: giải đáp thắc mắc bằng tiếng Việt bình dị, ngắn gọn, đi thẳng vào các bước thực hiện.
- Trích xuất thông tin trực tiếp và chính xác từ các tài liệu PDF thủ tục hành chính được nạp vào.
- Tuyệt đối trung thực, kèm trích dẫn nguồn văn bản; nếu thông tin chưa có trong tài liệu thì hướng dẫn người dân gặp trực tiếp cán bộ phụ trách tại quầy, tuyệt đối không tự suy diễn hay bịa đặt.

---

## 2. Mục tiêu, Phi mục tiêu & Phản mục tiêu (Goals, Non-Goals, Anti-Goals)

### 2.1. Mục tiêu (Goals)
1. **Trả lời đúng trọng tâm:** Hướng dẫn rõ ràng thứ tự từng bước thực hiện thủ tục (Bước 1: Hồ sơ cần chuẩn bị ➔ Bước 2: Nơi tiếp nhận & nộp ➔ Bước 3: Lệ phí & Thời hạn trả kết quả).
2. **Ngôn ngữ bình dân, chuẩn mực:** Tiếng Việt gần gũi, câu từ gãy gọn, dễ hiểu với mọi lứa tuổi.
3. **Có trích dẫn nguồn văn bản:** Mỗi câu trả lời kèm tên tài liệu / trang hoặc điều khoản căn cứ.
4. **An toàn & Trung thực (No Hallucination):** Khi thông tin không có trong tài liệu, phải trả lời theo đúng **câu mẫu từ chối duy nhất**:
   > *"Rất tiếc, trong tài liệu hướng dẫn hiện có chưa có thông tin về nội dung này. Bác/Anh/Chị vui lòng liên hệ trực tiếp cán bộ tại quầy hướng dẫn để được hỗ trợ cụ thể ạ."*
5. **Giao diện thân thiện (Phương án A):** Màn hình chat trực diện, font chữ to rõ, nút bấm chọn nhanh các thủ tục phổ biến (Khai sinh, Kết hôn, CCCD, Đất đai...) và nút "Bắt đầu lượt mới" để xóa lịch sử trò chuyện cho người dân tiếp theo.
6. **Mô hình AI chất lượng cao:** Sử dụng Google Gemini API với model ưu tiên `gemini-2.5-flash` (hoặc `gemini-1.5-flash` / `gemini-2.0-flash` tùy theo danh mục model khả dụng trên AI Studio của tài khoản), embedding `text-embedding-004`.
   > **Lưu ý quan trọng về Hạn mức (Quota):** Hạn mức API được quản lý theo API Key trong Google AI Studio (mặc định gói Free tier: ví dụ 15 RPM, 1.000.000 TPM, 1.500 RPD), **không tự động kế thừa từ gói tài khoản Gemini Pro/Advanced cá nhân**. Kế hoạch kiểm chứng sẽ có bước kiểm tra quota thực tế của API key để đảm bảo hoạt động liên tục.
7. **Lưu trữ vector:** Tích hợp Supabase (pgvector) để lưu trữ và truy vấn ngữ nghĩa văn bản.
8. **Hỗ trợ hỏi tiếp ngữ cảnh (Multi-turn Context):** Chatbot hiểu được các câu hỏi tiếp theo trong cùng ngữ cảnh (ví dụ: *"Làm khai sinh cần gì?"* ➔ *"Thế lệ phí bao nhiêu?"* thì chatbot tự hiểu là hỏi lệ phí khai sinh).

### 2.2. Phi mục tiêu (Non-Goals)
- Chưa xây dựng trang web quản trị đăng nhập (Admin Portal) phức tạp; việc nạp/cập nhật tài liệu thực hiện qua script dòng lệnh `npm.cmd run ingest`.
- Không tích hợp ký số hay tự động nộp hồ sơ dịch vụ công.
- Không nhận diện khuôn mặt hay lưu vết thông tin định danh cá nhân của người dân (bảo vệ quyền riêng tư).
- Không nhúng OCR trực tiếp vào mã nguồn; các tài liệu PDF scan chụp sẽ được chuyển đổi sang dạng văn bản trước qua Google Docs trước khi nạp.

### 2.3. Phản mục tiêu (Anti-Goals)
- **Tuyệt đối không bịa đặt thông tin:** Không tự phỏng đoán lệ phí, thời hạn giải quyết hoặc cơ quan nếu văn bản không đề cập.
- **Không gây rối mắt:** Tránh giao diện nhiều tầng nấc, phức tạp với người dân.
- **Không phụ thuộc OpenAI:** Chuyển hoàn toàn sang Google Gemini.

---

## 3. Kiến Trúc Kỹ Thuật & Công Nghệ (Tech Stack)

### 3.1. Nền tảng cốt lõi
- **Mã nguồn cơ sở:** Dựa trên repo mẫu `mayooear/ai-pdf-chatbot-langchain`.
- **Frontend / Giao diện người dùng:** Next.js (React), Tailwind CSS, tinh chỉnh theo **Phương án A**:
  - Giao diện chat trực diện, bố cục thoáng đãng, phông chữ lớn, tương phản cao.
  - Hàng nút bấm chọn nhanh các thủ tục thường gặp.
  - Nút "Bắt đầu lượt mới" làm mới phiên hỏi đáp cho người dân tiếp theo.
- **Backend & AI Orchestration:**
  - Next.js API Routes.
  - LangChain (`@langchain/core`, `@langchain/google-genai`).
  - Hỗ trợ Condense Question Prompt (tóm tắt lịch sử hội thoại khi hỏi tiếp).
- **Mô hình AI (Google Gemini):**
  - Embedding: `text-embedding-004` (768 chiều vector).
  - LLM: `gemini-2.5-flash` (ưu tiên) hoặc `gemini-1.5-flash` / `gemini-2.0-flash`.
- **Vector Database:**
  - Supabase PostgreSQL với extension `pgvector`.
- **Môi trường chạy:**
  - Node.js v24.x, Windows PowerShell (hỗ trợ `npm.cmd` / `npx.cmd`).
  - Chạy trên máy tính tại quầy Một cửa (có mạng), sẵn sàng triển khai lên đám mây (Vercel) khi cần.

---

## 4. Quy Trình Xử Lý Dữ Liệu & RAG (Data & Retrieval Pipeline)

### 4.1. Cấu trúc tài liệu đầu vào & Chiến lược nạp (Ingestion Strategy)
- **Dữ liệu đầu vào gồm 2 loại:**
  1. *File tách riêng từng thủ tục:* Mỗi file chứa nội dung 1 thủ tục (khoảng 2–5 trang). Ưu tiên cao nhất vì độ chính xác phân vùng ngữ cảnh cao.
  2. *File gộp nhiều thủ tục:* Các Quyết định công bố TTHC dài chứa nhiều thủ tục.
- **Cơ chế cắt nhỏ & Gắn thẻ (Chunking & Metadata Tagging):**
  - Sử dụng `RecursiveCharacterTextSplitter` với kích thước chunk ~800 ký tự, overlap 150 ký tự.
  - Mỗi chunk khi lưu vào Supabase sẽ được gắn kèm metadata: tên file nguồn (`source`), tiêu đề văn bản, trang tài liệu.
  - Khi cần cập nhật thủ tục, script sẽ xóa các vector cũ của file đó trong Supabase và nạp lại vector mới, tránh xung đột thông tin cũ - mới.

### 4.2. Quy trình hỏi đáp (Citizen Query & Retrieval Flow)
1. Người dân gõ câu hỏi hoặc bấm nút chọn nhanh.
2. Nếu câu hỏi là câu tiếp nối (có lịch sử hội thoại), mô hình Gemini viết lại câu hỏi thành câu độc lập có đầy đủ ngữ cảnh thủ tục.
3. Chuyển đổi câu hỏi thành vector qua Gemini `text-embedding-004`.
4. Tìm kiếm độ tương đồng trên Supabase lấy ra các đoạn trích liên quan nhất.
5. Gửi câu hỏi và các đoạn trích vào Gemini với System Prompt nghiêm ngặt:
   - Đóng vai cán bộ hướng dẫn tại Bộ phận Một cửa: niềm nở, lịch sự, dùng từ ngữ mộc mạc, bình dân.
   - Hướng dẫn theo thứ tự: Hồ sơ chuẩn bị ➔ Nơi nộp ➔ Lệ phí ➔ Thời gian nhận kết quả.
   - Luôn kèm theo trích dẫn nguồn tài liệu ở cuối câu trả lời.
   - Nếu trong các đoạn trích không có thông tin, bắt buộc trả lời **chính xác câu mẫu từ chối duy nhất**:
     *"Rất tiếc, trong tài liệu hướng dẫn hiện có chưa có thông tin về nội dung này. Bác/Anh/Chị vui lòng liên hệ trực tiếp cán bộ tại quầy hướng dẫn để được hỗ trợ cụ thể ạ."* Tuyệt đối không phỏng đoán.
6. Phản hồi được truyền trực tiếp (streaming) lên giao diện người dân.

---

## 5. Tiêu Chí Nghiệm Thu Cuối Cùng (Final Acceptance Criteria)

Hệ thống được coi là hoàn thành và đạt chuẩn nghiệm thu khi vượt qua đầy đủ 4 Test Case sau:

* **Test Case 1 (Hỏi thông tin có trong tài liệu):**
  - *Câu hỏi:* "Tôi muốn làm giấy khai sinh cho con thì đầu tiên phải chuẩn bị giấy tờ gì?"
  - *Kỳ vọng:* Chatbot trả lời đúng thứ tự các bước, liệt kê đầy đủ thành phần hồ sơ và trích dẫn rõ tên văn bản nguồn.
* **Test Case 2 (Hỏi về lệ phí và thời hạn giải quyết):**
  - *Câu hỏi:* "Lệ phí làm khai sinh là bao nhiêu và bao lâu có kết quả?"
  - *Kỳ vọng:* Trả lời chính xác số tiền lệ phí (hoặc miễn phí nếu theo quy định) và số ngày làm việc theo đúng nội dung trong văn bản nạp vào.
* **Test Case 3 (Hỏi thông tin ngoài tài liệu / Anti-Hallucination):**
  - *Câu hỏi:* "Ở đây có làm thủ tục xin cấp visa đi nước ngoài không?"
  - *Kỳ vọng:* Chatbot không tự bịa thông tin, trả lời đúng nguyên văn câu mẫu từ chối duy nhất: *"Rất tiếc, trong tài liệu hướng dẫn hiện có chưa có thông tin về nội dung này. Bác/Anh/Chị vui lòng liên hệ trực tiếp cán bộ tại quầy hướng dẫn để được hỗ trợ cụ thể ạ."*
* **Test Case 4 (Kiểm tra giao diện Kiosk Một cửa):**
  - *Thao tác:* Người dùng bấm các nút gợi ý thủ tục nhanh trên màn hình; sau đó bấm nút "Bắt đầu lượt mới".
  - *Kỳ vọng:* Nút gợi ý tự động gửi câu hỏi và nhận câu trả lời trôi chảy; nút "Bắt đầu lượt mới" xóa sạch lịch sử chat, đưa giao diện về trạng thái đón người dân tiếp theo.
