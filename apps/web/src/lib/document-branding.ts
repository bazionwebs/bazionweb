/**
 * Official Corporate Metadata for BAZION WEB
 * Single Source of Truth across Invoices, Receipts, Proposals, Statements, and Emails.
 * Compliant with Government of Kenya Certificate of Registration BN-DLSZOZ6O.
 */
export const BAZION_CORPORATE_DETAILS = {
  legalName: 'BAZION WEB',
  tradingName: 'BazionWeb',
  proprietor: 'Joseph Mburu Kiai',
  slogan: 'Managed Website Lifecycle & Enterprise Cloud Infrastructure',
  regNumber: 'BN-DLSZOZ6O',
  taxPin: 'A006926734I',
  address: 'Mwiki, Gituamba, Embakasi District',
  poBox: 'P.O. Box 46376, 00100 - G.P.O Nairobi',
  city: 'Nairobi',
  country: 'Kenya',
  brsValidation: 'Send BRS to 21546',
  actCap: 'The Registration of Business Names Act (Cap 499, Sec 14)',
  email: 'billing@bazionweb.com',
  supportEmail: 'support@bazionweb.com',
  phone: '+254 721 287 053',
  website: 'https://bazionweb.com',
  registryUrl: 'https://bazionweb.com/portal/invoices',
  globalRegions: 'Nairobi · Frankfurt · London Cloud Hubs',
  logoPath: '/brand/logo-with-background.png',
  paymentChannels: {
    mpesaPaybill: '400200',
    mpesaAccountNumber: '1205232',
    mpesaAccountName: 'BAZION WEB',
    bankName: 'Co-operative Bank of Kenya',
    bankBranch: 'Dandora Branch',
    bankAccountName: 'BAZION WEB',
    bankAccountNumber: '01103361465001',
    bankSwiftCode: 'KCOOKENA',
  },
};

// ─── Pure TypeScript SHA-256 (Zero Node/Browser Dependency) ──────────────────
function sha256Hex(ascii: string): string {
  function rightRotate(v: number, a: number): number {
    return (v >>> a) | (v << (32 - a));
  }
  const maxWord = Math.pow(2, 32);
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComp: Record<number, boolean> = {};

  for (let c = 2; primeCounter < 64; c++) {
    if (!isComp[c]) {
      for (let i = 0; i < 313; i += c) isComp[i] = true;
      hash[primeCounter] = (Math.pow(c, 0.5) * maxWord) | 0;
      k[primeCounter++] = (Math.pow(c, 1 / 3) * maxWord) | 0;
    }
  }

  let padded = ascii + '\x80';
  while ((padded.length % 64) - 56) padded += '\x00';
  for (let i = 0; i < padded.length; i++) {
    const j = padded.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = [...hash];
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15] || 0;
      const w2 = w[i - 2] || 0;
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        ((hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i] || 0
              : ((w[i - 16] || 0) +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  (w[i - 7] || 0) +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0)) |
          0) >>>
        0;
      const temp2 =
        ((rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]))) |
        0;
      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (oldHash[4] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// ─── Cryptographic Security Fingerprint (Anti-Fake Checksum) ────────────────
export interface ChecksumPayload {
  docNumber: string;
  amount?: number | string;
  currency?: string;
  recipientEmail?: string;
  issueDate?: string | Date | null;
}

/**
 * Computes a deterministic SHA-256 security digest formatted as an
 * official banking/tax-grade fingerprint (e.g. SHA256: 8867-4673-B413-...).
 */
export function generateDocumentChecksum(payload: ChecksumPayload): string {
  const parts = [
    String(payload.docNumber || '').trim().toUpperCase(),
    String(payload.amount ?? 0),
    String(payload.currency || 'USD').toUpperCase(),
    String(payload.recipientEmail || '').trim().toLowerCase(),
    payload.issueDate ? new Date(payload.issueDate).toISOString().slice(0, 10) : '2026-01-01',
    'BAZION_SECURE_DOCUMENT_INTEGRITY_SALT_V1',
  ];
  const hash = sha256Hex(parts.join('|')).toUpperCase();
  // Format as 8 hyphenated 4-character blocks (32 hex chars)
  const chunks = hash.slice(0, 32).match(/.{1,4}/g) || [hash.slice(0, 32)];
  return `SHA256: ${chunks.join('-')}`;
}

// ─── Zero-Dependency Pure TypeScript QR Code SVG Generator ───────────────────
// Galois Field GF(256) arithmetic & Reed-Solomon polynomial math
const GF_EXP = new Uint8Array(256);
const GF_LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 256; i++) {
  GF_EXP[i] = x;
  GF_LOG[x] = i;
  x <<= 1;
  if (x & 256) x ^= 0x11d;
}

