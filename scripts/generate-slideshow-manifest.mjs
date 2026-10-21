import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const slideshowDir = path.join(rootDir, 'public', 'vinh-phu', 'slideshow');
const outputDir = path.join(rootDir, 'utils');
const outputFile = path.join(outputDir, 'slideshow-manifest.json');

const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.jfif'];

let imageFiles = [];

if (fs.existsSync(slideshowDir)) {
  const files = fs.readdirSync(slideshowDir);
  imageFiles = files
    .filter(file => validExtensions.includes(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(file => `/vinh-phu/slideshow/${file}`);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputFile, JSON.stringify(imageFiles, null, 2), 'utf-8');
console.log(`[Slideshow Manifest] Đã chốt danh sách ${imageFiles.length} ảnh tại build-time:`);
imageFiles.forEach(img => console.log(` - ${img}`));
