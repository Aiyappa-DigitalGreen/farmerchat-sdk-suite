// Test stub: an in-memory AsyncStorage. `__data` is exposed so tests can seed and inspect it.
export const __data = new Map();

const AsyncStorage = {
  async getAllKeys() {
    return Array.from(__data.keys());
  },
  async multiGet(keys) {
    return keys.map((k) => [k, __data.has(k) ? __data.get(k) : null]);
  },
  async getItem(k) {
    return __data.has(k) ? __data.get(k) : null;
  },
  async setItem(k, v) {
    __data.set(k, String(v));
  },
  async removeItem(k) {
    __data.delete(k);
  },
  async multiRemove(keys) {
    for (const k of keys) __data.delete(k);
  },
};

export default AsyncStorage;
