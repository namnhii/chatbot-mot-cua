import XLSX from 'xlsx';

const workbook = XLSX.readFile('D:\\tthc.xlsx');
const sheet = workbook.Sheets['Ma_QR_Thu_Tuc'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- 15 dòng đầu tiên tại cột 4 (cột E) ---');
for (let i = 0; i < Math.min(20, rows.length); i++) {
  const row = rows[i];
  if (row) {
    console.log(`Dòng ${i + 1}: STT=[${row[0]}], Mã=[${row[2]}], Tên=[${(row[3] || '').substring(0, 30)}], Cột E (QR)=[${row[4]}]`);
  }
}
