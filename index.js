import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import pkg from 'agora-access-token';
const { RtcTokenBuilder, RtcRole } = pkg;

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT;

//Agora data
const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

app.use(cors({
    origin: process.env.CORS_ORIGIN 
}));

const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN }
});

// Default state per room
const DEFAULT_TV_LINK = { tvLink: "https://www.youtube.com/embed/yGzqD-g2gts" };

// Rooms registry: roomId -> { users, tvLink, isTVVisible, webCamTVConnections }
const rooms = new Map();

const normalizeRoomId = (roomIdInput) => {
    const val = typeof roomIdInput === "string" ? roomIdInput.trim().toUpperCase() : "";
    return val || "LOBBY";
};

const ensureRoom = (roomId = "LOBBY") => {
    const normalized = normalizeRoomId(roomId);
    if (!rooms.has(normalized)) {
        rooms.set(normalized, {
            users: [],
            tvLink: { ...DEFAULT_TV_LINK },
            isTVVisible: true,
            webCamTVConnections: [],
        });
    }
    return rooms.get(normalized);
};

const findUserRoom = (socketId) => {
    for (const [roomId, room] of rooms.entries()) {
        const user = room.users.find((u) => u.id === socketId);
        if (user) return { roomId, room, user };
    }
    return null;
};

const removeUserFromRoom = (socketId) => {
    const found = findUserRoom(socketId);
    if (!found) return null;

    const { roomId, room } = found;

    if (Array.isArray(room.webCamTVConnections) && room.webCamTVConnections.length > 0) {
        room.webCamTVConnections = room.webCamTVConnections.filter((connection) => connection.userId !== socketId);
    }

    room.users = room.users.filter((u) => u.id !== socketId);

    if (room.users.length === 0) {
        rooms.delete(roomId);
        console.log("Room removed (empty):", roomId);
    } else {
        console.log("Updated users in room", roomId, room.users);
        io.to(roomId).emit("users", room.users);
    }

    return roomId;
};

const generateRandomPosition = () => {
    return [0, 1, 0];
};

io.on("connection", (socket) => {
    console.log("User connected to the webpage:", socket.id);

    //When user connects to the virtual environment
    socket.on("roomConnect", ({ name, hairColor, suitColor, trousersColor, gender, roomId }) => {
        const targetRoomId = normalizeRoomId(roomId);
        const room = ensureRoom(targetRoomId);
        console.log("User connected to room:", socket.id);
        if (!name) {
            name = "User"
        }
        const newUser = {
            id: socket.id,
            name: name,
            gender: gender,
            hairColor: hairColor,
            suitColor: suitColor,
            trousersColor: trousersColor,
            position: generateRandomPosition(),
            isVisible: true,
            animation: "idle",
            rotation: [0, 0, 0],
            roomId: targetRoomId,
        };
        room.users.push(newUser);
        socket.join(targetRoomId);

        //Reply with all current info about state of virtual space
        console.log("Current users in room", targetRoomId, room.users);
        io.to(targetRoomId).emit("users", room.users);
        io.to(targetRoomId).emit("tvLink", room.tvLink);
        io.to(targetRoomId).emit("tvVisibility", { isTVVisible: room.isTVVisible });
    })

    //When user moves its avatar
    socket.on("move", (user) => {
        const found = findUserRoom(socket.id);
        if (!found) return;
        const { roomId, room, user: userToUpdate } = found;
        userToUpdate.position = user.position;
        userToUpdate.animation = user.animation;
        userToUpdate.rotation = user.rotation;
        io.to(roomId).emit("users", room.users);
    });

    //When user leaves the virtual monitor
    socket.on("freeWebCamTV", (chooseTvData) => {
        const { userId } = chooseTvData;
        const found = findUserRoom(userId);
        if (!found) return;
        const { roomId, room } = found;
        const isTvOccupied = room.webCamTVConnections.some(a => a.userId === userId);
        if (isTvOccupied) {
            const updatedConnections = room.webCamTVConnections.filter(a => a.userId !== userId);
            room.webCamTVConnections = [...updatedConnections];

            const userToUpdate = room.users.find((u) => u.id === userId);
            if (userToUpdate) {
                userToUpdate.isVisible = true
                io.to(roomId).emit("users", room.users);
            }
        }
    })

    //When one of the users update the virtual TV link
    socket.on("tvLink", (tvLink) => {
        const found = findUserRoom(socket.id);
        if (!found) return;
        const { roomId, room } = found;
        room.tvLink = tvLink;
        io.to(roomId).emit("tvLink", tvLink);
    })

    //When one of the users toggles TV visibility
    socket.on("tvVisibility", ({ isTVVisible: newState }) => {
        const found = findUserRoom(socket.id);
        if (!found) return;
        if (typeof newState === "boolean") {
            const { roomId, room } = found;
            room.isTVVisible = newState;
            io.to(roomId).emit("tvVisibility", { isTVVisible: room.isTVVisible });
        }
    });

    //When user leaves the room but keeps the session alive
    socket.on("leaveRoom", () => {
        const roomId = removeUserFromRoom(socket.id);
        if (!roomId) {
            return;
        }
        socket.leave(roomId);
        console.log(`User ${socket.id} left room ${roomId}`);
    });

    //When user leaves
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        removeUserFromRoom(socket.id);
    });
});

//Endpoint, that return token for connection ot the Agora session
app.get('/rtc-token', (req, res) => {
    const channelName = req.query.channelName;
    const uid = req.query.uid;
    const role = RtcRole.PUBLISHER;

    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        uid,
        role,
        privilegeExpiredTs
    );

    res.json({ token });
});

//Start the server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
