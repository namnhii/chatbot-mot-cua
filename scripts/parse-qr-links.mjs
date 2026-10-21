import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const relsPath = 'd:\\chatbot-mot-cua\\temp_xlsx\\xl\\drawings\\_rels\\drawing1.xml.rels';
const drawingPath = 'd:\\chatbot-mot-cua\\temp_xlsx\\xl\\drawings\\drawing1.xml';
const mediaDir = 'd:\\chatbot-mot-cua\\temp_xlsx\\xl\\media';

// 1. Đọc rels
const relsXml = fs.readFileSync(relsPath, 'utf-8');
const idToImage = {};
const relRegex = /Id="([^"]+)"[^>]*Target="([^"]+)"/g;
let m;
while ((m = relRegex.exec(relsXml)) !== null) {
  const rId = m[1];
  const target = m[2]; // e.g. ../media/image1.png
  idToImage[rId] = path.basename(target);
}
console.log(`Tìm thấy ${Object.keys(idToImage).length} liên kết hình ảnh trong rels.`);

// 2. Đọc drawing1.xml
const drawingXml = fs.readFileSync(drawingPath, 'utf-8');
// Mỗi anchor có <xdr:from><xdr:col>4</xdr:col>...<xdr:row>X</xdr:row>... và <a:blip r:embed="rIdY"/>
const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)>[\s\S]*?<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?r:embed="([^"]+)"[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;

const rowToImage = {};
let countAnchors = 0;
while ((m = anchorRegex.exec(drawingXml)) !== null) {
  const row = parseInt(m[1], 10);
  const rId = m[2];
  const imageName = idToImage[rId];
  if (imageName) {
    rowToImage[row] = imageName;
    countAnchors++;
  }
}
console.log(`Đã ánh xạ ${countAnchors} vị trí dòng sang ảnh QR.`);

// 3. Hàm decode QR từ file PNG
function decodeQr(imagePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(imagePath)) return resolve(null);
    fs.createReadStream(imagePath)
      .pipe(new PNG({ filterType: 4 }))
      .on('parsed', function () {
        const code = jsQR(new Uint8ClampedArray(this.data), this.width, this.height);
        if (code) {
          resolve(code.data);
        } else {
          resolve(null);
        }
      })
      .on('error', () => resolve(null));
  });
}

// 4. Test decode 5 ảnh đầu tiên
async function testDecode() {
  const rows = Object.keys(rowToImage).slice(0, 10);
  for (const r of rows) {
    const imgName = rowToImage[r];
    const imgPath = path.join(mediaDir, imgName);
    const result = await decodeQr(imgPath);
    console.log(`Row ${r} (Excel Dòng ${parseInt(r) + 1}) -> ${imgName} -> QR Content: [${result}]`);
  }
}

testDecode().catch(console.error);
