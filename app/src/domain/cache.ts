export class LruCache<Key, Value> {
  private readonly entries = new Map<Key, Value>();
  constructor(private readonly capacity: number) {
    if (capacity < 1) throw new Error("缓存容量必须为正数");
  }
  get size() { return this.entries.size; }
  get(key: Key): Value | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) { this.entries.delete(key); this.entries.set(key, value); }
    return value;
  }
  set(key: Key, value: Value) {
    this.entries.delete(key); this.entries.set(key, value);
    if (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
  }
}
export const gridColumns = (width: number, minWidth: number, gap: number) => Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
