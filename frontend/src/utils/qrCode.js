const VERSION = 5;
const SIZE = 17 + VERSION * 4;
const DATA_CODEWORDS = 108;
const ECC_CODEWORDS = 26;
const PAD_CODEWORDS = [0xec, 0x11];
const FORMAT_BITS_L_MASK_0 = 0x77c4;

const gfMul = (a, b) => {
  let x = a;
  let y = b;
  let result = 0;

  while (y > 0) {
    if (y & 1) result ^= x;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
    y >>= 1;
  }

  return result;
};

const gfPow = (exp) => {
  let result = 1;
  for (let i = 0; i < exp; i += 1) {
    result = gfMul(result, 2);
  }
  return result;
};

const buildGenerator = (degree) => {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;

  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 2);
  }

  return result;
};

const buildEcc = (data) => {
  const generator = buildGenerator(ECC_CODEWORDS);
  const remainder = new Array(ECC_CODEWORDS).fill(0);

  data.forEach((value) => {
    const factor = value ^ remainder.shift();
    remainder.push(0);
    for (let i = 0; i < ECC_CODEWORDS; i += 1) {
      remainder[i] ^= gfMul(generator[i], factor);
    }
  });

  return remainder;
};

const pushBits = (bits, value, length) => {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
};

export const buildQrPayload = (value) => {
  const encoder = new TextEncoder();
  const bytes = Array.from(encoder.encode(String(value ?? "")));
  if (bytes.length > DATA_CODEWORDS - 3) {
    throw new Error("El dato para QR excede el tamano soportado del ticket");
  }

  const bits = [];
  pushBits(bits, 0x4, 4);
  pushBits(bits, bytes.length, 8);
  bytes.forEach((byte) => pushBits(bits, byte, 8));

  const maxBits = DATA_CODEWORDS * 8;
  const terminator = Math.min(4, maxBits - bits.length);
  pushBits(bits, 0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) {
      byte = (byte << 1) | bits[i + j];
    }
    data.push(byte);
  }

  let padIndex = 0;
  while (data.length < DATA_CODEWORDS) {
    data.push(PAD_CODEWORDS[padIndex % PAD_CODEWORDS.length]);
    padIndex += 1;
  }

  return [...data, ...buildEcc(data)];
};

const makeMatrix = () => {
  const modules = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const reserved = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

  const set = (row, col, dark, isReserved = true) => {
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;
    modules[row][col] = !!dark;
    if (isReserved) reserved[row][col] = true;
  };

  const drawFinder = (row, col) => {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const r = row + y;
        const c = col + x;
        const inside = x >= 0 && x <= 6 && y >= 0 && y <= 6;
        const border = x === 0 || x === 6 || y === 0 || y === 6;
        const center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        set(r, c, inside && (border || center));
      }
    }
  };

  const drawAlignment = (centerRow, centerCol) => {
    for (let y = -2; y <= 2; y += 1) {
      for (let x = -2; x <= 2; x += 1) {
        const distance = Math.max(Math.abs(x), Math.abs(y));
        set(centerRow + y, centerCol + x, distance !== 1);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, SIZE - 7);
  drawFinder(SIZE - 7, 0);
  drawAlignment(30, 30);

  for (let i = 8; i < SIZE - 8; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  set(4 * VERSION + 9, 8, true);

  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][SIZE - 1 - i] = true;
    reserved[SIZE - 1 - i][8] = true;
  }

  return { modules, reserved, set };
};

const placeData = (matrix, codewords) => {
  const bits = [];
  codewords.forEach((byte) => pushBits(bits, byte, 8));

  let bitIndex = 0;
  let upward = true;
  for (let col = SIZE - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;

    for (let i = 0; i < SIZE; i += 1) {
      const row = upward ? SIZE - 1 - i : i;
      for (let offset = 0; offset < 2; offset += 1) {
        const c = col - offset;
        if (matrix.reserved[row][c]) continue;
        const bit = bits[bitIndex] || 0;
        const masked = bit ^ (((row + c) % 2 === 0) ? 1 : 0);
        matrix.set(row, c, masked, false);
        bitIndex += 1;
      }
    }

    upward = !upward;
  }
};

const placeFormatBits = (matrix) => {
  const bit = (index) => ((FORMAT_BITS_L_MASK_0 >> index) & 1) === 1;

  for (let i = 0; i <= 5; i += 1) matrix.set(8, i, bit(i));
  matrix.set(8, 7, bit(6));
  matrix.set(8, 8, bit(7));
  matrix.set(7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) matrix.set(14 - i, 8, bit(i));

  for (let i = 0; i < 8; i += 1) matrix.set(SIZE - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i += 1) matrix.set(8, SIZE - 15 + i, bit(i));
};

export const generateQrSvg = (value, options = {}) => {
  const scale = options.scale || 4;
  const quiet = options.quietZone ?? 4;
  const matrix = makeMatrix();
  placeData(matrix, buildQrPayload(value));
  placeFormatBits(matrix);

  const totalModules = SIZE + quiet * 2;
  const rects = [];
  matrix.modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) rects.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`);
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalModules * scale}" height="${totalModules * scale}" viewBox="0 0 ${totalModules} ${totalModules}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${totalModules}v${totalModules}H0z"/><g fill="#000">${rects.join("")}</g></svg>`;
};

export const generateQrDataUrl = (value, options = {}) => {
  const svg = generateQrSvg(value, options);
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
