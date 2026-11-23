import crypto from 'crypto';

/**
 * Enterprise Cryptographic Service for LabLink
 *
 * Provides:
 * 1. AES-256-GCM authenticated encryption and decryption for sensitive OAuth tokens at rest.
 * 2. Cryptographically secure random nonces and state tokens for CSRF protection.
 * 3. HMAC-SHA256 signature generation and constant-time verification for OAuth state payloads.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV
const TAG_LENGTH = 16; // 128-bit Auth Tag
const SALT = 'lablink-gcal-token-vault-salt-v1';

class CryptoService {
  constructor() {
    this._key = null;
    this._hmacKey = null;
  }

  /**
   * Derive a 256-bit key using scrypt from environment secret or fallback key
   */
  getEncryptionKey() {
    if (this._key) return this._key;

    const secret = process.env.CALENDAR_ENCRYPTION_KEY || process.env.APP_SECRET || 'lablink-default-dev-secret-key-32b!';
    if (!process.env.CALENDAR_ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
      console.warn('[SECURITY WARNING] CALENDAR_ENCRYPTION_KEY is not defined in production environment! Using fallback key derivation.');
    }

    this._key = crypto.scryptSync(secret, SALT, 32);
    return this._key;
  }

  getHmacKey() {
    if (this._hmacKey) return this._hmacKey;
    const secret = process.env.OAUTH_STATE_SECRET || process.env.CALENDAR_ENCRYPTION_KEY || 'lablink-oauth-state-signing-key-dev';
    this._hmacKey = crypto.scryptSync(secret, 'lablink-hmac-salt', 32);
    return this._hmacKey;
  }

  /**
   * Encrypt plaintext string using AES-256-GCM
   * Returns formatted string: iv_hex:authTag_hex:ciphertext_hex
   */
  encrypt(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') {
      return null;
    }

    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
  }

  /**
   * Decrypt formatted ciphertext using AES-256-GCM
   * Validates authentication tag to prevent tampering
   */
  decrypt(payload) {
    if (!payload || typeof payload !== 'string') {
      return null;
    }

    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format. Expected iv:tag:ciphertext');
    }

    const [ivHex, tagHex, ciphertextHex] = parts;
    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate secure cryptographically random hex string
   */
  generateRandomNonce(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Create an HMAC-signed, tamper-evident OAuth state string
   * Serialized as: base64url(JSON) + '.' + base64url(hmac)
   */
  signOAuthState(payload) {
    const dataString = JSON.stringify({
      nonce: this.generateRandomNonce(16),
      timestamp: Date.now(),
      ...payload
    });

    const dataB64 = Buffer.from(dataString).toString('base64url');
    const hmac = crypto.createHmac('sha256', this.getHmacKey()).update(dataB64).digest('base64url');

    return `${dataB64}.${hmac}`;
  }

  /**
   * Verify and decode OAuth state string
   * Checks HMAC signature and enforces max age (default: 10 minutes)
   */
  verifyOAuthState(stateString, maxAgeMs = 10 * 60 * 1000) {
    if (!stateString || typeof stateString !== 'string') {
      return { valid: false, error: 'State parameter missing' };
    }

    const parts = stateString.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Malformed state parameter' };
    }

    const [dataB64, hmacProvided] = parts;
    const hmacExpected = crypto.createHmac('sha256', this.getHmacKey()).update(dataB64).digest('base64url');

    // Constant-time HMAC comparison
    const bufProvided = Buffer.from(hmacProvided);
    const bufExpected = Buffer.from(hmacExpected);

    if (bufProvided.length !== bufExpected.length || !crypto.timingSafeEqual(bufProvided, bufExpected)) {
      return { valid: false, error: 'Invalid state signature / CSRF detected' };
    }

    try {
      const jsonStr = Buffer.from(dataB64, 'base64url').toString('utf8');
      const payload = JSON.parse(jsonStr);

      if (!payload.timestamp || Date.now() - payload.timestamp > maxAgeMs) {
        return { valid: false, error: 'State parameter expired (exceeded 10 minutes)' };
      }

      return { valid: true, payload };
    } catch (err) {
      return { valid: false, error: 'Failed to parse state payload' };
    }
  }
}

export const cryptoService = new CryptoService();
