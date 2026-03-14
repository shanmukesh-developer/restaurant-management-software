/**
 * Besta Shared Utilities
 * Centralized logic for timers, notifications, and audio feedback.
 */

window.Besta = {
    /**
     * Formats elapsed time from a timestamp.
     * @param {string} t ISO timestamp or SQLite date string
     * @returns {object} { s: seconds, label: "m:ss" }
     */
    el: function(t) {
        if (!t) return { s: 0, label: '--:--' };
        if (typeof t === 'string' && !t.endsWith('Z') && !t.includes('+')) {
            t += 'Z'; // Assume UTC from SQLite
        }
        const d = Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / 1000));
        const m = Math.floor(d / 60), s = d % 60;
        return { s: d, label: `${m}:${s.toString().padStart(2, '0')}` };
    },

    /**
     * Plays a feedback chime.
     * @param {number} f Frequency in Hz
     */
    ding: function(f = 880) {
        try {
            const c = new (window.AudioContext || window.webkitAudioContext)();
            const o = c.createOscillator(), g = c.createGain();
            o.connect(g); g.connect(c.destination);
            o.frequency.value = f;
            g.gain.setValueAtTime(.4, c.currentTime);
            g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .8);
            o.start(); o.stop(c.currentTime + .8);
        } catch (e) { }
    },

    /**
     * Shows a toast notification.
     * @param {string} msg 
     * @param {string} type 'info' | 'error' | 'success'
     */
    toast: function(msg, type = 'info') {
        const container = document.getElementById('toast-container') || this._createToastContainer();
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = msg;
        container.appendChild(t);
        setTimeout(() => {
            t.classList.add('out');
            setTimeout(() => t.remove(), 500);
        }, 4000);
    },

    _createToastContainer: function() {
        const c = document.createElement('div');
        c.id = 'toast-container';
        document.body.appendChild(c);
        return c;
    },

    /**
     * Unified API wrapper with JWT injection.
     * @param {string} url 
     * @param {object} opts 
     */
    api: async function(url, opts = {}) {
        const token = sessionStorage.getItem('bestaToken');
        const headers = {
            'Content-Type': 'application/json',
            ...opts.headers
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(url, { ...opts, headers });
        if (response.status === 401) {
            this.toast('🔒 Session expired. Please log in again.', 'error');
            setTimeout(() => window.location.href = '/', 2000);
            throw new Error('Unauthorized');
        }
        return response;
    },

    /**
     * Registers the PWA Service Worker and handles install prompt.
     */
    registerSW: function() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('SW Registered', reg))
                    .catch(e => console.error('SW Failed', e));
            });
        }

    }
};

Besta.registerSW();
