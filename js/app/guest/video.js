import { util } from '../../common/util.js';
import { cache } from '../../connection/cache.js';
import { HTTP_GET, request } from '../../connection/request.js';

export const video = (() => {

    /**
     * @type {ReturnType<typeof cache>|null}
     */
    let c = null;

    /**
     * @returns {void}
     */
    const load = () => {
        const wrap = document.getElementById('video-love-stroy');
        if (!wrap || !wrap.hasAttribute('data-src')) {
            wrap?.remove();
            return;
        }

        const src = wrap.getAttribute('data-src');
        if (!src) {
            return;
        }

        const vid = document.createElement('video');
        vid.className = wrap.getAttribute('data-vid-class');
        vid.loop = true;
        vid.muted = true;
        vid.controls = true;
        vid.autoplay = false;
        vid.playsInline = true;
        vid.preload = 'metadata';
        vid.disableRemotePlayback = true;
        vid.disablePictureInPicture = true;
        vid.controlsList = 'noremoteplayback nodownload noplaybackrate';

        const observer = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting ? vid.play() : vid.pause()));

        /**
         * @param {Response} res 
         * @returns {Promise<Response>}
         */
        const resToVideo = (res) => {
            vid.addEventListener('canplay', () => {
                vid.style.removeProperty('height');
                document.getElementById('video-love-stroy-loading')?.remove();
            }, { once: true });

            return res.clone().blob().then((b) => {
                vid.src = URL.createObjectURL(b);
                return res;
            });
        };

        /**
         * @returns {Promise<Response>}
         */
        const fetchBasic = () => {
            const bar = document.getElementById('progress-bar-video-love-stroy');
            const inf = document.getElementById('progress-info-video-love-stroy');
            const loaded = new Promise((res) => vid.addEventListener('canplay', res, { once: true }));

            vid.src = util.escapeHtml(src);
            wrap.appendChild(vid);

            return loaded.then(() => {
                const height = vid.getBoundingClientRect().width * (vid.videoHeight / vid.videoWidth);
                vid.style.height = `${height}px`;

                return request(HTTP_GET, vid.src)
                    .withProgressFunc((a, b) => {
                        const result = Number((a / b) * 100).toFixed(0) + '%';

                        bar.style.width = result;
                        inf.innerText = result;
                    })
                    .withRetry()
                    .default()
                    .then(resToVideo)
                    .catch(() => {
                        bar.style.backgroundColor = 'red';
                        inf.innerText = `Error loading video`;
                    })
                    .finally(() => observer.observe(vid));
            });
        };

        // run in async
        c.open().then(() => {
            if (!window.isSecureContext) {
                return fetchBasic();
            }

            return c.has(src).then((res) => {
                if (res) {
                    return resToVideo(res).finally(() => {
                        wrap.appendChild(vid);
                        observer.observe(vid);
                    });
                }

                return c.del(src)
                    .then(fetchBasic)
                    .then((r) => c.set(src, r));
            });
        });
    };

    /**
     * @returns {object}
     */
    const init = () => {
        c = cache('video').withForceCache();

        return {
            load,
        };
    };

    return {
        init,
    };
})();