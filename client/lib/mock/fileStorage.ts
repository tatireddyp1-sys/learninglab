/**
 * IndexedDB-backed file storage for the mock upload layer.
 *
 * Uploaded files (images, videos, PDFs) are stored as blobs in IndexedDB
 * so they persist across page refreshes — unlike blob: URLs which are
 * session-only. Each file is keyed by a deterministic `mock-asset://` URL
 * that the rest of the app can use in <img>, <video>, <iframe> src attributes.
 *
 * ► When migrating to a real backend, delete this file. Real uploads
 *   will go through S3/CDN and return permanent HTTPS URLs.
 */

const DB_NAME = "learninglab_files";
const STORE_NAME = "blobs";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Store a file blob under the given key. Returns the key for convenience. */
export async function storeFile(key: string, blob: Blob): Promise<string> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, key);
    tx.oncomplete = () => resolve(key);
    tx.onerror = () => reject(tx.error);
  });
}

/** Retrieve a stored blob. Returns null if not found. */
export async function getFile(key: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Delete a stored file. */
export async function deleteFile(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Clear all stored files (useful for reset). */
export async function clearAllFiles(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Resolve a mock-asset:// key to a usable object URL.
 * Caches resolved URLs so we don't re-read IDB on every render.
 */
const urlCache = new Map<string, string>();

export async function resolveAssetUrl(key: string): Promise<string> {
  if (!key.startsWith("mock-asset://")) return key;
  const cached = urlCache.get(key);
  if (cached) return cached;
  const blob = await getFile(key);
  if (!blob) return key;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

/**
 * Resolve a mock-asset:// key to a base64 data URL.
 * Required for PDFs because blob: URLs are often blocked in iframes.
 */
const dataUrlCache = new Map<string, string>();

export async function resolveAsDataUrl(key: string): Promise<string> {
  if (!key.startsWith("mock-asset://")) return key;
  const cached = dataUrlCache.get(key);
  if (cached) return cached;
  const blob = await getFile(key);
  if (!blob) return key;
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      dataUrlCache.set(key, dataUrl);
      resolve(dataUrl);
    };
    reader.onerror = () => resolve(key);
    reader.readAsDataURL(blob);
  });
}

/** Get the raw blob for a mock-asset key (e.g. for download links). */
export async function resolveAsBlob(key: string): Promise<Blob | null> {
  if (!key.startsWith("mock-asset://")) return null;
  return getFile(key);
}

/**
 * Generate a unique mock-asset key for a new upload.
 */
export function generateAssetKey(lessonId: string, fileName: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `mock-asset://${lessonId}/${ts}_${rand}_${fileName}`;
}
