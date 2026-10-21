import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const items = JSON.parse(fs.readFileSync('d:\\chatbot-mot-cua\\scripts\\top10-qr-results.json', 'utf-8'));
const docsDir = 'd:\\chatbot-mot-cua\\docs';

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

async function main() {
  console.log(`=== BẮT ĐẦU TẢI 10 FILE PDF TÀI LIỆU TỪ MÃ QR CỔNG DVC QUỐC GIA ===\n`);
  
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });

  const downloadReport = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const safeName = `TTHC_${item.maTthc.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const targetPdfPath = path.join(docsDir, `${safeName}.pdf`);

    console.log(`[${i + 1}/10] Đang xử lý: [${item.maTthc}] ${item.tenTthc}`);
    console.log(`      Link: ${item.qrLink}`);

    const page = await context.newPage();
    let success = false;
    let method = '';

    try {
      await page.goto(item.qrLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Chờ một chút để React hydrate
      await page.waitForTimeout(2000);

      // Tìm nút icon PDF màu đỏ
      const pdfBtnSelector = 'button:has(svg.text-red-500)';
      const btn = await page.$(pdfBtnSelector);

      if (btn) {
        console.log(`      -> Tìm thấy nút PDF màu đỏ. Đang gửi lệnh tải xuống...`);
        try {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }),
            btn.click()
          ]);

          await download.saveAs(targetPdfPath);
          const stats = fs.statSync(targetPdfPath);
          console.log(`      ✅ ĐÃ TẢI FILE PDF GỐC THÀNH CÔNG: ${path.basename(targetPdfPath)} (${stats.size} bytes)`);
          success = true;
          method = 'PDF_DIRECT_DOWNLOAD';
        } catch (downloadErr) {
          console.log(`      ⚠️ Lỗi chờ download event (${downloadErr.message}). Chuyển sang Phương án 2 (Cào nội dung chi tiết)...`);
        }
      } else {
        console.log(`      ⚠️ Không tìm thấy nút PDF đỏ trên giao diện. Chuyển sang Phương án 2...`);
      }

      // NẾU PHƯƠNG ÁN 1 KHÔNG THÀNH CÔNG -> THỰC HIỆN PHƯƠNG ÁN 2 (CÀO TOÀN BỘ NỘI DUNG CHI TIẾT & IN PDF)
      if (!success) {
        console.log(`      -> [Phương án 2] Cào tự động toàn bộ nội dung chi tiết thủ tục...`);
        const extracted = await page.evaluate(() => {
          return {
            title: document.title,
            bodyText: document.body.innerText
          };
        });

        // Tạo PDF bằng Playwright page.pdf()
        await page.pdf({
          path: targetPdfPath,
          format: 'A4',
          margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
          printBackground: true
        });

        const stats = fs.statSync(targetPdfPath);
        console.log(`      ✅ ĐÃ XUẤT NỘI DUNG CÀO THÀNH FILE PDF: ${path.basename(targetPdfPath)} (${stats.size} bytes)`);
        success = true;
        method = 'CRAWL_AND_GENERATE_PDF';
      }

      downloadReport.push({
        maTthc: item.maTthc,
        tenTthc: item.tenTthc,
        qrLink: item.qrLink,
        status: 'SUCCESS',
        method,
        file: path.basename(targetPdfPath),
        sizeBytes: fs.statSync(targetPdfPath).size
      });

    } catch (err) {
      console.error(`      ❌ THẤT BẠI: ${err.message}`);
      downloadReport.push({
        maTthc: item.maTthc,
        tenTthc: item.tenTthc,
        qrLink: item.qrLink,
        status: 'FAILED',
        error: err.message
      });
    } finally {
      await page.close();
    }

    console.log('');
  }

  await browser.close();

  fs.writeFileSync('d:\\chatbot-mot-cua\\scripts\\download-summary.json', JSON.stringify(downloadReport, null, 2), 'utf-8');
  console.log(`\n========================================================`);
  console.log(`🎉 HOÀN TẤT TẢI DỮ LIỆU 10 THỦ TỤC VỀ THƯ MỤC docs/!`);
  const successCount = downloadReport.filter(r => r.status === 'SUCCESS').length;
  console.log(`Tổng kết: ${successCount}/10 thủ tục thành công.`);
  console.log(`========================================================\n`);
}

main().catch(console.error);
