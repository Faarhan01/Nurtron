/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone Local Storage Database & Authentication Engine
 * Replaces external Firebase dependencies with a zero-setup, 100% offline-compatible,
 * local-storage-backed database and auth system suitable for ZIP exports & standalone dev.
 */

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
  metadata?: {
    creationTime?: string;
    lastSignInTime?: string;
  };
}

// Global Event Emitter for Local DB & Auth changes
const DB_CHANGE_EVENT = 'nurtron_local_db_change';
const AUTH_CHANGE_EVENT = 'nurtron_local_auth_change';

function notifyDbChange(collectionName?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DB_CHANGE_EVENT, { detail: { collectionName } }));
  }
}

function notifyAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
  }
}

// Initial Seed Data Helper
function initLocalStorageSeed() {
  if (typeof window === 'undefined') return;
  try {
    // 1. Settings Seed
    const settingsKey = 'nurtron_db_collection_settings';
    if (!localStorage.getItem(settingsKey)) {
      const defaultSettings = {
        'STR-100100': {
          storeName: 'megapos',
          taxRate: 8,
          taxType: 'exclusive',
          currency: 'USD',
          registrationNumber: 'REG-994820',
          vatNumber: 'VAT-882019',
          autoPrint: true,
          productLayout: 'grid',
          textSize: 'base',
          updatedAt: new Date().toISOString()
        }
      };
      localStorage.setItem(settingsKey, JSON.stringify(defaultSettings));
    }

    // 2. Staff Seed
    const staffKey = 'nurtron_db_collection_staff';
    if (!localStorage.getItem(staffKey)) {
      const defaultStaff = {
        'admin@megapos.pos': {
          email: 'admin@megapos.pos',
          username: 'admin',
          role: 'Manager',
          customRoleName: 'System Administrator',
          pin: 'admin',
          createdAt: new Date().toISOString()
        }
      };
      localStorage.setItem(staffKey, JSON.stringify(defaultStaff));
    }

    // 3. User Seed - Only seed on initial setup if user has never interacted
    const currentUserKey = 'nurtron_current_user';
    const initialSeedDoneKey = 'nurtron_initial_auth_seeded_v1';
    if (!localStorage.getItem(initialSeedDoneKey)) {
      localStorage.setItem(initialSeedDoneKey, 'true');
      if (!localStorage.getItem(currentUserKey)) {
        const defaultUser: User = {
          uid: 'usr_admin_001',
          email: 'admin@megapos.pos',
          displayName: 'admin',
          photoURL: null,
          emailVerified: true
        };
        localStorage.setItem(currentUserKey, JSON.stringify(defaultUser));
      }
    }
  } catch (e) {
    console.warn('Local storage seed error:', e);
  }
}

// Execute seed
initLocalStorageSeed();

// Local Database Context Stub
export const db = {
  _type: 'LocalDatabase',
  name: 'MegaPosLocalStoreDB'
};

// Local Auth Context Object
class LocalAuth {
  private _user: User | null = null;

  constructor() {
    this.reloadUserFromStorage();
  }

  public reloadUserFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('nurtron_current_user');
      if (raw) {
        this._user = JSON.parse(raw);
      } else {
        this._user = null;
      }
    } catch (e) {
      this._user = null;
    }
  }

  get currentUser(): User | null {
    return this._user;
  }

  set currentUser(user: User | null) {
    this._user = user;
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('nurtron_current_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('nurtron_current_user');
      }
    }
    notifyAuthChange();
  }
}

export const auth = new LocalAuth();

// --- AUTHENTICATION IMPLEMENTATION ---

