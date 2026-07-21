import { base64ToBytes, bytesToBase64 } from '@/lib/crypto'

const DB_NAME = 'softlaw-private-content-recovery'
const DB_VERSION = 1
const KEY_STORE = 'device-keys'
const RECORD_STORE = 'recoveries'
const DEVICE_KEY_ID = 'v1'
const RECOVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type RecoveryKind = 'asset' | 'license'

export interface PrivateContentRecovery {
  id: string
  kind: RecoveryKind
  chainId: number
  contractAddress: string
  walletAddress: string
  cid: string
  txHash?: `0x${string}`
  subjectId?: number
  createdAt: number
  expiresAt: number
  wrappedKeyB64: string
  ivB64: string
}

type RecoveryDraft = Omit<PrivateContentRecovery, 'id' | 'createdAt' | 'expiresAt' | 'wrappedKeyB64' | 'ivB64'>

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

async function openRecoveryDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw new Error('Secure recovery is unavailable in this browser')
  const request = indexedDB.open(DB_NAME, DB_VERSION)
  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE)
    if (!db.objectStoreNames.contains(RECORD_STORE)) db.createObjectStore(RECORD_STORE, { keyPath: 'id' })
  }
  return requestValue(request)
}

let deviceKeyPromise: Promise<CryptoKey> | null = null

async function loadOrCreateDeviceKey(db: IDBDatabase): Promise<CryptoKey> {
  const read = db.transaction(KEY_STORE, 'readonly')
  const existing = await requestValue(read.objectStore(KEY_STORE).get(DEVICE_KEY_ID)) as CryptoKey | undefined
  if (existing) return existing

  // Non-extractable: the device wrapping key can be used by this origin but
  // cannot be serialized into localStorage, logs, or network requests.
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const write = db.transaction(KEY_STORE, 'readwrite')
  write.objectStore(KEY_STORE).put(key, DEVICE_KEY_ID)
  await transactionDone(write)
  return key
}

function getDeviceKey(db: IDBDatabase): Promise<CryptoKey> {
  // Serialize first-use creation. Without this guard, two simultaneous
  // confidential preparations could each encrypt under a different new key
  // while only the last key written to IndexedDB survives.
  if (!deviceKeyPromise) {
    deviceKeyPromise = loadOrCreateDeviceKey(db).catch(error => {
      deviceKeyPromise = null
      throw error
    })
  }
  return deviceKeyPromise
}

export async function createPrivateContentRecovery(
  draft: RecoveryDraft,
  aesKeyB64: string,
): Promise<PrivateContentRecovery> {
  const db = await openRecoveryDB()
  try {
    const deviceKey = await getDeviceKey(db)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plaintext = new TextEncoder().encode(aesKeyB64)
    const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, deviceKey, plaintext)
    const now = Date.now()
    const record: PrivateContentRecovery = {
      ...draft,
      walletAddress: draft.walletAddress.toLowerCase(),
      contractAddress: draft.contractAddress.toLowerCase(),
      id: crypto.randomUUID(),
      createdAt: now,
      expiresAt: now + RECOVERY_TTL_MS,
      wrappedKeyB64: bytesToBase64(new Uint8Array(wrapped)),
      ivB64: bytesToBase64(iv),
    }
    const transaction = db.transaction(RECORD_STORE, 'readwrite')
    transaction.objectStore(RECORD_STORE).put(record)
    await transactionDone(transaction)
    window.dispatchEvent(new Event('softlaw-private-recovery-changed'))
    return record
  } finally {
    db.close()
  }
}

export async function updatePrivateContentRecovery(
  id: string,
  patch: Partial<Pick<PrivateContentRecovery, 'txHash' | 'subjectId'>>,
): Promise<void> {
  const db = await openRecoveryDB()
  try {
    const transaction = db.transaction(RECORD_STORE, 'readwrite')
    const store = transaction.objectStore(RECORD_STORE)
    const current = await requestValue(store.get(id)) as PrivateContentRecovery | undefined
    if (!current) throw new Error('Recovery record not found')
    store.put({ ...current, ...patch })
    await transactionDone(transaction)
    window.dispatchEvent(new Event('softlaw-private-recovery-changed'))
  } finally {
    db.close()
  }
}

export async function listPrivateContentRecoveries(walletAddress?: string): Promise<PrivateContentRecovery[]> {
  const db = await openRecoveryDB()
  try {
    const transaction = db.transaction(RECORD_STORE, 'readwrite')
    const store = transaction.objectStore(RECORD_STORE)
    const records = await requestValue(store.getAll()) as PrivateContentRecovery[]
    const now = Date.now()
    for (const record of records) {
      if (record.expiresAt <= now) store.delete(record.id)
    }
    await transactionDone(transaction)
    const wallet = walletAddress?.toLowerCase()
    return records
      .filter(record => record.expiresAt > now && (!wallet || record.walletAddress === wallet))
      .sort((a, b) => b.createdAt - a.createdAt)
  } finally {
    db.close()
  }
}

export async function recoverPrivateContentKey(id: string): Promise<string> {
  const db = await openRecoveryDB()
  try {
    const transaction = db.transaction(RECORD_STORE, 'readonly')
    const record = await requestValue(transaction.objectStore(RECORD_STORE).get(id)) as PrivateContentRecovery | undefined
    if (!record || record.expiresAt <= Date.now()) throw new Error('Recovery record is missing or expired')
    const deviceKey = await getDeviceKey(db)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(record.ivB64) },
      deviceKey,
      base64ToBytes(record.wrappedKeyB64),
    )
    return new TextDecoder().decode(plaintext)
  } finally {
    db.close()
  }
}

export async function deletePrivateContentRecovery(id: string): Promise<void> {
  const db = await openRecoveryDB()
  try {
    const transaction = db.transaction(RECORD_STORE, 'readwrite')
    transaction.objectStore(RECORD_STORE).delete(id)
    await transactionDone(transaction)
    window.dispatchEvent(new Event('softlaw-private-recovery-changed'))
  } finally {
    db.close()
  }
}
