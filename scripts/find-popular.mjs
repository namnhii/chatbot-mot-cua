import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('d:\\chatbot-mot-cua\\scripts\\tthc-data.json', 'utf-8'));

const targetFields = [
  'Hộ tịch',
  'Chứng thực',
  'Đất đai',
  'Thành lập và hoạt động doanh nghiệp (hộ kinh doanh)',
  'Thủ tục hành chính liên thông',
  'Bảo trợ xã hội',
  'Hoạt động xây dựng',
  'Nhà ở và công sở'
];

console.log('=== DANH SÁCH CHI TIẾT CÁC THỦ TỤC TRONG CÁC LĨNH VỰC DÂN SINH CAO NHẤT ===\n');

for (const field of targetFields) {
  const procs = data.byField[field] || [];
  console.log(`\n--- [${field}] (${procs.length} thủ tục) ---`);
  procs.forEach((p, i) => {
    console.log(` ${i + 1}. [${p.maTthc}] ${p.tenTthc} (Mức độ: ${p.mucDo})`);
  });
}
