// NTP-like time synchronization to calculate clock offset between client and server.
// offset = serverTime - clientLocalTime

export class TimeSync {
    constructor(socket) {
        this.socket = socket;
        this.offset = 0;
        this.roundTripTime = 0;
        this.syncSamples = [];
        this.syncInterval = null;
    }

    async sync(samples = 5) {
        this.syncSamples = [];

        for (let i = 0; i < samples; i++) {
            const clientSentTime = Date.now();

            await new Promise(resolve => {
                this.socket.emit('sync-time', { clientTime: clientSentTime }, (response) => {
                    const clientReceiveTime = Date.now();
                    const serverTime = response.serverTime;

                    // Simplified NTP calculation
                    // Latency = (clientReceiveTime - clientSentTime) / 2
                    // We assume symmetric latency for MVP
                    const rtt = clientReceiveTime - clientSentTime;
                    const latency = rtt / 2;

                    // The time it was on the server is (serverTime - latency)
                    // offset is the difference between server time and our local time
                    const currentOffset = serverTime - (clientReceiveTime - latency);

                    this.syncSamples.push({ offset: currentOffset, rtt });
                    resolve();
                });
            });

            // Short delay between samples
            await new Promise(r => setTimeout(r, 100));
        }

        // Filter outlines and calculate average
        this.syncSamples.sort((a, b) => a.rtt - b.rtt);
        // Take the best 3 samples (lowest RTT)
        const bestSamples = this.syncSamples.slice(0, 3);

        this.offset = bestSamples.reduce((sum, sample) => sum + sample.offset, 0) / bestSamples.length;
        this.roundTripTime = bestSamples.reduce((sum, sample) => sum + sample.rtt, 0) / bestSamples.length;

        console.log(`[TimeSync] Calculated offset: ${this.offset}ms, avg RTT: ${this.roundTripTime}ms`);
    }

    // Poll server every 10 seconds to correct clock drift
    startContinuousSync(intervalMs = 10000) {
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => {
            this.sync(3); // Do 3 quick pings every 10 seconds
        }, intervalMs);
    }

    stopContinuousSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // Get synchronized time (what time it is on the host/server)
    now() {
        return Date.now() + this.offset;
    }
}
