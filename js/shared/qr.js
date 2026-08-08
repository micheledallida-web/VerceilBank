// Minimal QR Code encoder — byte mode, error correction level L, versions 1–6.
//
// The deposit screen shows a QR for a real Bitcoin address, so the matrix has
// to be a genuine QR: a decorative grid of random squares would scan as
// nothing (or, worse, as something else) and send someone's funds nowhere.
// This is deliberately the smallest encoder that covers a `bitcoin:` URI —
// versions 1–6 hold up to 134 bytes at level L, and stopping at 6 means no
// version-information blocks and a single alignment pattern to place.
//
// Usage:
//   const { size, modules } = encodeQr('bitcoin:bc1...?amount=0.001');
//   modules[row * size + col] === 1  → dark module
//
// Throws if the payload is longer than version 6 can hold.

// [data codewords, EC codewords per block, block count] for level L.
const VERSIONS = [
  null,
  { data: 19, ec: 7, blocks: 1 },
  { data: 34, ec: 10, blocks: 1 },
  { data: 55, ec: 15, blocks: 1 },
  { data: 80, ec: 20, blocks: 1 },
  { data: 108, ec: 26, blocks: 1 },
  { data: 136, ec: 18, blocks: 2 },
];

// Mode indicator (4 bits) + character count (8 bits for byte mode at these
// versions) = 12 bits of header, so a version holds `data - 2` payload bytes.
const HEADER_BYTES = 2;

// ---------- GF(256) arithmetic, the field QR's Reed–Solomon works over ----------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function buildTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // QR's primitive polynomial
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

// Generator polynomial for `degree` error-correction codewords: the product of
// (x - a^i) for i in 0..degree-1. Built up coefficient-by-coefficient with the
// constant term first, then reversed — the division below indexes it in
// descending degree, with the leading 1 at index 0.
function generatorPoly(degree) {
  let poly = [1];
  for (let d = 0; d < degree; d++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let i = 0; i < poly.length; i++) {
      next[i] ^= gfMul(poly[i], EXP[d]);
      next[i + 1] ^= poly[i];
    }
    poly = next;
  }
  return poly.reverse();
}

function reedSolomon(data, ecLength) {
  const gen = generatorPoly(ecLength);
  const remainder = new Uint8Array(ecLength);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[ecLength - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLength; j++) {
        remainder[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return remainder;
}

// ---------- Codeword stream ----------
function toUtf8Bytes(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
  return Uint8Array.from(unescape(encodeURIComponent(text)), c => c.charCodeAt(0));
}

function buildCodewords(bytes, version) {
  const spec = VERSIONS[version];
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4);        // byte mode
  push(bytes.length, 8);  // character count
  for (const b of bytes) push(b, 8);

  // Terminator, then pad out to a whole codeword.
  const capacityBits = spec.data * 8;
  for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = new Uint8Array(spec.data);
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords[i / 8] = byte;
  }
  // Alternating pad bytes fill whatever the message left empty.
  const padBytes = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < spec.data; i++, p++) {
    codewords[i] = padBytes[p % 2];
  }
  return codewords;
}

// Split into blocks, append each block's EC codewords, then interleave both
// groups the way the spec requires.
function interleave(codewords, version) {
  const spec = VERSIONS[version];
  const perBlock = spec.data / spec.blocks;
  const dataBlocks = [];
  const ecBlocks = [];

  for (let b = 0; b < spec.blocks; b++) {
    const block = codewords.subarray(b * perBlock, (b + 1) * perBlock);
    dataBlocks.push(block);
    ecBlocks.push(reedSolomon(block, spec.ec));
  }

  const result = new Uint8Array(spec.data + spec.ec * spec.blocks);
  let n = 0;
  for (let i = 0; i < perBlock; i++) {
    for (const block of dataBlocks) result[n++] = block[i];
  }
  for (let i = 0; i < spec.ec; i++) {
    for (const block of ecBlocks) result[n++] = block[i];
  }
  return result;
}

// ---------- Matrix ----------
function placeFunctionPatterns(modules, reserved, size, version) {
  const set = (r, c, dark) => {
    modules[r * size + c] = dark ? 1 : 0;
    reserved[r * size + c] = 1;
  };

  // Finder patterns and their separators, in all three corners.
  const finders = [[0, 0], [0, size - 7], [size - 7, 0]];
  for (const [fr, fc] of finders) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = fr + r;
        const cc = fc + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6))
          || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(rr, cc, inRing || inCore);
      }
    }
  }

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Versions 2–6 carry exactly one alignment pattern, bottom-right.
  if (version >= 2) {
    const center = 4 * version + 10;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const ring = Math.max(Math.abs(r), Math.abs(c));
        set(center + r, center + c, ring !== 1);
      }
    }
  }

  // Dark module, always at this fixed position.
  set(4 * version + 9, 8, true);

  // Reserve the two format-information strips (written after masking).
  for (let i = 0; i < 9; i++) {
    if (!reserved[8 * size + i]) set(8, i, false);
    if (!reserved[i * size + 8]) set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8 * size + (size - 1 - i)]) set(8, size - 1 - i, false);
    if (!reserved[(size - 1 - i) * size + 8]) set(size - 1 - i, 8, false);
  }
}