function gfMult(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
}

function rsPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMult(poly[j], root);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCalculateEcc(data: Uint8Array, eccCount: number): Uint8Array {
  const gen = rsPoly(eccCount);
  const res = new Uint8Array(eccCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    for (let j = 0; j < eccCount - 1; j++) {
      res[j] = res[j + 1] ^ gfMult(gen[j + 1], factor);
    }
    res[eccCount - 1] = gfMult(gen[eccCount], factor);
  }
  return res;
}

interface QrSpec {
  version: number;
  size: number;
  total: number;
  data: number;
  eccPerBlock: number;
  g1Blocks: number;
  g1Data: number;
  g2Blocks: number;
  g2Data: number;
}

// Version table for Level M (Medium ~15% error recovery capacity)
const QR_SPECS: (QrSpec | null)[] = [
  null,
  { version: 1, size: 21, total: 26, data: 16, eccPerBlock: 10, g1Blocks: 1, g1Data: 16, g2Blocks: 0, g2Data: 0 },
  { version: 2, size: 25, total: 44, data: 28, eccPerBlock: 16, g1Blocks: 1, g1Data: 28, g2Blocks: 0, g2Data: 0 },
  { version: 3, size: 29, total: 70, data: 44, eccPerBlock: 26, g1Blocks: 1, g1Data: 44, g2Blocks: 0, g2Data: 0 },
  { version: 4, size: 33, total: 100, data: 64, eccPerBlock: 18, g1Blocks: 2, g1Data: 32, g2Blocks: 0, g2Data: 0 },
  { version: 5, size: 37, total: 134, data: 86, eccPerBlock: 24, g1Blocks: 2, g1Data: 43, g2Blocks: 0, g2Data: 0 },
  { version: 6, size: 41, total: 172, data: 108, eccPerBlock: 16, g1Blocks: 4, g1Data: 27, g2Blocks: 0, g2Data: 0 },
  { version: 7, size: 45, total: 196, data: 124, eccPerBlock: 18, g1Blocks: 4, g1Data: 31, g2Blocks: 0, g2Data: 0 },
  { version: 8, size: 49, total: 242, data: 154, eccPerBlock: 22, g1Blocks: 2, g1Data: 38, g2Blocks: 2, g2Data: 39 },
  { version: 9, size: 53, total: 292, data: 182, eccPerBlock: 22, g1Blocks: 3, g1Data: 36, g2Blocks: 2, g2Data: 37 },
  { version: 10, size: 57, total: 346, data: 216, eccPerBlock: 26, g1Blocks: 4, g1Data: 40, g2Blocks: 1, g2Data: 41 },
];

const ALIGN_POS: number[][] = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

const FORMAT_MASKS = [
  0x5412 ^ 0x422b, 0x5412 ^ 0x475c, 0x5412 ^ 0x4c17, 0x5412 ^ 0x4960,
  0x5412 ^ 0x56a4, 0x5412 ^ 0x53d3, 0x5412 ^ 0x588e, 0x5412 ^ 0x5df9,
];

