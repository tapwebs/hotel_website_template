/**
 * Offline Store using native IndexedDB
 * Handles queued POS orders, offline order numbering, and cached menu snapshot.
 */

const DB_NAME = 'tapmenu_offline_pos'
const DB_VERSION = 1
const ORDERS_STORE = 'queued_orders'
const META_STORE = 'pos_meta'

export interface QueuedPOSOrder {
  id: string
  offlineNumber: string
  payload: any
  printableOrder: any
  createdAt: string
  attempts: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'))
      return
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(ORDERS_STORE))
        db.createObjectStore(ORDERS_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(META_STORE))
        db.createObjectStore(META_STORE, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Generic IDB helpers — avoids repeating the open → transaction → request pattern

function idbPut(storeName: string, value: unknown): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
  )
}

function idbDelete(storeName: string, key: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
  )
}

function idbGetAll<T>(storeName: string): Promise<T[]> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll()
        req.onsuccess = () => resolve((req.result ?? []) as T[])
        req.onerror = () => reject(req.error)
      })
  )
}

function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key)
        req.onsuccess = () => resolve(req.result as T | undefined)
        req.onerror = () => reject(req.error)
      })
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const saveQueuedOrder = (order: QueuedPOSOrder): Promise<void> =>
  idbPut(ORDERS_STORE, order)

export const getQueuedOrders = (): Promise<QueuedPOSOrder[]> =>
  idbGetAll<QueuedPOSOrder>(ORDERS_STORE)

export const removeQueuedOrder = (id: string): Promise<void> =>
  idbDelete(ORDERS_STORE, id)

export async function getNextOfflineOrderNumber(): Promise<string> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readwrite')
      const store = tx.objectStore(META_STORE)
      const req = store.get('order_counter')
      req.onsuccess = () => {
        const next = (req.result ? Number(req.result.value) : 100) + 1
        store.put({ key: 'order_counter', value: next })
        resolve(`OFF-${next}`)
      }
      req.onerror = () =>
        resolve(`OFF-${Math.floor(Date.now() / 1000).toString().slice(-4)}`)
    })
  } catch {
    return `OFF-${Math.floor(Date.now() / 1000).toString().slice(-4)}`
  }
}

export async function cacheOfflineMenu(menu: any): Promise<void> {
  try {
    await idbPut(META_STORE, { key: 'cached_menu', value: menu, cachedAt: new Date().toISOString() })
  } catch (e) {
    console.warn('[OfflineStore] Failed to cache menu:', e)
  }
}

export async function getCachedOfflineMenu(): Promise<any | null> {
  try {
    const record = await idbGet<{ value: any }>(META_STORE, 'cached_menu')
    return record?.value ?? null
  } catch {
    return null
  }
}
