import { request, cacheWrapper, HTTP_GET } from './request.js';

const objectPool = (() => {
    /**
     * @type {Map<string, Promise<Cache>>|null}
     */
    let cachePool = null;

    return {
        /**
         * @param {string} name
         * @returns {Promise<Cache>}
         */
        getInstance: (name) => {
            if (!cachePool) {
                cachePool = new Map();
            }

            if (!cachePool.has(name)) {
                cachePool.set(name, window.caches.open(name));
            }

            return cachePool.get(name);
        },
    };
})();

export const cache = (cacheName) => {

    /**
     * @type {Map<string, string>}
     */
    const objectUrls = new Map();

    /**
     * @type {Map<string, Promise<string>>}
     */
    const inFlightRequests = new Map();

    /**
     * @type {Cache|null}
     */
    let cacheObject = null;

    let ttl = 1000 * 60 * 60 * 6;

    let forceCache = false;

    /**
     * @returns {Promise<Cache>|null}
     */
    const open = async () => {
        if (!cacheObject && window.isSecureContext) {
            cacheObject = await objectPool.getInstance(cacheName);
        }

        return cacheObject;
    };

    /**
     * @param {string|URL} input 
     * @param {Response} res 
     * @returns {Response}
     */
    const set = (input, res) => open().then(cacheWrapper).then((cw) => {
        if (!res.ok) {
            throw new Error(res.statusText);
        }

        return cw.set(input, res, forceCache, ttl);
    });

    /**
     * @param {string|URL} input 
     * @returns {Promise<Response|null>}
     */
    const has = (input) => open().then(cacheWrapper).then((cw) => cw.has(input));

    /**
     * @param {string|URL} input 
     * @returns {Promise<boolean>}
     */
    const del = (input) => open().then(cacheWrapper).then((cw) => cw.del(input));

    /**
     * @param {string} input
     * @param {Promise<void>|null} [cancel=null]
     * @returns {Promise<string>}
     */
    const get = (input, cancel = null) => {
        if (objectUrls.has(input)) {
            return Promise.resolve(objectUrls.get(input));
        }

        if (inFlightRequests.has(input)) {
            return inFlightRequests.get(input);
        }

        /**
         * @returns {Promise<Response>}
         */
        const fetchPut = () => request(HTTP_GET, input).withCancel(cancel).withRetry().default();

        const inflightPromise = open()
            .then(() => window.isSecureContext ? has(input).then((res) => res ? Promise.resolve(res) : del(input).then(fetchPut).then((r) => set(input, r))) : fetchPut())
            .then((r) => r.blob())
            .then((b) => objectUrls.set(input, URL.createObjectURL(b)))
            .then(() => objectUrls.get(input))
            .finally(() => inFlightRequests.delete(input));

        inFlightRequests.set(input, inflightPromise);
        return inflightPromise;
    };

    /**
     * @param {object[]} items
     * @param {Promise<void>|null} cancel
     * @returns {Promise<void>}
     */
    const run = (items, cancel = null) => open().then(() => {
        const uniq = new Map();

        if (!window.isSecureContext) {
            console.warn('Cache is not supported in insecure context');
        }

        items.filter((val) => val !== null).forEach((val) => {
            const exist = uniq.get(val.url) ?? [];
            uniq.set(val.url, [...exist, [val.res, val?.rej]]);
        });

        return Promise.allSettled(Array.from(uniq).map(([k, v]) => get(k, cancel)
            .then((s) => {
                v.forEach((cb) => cb[0]?.(s));
                return s;
            })
            .catch((r) => {
                v.forEach((cb) => cb[1]?.(r));
                return r;
            })
        ));
    });

    /**
     * @param {string} input
     * @param {string} name
     * @returns {Promise<Response>}
     */
    const download = async (input, name) => {
        const reverse = new Map(Array.from(objectUrls.entries()).map(([k, v]) => [v, k]));

        if (!reverse.has(input)) {
            try {
                const checkUrl = new URL(input);
                if (!checkUrl.protocol.includes('blob')) {
                    throw new Error('Is not blob');
                }
            } catch {
                input = await get(input);
            }
        }

        return request(HTTP_GET, input).withDownload(name).default();
    };

    return {
        run,
        del,
        has,
        set,
        get,
        open,
        download,
        /**
         * @param {number} v
         * @returns {ReturnType<typeof cache>} 
         */
        setTtl(v) {
            ttl = Number(v);
            return this;
        },
        /**
         * @returns {ReturnType<typeof cache>} 
         */
        withForceCache() {
            forceCache = true;
            return this;
        },
    };
};