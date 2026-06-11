// WebRTC manager for 1-to-N (Host) and N-to-1 (Listener) connections

export class WebRTCManager {
    constructor(socket) {
        this.socket = socket;
        this.conns = new Map(); // targetId -> RTCPeerConnection
        this.localStream = null;
        this.onTrack = null; // Callback for when a track is received (Listener mode)

        // Listen for signaling events
        this.socket.on('offer', this.handleOffer.bind(this));
        this.socket.on('answer', this.handleAnswer.bind(this));
        this.socket.on('ice-candidate', this.handleIceCandidate.bind(this));
    }

    _createConnection(targetId) {
        let pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'turn:turn.sync.fm:3478', username: 'sync', credential: 'fm' } // TURN Server added
            ],
            iceTransportPolicy: 'all'
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice-candidate', { targetId, candidate: event.candidate });
            }
        };

        // Queue for ICE candidates that arrive before remote description is set
        pc.pendingCandidates = [];

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || isIOS;

        pc.ontrack = (event) => {
            if (event.receiver && typeof event.receiver.playoutDelayHint !== 'undefined') {
                event.receiver.playoutDelayHint = isMobile ? 0.5 : 0.2; // 500ms buffer for mobile, 200ms for desktop
            }
            if (this.onTrack) {
                this.onTrack(event.streams[0]);
            }
        };

        // If direct ICE connection fails within 3 seconds, automatically fall back to TURN relay
        const iceTimer = setTimeout(() => {
            if (pc.connectionState !== 'connected' && pc.connectionState !== 'completed' && pc.connectionState !== 'closed') {
                console.warn(`[WebRTC] Direct connection failed within 3s for ${targetId}, forcing TURN relay...`);
                // Force relay transport policy
                try {
                    pc.setConfiguration({ ...pc.getConfiguration(), iceTransportPolicy: 'relay' });
                } catch (e) {
                    console.warn('[WebRTC] Could not set relay policy natively:', e);
                }
            }
        }, 3000);

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state with ${targetId}:`, pc.connectionState);
            if (pc.connectionState === 'connected') {
                clearTimeout(iceTimer);
            }
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                pc.close();
                this.conns.delete(targetId);
            }
        };

        return pc;
    }

    // Hosted Mode: Add a new listener
    async createOffer(targetId, stream) {
        const pc = this._createConnection(targetId);
        this.conns.set(targetId, pc);

        // Add local tracks to the connection
        if (stream) {
            this.localStream = stream;
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.socket.emit('offer', { targetId, offer });
    }

    // Listener Mode: Handle incoming offer from host
    async handleOffer({ senderId, offer }) {
        console.log(`[WebRTC] Received offer from ${senderId}`);
        const pc = this._createConnection(senderId);
        this.conns.set(senderId, pc);

        // Set remote description for incoming offer (listener side)
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        // Ensure we are in the correct state before creating an answer
        if (pc.signalingState !== 'have-remote-offer') {
            console.warn('[WebRTC] Unexpected signaling state before answer:', pc.signalingState, 'from', senderId);
            return;
        }
        // Apply any ICE candidates that arrived early
        if (pc.pendingCandidates && pc.pendingCandidates.length) {
            for (const cand of pc.pendingCandidates) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                    console.error('[WebRTC] Error adding queued ICE candidate', e);
                }
            }
            pc.pendingCandidates = [];
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('answer', { targetId: senderId, answer });
    }

    // Host Mode: Handle answer from listener
    async handleAnswer({ senderId, answer }) {
        console.log(`[WebRTC] Received answer from ${senderId}`);
        const pc = this.conns.get(senderId);
        if (pc) {
            // Ensure we are in the correct state before applying the remote answer.
                        // Ensure we are in the correct state before applying the remote answer.
            if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } else if (pc.signalingState === 'stable') {
                console.warn('[WebRTC] Remote answer already applied, ignoring duplicate.');
            } else {
                console.warn('[WebRTC] Unexpected signaling state for answer:', pc.signalingState, 'from', senderId);
            }
        }
    }

    // Handle ICE candidates from either side
    async handleIceCandidate({ senderId, candidate }) {
        const pc = this.conns.get(senderId);
        if (pc) {
            // If remote description not yet set, queue the candidate
            if (!pc.remoteDescription || pc.remoteDescription.type === '') {
                pc.pendingCandidates = pc.pendingCandidates || [];
                pc.pendingCandidates.push(candidate);
                console.warn('[WebRTC] Queued ICE candidate until remote description is set');
                return;
            }
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error('[WebRTC] Error adding received ice candidate', e);
            }
        }
    }

    // Host Mode: Change or set the audio stream for all current connections
    updateStream(newStream) {
        this.localStream = newStream;
        // For existing connections, we need to replace the tracks.
        // In MVP, we can just renegotiate or close and recreate connections.
        // But setting it up correctly before listeners join is the easiest MVP path.
    }

    disconnectAll() {
        this.conns.forEach(pc => pc.close());
        this.conns.clear();
    }
}
