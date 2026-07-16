import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const KEY_LIST = "bb_native_persisted_keys";

function isNativeApp() {
  return Capacitor.isNativePlatform();
}

function shouldPersistKey(key: string) {
  const lower = key.toLowerCase();
  return key.startsWith("sb-") || lower.includes("supabase") || key.startsWith("bb_");
}

async function readPersistedKeyList(): Promise<string[]> {
  try {
    const { value } = await Preferences.get({ key: KEY_LIST });
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}

async function rememberKey(key: string) {
  if (!shouldPersistKey(key)) return;
  const keys = new Set(await readPersistedKeyList());
  keys.add(key);
  await Preferences.set({ key: KEY_LIST, value: JSON.stringify([...keys]) });
}

async function forgetKey(key: string) {
  const keys = new Set(await readPersistedKeyList());
  keys.delete(key);
  await Preferences.set({ key: KEY_LIST, value: JSON.stringify([...keys]) });
}

export async function hydrateNativePersistence() {
  if (!isNativeApp()) return;
  try {
    const listedKeys = await readPersistedKeyList();
    const { keys: allPreferenceKeys } = await Preferences.keys();
    const keys = new Set([
      ...listedKeys,
      ...allPreferenceKeys.filter((key) => shouldPersistKey(key)),
    ]);

    for (const key of keys) {
      const { value } = await Preferences.get({ key });
      if (value == null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    }
  } catch (error) {
    console.warn("Native persistence hydration failed", error);
  }
}

export function installNativePersistenceMirror() {
  if (!isNativeApp()) return;
  const storage = window.localStorage as Storage & { __bbNativeMirrorInstalled?: boolean };
  if (storage.__bbNativeMirrorInstalled) return;
  storage.__bbNativeMirrorInstalled = true;

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const originalClear = Storage.prototype.clear;

  Storage.prototype.setItem = function setItem(key: string, value: string) {
    originalSetItem.call(this, key, value);
    if (this === window.localStorage && shouldPersistKey(key)) {
      void Preferences.set({ key, value }).then(() => rememberKey(key));
    }
  };

  Storage.prototype.removeItem = function removeItem(key: string) {
    originalRemoveItem.call(this, key);
    if (this === window.localStorage && shouldPersistKey(key)) {
      void Preferences.remove({ key }).then(() => forgetKey(key));
    }
  };

  Storage.prototype.clear = function clear() {
    if (this === window.localStorage) {
      void (async () => {
        const keys = await readPersistedKeyList();
        await Promise.all(keys.map((key) => Preferences.remove({ key })));
        await Preferences.remove({ key: KEY_LIST });
      })();
    }
    originalClear.call(this);
  };
}

export async function syncNativePersistenceFromLocalStorage() {
  if (!isNativeApp()) return;
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && shouldPersistKey(key)) keys.push(key);
  }
  await Promise.all(
    keys.map(async (key) => {
      const value = localStorage.getItem(key);
      if (value != null) {
        await Preferences.set({ key, value });
      }
    })
  );
  await Preferences.set({ key: KEY_LIST, value: JSON.stringify(keys) });
}
