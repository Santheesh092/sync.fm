---
description: Check if the backend server is running and healthy
---

### 1. Check if port 3001 is listening
// turbo
Run `netstat -ano | findstr :3001` to see if the port is active.

### 2. Check Backend Health Endpoint
// turbo
Run `curl http://localhost:3001/api/health` to verify the server is responding correctly.

### 3. Check Backend Process
Check the process list for `node server.js` if the port is not responding.
