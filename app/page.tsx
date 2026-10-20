'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, User, Bot, Sparkles, Clock, FileText, Zap } from 'lucide-react';

interface TimingBreakdown {
  condenseMs?: number;
  embedMs?: number;
  searchMs?: number;
  ttftMs?: number;
  totalGenMs?: number;
  totalPipelineMs?: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  latencyMs?: number;
  firstTokenMs?: number;
  condensedQuestion?: string;
  breakdown?: TimingBreakdown;
}

export default function KioskChatPage() {
  const initialGreeting = 'Xin chào bác/anh/chị! Tôi là Trợ lý tra cứu thủ tục hành chính của Bộ phận Một cửa - UBND phường Vinh Phú. Tôi có thể hỗ trợ bác/anh/chị tra cứu quy trình, hồ sơ giấy tờ, lệ phí hay thời hạn giải quyết của thủ tục nào hôm nay ạ?';

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: initialGreeting,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasFirstToken, setHasFirstToken] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    scrollToBottom();
  }, [messages, isLoading, hasFirstToken]);

  const handleReset = () => {
    setMessages([
      {
        role: 'assistant',
        content: initialGreeting,
      },
    ]);
    setInput('');
    setIsLoading(false);
    setHasFirstToken(false);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const questionText = textToSend || input;
    if (!questionText.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: questionText.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setHasFirstToken(false);

    const historyForBackend = messages
      .filter((_, idx) => idx > 0) // bỏ câu chào ban đầu
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
        throw new Error('Lỗi kết nối tới máy chủ');
      }

      let assistantAnswer = '';
      let sources: string[] = [];
      let latencyMs: number | undefined;
      let firstTokenMs: number | undefined;
      let condensedQuestion: string | undefined;
      let breakdown: TimingBreakdown | undefined;

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
              if (!hasFirstToken) setHasFirstToken(true);
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
                  breakdown,
                };
                return next;
              });
            } else if (data.type === 'done') {
              sources = data.sources || [];
              latencyMs = data.latencyMs;
              firstTokenMs = data.firstTokenMs;
              condensedQuestion = data.condensedQuestion;
              breakdown = data.breakdown;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: 'assistant',
                  content: assistantAnswer,
                  sources,
                  latencyMs,
                  firstTokenMs,
                  condensedQuestion,
                  breakdown,
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
      setHasFirstToken(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto bg-white shadow-2xl border-x border-slate-200 relative overflow-hidden">
      {/* BACKGROUND MỜ ĐẤU NỐI THƯ MỤC /vinh-phu/ */}
      <div 
        className="absolute inset-0 pointer-events-none bg-repeat bg-center z-0 opacity-[0.03]"
        style={{ backgroundImage: 'url("/vinh-phu/bg-kiosk.svg")' }}
      />

      {/* HEADER KIOSK UBND PHƯỜNG VINH PHÚ */}
      <header className="relative z-10 bg-gradient-to-r from-red-800 via-red-700 to-amber-700 text-white px-6 py-4 flex items-center justify-between shadow-lg border-b-2 border-amber-400">
        <div className="flex items-center gap-4">
          {/* VỊ TRÍ ĐẶT QUỐC HUY VIỆT NAM */}
          <div className="relative w-16 h-16 flex items-center justify-center shrink-0 p-1 bg-white/10 rounded-full border-2 border-amber-300 shadow-md backdrop-blur">
            <img
              src="/vinh-phu/quoc-huy.svg"
              alt="Quốc huy Việt Nam"
              className="w-14 h-14 object-contain filter drop-shadow"
              onError={(e) => {
                // Fallback nếu người dùng đặt file png
                e.currentTarget.src = '/vinh-phu/quoc-huy.png';
              }}
            />
          </div>

          <div>
            <div className="text-xs font-extrabold uppercase tracking-widest text-amber-300 drop-shadow-sm">
              Ủy ban nhân dân phường Vinh Phú
            </div>
            <h1 className="text-xl font-bold tracking-wide flex items-center gap-2 uppercase text-white drop-shadow">
              Bộ phận Tiếp nhận và Trả kết quả — Bộ phận Một cửa
            </h1>
            <p className="text-xs text-amber-100 font-medium">
              Trợ lý ảo hỗ trợ công dân tra cứu thủ tục, hồ sơ, lệ phí và thời hạn giải quyết
            </p>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-900 font-bold text-sm rounded-lg border border-amber-300 shadow transition-all shrink-0"
          title="Xóa cuộc trò chuyện để đón tiếp người dân tiếp theo"
        >
          <RotateCcw className="w-4 h-4 text-slate-900" />
          <span>Bắt đầu lượt mới</span>
        </button>
      </header>

      {/* CHAT MESSAGES AREA */}
      <main className="relative z-10 flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/70">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex items-start gap-3.5 ${
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-red-700 text-amber-300 border-2 border-amber-300'
              }`}
            >
              {msg.role === 'user' ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm text-base leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
              }`}
            >
              {/* Message Content */}
              <div className="whitespace-pre-wrap font-normal">{msg.content}</div>

              {/* Sources & Latency for Assistant */}
              {msg.role === 'assistant' && (msg.sources || msg.latencyMs) && (
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <FileText className="w-3.5 h-3.5 text-red-600" />
                      <span className="font-semibold text-slate-700">Căn cứ trích dẫn:</span>
                      {msg.sources.map((src, i) => (
                        <span
                          key={i}
                          className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 font-medium"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.latencyMs && (
                    <div className="flex items-center gap-2 text-emerald-800 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 ml-auto">
                      <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                      {msg.firstTokenMs && (
                        <span>Token đầu: <b>{msg.firstTokenMs}ms</b></span>
                      )}
                      <span>|</span>
                      <span>Tổng: <b>{msg.latencyMs}ms</b></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* HIỆU ỨNG ĐANG SOẠN TRẢ LỜI TRONG LÚC CHỜ TOKEN ĐẦU TIÊN */}
        {isLoading && !hasFirstToken && (
          <div className="flex items-center gap-3.5 pl-2 animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-red-700 text-amber-300 border-2 border-amber-300 flex items-center justify-center shrink-0 shadow">
              <Bot className="w-6 h-6" />
            </div>
            <div className="bg-white border border-slate-200 px-5 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
              <div className="flex gap-1.5 items-center">
                <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-bounce"></span>
              </div>
              <span className="text-sm font-medium text-slate-600">
                Trợ lý Một cửa phường Vinh Phú đang tra cứu tài liệu và soạn câu trả lời...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* QUICK BUTTONS & INPUT AREA */}
      <footer className="relative z-10 p-4 bg-white border-t border-slate-200 shadow-inner space-y-3">
        {/* Nút gợi ý thủ tục nhanh */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="font-bold text-red-800 shrink-0">👉 Gợi ý nhanh:</span>
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              disabled={isLoading}
              className="bg-slate-100 hover:bg-amber-100 hover:border-amber-400 hover:text-amber-900 text-slate-700 px-3 py-1.5 rounded-full border border-slate-300 transition-colors whitespace-nowrap active:scale-95 disabled:opacity-50 font-medium"
            >
              {prompt}
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
            onChange={e => setInput(e.target.value)}
            placeholder="Nhập câu hỏi thủ tục của bác/anh/chị tại đây (ví dụ: làm khai sinh cần giấy tờ gì?)..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition shadow-sm disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-red-700 hover:bg-red-800 disabled:bg-slate-300 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
          >
            <Send className="w-5 h-5" />
            <span>Gửi câu hỏi</span>
          </button>
        </form>

        {/* CHÂN TRANG ĐỊNH DANH UBND PHƯỜNG VINH PHÚ */}
        <div className="text-center text-xs text-slate-500 font-medium pt-1 border-t border-slate-100">
          🏛️ Phần mềm hỗ trợ tra cứu thủ tục hành chính — Bộ phận Một cửa, UBND phường Vinh Phú
        </div>
      </footer>
    </div>
  );
}
