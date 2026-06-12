import AsyncStorage from "@react-native-async-storage/async-storage";

function logStorageError(action: string, key: string, error: unknown) {
  console.warn(`[Storage] ${action} failed for ${key}:`, error);
}

export async function getStoredString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    logStorageError("Read", key, error);
    return null;
  }
}

export function parseStoredJson<T>(raw: string | null, key: string, fallback: T): T {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logStorageError("Parse", key, error);
    return fallback;
  }
}

export async function getStoredJson<T>(key: string, fallback: T): Promise<T> {
  return parseStoredJson(await getStoredString(key), key, fallback);
}

export async function setStoredString(key: string, value: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (error) {
    logStorageError("Write", key, error);
    return false;
  }
}

export async function setStoredJson<T>(key: string, value: T): Promise<boolean> {
  return setStoredString(key, JSON.stringify(value));
}

export async function removeStoredItem(key: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    logStorageError("Remove", key, error);
    return false;
  }
}

export async function removeStoredItems(keys: string[]): Promise<boolean> {
  try {
    await AsyncStorage.multiRemove(keys);
    return true;
  } catch (error) {
    logStorageError("Remove multiple", keys.join(", "), error);
    return false;
  }
}

export async function clearStoredData(): Promise<boolean> {
  try {
    await AsyncStorage.clear();
    return true;
  } catch (error) {
    logStorageError("Clear", "AsyncStorage", error);
    return false;
  }
}
