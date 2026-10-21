// Bộ giới hạn tần suất (Rate Limiter) theo địa chỉ IP
// Bảo vệ hạn mức Gemini API miễn phí và chống spam

interface RateLimitRecord {
  timestamps: number[];
}

const ipMap = new Map<string, RateLimitRecord>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  errorMessage?: string;
}

/**
 * Kiểm tra giới hạn tần suất theo IP
 * @param ip Địa chỉ IP của client
 * @param maxRequests Số yêu cầu tối đa trong một cửa sổ thời gian (mặc định: 10 câu / phút)
 * @param windowMs Độ dài cửa sổ thời gian tính bằng ms (mặc định: 60.000ms = 1 phút)
 */
export function checkRateLimit(
  ip: string,
  maxRequests: number = 10,
  windowMs: number = 60 * 1000
): RateLimitResult {
  const now = Date.now();

  // Dọn dẹp định kỳ các IP đã hết hạn
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    ipMap.forEach((record, key) => {
      record.timestamps = record.timestamps.filter(ts => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        ipMap.delete(key);
      }
    });
  }

  const record = ipMap.get(ip) || { timestamps: [] };
  // Lọc các timestamp nằm trong cửa sổ trượt hiện tại
  record.timestamps = record.timestamps.filter(ts => now - ts < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0];
    const resetSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetSeconds: Math.max(1, resetSeconds),
      errorMessage: `Hệ thống đang tiếp nhận nhiều lượt hỏi cùng lúc. Bác/Anh/Chị vui lòng chờ khoảng ${Math.max(1, resetSeconds)} giây rồi gửi tiếp nhé!`,
    };
  }

  record.timestamps.push(now);
  ipMap.set(ip, record);

  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - record.timestamps.length,
    resetSeconds: Math.ceil(windowMs / 1000),
  };
}

/**
 * Trích xuất địa chỉ IP thực của người dùng (tương thích Vercel proxy)
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}