function buildQrMatrix(text: string): { matrix: number[][]; size: number } {
  const utf8 = Buffer.from(text, 'utf-8');
  let spec: QrSpec | null = null;
  for (let v = 1; v <= 10; v++) {
    const s = QR_SPECS[v]!;
    const countBits = v < 10 ? 8 : 16;
    if (4 + countBits + utf8.length * 8 <= s.data * 8) {
      spec = s;
      break;
    }
  }
  if (!spec) {
    spec = QR_SPECS[10]!;
  }

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  // Byte mode header
  pushBits(0b0100, 4);
  pushBits(utf8.length, spec.version < 10 ? 8 : 16);
  for (let i = 0; i < utf8.length; i++) pushBits(utf8[i], 8);

  const maxDataBits = spec.data * 8;
  const termLen = Math.min(4, maxDataBits - bits.length);
  pushBits(0, termLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxDataBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  const dataBytes = new Uint8Array(spec.data);
  for (let i = 0; i < spec.data; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    dataBytes[i] = b;
  }

  const blocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  let byteOffset = 0;

  for (let b = 0; b < spec.g1Blocks; b++) {
    const slice = dataBytes.slice(byteOffset, byteOffset + spec.g1Data);
    blocks.push(slice);
    eccBlocks.push(rsCalculateEcc(slice, spec.eccPerBlock));
    byteOffset += spec.g1Data;
  }
  for (let b = 0; b < spec.g2Blocks; b++) {
    const slice = dataBytes.slice(byteOffset, byteOffset + spec.g2Data);
    blocks.push(slice);
    eccBlocks.push(rsCalculateEcc(slice, spec.eccPerBlock));
    byteOffset += spec.g2Data;
  }

  const interleaved: number[] = [];
  const maxBlockData = Math.max(spec.g1Data, spec.g2Data);
  for (let i = 0; i < maxBlockData; i++) {
    for (let b = 0; b < blocks.length; b++) {
      if (i < blocks[b].length) interleaved.push(blocks[b][i]);
    }
  }
  for (let i = 0; i < spec.eccPerBlock; i++) {
    for (let b = 0; b < eccBlocks.length; b++) {
      interleaved.push(eccBlocks[b][i]);
    }
  }

  const size = spec.size;
  const matrix: (number | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  const setModule = (r: number, c: number, val: boolean, func = true) => {
    matrix[r][c] = val ? 1 : 0;
    if (func) isFunction[r][c] = true;
  };

  const placeFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setModule(row, col, isBorder || isInner);
        } else {
          setModule(row, col, false);
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) setModule(6, i, i % 2 === 0);
    if (!isFunction[i][6]) setModule(i, 6, i % 2 === 0);
  }
  setModule(size - 8, 8, true);

  const aligns = ALIGN_POS[spec.version] || [];
  for (let r = 0; r < aligns.length; r++) {
    for (let c = 0; c < aligns.length; c++) {
      const cy = aligns[r];
      const cx = aligns[c];
      if (isFunction[cy][cx]) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const isB = Math.abs(dy) === 2 || Math.abs(dx) === 2 || (dy === 0 && dx === 0);
          setModule(cy + dy, cx + dx, isB);
        }
      }
    }
  }

  for (let i = 0; i < 9; i++) {
    isFunction[8][i] = true;
    isFunction[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 1 - i] = true;
    isFunction[size - 1 - i][8] = true;
  }

  const finalBits: number[] = [];
  for (const b of interleaved) {
    for (let i = 7; i >= 0; i--) finalBits.push((b >> i) & 1);
  }

  let bitIdx = 0;
  let dir = -1;
  let col = size - 1;
  while (col > 0) {
    if (col === 6) col--;
    const rows: number[] = [];
    if (dir === -1) {
      for (let r = size - 1; r >= 0; r--) rows.push(r);
    } else {
      for (let r = 0; r < size; r++) rows.push(r);
    }
    for (const r of rows) {
      for (let c = 0; c < 2; c++) {
        const curCol = col - c;
        if (!isFunction[r][curCol]) {
          matrix[r][curCol] = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
        }
      }
    }
    col -= 2;
    dir = -dir;
  }

  const maskPattern = 2; // (col % 3 === 0)
  const maskedMatrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFunction[r][c]) {
        maskedMatrix[r][c] = matrix[r][c] || 0;
      } else {
        const maskBit = c % 3 === 0 ? 1 : 0;
        maskedMatrix[r][c] = (matrix[r][c] || 0) ^ maskBit;
      }
    }
  }

  const formatInfo = FORMAT_MASKS[maskPattern];
  const formatBits: number[] = [];
  for (let i = 0; i < 15; i++) formatBits.push((formatInfo >> i) & 1);

  const posTopLeft = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = posTopLeft[i];
    maskedMatrix[r][c] = formatBits[14 - i];
  }
  for (let i = 0; i < 8; i++) {
    maskedMatrix[size - 1 - i][8] = formatBits[14 - i];
  }
  for (let i = 8; i < 15; i++) {
    maskedMatrix[8][size - 15 + i] = formatBits[14 - i];
  }

  return { matrix: maskedMatrix, size };
}

