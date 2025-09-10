
"use client";

// A simple in-memory cache with a TTL (time-to-live)
export class SimpleCache<T> {
    private cache = new Map<string, { data: T; expires: number }>();
    private ttl: number;

    constructor(ttlInSeconds: number = 60) {
        this.ttl = ttlInSeconds * 1000; // Convert seconds to milliseconds
    }

    get(key: string): T | undefined {
        const item = this.cache.get(key);
        if (!item) {
            return undefined;
        }

        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return undefined;
        }

        return item.data;
    }

    set(key: string, data: T): void {
        const expires = Date.now() + this.ttl;
        this.cache.set(key, { data, expires });
    }

    invalidate(key: string): void {
        this.cache.delete(key);
    }
    
    invalidatePrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }

    clear(): void {
        this.cache.clear();
    }
}
