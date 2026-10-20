-- ============================================================
-- SQL THIẾT LẬP VECTOR DATABASE TRÊN SUPABASE CHO GOOGLE GEMINI
-- Kích thước vector: 768 chiều (gemini-embedding-001)
-- ============================================================

-- 1. Bật extension pgvector để hỗ trợ tìm kiếm vector
create extension if not exists vector;

-- 2. Tạo bảng documents lưu trữ tài liệu đã cắt nhỏ
create table if not exists documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  embedding vector(768)
);

-- 3. Tạo index HNSW để tăng tốc độ tìm kiếm vector tương đồng
create index if not exists documents_embedding_hnsw_idx 
on documents 
using hnsw (embedding vector_cosine_ops);

-- 4. Tạo hàm tìm kiếm độ tương đồng (RPC match_documents)
create or replace function match_documents (
  query_embedding vector(768),
  match_count int default 5,
  filter jsonb default '{}'::jsonb
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
