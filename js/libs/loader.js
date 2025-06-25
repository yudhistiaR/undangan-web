import { cache } from '../connection/cache.js';

const urlAosCss = 'https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.css';
const urlAosJs = 'https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js';
const urlConfetti = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.js';

/**
 * @param {ReturnType<typeof cache>} c
 * @returns {Promise<void>}
 */
const loadAOS = (c) => {

    /**
     * @returns {Promise<void>}
     */
    const loadCss = () => c.get(urlAosCss).then((uri) => new Promise((res, rej) => {
        const link = document.createElement('link');
        link.onload = res;
        link.onerror = rej;

        link.rel = 'stylesheet';
        link.href = uri;
        document.head.appendChild(link);
    }));

    /**
     * @returns {Promise<void>}
     */
    const loadJs = () => c.get(urlAosJs).then((uri) => new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.onload = res;
        sc.onerror = rej;

        sc.src = uri;
        document.head.appendChild(sc);
    }));

    return Promise.all([loadCss(), loadJs()]).then(() => {
        if (typeof window.AOS === 'undefined') {
            throw new Error('AOS library failed to load');
        }

        window.AOS.init();
    });
};

/**
 * @param {ReturnType<typeof cache>} c
 * @returns {Promise<void>}
 */
const loadConfetti = (c) => c.get(urlConfetti).then((uri) => new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.onerror = rej;
    sc.onload = () => {
        return typeof window.confetti === 'undefined' ? rej(new Error('Confetti library failed to load')) : res();
    };

    sc.src = uri;
    document.head.appendChild(sc);
}));

/**
 * @param {Object} [opt]
 * @param {boolean} [opt.aos=true] - Load AOS library
 * @param {boolean} [opt.confetti=true] - Load Confetti library
 * @returns {Promise<void>}
 */
export const loader = (opt = {}) => {
    const c = cache('libs');

    return c.open().then(() => {
        const promises = [];

        if (opt?.aos ?? true) {
            promises.push(loadAOS(c));
        }

        if (opt?.confetti ?? true) {
            promises.push(loadConfetti(c));
        }

        return Promise.all(promises);
    });
};