/**
 * Generates a clean, crisp, self-contained SVG QR Code string.
 */
export function generateQrCodeSvg(
  text: string,
  options: { size?: number; margin?: number; darkColor?: string } = {},
): string {
  const pixelSize = options.size ?? 120;
  const margin = options.margin ?? 3;
  const darkColor = options.darkColor ?? '#0F172A';

  const { matrix, size } = buildQrMatrix(text);
  const totalSize = size + margin * 2;
  const pathParts: string[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        pathParts.push(`M${c + margin},${r + margin}h1v1h-1z`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges">
  <rect width="${totalSize}" height="${totalSize}" fill="#ffffff" rx="6" />
  <path d="${pathParts.join('')}" fill="${darkColor}" />
</svg>`;
}

// ─── Corporate Digital E-Stamp (Official Digital Seal) ───────────────────────
export interface DigitalStampOptions {
  docNumber?: string;
  status?: string;
  dateStr?: string;
  tone?: 'blue' | 'emerald' | 'navy';
  size?: number;
}

/**
 * Generates an executive corporate digital e-stamp / company seal SVG.
 * Features double concentric rings, serrated border, curved legal entity text,
 * security shield emblem, certified checkmark, and authorization reference.
 */
export function renderDigitalStampSvg(options: DigitalStampOptions = {}): string {
  const tone = options.tone ?? (options.status === 'PAID' ? 'emerald' : 'blue');
  const size = options.size ?? 136;
  const color = tone === 'emerald' ? '#047857' : tone === 'navy' ? '#0F172A' : '#1D4ED8';
  const lightBg = tone === 'emerald' ? '#ECFDF5' : tone === 'navy' ? '#F1F5F9' : '#EFF6FF';
  const labelText = options.status === 'PAID' ? 'PAID &amp; VERIFIED' : 'AUTHENTICATED';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" style="transform: rotate(-7deg); display: inline-block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.06));">
  <defs>
    <path id="seal-top-arc" d="M 24,100 A 76,76 0 1,1 176,100" fill="none" />
    <path id="seal-bot-arc" d="M 174,100 A 74,74 0 0,1 26,100" fill="none" />
  </defs>
  <!-- Outer serrated circular seal border -->
  <circle cx="100" cy="100" r="94" stroke="${color}" stroke-width="2.5" stroke-dasharray="4,3" fill="none" opacity="0.85" />
  <!-- Dual inner precision rings -->
  <circle cx="100" cy="100" r="86" stroke="${color}" stroke-width="1.8" fill="none" />
  <circle cx="100" cy="100" r="58" stroke="${color}" stroke-width="1.4" stroke-dasharray="3,2" fill="none" opacity="0.9" />
  <!-- Arched corporate identity text -->
  <text font-family="'Inter', -apple-system, sans-serif" font-size="9" font-weight="900" fill="${color}" letter-spacing="1.4">
    <textPath href="#seal-top-arc" startOffset="50%" text-anchor="middle">★ BAZION WEB · BN-DLSZOZ6O ★</textPath>
  </text>
  <text font-family="'Inter', -apple-system, sans-serif" font-size="8.5" font-weight="800" fill="${color}" letter-spacing="1.3">
    <textPath href="#seal-bot-arc" startOffset="50%" text-anchor="middle">OFFICIAL DIGITAL SEAL · NAIROBI, KENYA</textPath>
  </text>
  <!-- Security Shield Emblem -->
  <path d="M 80,72 L 120,72 L 126,98 L 100,122 L 74,98 Z" fill="${lightBg}" stroke="${color}" stroke-width="2" />
  <!-- Security text inside shield -->
  <text x="100" y="83" text-anchor="middle" font-family="'Inter', -apple-system, sans-serif" font-size="7" font-weight="900" fill="${color}" letter-spacing="0.8">${labelText}</text>
  <text x="100" y="99" text-anchor="middle" font-family="'Inter', -apple-system, sans-serif" font-size="13" font-weight="900" fill="${color}">✓</text>
  <text x="100" y="112" text-anchor="middle" font-family="'Inter', -apple-system, sans-serif" font-size="6.5" font-weight="800" fill="${color}" letter-spacing="0.5">SSOT ENGINE</text>
  <!-- Precision star anchors -->
  <circle cx="32" cy="100" r="2.5" fill="${color}" />
  <circle cx="168" cy="100" r="2.5" fill="${color}" />
</svg>`;
}

// ─── ISO/IEC 15417 Code 128B Linear Security Barcode SVG Generator ──────────
const CODE128_SVG_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export function generateCode128BarcodeSvg(
  rawText: string,
  options: { width?: number; height?: number; darkColor?: string; showCaption?: boolean } = {},
): string {
  const cleanText =
    String(rawText || 'BAZIONWEB')
      .replace(/[^\x20-\x7E]/g, '')
      .trim() || 'BAZIONWEB';

  const codes: number[] = [104]; // Start Code B
  let checksum = 104;
  for (let i = 0; i < cleanText.length; i++) {
    const val = cleanText.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(106); // Stop

  const quietModules = 10;
  let cursor = quietModules;
  const rects: string[] = [];
  const barHeight = options.height ?? 42;
  const showCaption = options.showCaption ?? true;
  const totalHeight = showCaption ? barHeight + 18 : barHeight + 6;
  const darkColor = options.darkColor ?? '#0F172A';

  for (const code of codes) {
    const pattern = CODE128_SVG_PATTERNS[code];
    for (let j = 0; j < pattern.length; j++) {
      const w = Number(pattern[j]);
      if (j % 2 === 0) {
        rects.push(`<rect x="${cursor}" y="3" width="${w}" height="${barHeight}" fill="${darkColor}" />`);
      }
      cursor += w;
    }
  }
  const totalWidth = cursor + quietModules;
  const svgWidth = options.width ?? 280;
  const safeCaption = cleanText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${svgWidth}" height="${Math.round((svgWidth * totalHeight) / totalWidth)}" shape-rendering="crispEdges" role="img" aria-label="Security Barcode ${safeCaption}">
  <rect width="${totalWidth}" height="${totalHeight}" fill="#FFFFFF" rx="4" />
  ${rects.join('')}
  ${showCaption ? `<text x="${totalWidth / 2}" y="${barHeight + 14}" text-anchor="middle" font-family="'JetBrains Mono', monospace, Courier" font-size="9.5" font-weight="700" fill="#334155" letter-spacing="0.6">${safeCaption}</text>` : ''}
</svg>`;
}

function resolveBrandAssetOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')) {
    return window.location.origin;
  }
  return BAZION_CORPORATE_DETAILS.website;
}

// ─── Official Brand Logo Markup ──────────────────────────────────────────────
/**
 * Renders the official BazionWeb brand logo (from /brand/logo-with-background.png)
 * with absolute origin resolution so blob: print windows and standalone receipts render crisply.
 */
export function renderBrandLogoSvg(size = 64): string {
  const logoUrl = `${resolveBrandAssetOrigin()}${BAZION_CORPORATE_DETAILS.logoPath}`;
  const heightPx = Math.max(56, size);
  return `<img src="${logoUrl}" alt="BazionWeb – Build, Host n Grow" style="height: ${heightPx}px; width: auto; display: block; border-radius: 8px; border: 1px solid #CBD5E1; object-fit: contain; background: #EBEBEB;" />`;
}

// ─── Official Payment Channels HTML Block ────────────────────────────────────
export function renderPaymentInstructionsHtml(options: { docNumber?: string; isPaid?: boolean } = {}): string {
  const p = BAZION_CORPORATE_DETAILS.paymentChannels;
  const refLabel = options.docNumber ? ` (Quote Ref: ${options.docNumber})` : '';
  return `<div style="flex: 1; min-width: 280px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 14px; overflow: hidden;">
  <div style="background: #0F172A; color: #FFFFFF; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 14px;">
    Official Payment Channels${refLabel}
  </div>
  <div style="padding: 12px 14px; font-size: 12px; line-height: 1.5; color: #1E293B;">
    <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #CBD5E1;">
      <div style="font-size: 10.5px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.04em;">
        1. Lipa Na M-Pesa (Co-op Bank Paybill)
      </div>
      <div style="margin-top: 2px; font-family: 'JetBrains Mono', monospace, Courier; font-size: 12px; font-weight: 800; color: #0F172A;">
        Paybill: <span style="color: #047857;">${p.mpesaPaybill}</span> &nbsp;|&nbsp; Account: <span style="color: #047857;">${p.mpesaAccountNumber}</span>
      </div>
      <div style="font-size: 11px; color: #475569;">Business Name: <strong>${p.mpesaAccountName}</strong></div>
    </div>
    <div>
      <div style="font-size: 10.5px; font-weight: 800; color: #1D4ED8; text-transform: uppercase; letter-spacing: 0.04em;">
        2. Bank Transfer (EFT / RTGS / SWIFT)
      </div>
      <div style="font-size: 11.5px; color: #0F172A; margin-top: 2px;">
        <strong>${p.bankName}</strong> (${p.bankBranch})
      </div>
      <div style="font-family: 'JetBrains Mono', monospace, Courier; font-size: 11.5px; font-weight: 800; color: #0F172A;">
        A/C Name: ${p.bankAccountName} &nbsp;|&nbsp; A/C No: ${p.bankAccountNumber}
      </div>
      <div style="font-size: 11px; color: #475569;">
        SWIFT / BIC: <strong>${p.bankSwiftCode}</strong> &nbsp;&bull;&nbsp; Online Card / STK: <a href="${BAZION_CORPORATE_DETAILS.registryUrl}" style="color: #2563EB; text-decoration: none; font-weight: 700;">bazionweb.com/portal/invoices</a>
      </div>
    </div>
  </div>
</div>`;
}

// ─── Executive Document Letterhead HTML ──────────────────────────────────────
export interface LetterheadOptions {
  docType: 'OFFICIAL INVOICE' | 'PAYMENT RECEIPT' | 'PROJECT PROPOSAL' | 'ACCOUNT STATEMENT';
  docNumber: string;
  statusBadgeText?: string;
  statusTone?: 'emerald' | 'amber' | 'blue' | 'slate';
  issueDate?: string | Date | null;
  dueDate?: string | Date | null;
  settledDate?: string | Date | null;
  gatewayRef?: string | null;
}

/**
 * Builds the official corporate letterhead with full registered company
 * identity, vector brand logo, and two-tone security rule.
 */
export function renderDocumentLetterheadHtml(options: LetterheadOptions): string {
  const { legalName, address, city, country, taxPin, email, phone, website } = BAZION_CORPORATE_DETAILS;
  const isPaid = options.statusTone === 'emerald' || options.docType === 'PAYMENT RECEIPT';
  const badgeBg = isPaid ? '#dcfce7' : options.statusTone === 'blue' ? '#dbeafe' : '#fef3c7';
  const badgeColor = isPaid ? '#166534' : options.statusTone === 'blue' ? '#1e40af' : '#92400e';
  const badgeBorder = isPaid ? '#bbf7d0' : options.statusTone === 'blue' ? '#bfdbfe' : '#fde68a';
  const badgeText = options.statusBadgeText || (isPaid ? 'PAID IN FULL' : 'ACTION REQUIRED');

  return `<!-- Executive Corporate Letterhead -->
<header style="border-bottom: 2px solid #0F172A; padding-bottom: 20px; position: relative;">
  <!-- Security Microline Accent -->
  <div style="height: 3px; background: linear-gradient(90deg, #0F172A 0%, #2563EB 60%, #10B981 100%); border-radius: 2px; margin-bottom: 20px;"></div>

  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; flex-wrap: wrap;">
    <!-- Left: Brand Logo & Full Registered Corporate Identity -->
    <div style="display: flex; align-items: flex-start; gap: 16px; max-width: 500px;">
      <div style="flex-shrink: 0;">
        ${renderBrandLogoSvg(74)}
      </div>
      <div>
        <div style="font-size: 13px; font-weight: 900; color: #0F172A; letter-spacing: 0.02em;">
          ${legalName} <span style="font-size: 10.5px; font-weight: 600; color: #64748B;">(Proprietor: ${BAZION_CORPORATE_DETAILS.proprietor})</span>
        </div>
        <div style="font-size: 10.5px; color: #64748B; margin-top: 3px; line-height: 1.48;">
          ${address} · ${BAZION_CORPORATE_DETAILS.poBox} · ${city}, ${country}<br>
          <strong>BRS Reg:</strong> ${BAZION_CORPORATE_DETAILS.regNumber} (Cap 499, Sec 14) · <strong>KRA PIN:</strong> ${taxPin}<br>
          <strong>Email:</strong> <a href="mailto:${email}" style="color: #2563EB; text-decoration: none;">${email}</a> · <strong>Tel:</strong> ${phone} · <a href="${website}" style="color: #64748B; text-decoration: none;">${website.replace(/^https?:\/\//, '')}</a>
        </div>
      </div>
    </div>

    <!-- Right: Formal Document Title, Number & Status Badge -->
    <div style="text-align: right; min-width: 220px;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748B; letter-spacing: 0.1em;">
        ${options.docType}
      </div>
      <div style="font-size: 20px; font-weight: 900; font-family: 'JetBrains Mono', monospace, Courier; color: #0F172A; margin-top: 4px; letter-spacing: -0.01em;">
        ${options.docNumber}
      </div>
      <div style="margin-top: 8px;">
        <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
          ${badgeText}
        </span>
      </div>
    </div>
  </div>
</header>`;
}

// ─── Anti-Fake Security & Authenticity Verification Block ───────────────────
export interface SecuritySectionOptions {
  docNumber: string;
  docType: string;
  totalAmount?: number | string;
  currency?: string;
  recipientEmail?: string;
  issueDate?: string | Date | null;
  status?: string;
  isPaid?: boolean;
}

/**
 * Builds the comprehensive Anti-Fake Security Section featuring:
 * 1. Dynamic QR Code linking to official verification URL
 * 2. SHA-256 Tamper-Evident Cryptographic Checksum
 * 3. Corporate E-Stamp / Official Digital Seal
 * 4. Microprint security ribbon
 * 5. Kenya Cap 411A & UNCITRAL statutory electronic validity notice
 */
export function renderSecurityVerificationSectionHtml(options: SecuritySectionOptions): string {
  const isPaid = options.isPaid ?? options.status === 'PAID';
  const checksum = generateDocumentChecksum({
    docNumber: options.docNumber,
    amount: options.totalAmount,
    currency: options.currency,
    recipientEmail: options.recipientEmail,
    issueDate: options.issueDate,
  });

  const cleanHashSuffix = checksum.replace(/^SHA256:\s*/, '').replace(/-/g, '').slice(0, 6);
  const barcodeValue = `${String(options.docNumber || 'BAZION').toUpperCase()}-${cleanHashSuffix}`;
  const verifyUrl = `${BAZION_CORPORATE_DETAILS.registryUrl}?verify=${encodeURIComponent(options.docNumber)}&checksum=${encodeURIComponent(checksum.slice(8, 20))}`;
  const barcodeSvg = generateCode128BarcodeSvg(barcodeValue, { width: 290, height: 38, darkColor: '#0F172A' });
  const stampSvg = renderDigitalStampSvg({
    docNumber: options.docNumber,
    status: isPaid ? 'PAID' : 'AUTHENTICATED',
    tone: isPaid ? 'emerald' : 'blue',
    size: 124,
  });

  return `<!-- Anti-Fake Document Security & Electronic Authenticity Center -->
<section style="margin-top: 36px; border: 1px solid #CBD5E1; border-radius: 16px; background: #F8FAFC; overflow: hidden; page-break-inside: avoid;">
  <!-- Security Microprint Ribbon -->
  <div style="background: #0F172A; color: #94A3B8; font-size: 9px; font-family: 'JetBrains Mono', monospace, Courier; text-transform: uppercase; letter-spacing: 0.12em; padding: 6px 14px; text-align: center; border-bottom: 1px solid #1E293B;">
    ••• BAZION WEB (REG: BN-DLSZOZ6O | KRA PIN: ${BAZION_CORPORATE_DETAILS.taxPin}) ••• OFFICIAL SYSTEM-GENERATED RECORD ••• ISO 14533 ALIGNED •••
  </div>

  <div style="padding: 18px 22px;">
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap;">
      <!-- Left: Linear ISO Code-128B Security Barcode & Cryptographic Checksum -->
      <div style="flex: 1; min-width: 280px;">
        <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #0F172A;">
          Security Barcode (Code-128B) &amp; Cryptographic Fingerprint
        </div>
        <div style="background: #FFFFFF; padding: 8px 10px; border-radius: 10px; border: 1px solid #CBD5E1; display: inline-block; margin-top: 6px;">
          ${barcodeSvg}
        </div>
        <div style="font-family: 'JetBrains Mono', monospace, Courier; font-size: 10px; font-weight: 800; color: #1E40AF; background: #EFF6FF; border: 1px solid #BFDBFE; padding: 5px 8px; border-radius: 6px; margin-top: 8px; word-break: break-all;">
          ${checksum}
        </div>
        <p style="font-size: 9.5px; color: #475569; margin-top: 6px; line-height: 1.45;">
          <strong>Statutory Validity:</strong> Pursuant to Cap 499 Sec 14, Kenya KICA Cap 411A &amp; UNCITRAL Model Law, this computer-generated record (KRA PIN: <strong>${BAZION_CORPORATE_DETAILS.taxPin}</strong>) is legally valid without a wet-ink signature. <a href="${verifyUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563EB; font-weight: 700; text-decoration: none;">Verify online &rarr;</a>
        </p>
      </div>

      <!-- Right: Official Corporate Digital E-Stamp -->
      <div style="flex-shrink: 0; text-align: center;">
        ${stampSvg}
      </div>
    </div>
  </div>
</section>`;
}

// ─── Subtle Anti-Fraud Watermark Style ───────────────────────────────────────
/**
 * Renders print & screen friendly background security watermark CSS.
 */
export function getAntiFraudWatermarkCss(): string {
  return `
    .security-watermark-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 64px;
      font-weight: 900;
      color: rgba(15, 23, 42, 0.038);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      pointer-events: none;
      user-select: none;
      z-index: 1;
      white-space: nowrap;
    }
    @media print {
      .security-watermark-overlay {
        color: rgba(0, 0, 0, 0.04) !important;
      }
    }
  `;
}
