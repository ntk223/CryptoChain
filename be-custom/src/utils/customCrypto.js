const crypto = require('crypto');

// ─── SECP256K1 CURVE PARAMETERS ──────────────────────────────────────────────
// Equation: y^2 = x^3 + 7 (mod p)
const p = 2n ** 256n - 2n ** 32n - 977n; // Field size
const a = 0n;
const b = 7n;

// Generator point G
const G = [
  0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n
];

// Order of the group G
const n = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

// ─── UTILITIES & MATHEMATICAL HELPER FUNCTIONS ───────────────────────────────

/**
 * Computes the modular inverse using the Extended Euclidean Algorithm.
 * Returns x such that (a * x) % m === 1.
 */
function modInverse(a, m) {
  a = ((a % m) + m) % m;
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];

  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }

  return ((old_s % m) + m) % m;
}

/**
 * Computes (base^exponent) % modulus using modular exponentiation.
 */
function modPower(base, exponent, modulus) {
  if (modulus === 1n) return 0n;
  let result = 1n;
  base = ((base % modulus) + modulus) % modulus;
  let exp = exponent;
  while (exp > 0n) {
    if (exp & 1n) {
      result = (result * base) % modulus;
    }
    base = (base * base) % modulus;
    exp >>= 1n;
  }
  return result;
}

// ─── ELLIPTIC CURVE POINT OPERATIONS ─────────────────────────────────────────

/**
 * Adds two points on the secp256k1 curve.
 * Represent point at infinity as null.
 */
function pointAdd(P, Q) {
  if (P === null) return Q;
  if (Q === null) return P;

  const [x1, y1] = P;
  const [x2, y2] = Q;

  if (x1 === x2) {
    if (((y1 + y2) % p) === 0n) {
      return null; // Point at infinity
    }
    return pointDouble(P);
  }

  // Slope: m = (y2 - y1) / (x2 - x1) mod p
  const num = ((y2 - y1) % p + p) % p;
  const den = ((x2 - x1) % p + p) % p;
  const m = (num * modInverse(den, p)) % p;

  // x3 = m^2 - x1 - x2 mod p
  const x3 = ((m * m - x1 - x2) % p + p) % p;
  // y3 = m * (x1 - x3) - y1 mod p
  const y3 = ((m * (x1 - x3) - y1) % p + p) % p;

  return [x3, y3];
}

/**
 * Doubles a point on the secp256k1 curve.
 */
function pointDouble(P) {
  if (P === null) return null;
  const [x1, y1] = P;
  if (y1 === 0n) return null; // Tangent line is vertical, yields point at infinity

  // Slope: m = (3 * x1^2) / (2 * y1) mod p
  const num = (3n * x1 * x1) % p;
  const den = (2n * y1) % p;
  const m = (num * modInverse(den, p)) % p;

  // x3 = m^2 - 2 * x1 mod p
  const x3 = ((m * m - 2n * x1) % p + p) % p;
  // y3 = m * (x1 - x3) - y1 mod p
  const y3 = ((m * (x1 - x3) - y1) % p + p) % p;

  return [x3, y3];
}

/**
 * Multiplies a point P by scalar k using double-and-add algorithm.
 */
function pointMultiply(k, P) {
  let R = null;
  let Q = P;
  let tempK = BigInt(k);

  // Take modulo group order if multiplication is larger
  tempK = tempK % n;

  while (tempK > 0n) {
    if (tempK & 1n) {
      R = pointAdd(R, Q);
    }
    Q = pointDouble(Q);
    tempK >>= 1n;
  }
  return R;
}

// ─── KEYS SERIALIZATION AND DESERIALIZATION ─────────────────────────────────

/**
 * Parses a hex public key string (compressed or uncompressed) into [x, y] coordinates.
 */
function parsePublicKey(pubHex) {
  const hex = pubHex.trim();
  if (hex.startsWith('04')) {
    if (hex.length !== 130) {
      throw new Error('Invalid uncompressed public key length');
    }
    const x = BigInt('0x' + hex.substring(2, 66));
    const y = BigInt('0x' + hex.substring(66, 130));

    // Verify point lies on the curve
    const left = (y * y) % p;
    const right = (x * x * x + 7n) % p;
    if (left !== right) {
      throw new Error('Public key point does not lie on the curve');
    }
    return [x, y];
  } else if (hex.startsWith('02') || hex.startsWith('03')) {
    if (hex.length !== 66) {
      throw new Error('Invalid compressed public key length');
    }
    const x = BigInt('0x' + hex.substring(2, 66));

    // Reconstruct y coordinate: y^2 = x^3 + 7 (mod p)
    const y2 = (x * x * x + 7n) % p;

    // Modulo square root for p % 4 === 3
    const exp = (p + 1n) / 4n;
    let y = modPower(y2, exp, p);

    const isEven = (y % 2n) === 0n;
    const wantEven = hex.startsWith('02');
    if (isEven !== wantEven) {
      y = p - y;
    }

    // Verify point lies on the curve
    const left = (y * y) % p;
    if (left !== y2) {
      throw new Error('Invalid compressed public key (no square root found)');
    }
    return [x, y];
  } else {
    throw new Error('Invalid public key prefix (must start with 02, 03, or 04)');
  }
}

/**
 * Serializes point [x, y] to hex string.
 */
function serializePublicKey(point, compressed = false) {
  if (point === null) throw new Error('Cannot serialize point at infinity');
  const [x, y] = point;
  const xHex = x.toString(16).padStart(64, '0');
  
  if (compressed) {
    const prefix = (y % 2n === 0n) ? '02' : '03';
    return prefix + xHex;
  } else {
    const yHex = y.toString(16).padStart(64, '0');
    return '04' + xHex + yHex;
  }
}

