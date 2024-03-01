"use strict";
/**
 * @internal
 */
class JSONDatabaseAdapter {
    impl;
    constructor(impl) {
        this.impl = impl;
    }
    async get(key) {
        const res = await this.impl.get(key);
        if (typeof res === 'string')
            return JSON.parse(res);
    }
    async set(key, value) {
        return await this.impl.set(key, JSON.stringify(value));
    }
    async has(key) {
        return await this.impl.has(key);
    }
    async delete(key) {
        return await this.impl.delete(key);
    }
    async *[Symbol.asyncIterator]() {
        for (const [id, value] of await this.impl.entries()) {
            yield [id, JSON.parse(value)];
        }
    }
}
/**
 * Routine
 */
async function cleanupDatabase(database) {
    const adapter = new JSONDatabaseAdapter(database);
    for await (const [id, { expires }] of adapter)
        if (expires < Date.now())
            database.delete(id);
}

export { cleanupDatabase, JSONDatabaseAdapter };