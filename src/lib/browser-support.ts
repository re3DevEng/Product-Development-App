// getRandomValues is also available on local-network HTTP origins.
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// An IndexedDB read/write transaction serializes synchronous localStorage
// updates across tabs when Web Locks is unavailable on a LAN HTTP origin.
export async function withWorkspaceLock(name: string, change: () => void) {
  if (navigator.locks) return navigator.locks.request(name, change);
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("product-development-locks", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("locks");
    request.onerror = () =>
      reject(
        new Error(
          "Browser storage is unavailable. Allow site storage to save changes.",
        ),
      );
    request.onblocked = () =>
      reject(new Error("Close other app tabs and try again."));
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("locks", "readwrite");
      let failure: unknown;
      transaction.objectStore("locks").get(name).onsuccess = () => {
        try {
          change();
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onabort = () => {
        db.close();
        reject(
          failure ?? new Error("Could not save changes. Please try again."),
        );
      };
      db.onversionchange = () => db.close();
    };
  });
}
