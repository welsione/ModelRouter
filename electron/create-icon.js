const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a valid 512x512 PNG icon

const width = 512;
const height = 512;

// PNG signature
const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

// Create CRC32 lookup table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const crcData = Buffer.concat([typeBuffer, data]);
  const crcValue = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crcValue, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// Create IHDR chunk
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);  // width
ihdr.writeUInt32BE(height, 4); // height
ihdr[8] = 8;  // bit depth
ihdr[9] = 2;  // color type (RGB)
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// Create raw image data (blue circle on white background)
const rawData = [];
for (let y = 0; y < height; y++) {
  rawData.push(0); // filter byte
  for (let x = 0; x < width; x++) {
    const cx = width / 2;
    const cy = height / 2;
    const r = width / 2 - 20;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    
    if (dist < r) {
      // Blue color (66, 133, 244)
      rawData.push(66, 133, 244);
    } else {
      // White background
      rawData.push(255, 255, 255);
    }
  }
}

// Compress with zlib
const compressed = zlib.deflateSync(Buffer.from(rawData));

// Create PNG file
const png = Buffer.concat([
  signature,
  createChunk('IHDR', ihdr),
  createChunk('IDAT', compressed),
  createChunk('IEND', Buffer.alloc(0))
]);

const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

fs.writeFileSync(path.join(buildDir, 'icon.png'), png);
console.log('Icon created successfully! Size:', png.length, 'bytes');
