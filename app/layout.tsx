import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Hệ Thống Tra Cứu Thủ Tục Hành Chính - Bộ Phận Một Cửa',
  description: 'Trợ lý ảo hỗ trợ người dân tra cứu quy trình, hồ sơ, lệ phí và thời hạn thủ tục hành chính',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
