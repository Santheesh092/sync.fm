/**
 * Nearby.fm — Sync Engine
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

        for (let i = 0; i < samples; i++) {
            const t0 = performance.now();
            try {
                const res = await fetch(SYNC_ENDPOINT);
                const { now: serverTime } = await res.json();
                const t1 = performance.now();
                const rtt = t1 - t0;
                const offset = serverTime - (t0 + rtt / 2);
                results.push({ offset, rtt });
            } catch (e) {
                console.warn('[SyncEngine] HTTP fetch failed, using socket fallback');
                // Socket fallback
                await new Promise(resolve => {
                    const t0s = Date.now();
                    this.socket.emit('sync-time', { clientTime: t0s }, (resp) => {
                        const t1s = Date.now();
                        const rtt = t1s - t0s;
                        results.push({ offset: resp.serverTime - (t0s + rtt / 2), rtt });
                        resolve();
                    });
                });
            }
            await new Promise(r => setTimeout(r, 50));
        }

        // Sort by lowest RTT, take best 3
        results.sort((a, b) => a.rtt - b.rtt);
        const best = results.slice(0, Math.min(3, results.length));
        this.offset = best.reduce((s, r) => s + r.offset, 0) / best.length;
        this.roundTripTime = best.reduce((s, r) => s + r.rtt, 0) / best.length;

        console.log(`[SyncEngine] offset=${this.offset.toFixed(1)}ms RTT=${this.roundTripTime.toFixed(1)}ms`);
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

        const lag = (Date.now() + this.offset - data.serverTime) / 1000; // seconds
        const expectedPos = data.position + lag;
        const drift = audio.currentTime - expectedPos;
        const absDrift = Math.abs(drift);

        // Hard seek if drift > 500ms
        if (absDrift > 0.5) {
            audio.currentTime = expectedPos;
            audio.playbackRate = data.playbackRate || 1;
            return;
        }

        // Soft correction via playback rate ±1% for drift > 30ms
        if (absDrift > 0.03) {
            const correction = drift > 0 ? 0.99 : 1.01;
            audio.playbackRate = (data.playbackRate || 1) * correction;
        } else {
            audio.playbackRate = data.playbackRate || 1;
        }

        // Play/pause sync
        if (data.isPlaying && audio.paused) {
            audio.play().catch(() => { });
        } else if (!data.isPlaying && !audio.paused) {
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
