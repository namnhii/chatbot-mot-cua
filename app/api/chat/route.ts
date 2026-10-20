import { NextResponse } from 'next/server';
import { executeRagQuery } from '@/utils/rag-engine.mjs';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Tin nhắn không hợp lệ' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    executeRagQuery({
      question: message,
      history: history || [],
      onChunk: async (chunkText) => {
        const payload = JSON.stringify({ type: 'chunk', text: chunkText }) + '\n';
        await writer.write(encoder.encode(payload));
      }
    })
      .then(async (result) => {
        const finalPayload = JSON.stringify({
          type: 'done',
          sources: result.sources,
          latencyMs: result.latencyMs,
          firstTokenMs: result.firstTokenMs,
          condensedQuestion: result.condensedQuestion,
          breakdown: result.breakdown
        }) + '\n';
        await writer.write(encoder.encode(finalPayload));
        await writer.close();
      })
      .catch(async (err) => {
        console.error('Lỗi RAG API:', err);
        const errorPayload = JSON.stringify({ type: 'error', error: err.message }) + '\n';
        await writer.write(encoder.encode(errorPayload));
        await writer.close();
      });

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error('API Chat Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
