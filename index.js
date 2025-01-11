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
let curTvLink = {tvLink: "https://www.youtube.com/embed/yGzqD-g2gts"}

const generateRandomPosition = () => {
    return [0, 1, 0];
};

io.on("connection", (socket) => {
    console.log("User connected to the webpage:", socket.id);

    socket.on("roomConnect", ({name, hairColor, suitColor, trousersColor, gender})=> {
        console.log("User connected to room:", socket.id);
        if(!name){
            name = "User"
        }
        users.push({
            id: socket.id,
            name: name,
            gender: gender,
            hairColor: hairColor,
            suitColor: suitColor,
            trousersColor: trousersColor,
            position: generateRandomPosition(),
            animation: "idle",
            rotation: 0,
            linvel: 0,
            containerRotation: 0,
        });

        console.log("Current users:", users);
        io.emit("connectAudio")
        io.emit("users", users);
        io.emit("tvLink", curTvLink)
    })

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

    socket.on("tvLink", (tvLink) => {
        curTvLink = tvLink
        socket.broadcast.emit("tvLink", tvLink)
    })

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
