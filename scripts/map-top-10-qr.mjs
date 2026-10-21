import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const relsPath = 'd:\\chatbot-mot-cua\\temp_xlsx\\xl\\drawings\\_rels\\drawing1.xml.rels';
const drawingPath = 'd:\\chatbot-mot-cua\\temp_xlsx\\xl\\drawings\\drawing1.xml';
const mediaDir = 'd:\\chatbot-mot-cua\\temp_xlsx\\xl\\media';

// 1. Map rels
const relsXml = fs.readFileSync(relsPath, 'utf-8');
const idToImage = {};
const relRegex = /Id="([^"]+)"[^>]*Target="([^"]+)"/g;
let m;
while ((m = relRegex.exec(relsXml)) !== null) {
  idToImage[m[1]] = path.basename(m[2]);
}

// 2. Map row -> image
const drawingXml = fs.readFileSync(drawingPath, 'utf-8');
const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)>[\s\S]*?<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?r:embed="([^"]+)"[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
const rowToImage = {};
while ((m = anchorRegex.exec(drawingXml)) !== null) {
  const row = parseInt(m[1], 10);
  const rId = m[2];
  if (idToImage[rId]) {
    rowToImage[row] = idToImage[rId];
  }
}

// 3. Decode QR
function decodeQr(imagePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(imagePath)) return resolve(null);
    fs.createReadStream(imagePath)
      .pipe(new PNG({ filterType: 4 }))
      .on('parsed', function () {
        const code = jsQR(new Uint8ClampedArray(this.data), this.width, this.height);
        resolve(code ? code.data : null);
      })
      .on('error', () => resolve(null));
  });
}

// 4. Đọc sheet Excel
const workbook = XLSX.readFile('D:\\tthc.xlsx');
const sheet = workbook.Sheets['Ma_QR_Thu_Tuc'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const top10Codes = [
  '2.000815', // Chứng thực bản sao từ bản chính
  '2.000884', // Chứng thực chữ ký
  '1.004873', // Cấp Giấy xác nhận tình trạng hôn nhân
  '3.000722', // Liên thông: Khai sinh, thường trú, BHYT trẻ < 6 tuổi
  '1.000894', // Đăng ký kết hôn
  '2.000635', // Cấp bản sao Trích lục hộ tịch
  '2.002913', // Liên thông: Khai tử, xóa thường trú, mai táng phí
  '1.001612', // Đăng ký thành lập Hộ kinh doanh
  '1.013978', // Đăng ký đất đai, cấp GCN QSDĐ lần đầu
  '1.013225'  // Cấp phép xây dựng nhà ở riêng lẻ
];

async function run() {
  console.log('=== KẾT QUẢ QUÉT MÃ QR CỦA TOP 10 THỦ TỤC HÀNH CHÍNH ===\n');
  const results = [];

  for (let r = 5; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const maTthc = (row[2] || '').toString().trim();
    const tenTthc = (row[3] || '').toString().trim();
    const linhVuc = (row[1] || '').toString().trim();

    if (top10Codes.includes(maTthc)) {
      const imgName = rowToImage[r];
      let qrLink = null;
      if (imgName) {
        qrLink = await decodeQr(path.join(mediaDir, imgName));
      }

      results.push({
        row: r + 1,
        maTthc,
        tenTthc,
        linhVuc,
        image: imgName,
        qrLink
      });
    }
  }

  results.forEach((res, i) => {
    console.log(`${i + 1}. [${res.maTthc}] ${res.tenTthc}`);
    console.log(`   - Lĩnh vực: ${res.linhVuc}`);
    console.log(`   - Dòng Excel: ${res.row}`);
    console.log(`   - Ảnh QR: ${res.image}`);
    console.log(`   - Link Dịch vụ công: ${res.qrLink}\n`);
  });

  fs.writeFileSync('d:\\chatbot-mot-cua\\scripts\\top10-qr-results.json', JSON.stringify(results, null, 2), 'utf-8');
}

run().catch(console.error);
