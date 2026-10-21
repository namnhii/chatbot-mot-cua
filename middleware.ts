import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const isMaintenance = process.env.MAINTENANCE_MODE === 'true';
  const pathname = req.nextUrl.pathname;

  // 1. TRƯỜNG HỢP BẬT BẢO TRÌ (MAINTENANCE_MODE=true)
  if (isMaintenance) {
    // Cho phép các static files (css, js, ảnh Quốc huy, favicon, ảnh slideshow...) đi qua để trang thông báo hiển thị đúng giao diện
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/static') ||
      pathname.endsWith('.webp') ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.jpeg') ||
      pathname.endsWith('.jfif') ||
      pathname.endsWith('.ico') ||
      pathname.endsWith('.svg') ||
      pathname.endsWith('.css') ||
      pathname.endsWith('.js')
    ) {
      return NextResponse.next();
    }

    // A. Chặn các API (như /api/chat): Từ chối ngay tại đầu vào, trả về mã 503 Service Unavailable
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error:
            'Hệ thống đang tạm dừng phục vụ. Bác/Anh/Chị vui lòng quay lại sau hoặc liên hệ trực tiếp Bộ phận Một cửa UBND phường Vinh Phú để được hỗ trợ.',
        },
        {
          status: 503,
          headers: {
            'Retry-After': '3600',
            'Content-Type': 'application/json; charset=utf-8',
          },
        }
      );
    }

    // B. Nếu đã ở trang /maintenance thì tiếp tục render
    if (pathname === '/maintenance') {
      const res = NextResponse.next();
      res.headers.set('Retry-After', '3600');
      return res;
    }

    // C. Mọi trang web khác đều được rewrite ngay tại đầu vào sang trang /maintenance với mã trạng thái 503
    const maintenanceUrl = new URL('/maintenance', req.url);
    const res = NextResponse.rewrite(maintenanceUrl, { status: 503 });
    res.headers.set('Retry-After', '3600');
    return res;
  }

  // 2. TRƯỜNG HỢP BÌNH THƯỜNG (MAINTENANCE_MODE=false hoặc không đặt)
  // Nếu người dùng cố tình truy cập /maintenance lúc đang chạy bình thường, chuyển hướng về trang chủ /
  if (pathname === '/maintenance') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Áp dụng middleware cho tất cả các đường dẫn ngoại trừ static nội bộ của Next.js
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
