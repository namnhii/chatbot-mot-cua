import { NextResponse } from 'next/server';
import slideshowImages from '@/utils/slideshow-manifest.json';

// Chốt danh sách ảnh tại thời điểm build để chạy tối ưu trên Vercel Serverless
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ images: slideshowImages });
}
