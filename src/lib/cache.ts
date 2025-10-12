// A simple in-memory cache with an optional TTL (time-to-live)
export class SimpleCache<T> {
    private cache = new Map<string, { data: T; expires: number | null }>();
    private ttl: number | null;

    constructor(ttlInSeconds: number | null = 60) {
        this.ttl = ttlInSeconds ? ttlInSeconds * 1000 : null; // Convert seconds to milliseconds
    }

    get(key: string): T | undefined {
        const item = this.cache.get(key);
        if (!item) {
            return undefined;
        }

        // If expires is a number and the time has passed, invalidate it.
        if (item.expires !== null && Date.now() > item.expires) {
            this.cache.delete(key);
            return undefined;
        }

        return item.data;
    }

    set(key: string, data: T): void {
        const expires = this.ttl ? Date.now() + this.ttl : null;
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
