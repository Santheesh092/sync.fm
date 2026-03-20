const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Serve uploads statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
// Serve uploads with explicit CORS for cross-device sync
app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'public, max-age=3600');
    }
}));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'))
});
const upload = multer({ storage });

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST', 'DELETE'] }
});

const PORT = process.env.PORT || 3001;

// ─── In-Memory Store ───────────────────────────────────────────────────────
const rooms = new Map(); // roomId → roomState
const socketToRoom = new Map(); // socketId → { roomId, role: 'host'|'listener' }

// rate limiting: ip → { count, resetAt }
let rateLimits = new Map();
const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const MAX_ROOMS_PER_HOUR = isDev ? 100 : 10;

function getRoomState(roomId) {
    return rooms.get(roomId) || null;
}

function createRoom({ id, type, name, hostId, password, allowListenerControls, quality, maxDevices }) {
    const roomId = id || Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = {
        id: roomId,
        type: type || 'party',
        name: name || 'Unnamed Room',
        hostId,
        password: password || null,
        allowListenerControls: allowListenerControls || false,
        quality: quality || 'high',
        maxDevices: maxDevices || 0, // 0 = unlimited
        createdAt: Date.now(),
        track: { url: null, title: 'No track loaded', artist: '', duration: 0, albumArt: null },
        state: { isPlaying: false, position: 0, updatedAt: Date.now(), playbackRate: 1 },
        devices: new Map(), // deviceId → deviceInfo
        syncInterval: null,
        alert: null,
    };
    rooms.set(roomId, room);
    return room;
}

const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['x-real-ip'] || 
           req.socket.remoteAddress || 
           'unknown';
};

// ─── REST API ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'UP', 
        timestamp: Date.now(),
        rooms: rooms.size,
        uptime: process.uptime()
    });
});

app.get('/api/time', (req, res) => {
    res.json({ now: Date.now() });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, title: req.file.originalname.replace(/\.[^.]+$/, '') });
});

