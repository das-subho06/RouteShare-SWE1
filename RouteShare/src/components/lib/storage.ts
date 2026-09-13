// lib/storage.ts
//
// Drop-in replacement for @react-native-async-storage/async-storage.
//
// On web, AsyncStorage's default persistence is window.localStorage,
// which is shared across every tab open on the same origin — so two
// people logged in as different users (e.g. a rider in one tab, a
// driver in another) stomp on each other's session data (userId,
// name, token, designation, activeRideSummary...). sessionStorage is
// scoped per-tab, which is what we actually want for session identity.
// Native platforms are untouched — they go straight to the real
// AsyncStorage, which is already per-app-install.

import { Platform } from 'react-native';

type StorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiSet(pairs: [string, string][]): Promise<void>;
  multiGet(keys: string[]): Promise<[string, string | null][]>;
  multiRemove(keys: string[]): Promise<void>;
};

const webStorage: StorageLike = {
  async getItem(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    window.sessionStorage.setItem(key, value);
  },
  async removeItem(key) {
    window.sessionStorage.removeItem(key);
  },
  async multiSet(pairs) {
    pairs.forEach(([key, value]) => window.sessionStorage.setItem(key, value));
  },
  async multiGet(keys) {
    return keys.map((key) => [key, window.sessionStorage.getItem(key)]);
  },
  async multiRemove(keys) {
    keys.forEach((key) => window.sessionStorage.removeItem(key));
  },
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const NativeAsyncStorage =
  Platform.OS === 'web' ? null : require('@react-native-async-storage/async-storage').default;

const storage: StorageLike = Platform.OS === 'web' ? webStorage : NativeAsyncStorage;

export default storage;