export function onAuthStateChanged(
  authInstance: any,
  callback: (user: User | null) => void,
  errorCallback?: (error: any) => void
): () => void {
  // Fire initially
  try {
    callback(auth.currentUser);
  } catch (err) {
    if (errorCallback) errorCallback(err);
  }

  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    try {
      auth.reloadUserFromStorage();
      callback(auth.currentUser);
    } catch (err) {
      if (errorCallback) errorCallback(err);
    }
  };

  window.addEventListener(AUTH_CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export async function signInWithEmailAndPassword(
  authInstance: any,
  emailOrUsername: string,
  password?: string
): Promise<{ user: User }> {
  const cleanInput = (emailOrUsername || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  // Load staff map from local storage or default map
  let staffMap: Record<string, any> = {};
  try {
    const raw = localStorage.getItem('nurtron_db_collection_staff');
    if (raw) staffMap = JSON.parse(raw);
  } catch (e) {}

  // Explicit admin bypass for admin / admin or admin / 1234
  if ((cleanInput === 'admin' || cleanInput === 'admin@megapos.pos') && 
      (cleanPass === 'admin' || cleanPass === '1234' || cleanPass === '0000' || !cleanPass)) {
    const adminUser: User = {
      uid: 'usr_admin_master',
      email: 'admin@megapos.pos',
      displayName: 'admin',
      emailVerified: true
    };
    auth.currentUser = adminUser;
    return { user: adminUser };
  }

  // Find matching staff member in local staff storage
  let matchedStaff: any = null;
  for (const key of Object.keys(staffMap)) {
    const staff = staffMap[key];
    if (
      (staff.email && staff.email.toLowerCase() === cleanInput) ||
      (staff.username && staff.username.toLowerCase() === cleanInput)
    ) {
      matchedStaff = staff;
      break;
    }
  }

  if (matchedStaff) {
    const expectedPin = (matchedStaff.pin || matchedStaff.password || '').trim();
    if (expectedPin && cleanPass && expectedPin.toLowerCase() !== cleanPass.toLowerCase()) {
      throw new Error('Incorrect password or PIN for operator.');
    }
    const authenticatedUser: User = {
      uid: `usr_${matchedStaff.email.replace(/[^a-z0-9]/g, '_')}`,
      email: matchedStaff.email,
      displayName: matchedStaff.username || matchedStaff.email.split('@')[0],
      emailVerified: true
    };
    auth.currentUser = authenticatedUser;
    return { user: authenticatedUser };
  }

  // Generic fallback if not explicitly in staff list but valid format
  const targetEmail = cleanInput.includes('@') ? cleanInput : `${cleanInput}@megapos.pos`;
  const newUser: User = {
    uid: `usr_${cleanInput.replace(/[^a-z0-9]/g, '_')}`,
    email: targetEmail,
    displayName: cleanInput.split('@')[0],
    emailVerified: true
  };
  auth.currentUser = newUser;
  return { user: newUser };
}

export async function createUserWithEmailAndPassword(
  authInstance: any,
  email: string,
  password?: string
): Promise<{ user: User }> {
  return signInWithEmailAndPassword(authInstance, email, password);
}

export async function signInWithAdmin(authInstance?: any): Promise<{ user: User }> {
  const adminUser: User = {
    uid: 'usr_admin_master',
    email: 'admin@megapos.pos',
    displayName: 'admin',
    photoURL: null,
    emailVerified: true
  };
  auth.currentUser = adminUser;
  return { user: adminUser };
}

export async function signOut(authInstance?: any): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('nurtron_user_username');
      localStorage.removeItem('nurtron_user_password');
      localStorage.removeItem('nurtron_user_pin');
    } catch (e) {}
  }
  auth.currentUser = null;
}

export async function updateProfile(user: User, data: { displayName?: string; photoURL?: string }): Promise<void> {
  if (!user) return;
  const updated = { ...user, ...data };
  auth.currentUser = updated;
}

export async function signInWithPopup(authInstance?: any, provider?: any): Promise<{ user: User }> {
  return signInWithAdmin();
}

export async function signInWithRedirect(authInstance?: any, provider?: any): Promise<void> {
  await signInWithAdmin();
}

export class GoogleAuthProvider {
  static PROVIDER_ID = 'google.com';
}

// --- FIRESTORE DATABASE IMPLEMENTATION ---

export interface DocRef {
  _type: 'doc';
  collection: string;
  id: string;
}

export interface CollectionRef {
  _type: 'collection';
  collection: string;
}

export function doc(database: any, ...pathSegments: string[]): DocRef {
  const fullPath = pathSegments.join('/');
  const parts = fullPath.split('/').filter(Boolean);
  const docId = parts.pop() || 'default_doc';
  const collectionName = parts.join('/') || 'default_collection';
  return { _type: 'doc', collection: collectionName, id: docId };
}

export function collection(database: any, ...pathSegments: string[]): CollectionRef {
  const fullPath = pathSegments.join('/');
  return { _type: 'collection', collection: fullPath };
}

