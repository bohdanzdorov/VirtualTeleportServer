## Virtual Teleport Server

The Virtual Teleport Server is the signalling and media-coordination backend for the Virtual Teleport experience. It exposes a Socket.IO gateway that manages shared rooms, avatar state, and virtual TV settings, and it issues short-lived Agora RTC tokens so clients can exchange real-time audio and video.

### Features
- Socket.IO based room lifecycle with automatic cleanup when the last user leaves.
- Tracks user avatars (appearance, transforms, visibility) and streams updates to everyone in the room.
- Maintains shared virtual TV state (link, visibility, webcam occupancy) in memory per room.
- Issues Agora RTC tokens on demand via `/rtc-token` to keep browser sessions authenticated.
- Enforces CORS restrictions based on configuration to limit access to trusted frontends.

### Tech Stack
- Node.js 18+
- Express 4
- Socket.IO 4
- Agora Access Token SDK
- dotenv, cors, nodemon (development)

### Directory Overview
```
VirtualTeleportServer/
  index.js      # Express app, Socket.IO handlers, and Agora token endpoint
  package.json  # Scripts and dependencies
  README.md
```

### Prerequisites
- Node.js 18 or newer
- npm 9+
- Agora project credentials (App ID and App Certificate)

### Environment Variables
Create a `.env` file in the server root with the following values:

```
PORT=4000                        # Listening port for HTTP and Socket.IO
CORS_ORIGIN=http://localhost:5173 # Origin allowed to connect (comma-separate for multiple)
APP_ID=your_agora_app_id          # Agora project App ID
APP_CERTIFICATE=your_agora_cert   # Agora project App Certificate
```

> If you host the frontend on multiple domains, set `CORS_ORIGIN` to a comma-separated list or adjust the middleware accordingly.

### Installation & Local Development
1. Install dependencies
   ```powershell
   npm install
   ```
2. Start in watch mode (nodemon)
   ```powershell
   npm run dev
   ```
   The server will reload when you modify `index.js`.
3. For production-style execution
   ```powershell
   npm start
   ```

### REST & Socket Interfaces
- **GET `/rtc-token`** – returns `{ token }` for an Agora client. Requires `channelName` and `uid` query params. The token expires after one hour.

Socket events handled by the server:
- `roomConnect` – payload `{ name, gender, hairColor, suitColor, trousersColor, roomId }`; registers a user, joins the room, and broadcasts current state.
- `move` – payload `{ position, rotation, animation }`; updates the user transform inside the room.
- `tvLink` – payload `{ tvLink }`; updates the shared video URL for the room.
- `tvVisibility` – payload `{ isTVVisible }`; toggles the shared TV on/off for everyone.
- `freeWebCamTV` – payload `{ userId }`; marks the user as visible again and frees any webcam TV slot they occupied.
- `leaveRoom` – client-initiated clean-up when closing the teleport view while keeping the socket alive.
- Standard `disconnect` – triggers automatic removal and room cleanup.

### Operational Notes
- Room data is stored in-memory. Deploying multiple instances requires an external state store or Socket.IO adapter (e.g., Redis).
- Token issuance depends on valid Agora APP_ID and APP_CERTIFICATE values. Keep these secrets out of source control.
- Default TV links are initialised to a safe placeholder and rely on the client to sanitize URLs before broadcasting.

### Deployment Checklist
- Set environment variables on the target platform (Docker secrets, managed configs, etc.).
- Place the service behind HTTPS (or a reverse proxy) so browsers can access media and sockets securely.
- Monitor memory usage if you expect many concurrent rooms; consider persistence for resilience.

Refer to the [Virtual Teleport Client](../VirtualTeleportClient/README.md) for frontend setup and integration guidance.
