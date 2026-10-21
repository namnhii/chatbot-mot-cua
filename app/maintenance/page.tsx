import React from 'react';
import { AlertCircle, Clock, MapPin, PhoneCall } from 'lucide-react';

export const metadata = {
  title: 'Hệ Thống Đang Tạm Dừng Phục Vụ — UBND Phường Vinh Phú',
  description: 'Thông báo tạm dừng phục vụ hệ thống tra cứu thủ tục hành chính',
};

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      {/* HEADER BANNER ĐỒNG BỘ NHẬN DIỆN UBND PHƯỜNG VINH PHÚ */}
      <header className="bg-gradient-to-r from-red-700 via-red-800 to-amber-700 text-white px-4 py-3.5 sm:px-6 sm:py-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center gap-3 sm:gap-4">
          <img
            src="/quochuy.webp"
            alt="Quốc huy Việt Nam"
            className="h-12 sm:h-16 w-auto object-contain drop-shadow-md shrink-0"
          />
          <div>
            <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-amber-300 drop-shadow-sm leading-tight">
              ỦY BAN NHÂN DÂN PHƯỜNG VINH PHÚ
            </div>
            <h1 className="text-sm sm:text-xl font-bold tracking-wide uppercase leading-tight mt-0.5">
              Bộ phận Một cửa - Tra cứu thủ tục hành chính
            </h1>
          </div>
        </div>
      </header>

      {/* NỘI DUNG THÔNG BÁO TẠM DỪNG PHỤC VỤ CHÍNH */}
      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-16 flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-10 space-y-6">
          {/* Biểu tượng thông báo */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-red-50 text-red-700 border-2 border-red-200 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
            <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>

          <div className="space-y-3">
            <span className="inline-block px-4 py-1.5 rounded-full bg-amber-100 text-amber-900 font-bold text-xs uppercase tracking-wider border border-amber-300">
              Thông báo bảo trì hệ thống
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              Hệ thống đang tạm dừng phục vụ
            </h2>
          </div>

          {/* Dòng thông điệp quy định chuẩn */}
          <div className="bg-slate-50 border-l-4 border-red-600 p-4 sm:p-5 rounded-r-2xl text-left">
            <p className="text-base sm:text-lg text-slate-700 font-medium leading-relaxed">
              Hệ thống đang tạm dừng phục vụ. Bác/Anh/Chị vui lòng quay lại sau hoặc liên hệ trực tiếp Bộ phận Một cửa UBND phường Vinh Phú để được hỗ trợ.
            </p>
          </div>

          {/* Hộp thông tin hỗ trợ trực tiếp */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-600 text-left">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <MapPin className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">Địa chỉ tiếp nhận:</span>
                Bộ phận Tiếp nhận & Trả kết quả — UBND Phường Vinh Phú
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">Thời gian làm việc:</span>
                Thứ Hai đến Thứ Sáu (Sáng 7h00 - 11h30; Chiều 13h30 - 17h00)
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* CHÂN TRANG */}
      <footer className="text-center text-xs text-slate-500 py-4 bg-white border-t border-slate-200">
        Phần mềm hỗ trợ tra cứu thủ tục hành chính — Bộ phận Một cửa, UBND phường Vinh Phú
      </footer>
    </div>
  );
}
