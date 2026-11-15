/* In-browser stand-in for the firebase/* packages: a tiny fake Firestore over window.__FIXTURES__ docs,
   every other export a harmless deep proxy. Writes are recorded on window.__WRITES__. */
const g = typeof window !== 'undefined' ? window : globalThis
g.__WRITES__ = g.__WRITES__ || []
const fixtures = () => g.__FIXTURES__ || {}

function deep(name) {
  return new Proxy(function () {}, {
    get(_t, k) {
      if (typeof k === 'symbol') return undefined
      if (k === 'then') return undefined
      if (k === 'prototype') return {}
      if (k === 'toJSON') return () => name
      return deep(name + '.' + String(k))
    },
    apply() {
      return deep(name + '()')
    },
    construct() {
      return deep('new ' + name)
    },
  })
}

function pathOf(args) {
  const parts = []
  for (const a of args) {
    if (a && typeof a === 'object' && typeof a.path === 'string') parts.push(a.path)
    else if (typeof a === 'string') parts.push(a)
  }
  return parts.join('/')
}

class Timestamp {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds
    this.nanoseconds = nanoseconds || 0
  }
  static fromDate(d) {
    return new Timestamp(Math.floor(d.getTime() / 1000), 0)
  }
  static fromMillis(ms) {
    return new Timestamp(Math.floor(ms / 1000), 0)
  }
  static now() {
    return Timestamp.fromDate(new Date())
  }
  toDate() {
    return new Date(this.seconds * 1000)
  }
  toMillis() {
    return this.seconds * 1000
  }
}

function docSnap(path) {
  const data = fixtures()[path]
  const id = path.split('/').pop()
  return { id, ref: { path, id }, exists: () => data != null, data: () => (data == null ? undefined : { ...data }), get: (k) => data?.[k], metadata: { fromCache: false, hasPendingWrites: false } }
}
function querySnap(path) {
  const docs = Object.keys(fixtures())
    .filter((p) => p.startsWith(path + '/') && p.slice(path.length + 1).indexOf('/') === -1)
    .map(docSnap)
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn) => docs.forEach(fn), docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }
}

const api = {
  Timestamp,
  doc: (...args) => {
    const path = pathOf(args)
    return { type: 'document', path, id: path.split('/').pop(), withConverter() { return this } }
  },
  collection: (...args) => ({ type: 'collection', path: pathOf(args), withConverter() { return this } }),
  collectionGroup: (_db, id) => ({ type: 'collection', path: '__group__/' + id }),
  query: (ref) => ({ type: 'query', path: ref.path, withConverter() { return this } }),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  startAfter: () => ({}),
  documentId: () => '__name__',
  getDoc: async (ref) => docSnap(ref.path),
  getDocFromServer: async (ref) => docSnap(ref.path),
  getDocFromCache: async (ref) => docSnap(ref.path),
  getDocs: async (q) => querySnap(q.path),
  getDocsFromServer: async (q) => querySnap(q.path),
  getDocsFromCache: async (q) => querySnap(q.path),
  getCountFromServer: async () => ({ data: () => ({ count: 0 }) }),
  onSnapshot: (ref, a, b) => {
    const next = typeof a === 'function' ? a : typeof b === 'function' ? b : a && a.next
    setTimeout(() => {
      try {
        next && next(ref.type === 'document' ? docSnap(ref.path) : querySnap(ref.path))
      } catch (e) {
        console.error('harness onSnapshot', e)
      }
    }, 0)
    return () => {}
  },
  setDoc: async (ref, data, opts) => void g.__WRITES__.push({ op: 'set', path: ref.path, data, opts }),
  updateDoc: async (ref, data) => void g.__WRITES__.push({ op: 'update', path: ref.path, data }),
  addDoc: async (ref, data) => (g.__WRITES__.push({ op: 'add', path: ref.path, data }), { id: 'new' }),
  deleteDoc: async (ref) => void g.__WRITES__.push({ op: 'delete', path: ref.path }),
  writeBatch: () => {
    const ops = []
    return {
      set: (ref, data, opts) => (ops.push({ op: 'set', path: ref.path, data, opts }), undefined),
      update: (ref, data) => (ops.push({ op: 'update', path: ref.path, data }), undefined),
      delete: (ref) => (ops.push({ op: 'delete', path: ref.path }), undefined),
      commit: async () => void g.__WRITES__.push({ op: 'batch', ops }),
    }
  },
  runTransaction: async () => undefined,
  serverTimestamp: () => ({ __serverTimestamp: true }),
  deleteField: () => ({ __deleteField: true }),
  arrayUnion: (...v) => ({ __arrayUnion: v }),
  arrayRemove: (...v) => ({ __arrayRemove: v }),
  increment: (n) => ({ __increment: n }),
  getFirestore: () => ({ type: 'firestore' }),
  initializeFirestore: () => ({ type: 'firestore' }),
  getApps: () => [{}],
  getApp: () => ({}),
  initializeApp: () => ({}),
  getAuth: () => ({ currentUser: null, authStateReady: async () => {}, onAuthStateChanged: () => () => {}, onIdTokenChanged: () => () => {} }),
  onAuthStateChanged: () => () => {},
  onIdTokenChanged: () => () => {},
}

const fallback = new Proxy(
  {},
  {
    get(_t, k) {
      if (typeof k === 'symbol' || k === 'then' || k === '__esModule') return undefined
      return deep(String(k))
    },
  }
)
const exportsObj = Object.create(fallback)
Object.assign(exportsObj, api)
module.exports = exportsObj
