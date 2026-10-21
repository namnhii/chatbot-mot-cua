'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, RotateCcw, User, Bot, Sparkles, Clock, FileText } from 'lucide-react';
import initialSlideshowImages from '@/utils/slideshow-manifest.json';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  latencyMs?: number;
  firstTokenMs?: number;
  condensedQuestion?: string;
}

export default function KioskChatPage() {
  const initialGreeting =
    'Xin chào bác/anh/chị! Tôi là Trợ lý tra cứu thủ tục hành chính của Bộ phận Một cửa - UBND phường Vinh Phú. Tôi có thể hỗ trợ bác/anh/chị tra cứu quy trình, hồ sơ giấy tờ, lệ phí hay thời hạn giải quyết của thủ tục nào hôm nay ạ?';

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: initialGreeting,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [slideshowImages, setSlideshowImages] = useState<string[]>(initialSlideshowImages);
  const [currentSlide, setCurrentSlide] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const quickPrompts = [
    'Tôi muốn làm giấy khai sinh cho con thì đầu tiên phải làm thế nào?',
    'Lệ phí làm khai sinh là bao nhiêu và bao lâu có kết quả?',
    'Thủ tục đăng ký khai tử liên thông cần chuẩn bị những gì?',
    'Xác nhận đăng ký thu hồi khoáng sản thuộc thẩm quyền của ai?',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isIdle) {
      scrollToBottom();
    }
  }, [messages, isLoading, isIdle]);

  // Tải danh sách ảnh slideshow động từ /api/slideshow
  const fetchSlideshow = useCallback(async () => {
    try {
      const res = await fetch('/api/slideshow');
      if (res.ok) {
        const data = await res.json();
        if (data.images && data.images.length > 0) {
          setSlideshowImages(data.images);
        }
      }
    } catch (e) {
      console.error('Lỗi tải danh sách ảnh slideshow:', e);
    }
  }, []);

  useEffect(() => {
    fetchSlideshow();
  }, [fetchSlideshow]);

  // Luân chuyển ảnh trình chiếu khi ở màn hình chờ (mỗi 4.5 giây đổi ảnh)
  useEffect(() => {
    if (!isIdle || slideshowImages.length <= 1) return;
    const slideInterval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slideshowImages.length);
    }, 4500);
    return () => clearInterval(slideInterval);
  }, [isIdle, slideshowImages.length]);

  const resetActivity = () => {
    lastActivityRef.current = Date.now();
  };

  const handleReset = () => {
    setMessages([
      {
        role: 'assistant',
        content: initialGreeting,
      },
    ]);
    setInput('');
    resetActivity();
  };

  // Chạm vào màn hình chờ để bắt đầu phiên mới
  const handleStartChat = () => {
    handleReset();
    setIsIdle(false);
    resetActivity();
  };

  // Quản lý thời gian không thao tác (Inactivity Timeout 60s)
  useEffect(() => {
    const handleUserInteraction = () => {
      resetActivity();
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    // Kiểm tra không thao tác mỗi 1 giây
    const idleCheckInterval = setInterval(() => {
      const inactiveMs = Date.now() - lastActivityRef.current;
      // Sau 60 giây không có thao tác: tự động xóa toàn bộ trò chuyện và về màn hình chờ slideshow
      if (inactiveMs >= 60000 && !isIdle) {
        handleReset();
        setIsIdle(true);
        fetchSlideshow();
      }
    }, 1000);

    // Cung cấp hàm chuyển đổi cho testing / điều khiển nhanh
    (window as any).__setIdleState = (idle: boolean) => {
      if (idle) {
        handleReset();
        setIsIdle(true);
      } else {
        handleStartChat();
      }
    };

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserInteraction));
      clearInterval(idleCheckInterval);
    };
  }, [isIdle, fetchSlideshow]);

  const handleSendMessage = async (textToSend?: string) => {
    resetActivity();
    const questionText = textToSend || input;
    if (!questionText.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: questionText.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const historyForBackend = messages
      .filter((_, idx) => idx > 0)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: questionText.trim(),
          history: historyForBackend,
        }),
      });

      if (!response.ok || !response.body) {
        if (response.status === 429) {
          const errData = await response.json().catch(() => ({}));
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: `⏳ **Thông báo:** ${errData.error || 'Hệ thống đang tiếp nhận nhiều lượt hỏi cùng lúc. Bác/Anh/Chị vui lòng chờ giây lát rồi gửi tiếp nhé!'}`,
            },
          ]);
          return;
        }
        throw new Error('Lỗi kết nối tới máy chủ');
      }

      let assistantAnswer = '';
      let sources: string[] = [];
      let latencyMs: number | undefined;
      let firstTokenMs: number | undefined;
      let condensedQuestion: string | undefined;

      const updatedWithEmptyAssistant = [
        ...newMessages,
        { role: 'assistant' as const, content: '' },
      ];
      setMessages(updatedWithEmptyAssistant);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'chunk') {
              assistantAnswer += data.text;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: 'assistant',
                  content: assistantAnswer,
                  sources,
                  latencyMs,
                  firstTokenMs,
                  condensedQuestion,
                };
                return next;
              });
            } else if (data.type === 'done') {
              sources = data.sources || [];
              latencyMs = data.latencyMs;
              firstTokenMs = data.firstTokenMs;
              condensedQuestion = data.condensedQuestion;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: 'assistant',
                  content: assistantAnswer,
                  sources,
                  latencyMs,
                  firstTokenMs,
                  condensedQuestion,
                };
                return next;
              });
            }
          } catch (e) {
            console.error('Lỗi parse stream:', e);
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Đã xảy ra lỗi: ${err.message}. Bác/Anh/Chị vui lòng thử lại hoặc liên hệ cán bộ tại quầy.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto bg-white shadow-2xl border-x border-slate-200 overflow-hidden">
      {/* HEADER KIOSK GIỮ NGUYÊN STYLE TASK 6 + QUỐC HUY + ẢNH SLIDESHOW NỀN MỜ */}
      <header className="bg-gradient-to-r from-red-700 via-red-800 to-amber-700 text-white px-6 py-4 flex items-center justify-between shadow-md relative overflow-hidden shrink-0">
        {/* Ảnh từ thư mục slideshow làm nền mờ cho banner (nếu có) */}
        {slideshowImages.length > 0 && (
          <div
            className="absolute inset-0 pointer-events-none bg-cover bg-center opacity-15 blur-[2px] mix-blend-overlay transition-all duration-1000"
            style={{ backgroundImage: `url(${slideshowImages[0]})` }}
          />
        )}

        <div className="relative z-10 flex items-center justify-between w-full gap-4">
          <div className="flex items-center gap-4">
            {/* QUỐC HUY VIỆT NAM (/quochuy.webp), cao 56-64px, giữ nguyên tỉ lệ */}
            <img
              src="/quochuy.webp"
              alt="Quốc huy Việt Nam"
              className="h-16 w-auto object-contain drop-shadow-md shrink-0"
            />

            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-amber-300 drop-shadow-sm">
                ỦY BAN NHÂN DÂN PHƯỜNG VINH PHÚ
              </div>
              <h1 className="text-xl font-bold tracking-wide flex items-center gap-2 uppercase">
                Bộ phận Một cửa - Tra cứu thủ tục hành chính
              </h1>
              <p className="text-xs text-amber-100 font-medium">
                Trợ lý ảo hỗ trợ công dân tra cứu thủ tục, hồ sơ, lệ phí và thời hạn giải quyết
              </p>
            </div>
          </div>

          {!isIdle && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-sm font-semibold rounded-lg border border-white/30 backdrop-blur shrink-0 shadow-sm"
              title="Xóa cuộc trò chuyện để đón tiếp người dân tiếp theo"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Bắt đầu lượt mới</span>
            </button>
          )}
        </div>
      </header>

      {/* NẾU Ở MÀN HÌNH CHỜ (IDLE SCREENSAVER): CHIẾU SLIDESHOW + NÚT CHẠM ĐỂ BẮT ĐẦU */}
      {isIdle ? (
        <div
          onClick={handleStartChat}
          className="flex-1 relative overflow-hidden bg-slate-950 flex flex-col justify-between cursor-pointer select-none"
        >
          {/* SLIDESHOW CHỈ ĐỌC ẢNH THẬT TRONG public/vinh-phu/slideshow/ */}
          <div className="absolute inset-0">
            {slideshowImages.map((imgSrc, idx) => (
              <div
                key={imgSrc}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  idx === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <img
                  src={imgSrc}
                  alt={`Trình chiếu Kiosk ${idx + 1}`}
                  className="w-full h-full object-cover transform scale-100 transition-transform duration-[6000ms] ease-out"
                />
                {/* Lớp phủ tối 35-40%: tối dần ở mép trên và mép dưới, vùng giữa để ảnh và gương mặt người sáng rõ */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/75" />
              </div>
            ))}
          </div>

          {/* DÒNG CHÀO MỪNG TRÊN MÀN HÌNH CHỜ (Ở ĐỈNH) */}
          <div className="relative z-10 pt-6 px-6 text-center">
            <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-red-950/80 backdrop-blur-md border border-amber-400/40 shadow-lg">
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
              <span className="text-amber-200 font-extrabold uppercase tracking-wider text-xs sm:text-sm">
                UBND Phường Vinh Phú — Bộ phận Tiếp nhận & Trả kết quả
              </span>
            </div>
          </div>

          {/* VÙNG 1/4 PHÍA DƯỚI: NÚT BẮT ĐẦU + DÒNG GỢI Ý + CHỈ SỐ SLIDE (KHÔNG CHE VÙNG MẶT NGƯỜI Ở GIỮA) */}
          <div className="relative z-10 mt-auto pb-6 px-6 flex flex-col items-center gap-3">
            {/* NÚT CHẠM ĐỂ BẮT ĐẦU: NỀN ĐỎ ĐẶC, CHỮ TRẮNG IN ĐẬM, BỎ VIỀN VÀNG SÁNG, THAY BẰNG BÓNG ĐỔ NHẸ */}
            <button
              onClick={e => {
                e.stopPropagation();
                handleStartChat();
              }}
              className="px-8 py-3.5 sm:px-10 sm:py-4 bg-red-700 hover:bg-red-800 text-white font-extrabold text-xl sm:text-2xl rounded-2xl shadow-xl flex items-center gap-3 active:scale-95 transition-all"
            >
              <span className="tracking-wide">👉 Chạm để bắt đầu tra cứu thủ tục</span>
            </button>

            {/* DÒNG GỢI Ý THỦ TỤC NGAY DƯỚI NÚT */}
            <p className="text-amber-200 text-xs sm:text-sm font-semibold drop-shadow-md bg-black/60 px-5 py-1.5 rounded-full backdrop-blur-md border border-white/10">
              Tra cứu: Khai sinh • Kết hôn • CCCD • Đất đai • Hộ tịch...
            </p>

            {/* CHẤM CHỈ SỐ SLIDE */}
            {slideshowImages.length > 1 && (
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 shadow-sm mt-1">
                {slideshowImages.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 rounded-full transition-all duration-500 ${
                      i === currentSlide ? 'w-6 bg-amber-400' : 'w-2 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* THÔNG TIN CHÂN TRANG MÀN HÌNH CHỜ */}
            <div className="text-[11px] text-white/70 font-medium drop-shadow text-center">
              🏛️ Kiosk thông minh — Tự động kích hoạt màn hình chờ sau 60 giây không có thao tác
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* CHAT MESSAGES AREA (GIỮ NGUYÊN 100% STYLE TASK 6) */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-start gap-3.5 ${
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-red-700 text-amber-300 border border-amber-300/40'
                  }`}
                >
                  {msg.role === 'user' ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[82%] rounded-2xl px-5 py-4 shadow-sm text-base leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                  }`}
                >
                  {/* Message Content với ReactMarkdown cho định dạng chuẩn xác */}
                  <div className="font-normal prose prose-slate max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-strong:text-slate-900 prose-strong:font-bold">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Sources & Latency for Assistant */}
                  {msg.role === 'assistant' && (msg.sources || msg.latencyMs) && (
                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-semibold text-slate-600">Căn cứ trích dẫn:</span>
                          {msg.sources.map((src, i) => (
                            <span
                              key={i}
                              className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200"
                            >
                              {src}
                            </span>
                          ))}
                        </div>
                      )}

                      {msg.latencyMs && (
                        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 ml-auto">
                          <Clock className="w-3 h-3" />
                          {msg.firstTokenMs && (
                            <span>TTFT: {msg.firstTokenMs}ms | </span>
                          )}
                          <span>Tổng: {msg.latencyMs}ms</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 text-slate-500 text-sm italic pl-14">
                <Sparkles className="w-4 h-4 animate-spin text-red-600" />
                <span>Trợ lý Một cửa phường Vinh Phú đang tra cứu tài liệu và soạn câu trả lời...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </main>

          {/* QUICK BUTTONS & INPUT AREA (GIỮ NGUYÊN 100% STYLE TASK 6) */}
          <footer className="p-4 bg-white border-t border-slate-200 shadow-inner space-y-3">
            {/* Nút gợi ý thủ tục nhanh */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span className="font-semibold text-slate-500 shrink-0">Gợi ý nhanh:</span>
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isLoading}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full border border-slate-300 transition-colors whitespace-nowrap active:scale-95 disabled:opacity-50"
                >
                  👉 {prompt}
                </button>
              ))}
            </div>

            {/* Input box */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={e => {
                  resetActivity();
                  setInput(e.target.value);
                }}
                placeholder="Nhập câu hỏi thủ tục của bác/anh/chị tại đây (ví dụ: làm khai sinh cần giấy tờ gì?)..."
                disabled={isLoading}
                className="flex-1 px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition shadow-sm disabled:bg-slate-100"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-5 py-3 bg-red-700 hover:bg-red-800 disabled:bg-slate-300 text-white font-semibold rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
              >
                <Send className="w-5 h-5" />
                <span>Gửi câu hỏi</span>
              </button>
            </form>

            {/* CHÂN TRANG ĐỊNH DANH UBND PHƯỜNG VINH PHÚ */}
            <div className="text-center text-xs text-slate-500 font-medium pt-1 border-t border-slate-100">
              Phần mềm hỗ trợ tra cứu thủ tục hành chính — Bộ phận Một cửa, UBND phường Vinh Phú
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
