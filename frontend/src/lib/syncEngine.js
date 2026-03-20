/**
 * Vibez.fm — Sync Engine
 * NTP clock sync + drift correction for synchronized audio playback
 */

const SYNC_ENDPOINT = '/api/time';
const SYNC_SAMPLES = 5;
const RESYNC_INTERVAL = 5000; // ms

export class SyncEngine {
    constructor(socket) {
        this.socket = socket;
        this.offset = 0;          // client clock → server clock offset (ms)
        this.roundTripTime = 0;   // average RTT (ms)
        this._interval = null;
        this._audioElement = null;
        this._isSyncing = false;
    }

    /** Measure clock offset using NTP-like algorithm */
    async measureOffset(samples = SYNC_SAMPLES) {
        const results = [];
        console.log(`[SyncEngine] Starting synchronization (${samples} samples)...`);

        for (let i = 0; i < samples; i++) {
            const t0 = performance.now();
            try {
                // Add timestamp to avoid browser caching of the time response
                const res = await fetch(`${SYNC_ENDPOINT}?t=${Date.now()}`, { cache: 'no-store' });
                const { now: serverTime } = await res.json();
                const t1 = performance.now();
                const rtt = t1 - t0;
                // Offset = ServerTime - ClientTime (at middle of request)
                const offset = serverTime - (t0 + rtt / 2);
                results.push({ offset, rtt });
            } catch (e) {
                console.warn('[SyncEngine] HTTP fetch failed, using socket fallback', e);
                // Socket fallback
                await new Promise(resolve => {
                    const t0s = performance.now();
                    this.socket.emit('sync-time', { clientTime: Date.now() }, (resp) => {
                        const t1s = performance.now();
                        const rtt = t1s - t0s;
                        results.push({ offset: resp.serverTime - (t0s + rtt / 2), rtt });
                        resolve();
                    });
                });
            }
            await new Promise(r => setTimeout(r, 50));
        }

        if (results.length === 0) {
            console.error('[SyncEngine] Sync failed: no samples collected');
            return { offset: this.offset, rtt: this.roundTripTime };
        }

        // Sort by lowest RTT, take best 3
        results.sort((a, b) => a.rtt - b.rtt);
        const best = results.slice(0, Math.min(3, results.length));
        this.offset = best.reduce((s, r) => s + r.offset, 0) / best.length;
        this.roundTripTime = best.reduce((s, r) => s + r.rtt, 0) / best.length;

        console.log(`[SyncEngine] Sync complete: offset=${this.offset.toFixed(1)}ms RTT=${this.roundTripTime.toFixed(1)}ms`);
        return { offset: this.offset, rtt: this.roundTripTime };
    }

    /** Get synchronized global time (matches server clock) */
    globalNow() {
        return performance.now() + this.offset;
    }

    /** Attach an audio element for automatic drift correction */
    attachAudio(audioElement) {
        this._audioElement = audioElement;
    }

    /**
     * Called on listener when a sync packet arrives from the host.
     * Corrects playback position and rate.
     */
    applySync(data) {
        const audio = this._audioElement;
        if (!audio || !data) return;

        // Determine buffer based on device type
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || isIOS;
        const bufferDelay = isMobile ? 0.5 : 0.2; // 500ms for mobile, 200ms for desktop

        // Use performance.now() + offset to get current server time estimate
        const nowServer = performance.now() + this.offset;
        const lag = (nowServer - data.serverTime) / 1000; // seconds
        
        // Ensure expected position isn't negative, apply buffer delay
        const expectedPos = Math.max(0, data.position + lag - bufferDelay);
        const drift = audio.currentTime - expectedPos;
        const absDrift = Math.abs(drift);

        // Hard seek if drift > 500ms
        if (absDrift > 0.5) {
            console.log(`[SyncEngine] Hard seek triggered: drift=${drift.toFixed(3)}s`);
            audio.currentTime = expectedPos;
            audio.playbackRate = data.playbackRate || 1;
            return;
        }

        // Soft correction via playback rate ±0.05% for drift > 50ms (ultra-subtle, no distortion)
        if (absDrift > 0.05) {
            const correction = drift > 0 ? 0.999 : 1.001;
            audio.playbackRate = (data.playbackRate || 1) * correction;
        } else {
            audio.playbackRate = data.playbackRate || 1;
        }

        // Play/pause sync (avoid redundant calls if buffering)
        if (data.isPlaying && audio.paused) {
            if (audio.readyState >= 2) {
                console.log('[SyncEngine] Syncing: Resumed playback');
                audio.play().catch(e => console.warn('[SyncEngine] Play blocked:', e));
            } else {
                // Still buffering — play as soon as enough data is available
                console.log('[SyncEngine] Buffering, will play on canplay event');
                const onCanPlay = () => {
                    audio.removeEventListener('canplay', onCanPlay);
                    audio.play().catch(e => console.warn('[SyncEngine] Play after canplay blocked:', e));
                };
                audio.addEventListener('canplay', onCanPlay);
            }
        } else if (!data.isPlaying && !audio.paused) {
            console.log('[SyncEngine] Syncing: Paused playback');
            audio.pause();
        }
    }

    /** Start continuous clock resync */
    startContinuousSync(intervalMs = RESYNC_INTERVAL) {
        this.stopContinuousSync();
        this._interval = setInterval(() => {
            if (!this._isSyncing) {
                this._isSyncing = true;
                this.measureOffset(3).finally(() => { this._isSyncing = false; });
            }
        }, intervalMs);
    }

    stopContinuousSync() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }

    destroy() {
        this.stopContinuousSync();
        this._audioElement = null;
    }
}