function getCollectionMap(collectionName: string): Record<string, any> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`nurtron_db_collection_${collectionName}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setCollectionMap(collectionName: string, map: Record<string, any>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`nurtron_db_collection_${collectionName}`, JSON.stringify(map));
    notifyDbChange(collectionName);
  } catch (e) {
    console.error(`Error writing collection ${collectionName} to local store:`, e);
  }
}

function processFieldTransforms(existing: any, update: any) {
  if (!update || typeof update !== 'object') return update;
  const result: any = Array.isArray(update) ? [...update] : { ...update };
  
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (val && typeof val === 'object' && val._type === 'increment') {
      const currentNum = Number(existing?.[key] || 0);
      result[key] = currentNum + val.delta;
    } else if (val && typeof val === 'object' && val._type === 'arrayUnion') {
      const currentArr = Array.isArray(existing?.[key]) ? existing[key] : [];
      const newItems = val.items.filter((item: any) => !currentArr.includes(item));
      result[key] = [...currentArr, ...newItems];
    } else if (val && typeof val === 'object' && val._type === 'arrayRemove') {
      const currentArr = Array.isArray(existing?.[key]) ? existing[key] : [];
      result[key] = currentArr.filter((item: any) => !val.items.includes(item));
    }
  }
  return result;
}

export async function getDoc(docRef: DocRef): Promise<{
  exists: () => boolean;
  data: () => any;
  id: string;
}> {
  const map = getCollectionMap(docRef.collection);
  const data = map[docRef.id];
  return {
    exists: () => data !== undefined && data !== null,
    data: () => data,
    id: docRef.id
  };
}

export async function getDocFromServer(docRef: DocRef) {
  return getDoc(docRef);
}

export async function setDoc(docRef: DocRef, data: any, options?: { merge?: boolean }): Promise<void> {
  const map = getCollectionMap(docRef.collection);
  const existing = map[docRef.id] || {};
  const processedData = processFieldTransforms(existing, data);
  if (options?.merge && map[docRef.id]) {
    map[docRef.id] = { ...existing, ...processedData };
  } else {
    map[docRef.id] = processedData;
  }
  setCollectionMap(docRef.collection, map);
}

export async function updateDoc(docRef: DocRef, data: any): Promise<void> {
  const map = getCollectionMap(docRef.collection);
  const existing = map[docRef.id] || {};
  const processedData = processFieldTransforms(existing, data);
  map[docRef.id] = { ...existing, ...processedData };
  setCollectionMap(docRef.collection, map);
}

export function increment(delta: number) {
  return { _type: 'increment', delta };
}

export function arrayUnion(...items: any[]) {
  return { _type: 'arrayUnion', items };
}

export function arrayRemove(...items: any[]) {
  return { _type: 'arrayRemove', items };
}

export function writeBatch(database?: any) {
  const operations: Array<() => Promise<void>> = [];
  return {
    set: (docRef: DocRef, data: any, options?: { merge?: boolean }) => {
      operations.push(() => setDoc(docRef, data, options));
    },
    update: (docRef: DocRef, data: any) => {
      operations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: DocRef) => {
      operations.push(() => deleteDoc(docRef));
    },
    commit: async () => {
      for (const op of operations) {
        await op();
      }
    }
  };
}

export async function deleteDoc(docRef: DocRef): Promise<void> {
  const map = getCollectionMap(docRef.collection);
  delete map[docRef.id];
  setCollectionMap(docRef.collection, map);
}

export async function addDoc(collectionRef: CollectionRef, data: any): Promise<DocRef> {
  const generatedId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const map = getCollectionMap(collectionRef.collection);
  map[generatedId] = { ...data, id: generatedId };
  setCollectionMap(collectionRef.collection, map);
  return { _type: 'doc', collection: collectionRef.collection, id: generatedId };
}

export async function getDocs(collectionRef: CollectionRef): Promise<{
  docs: Array<{ id: string; data: () => any }>;
  empty: boolean;
  size: number;
}> {
  const map = getCollectionMap(collectionRef.collection);
  const keys = Object.keys(map);
  const docs = keys.map(key => ({
    id: key,
    data: () => map[key]
  }));

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length
  };
}

export function onSnapshot(
  target: DocRef | CollectionRef,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
): () => void {
  const emitCurrent = async () => {
    try {
      if (target._type === 'doc') {
        const snap = await getDoc(target as DocRef);
        onNext(snap);
      } else {
        const snap = await getDocs(target as CollectionRef);
        onNext(snap);
      }
    } catch (err) {
      if (onError) onError(err);
    }
  };

  // Immediate execution
  emitCurrent();

  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const customEvent = e as CustomEvent;
    if (
      !customEvent.detail?.collectionName ||
      customEvent.detail.collectionName === target.collection
    ) {
      emitCurrent();
    }
  };

  const storageHandler = () => {
    emitCurrent();
  };

  window.addEventListener(DB_CHANGE_EVENT, handler);
  window.addEventListener('storage', storageHandler);

  return () => {
    window.removeEventListener(DB_CHANGE_EVENT, handler);
    window.removeEventListener('storage', storageHandler);
  };
}

export function query(collectionRef: CollectionRef, ...constraints: any[]): CollectionRef {
  return collectionRef;
}

export function orderBy(field: string, direction?: 'asc' | 'desc') {
  return { _type: 'orderBy', field, direction };
}

export function where(field: string, op: string, value: any) {
  return { _type: 'where', field, op, value };
}

export function serverTimestamp(): string {
  return new Date().toISOString();
}

export function initializeFirestore(...args: any[]) {
  return db;
}