// ─── ECDSA SIGNING AND VERIFICATION ──────────────────────────────────────────

/**
 * Generates a cryptographically secure random BigInt in [1, max - 1].
 */
function getSecureRandomBigInt(max) {
  while (true) {
    const buf = crypto.randomBytes(32);
    const val = BigInt('0x' + buf.toString('hex'));
    if (val > 0n && val < max) {
      return val;
    }
  }
}

/**
 * Generates a new key pair.
 * Returns { privateKey: hex, publicKey: hex }
 */
function generateKeyPair(compressed = false) {
  const privateKeyBigInt = getSecureRandomBigInt(n);
  const privateKeyHex = privateKeyBigInt.toString(16).padStart(64, '0');
  const publicKeyPoint = pointMultiply(privateKeyBigInt, G);
  const publicKeyHex = serializePublicKey(publicKeyPoint, compressed);
  return {
    privateKey: privateKeyHex,
    publicKey: publicKeyHex,
  };
}

/**
 * Converts r, s (BigInt) to DER encoded signature hex string.
 */
function toDERSignature(r, s) {
  function bigintToBuffer(val) {
    let hex = val.toString(16);
    if (hex.length % 2 !== 0) hex = '0' + hex;
    let buf = Buffer.from(hex, 'hex');
    // Prepend 0x00 if MSB is set to ensure the DER integer is treated as positive
    if (buf[0] & 0x80) {
      buf = Buffer.concat([Buffer.from([0x00]), buf]);
    }
    return buf;
  }

  const rBuf = bigintToBuffer(r);
  const sBuf = bigintToBuffer(s);

  const totalLen = rBuf.length + sBuf.length + 4;

  const der = Buffer.concat([
    Buffer.from([0x30, totalLen]),
    Buffer.from([0x02, rBuf.length]),
    rBuf,
    Buffer.from([0x02, sBuf.length]),
    sBuf
  ]);

  return der.toString('hex');
}

/**
 * Parses DER encoded signature hex string to r, s BigInts.
 */
function parseDERSignature(derHex) {
  const der = Buffer.from(derHex.trim(), 'hex');
  if (der[0] !== 0x30) throw new Error('Invalid DER signature header');
  const totalLen = der[1];
  if (der.length !== totalLen + 2) throw new Error('Invalid DER signature length');

  if (der[2] !== 0x02) throw new Error('Invalid r integer header');
  const rLen = der[3];
  const rBytes = der.subarray(4, 4 + rLen);

  const sHeaderIdx = 4 + rLen;
  if (der[sHeaderIdx] !== 0x02) throw new Error('Invalid s integer header');
  const sLen = der[sHeaderIdx + 1];
  const sBytes = der.subarray(sHeaderIdx + 2, sHeaderIdx + 2 + sLen);

  const r = BigInt('0x' + rBytes.toString('hex'));
  const s = BigInt('0x' + sBytes.toString('hex'));

  return { r, s };
}

/**
 * Signs a message hash hex string using a private key hex string.
 * Returns DER-encoded signature hex string.
 */
function signTransactionHash(msgHashHex, privateKeyHex) {
  const e = BigInt('0x' + msgHashHex);
  const d = BigInt('0x' + privateKeyHex);

  if (d <= 0n || d >= n) {
    throw new Error('Private key out of range [1, n-1]');
  }

  while (true) {
    // Generate k
    const k = getSecureRandomBigInt(n);
    const R = pointMultiply(k, G);
    if (R === null) continue;

    const r = R[0] % n;
    if (r === 0n) continue;

    const kInv = modInverse(k, n);
    let s = (kInv * (e + r * d)) % n;
    if (s === 0n) continue;

    // BIP-62 / BIP-146 Low-S signature rule (essential for Bitcoin)
    if (s > n / 2n) {
      s = n - s;
    }

    return toDERSignature(r, s);
  }
}

/**
 * Verifies a DER-encoded signature hex string against message hash and public key.
 * Returns true if valid, false otherwise.
 */
function verifyTransactionSignature(msgHashHex, derSignatureHex, publicKeyHex) {
  try {
    const e = BigInt('0x' + msgHashHex);
    const { r, s } = parseDERSignature(derSignatureHex);
    const P = parsePublicKey(publicKeyHex);

    // Validate range of r and s
    if (r <= 0n || r >= n || s <= 0n || s >= n) {
      return false;
    }

    // BIP-146 low-s validation rule
    if (s > n / 2n) {
      return false;
    }

    const w = modInverse(s, n);
    const u1 = (e * w) % n;
    const u2 = (r * w) % n;

    const u1G = pointMultiply(u1, G);
    const u2P = pointMultiply(u2, P);
    const RPrime = pointAdd(u1G, u2P);

    if (RPrime === null) {
      return false;
    }

    const x1 = RPrime[0] % n;
    return x1 === r;
  } catch (err) {
    return false;
  }
}

// ─── STANDARD SHA-256 HASHING ────────────────────────────────────────────────

/**
 * Computes standard SHA-256 hash of string or buffer.
 * Returns hex string.
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = {
  // Curve Constants
  p,
  a,
  b,
  G,
  n,
  
  // Math & Curve ops
  modInverse,
  modPower,
  pointAdd,
  pointDouble,
  pointMultiply,
  parsePublicKey,
  serializePublicKey,

  // ECDSA ops
  generateKeyPair,
  toDERSignature,
  parseDERSignature,
  sign: signTransactionHash,
  verify: verifyTransactionSignature,

  // Hash ops
  sha256,
};
