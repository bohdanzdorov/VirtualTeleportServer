import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();  


const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT;

const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN }
});

const users = [];

const generateRandomPosition = () => {
    return [0, 1, 0];
};

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    users.push({
        id: socket.id,
        position: generateRandomPosition(),
        animation: "idle",
        rotation: 0,
        linvel: 0,
        containerRotation: 0,
    });

    console.log("Current users:", users);
    io.emit("users", users);

    socket.on("move", (user) => {
        const userToUpdate = users.find((u) => u.id === socket.id);
        if (userToUpdate) {
            userToUpdate.position = user.position;
            userToUpdate.animation = user.animation;
            userToUpdate.rotation = user.rotation;
            userToUpdate.linvel = user.linvel;
            userToUpdate.containerRotation = user.containerRotation;
            io.emit("users", users);
        }
    });

    socket.on("audioStream", (audioData) => {
        socket.broadcast.emit("audioStream", audioData);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        const index = users.findIndex((u) => u.id === socket.id);
        if (index !== -1) users.splice(index, 1);
        console.log("Updated users:", users);
        io.emit("users", users);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
