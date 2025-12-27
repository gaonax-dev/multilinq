/**
 * IndexedDB 기반 Key-Value 저장소
 *
 * - localStorage 용량(보통 5~10MB)을 초과하는 큰 문자열(예: 원본 xcstrings)을 안전하게 저장하기 위한 용도
 * - 브라우저 환경에서만 동작 (SSR에서는 호출하지 않도록 주의)
 */

const DB_NAME = "multilinq";
const DB_VERSION = 1;
const STORE_NAME = "kv";

type KVRecord = {
  key: string;
  value: string;
  updatedAt: number;
};

function isBrowserWithIndexedDB(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDB(): Promise<IDBDatabase> {
  if (!isBrowserWithIndexedDB()) {
    return Promise.reject(new Error("IndexedDB를 사용할 수 없는 환경입니다."));
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: "key" });
    }
  };

  return requestToPromise(request);
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDB();

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("IndexedDB 트랜잭션이 중단되었습니다."));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("IndexedDB 트랜잭션 오류가 발생했습니다."));
    };
  });
}

export async function idbSetItem(key: string, value: string): Promise<void> {
  if (!isBrowserWithIndexedDB()) {
    return;
  }

  const record: KVRecord = { key, value, updatedAt: Date.now() };
  await withStore("readwrite", (store) => store.put(record));
}

export async function idbGetItem(key: string): Promise<string | null> {
  if (!isBrowserWithIndexedDB()) {
    return null;
  }

  const record = await withStore<KVRecord | undefined>("readonly", (store) =>
    store.get(key)
  );
  return record?.value ?? null;
}

export async function idbRemoveItem(key: string): Promise<void> {
  if (!isBrowserWithIndexedDB()) {
    return;
  }

  await withStore("readwrite", (store) => store.delete(key));
}

