interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

export class MemoryCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  set(key: string, value: T, ttlMs?: number): void {
    this.entries.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : null });
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  clear(): void {
    this.entries.clear();
  }
}