// Zigzag fill: two-module-wide columns, right to left, skipping column 6.
function placeData(modules, reserved, size, data) {
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    // Direction comes from the column's own position rather than a toggle —
    // the skip over column 6 would otherwise flip every pair after it.
    const upward = ((right + 1) & 2) === 0;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let c = 0; c < 2; c++) {
        const col = right - c;
        if (reserved[row * size + col]) continue;
        let bit = 0;
        if (bitIndex >> 3 < data.length) {
          bit = (data[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
        }
        modules[row * size + col] = bit;
        bitIndex++;
      }
    }
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(modules, reserved, size, mask) {
  const fn = MASKS[mask];
  const out = modules.slice();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r * size + c]) continue;
      if (fn(r, c)) out[r * size + c] ^= 1;
    }
  }
  return out;
}

// Format information: 5 data bits (EC level + mask) expanded by BCH(15,5).
function placeFormatInfo(modules, size, mask) {
  const ECC_L = 0b01;
  let value = (ECC_L << 3) | mask;
  let rem = value;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  const bits = ((value << 10) | rem) ^ 0x5412;

  // First copy wraps the top-left finder: bits 0–5 climb column 8, then the
  // strip turns the corner and runs left along row 8, ending with the most
  // significant bit at (8, 0).
  const bitAt = i => (bits >> i) & 1;
  for (let i = 0; i <= 5; i++) modules[i * size + 8] = bitAt(i);
  modules[7 * size + 8] = bitAt(6);
  modules[8 * size + 8] = bitAt(7);
  modules[8 * size + 7] = bitAt(8);
  for (let i = 9; i < 15; i++) modules[8 * size + (14 - i)] = bitAt(i);

  // Second copy: along row 8 from the right edge, then up column 8 from the
  // bottom-left finder.
  for (let i = 0; i <= 7; i++) modules[8 * size + (size - 1 - i)] = bitAt(i);
  for (let i = 8; i < 15; i++) modules[(size - 15 + i) * size + 8] = bitAt(i);

  modules[(size - 8) * size + 8] = 1; // dark module, never masked
}

// The four standard penalty rules. Lower is better; the mask with the lowest
// total is the one a real encoder picks, and it matters — a badly masked
// matrix can defeat a phone camera even though the bits are correct.
function penalty(modules, size) {
  let score = 0;

  const runPenalty = (getter) => {
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (getter(a, b) === getter(a, b - 1)) {
          run++;
        } else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  };
  runPenalty((r, c) => modules[r * size + c]);
  runPenalty((c, r) => modules[r * size + c]);

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r * size + c];
      if (v === modules[r * size + c + 1]
        && v === modules[(r + 1) * size + c]
        && v === modules[(r + 1) * size + c + 1]) score += 3;
    }
  }

  const FINDER = [1, 0, 1, 1, 1, 0, 1];
  const matches = (get, a, start) => {
    for (let i = 0; i < 7; i++) if (get(a, start + i) !== FINDER[i]) return false;
    return true;
  };
  const clear = (get, a, start, end) => {
    for (let i = start; i < end; i++) {
      if (i < 0 || i >= size) continue;
      if (get(a, i) !== 0) return false;
    }
    return true;
  };
  const finderPenalty = (get) => {
    for (let a = 0; a < size; a++) {
      for (let b = 0; b <= size - 7; b++) {
        if (!matches(get, a, b)) continue;
        if (clear(get, a, b - 4, b) || clear(get, a, b + 7, b + 11)) score += 40;
      }
    }
  };
  finderPenalty((r, c) => (c < 0 || c >= size ? 0 : modules[r * size + c]));
  finderPenalty((c, r) => (r < 0 || r >= size ? 0 : modules[r * size + c]));

  let dark = 0;
  for (let i = 0; i < modules.length; i++) dark += modules[i];
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/**
 * Encode `text` as a QR matrix.
 * @returns {{ size: number, modules: Uint8Array }} row-major, 1 = dark.
 */
export function encodeQr(text) {
  const bytes = toUtf8Bytes(text);

  let version = 0;
  for (let v = 1; v < VERSIONS.length; v++) {
    if (bytes.length <= VERSIONS[v].data - HEADER_BYTES) { version = v; break; }
  }
  if (!version) {
    throw new Error(`QR payload too long (${bytes.length} bytes; max ${VERSIONS[6].data - HEADER_BYTES})`);
  }

  const size = 17 + 4 * version;
  const base = new Uint8Array(size * size);
  const reserved = new Uint8Array(size * size);

  placeFunctionPatterns(base, reserved, size, version);
  placeData(base, reserved, size, interleave(buildCodewords(bytes, version), version));

  let best = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = applyMask(base, reserved, size, mask);
    placeFormatInfo(candidate, size, mask);
    const score = penalty(candidate, size);
    if (score < bestScore) { bestScore = score; best = candidate; }
  }

  return { size, modules: best };
}

/**
 * Draw an encoded matrix onto a canvas, sized to the canvas's CSS box with a
 * quiet zone. Rendered crisply at device pixel ratio so the camera sees hard
 * edges rather than a resampled blur.
 */
export function drawQr(canvas, text, { quietZone = 4, dark = '#000000', light = '#FFFFFF' } = {}) {
  const { size, modules } = encodeQr(text);
  const total = size + quietZone * 2;

  const cssSize = canvas.clientWidth || canvas.width || 180;
  const ratio = window.devicePixelRatio || 1;
  // Whole-pixel modules keep every square identical; anything else shimmers.
  const scale = Math.max(1, Math.floor((cssSize * ratio) / total));
  const pixelSize = scale * total;

  canvas.width = pixelSize;
  canvas.height = pixelSize;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, pixelSize, pixelSize);
  ctx.fillStyle = dark;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!modules[r * size + c]) continue;
      ctx.fillRect((c + quietZone) * scale, (r + quietZone) * scale, scale, scale);
    }
  }
}
