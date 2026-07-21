// ── Confidential-content crypto helpers (AES-GCM 256) ───────────────────────
// AES-GCM is non-streaming, so confidential-file limits account for peak memory.
export const BASE64_CHUNK_SIZE = 0x2000 // 8 KiB

/** O(n) binary→base64. No full-array spread, no quadratic string concatenation. */
export function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE)))
  }
  return btoa(chunks.join(''))
}

/** base64→bytes. Throws on malformed input (atob rejects non-base64). */
export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  // Allocate a concrete ArrayBuffer. TypeScript 6 distinguishes this from a
  // Uint8Array backed by ArrayBufferLike/SharedArrayBuffer, while WebCrypto's
  // BufferSource overload intentionally accepts only the former here.
  const out = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return bytesToBase64(new Uint8Array(raw))
}

export async function importKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', base64ToBytes(b64), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function encryptContent(
  data: Uint8Array,
  key: CryptoKey,
): Promise<{ ciphertextB64: string; ivB64: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const plaintext = new Uint8Array(32 + data.byteLength)
  plaintext.set(salt, 0)
  plaintext.set(data, 32)

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

  return {
    ciphertextB64: bytesToBase64(new Uint8Array(ciphertext)),
    ivB64: bytesToBase64(iv),
  }
}

export async function decryptContent(
  ciphertextB64: string,
  ivB64: string,
  key: CryptoKey,
): Promise<Uint8Array> {
  const ciphertext = base64ToBytes(ciphertextB64)
  const iv = base64ToBytes(ivB64)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new Uint8Array(decrypted).slice(32)  // strip 32-byte salt prefix
}