app.post('/api/room', (req, res) => {
    try {
        const ip = getClientIp(req);
        console.log(`[API] Room creation request from ${ip}`);
        
        const limit = rateLimits.get(ip) || { count: 0, resetAt: Date.now() + 3600000 };

        if (Date.now() > limit.resetAt) {
            limit.count = 0;
            limit.resetAt = Date.now() + 3600000;
        }
        if (limit.count >= MAX_ROOMS_PER_HOUR) {
            console.warn(`[API] Rate limit hit for ${ip} (${limit.count}/${MAX_ROOMS_PER_HOUR})`);
            return res.status(429).json({ error: `Rate limit exceeded. Max ${MAX_ROOMS_PER_HOUR} rooms/hour.` });
        }
        
        if (limit.count > (MAX_ROOMS_PER_HOUR * 0.8)) {
            console.warn(`[API] Rate limit warning for ${ip}: ${limit.count}/${MAX_ROOMS_PER_HOUR}`);
        }

        limit.count++;
        rateLimits.set(ip, limit);

        const body = req.body || {};
        const { type, name, password, allowListenerControls, quality, maxDevices } = body;
        
        // Validation
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Room name is required' });
        }
        if (name.length > 100) {
            return res.status(400).json({ error: 'Room name too long (max 100 chars)' });
        }

        console.log(`[API] Creating room with body:`, JSON.stringify(body, null, 2));
        const room = createRoom({ 
            type, 
            name: name.trim(), 
            hostId: null, 
            password, 
            allowListenerControls, 
            quality,
            maxDevices: Number(maxDevices) || 0 
        });

        const shareUrl = `${req.headers.origin || 'http://localhost:5173'}/join/${room.id}`;
        console.log(`[API] Room created: ${room.id}, URL: ${shareUrl}`);

        res.json({
            roomId: room.id,
            type: room.type,
            name: room.name,
            shareUrl,
        });
    } catch (err) {
        console.error('[API] CRITICAL Error creating room:', err.stack || err);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

app.get('/api/room/:id', (req, res) => {
    const room = getRoomState(req.params.id);
    if (!room) return res.status(200).json({ exists: false, error: 'Room not found' });
    res.json({
        id: room.id,
        type: room.type,
        name: room.name,
        track: room.track,
        state: room.state,
        deviceCount: room.devices.size,
    });
});

app.delete('/api/room/:id', (req, res) => {
    rooms.delete(req.params.id);
    res.json({ success: true });
});

app.get('/api/rooms/nearby', (req, res) => {
    const publicRooms = [];
    rooms.forEach((room) => {
        if (!room.password) {
            publicRooms.push({
                id: room.id,
                type: room.type,
                name: room.name,
                deviceCount: room.devices.size,
                createdAt: room.createdAt,
            });
        }
    });
    res.json(publicRooms);
});

const roomCleanupTimeouts = new Map();

// ─── Socket.io Events ──────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('[+] Connected:', socket.id);

    // ── Time Sync ──
    socket.on('sync-time', (data, callback) => {
        callback({ clientTime: data.clientTime, serverTime: Date.now() });
    });

    // ── Legacy: create-party (backward compat) ──
    socket.on('create-party', () => {
        const room = createRoom({ type: 'party', name: 'Quick Party', hostId: socket.id });
        socket.join(room.id);
        socketToRoom.set(socket.id, { roomId: room.id, role: 'host' });
        room.hostId = socket.id;
        room.devices.set(socket.id, {
            id: socket.id, name: 'Host', type: 'host',
            joinedAt: Date.now(), latency: 0, volume: 1, muted: false, zone: 'A'
        });
        socket.emit('party-created', { partyId: room.id });
        console.log(`[Room] Created ${room.id} by ${socket.id}`);
    });

    // ── Room: Create (new flow) ──
    socket.on('room:create', ({ roomId, roomType, roomName, deviceName, deviceType }) => {
        // Clear cleanup timeout if it exists
        if (roomCleanupTimeouts.has(roomId)) {
            clearTimeout(roomCleanupTimeouts.get(roomId));
            roomCleanupTimeouts.delete(roomId);
            console.log(`[Room] Grace period cancelled for ${roomId} - Host reconnected`);
        }

        let room = rooms.get(roomId);
        if (!room) {
            room = createRoom({ id: roomId, type: roomType || 'party', name: roomName || 'My Room', hostId: socket.id });
        } else {
            // Remove previous host device to prevent duplicates on reload
            for (const [deviceId, device] of room.devices.entries()) {
                if (device.isHost) {
                    room.devices.delete(deviceId);
                    // Notify others that the old host socket is gone
                    io.to(room.id).emit('device:disconnected', { deviceId });
                }
            }
        }
        room.hostId = socket.id;
        socket.join(room.id);
        socketToRoom.set(socket.id, { roomId: room.id, role: 'host' });

        const deviceInfo = {
            id: socket.id, name: deviceName || 'Host Device',
            type: deviceType || 'desktop', joinedAt: Date.now(),
            latency: 0, volume: 1, muted: false, zone: 'A', isHost: true,
        };
        room.devices.set(socket.id, deviceInfo);

        socket.emit('room:joined', {
            roomId: room.id,
            role: 'host',
            state: serializeRoomState(room),
        });
    });

    // ── Room: Join ──
    socket.on('room:join', ({ roomId, deviceName, deviceType, password }) => {
        const room = rooms.get(roomId);
        if (!room) {
            return socket.emit('error', { message: 'Room not found' });
        }
        if (room.password && room.password !== password) {
            return socket.emit('error', { message: 'Incorrect password' });
        }
        // Check capacity - only if maxDevices is set and > 0 (0 interpreted as unlimited)
        if (room.maxDevices && room.maxDevices > 0 && room.devices.size >= room.maxDevices) {
            return socket.emit('error', { message: 'Room reached maximum device capacity' });
        }

        socket.join(room.id);
        socketToRoom.set(socket.id, { roomId: room.id, role: 'listener' });

        const deviceInfo = {
            id: socket.id, name: deviceName || `Device-${socket.id.slice(0, 4)}`,
            type: deviceType || 'mobile', joinedAt: Date.now(),
            latency: 0, volume: 1, muted: false, zone: 'A', isHost: false,
        };
        room.devices.set(socket.id, deviceInfo);

        // Notify host
        io.to(room.hostId).emit('device:connected', deviceInfo);
        io.to(room.hostId).emit('listener-joined', { listenerId: socket.id });

        // Send current state to new listener
        socket.emit('room:joined', {
            roomId: room.id,
            role: 'listener',
            state: serializeRoomState(room),
        });

        console.log(`[Room] ${socket.id} joined ${roomId}`);
    });

    // ── Legacy join-party (backward compat) ──
    socket.on('join-party', ({ partyId }) => {
        const room = rooms.get(partyId);
        if (!room) return socket.emit('error', { message: 'Party not found' });

        if (room.maxDevices > 0 && room.devices.size >= room.maxDevices) {
            return socket.emit('error', { message: 'Room is full' });
        }

        socket.join(partyId);
        socketToRoom.set(socket.id, { roomId: partyId, role: 'listener' });

        const deviceInfo = {
            id: socket.id, name: `Listener-${socket.id.slice(0, 4)}`,
            type: 'mobile', joinedAt: Date.now(),
            latency: 0, volume: 1, muted: false, zone: 'A', isHost: false,
        };
        room.devices.set(socket.id, deviceInfo);

        io.to(room.hostId).emit('listener-joined', { listenerId: socket.id });
        io.to(room.hostId).emit('device:connected', deviceInfo);
    });

    // ── Sync: Host broadcasts playback state ──
    socket.on('sync:broadcast', (data) => {
        const info = socketToRoom.get(socket.id);
        if (!info) return;
        const room = rooms.get(info.roomId);
        if (!room || room.hostId !== socket.id) return;

        room.state = {
            isPlaying: data.isPlaying,
            position: data.position,
            playbackRate: data.playbackRate || 1,
            updatedAt: Date.now(),
        };

        // Relay to all listeners in room (except host)
        socket.to(info.roomId).emit('sync:broadcast', {
            ...data,
            serverTime: Date.now(),
        });
    });

    // ── Sync: Acknowledgment / Latency Ping ──
    socket.on('sync:ack', (data) => {
        const info = socketToRoom.get(socket.id);
        if (!info) return;
        const room = rooms.get(info.roomId);
        if (!room) return;

        const device = room.devices.get(socket.id);
        if (device) {
            device.latency = data.latency;
        }
        // Relay latency to host
        io.to(room.hostId).emit('device:latency', { deviceId: socket.id, ms: data.latency });
    });

    // ── Control: Play/Pause/Seek/Track ──
    socket.on('control:play', (data) => broadcastControl(socket, 'control:play', data));
    socket.on('control:pause', (data) => broadcastControl(socket, 'control:pause', data));
    socket.on('control:seek', (data) => broadcastControl(socket, 'control:seek', data));
    socket.on('control:track', (data) => {
        const info = socketToRoom.get(socket.id);
        if (info) {
            const room = rooms.get(info.roomId);
            if (room && room.hostId === socket.id) {
                room.track = { ...room.track, ...data };
            }
        }
        broadcastControl(socket, 'control:track', data);
    });
    socket.on('control:volume', ({ deviceId, volume }) => {
        const info = socketToRoom.get(socket.id);
        if (!info) return;
        const room = rooms.get(info.roomId);
        if (!room || room.hostId !== socket.id) return;
        const device = room.devices.get(deviceId);
        if (device) device.volume = volume;
        io.to(deviceId).emit('control:volume', { volume });
    });
    socket.on('control:mute', ({ deviceId }) => {
        const info = socketToRoom.get(socket.id);
        if (!info) return;
        const room = rooms.get(info.roomId);
        if (!room || room.hostId !== socket.id) return;
        const device = room.devices.get(deviceId);
        if (device) device.muted = !device.muted;
        io.to(deviceId).emit('control:mute', { muted: device?.muted });
    });
    socket.on('control:kick', ({ deviceId }) => {
        const info = socketToRoom.get(socket.id);
        if (!info) return;
        const room = rooms.get(info.roomId);
        if (!room || room.hostId !== socket.id) return;
        io.to(deviceId).emit('room:kicked');
        room.devices.delete(deviceId);
        io.to(info.roomId).emit('device:disconnected', { deviceId });
    });

    // ── Alert (Safety/Announcement override) ──
    socket.on('room:alert', (alertData) => {
        const info = socketToRoom.get(socket.id);
        if (!info) return;
        const room = rooms.get(info.roomId);
        if (!room || room.hostId !== socket.id) return;
        room.alert = alertData;
        io.to(info.roomId).emit('room:alert', alertData);
    });

    // ── WebRTC Signaling (for mic broadcasts) ──
    socket.on('offer', ({ targetId, offer }) => io.to(targetId).emit('offer', { senderId: socket.id, offer }));
    socket.on('answer', ({ targetId, answer }) => io.to(targetId).emit('answer', { senderId: socket.id, answer }));
    socket.on('ice-candidate', ({ targetId, candidate }) => io.to(targetId).emit('ice-candidate', { senderId: socket.id, candidate }));

    // ── Ping/Pong for latency measurement ──
    socket.on('ping', (data, callback) => {
        if (typeof callback === 'function') callback({ serverTime: Date.now() });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
        console.log('[-] Disconnected:', socket.id);
        const info = socketToRoom.get(socket.id);
        if (!info) return;

        const room = rooms.get(info.roomId);
        if (!room) return;

        if (info.role === 'host') {
            console.log(`[Room] Host disconnected from ${info.roomId}. Starting 60s grace period.`);
            
            // Start grace period for deletion
            const timeout = setTimeout(() => {
                console.log(`[Room] Grace period expired. Closing ${info.roomId}`);
                io.to(info.roomId).emit('party-closed');
                io.to(info.roomId).emit('room:closed', { message: 'Host ended the session' });
                if (room.syncInterval) clearInterval(room.syncInterval);
                rooms.delete(info.roomId);
                roomCleanupTimeouts.delete(info.roomId);
            }, 60000); // 60s grace period for better reliability

            roomCleanupTimeouts.set(info.roomId, timeout);
        } else {
            room.devices.delete(socket.id);
            io.to(room.hostId).emit('listener-left', { listenerId: socket.id });
            io.to(room.hostId).emit('device:disconnected', { deviceId: socket.id });
        }
        socketToRoom.delete(socket.id);
    });
});


// ─── Helpers ───────────────────────────────────────────────────────────────
function broadcastControl(socket, event, data) {
    const info = socketToRoom.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomId);
    if (!room) return;
    const isHost = room.hostId === socket.id;
    const isAllowed = isHost || room.allowListenerControls;
    if (!isAllowed) return;
    socket.to(info.roomId).emit(event, data);
}

function serializeRoomState(room) {
    return {
        id: room.id,
        type: room.type,
        name: room.name,
        hostId: room.hostId,
        track: room.track,
        state: room.state,
        devices: Array.from(room.devices.values()),
        allowListenerControls: room.allowListenerControls,
        maxDevices: room.maxDevices,
    };
}

server.listen(PORT, () => {
    console.log(`✅ Vibez.fm server running on port ${PORT}`);
});
