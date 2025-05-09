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
     origin: 'https://virtualteleport.netlify.app' 
    // origin: 'http://localhost:5173'
}));
const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN }
});

const users = [];
let webCamTVConnections = [];
let curTvLink = { tvLink: "https://www.youtube.com/embed/yGzqD-g2gts" }

const generateRandomPosition = () => {
    return [0, 1, 0];
};

io.on("connection", (socket) => {
    console.log("User connected to the webpage:", socket.id);

    socket.on("roomConnect", ({ name, hairColor, suitColor, trousersColor, gender }) => {
        console.log("User connected to room:", socket.id);
        if (!name) {
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
            isVisible: true,
            animation: "idle",
            rotation: [0, 0, 0],
            linvel: 0,
            containerRotation: 0,
        });

        console.log("Current users:", users);
        io.emit("users", users);
        io.emit("tvLink", curTvLink)
        io.emit("occupyWebCamTV", webCamTVConnections)
    })

    socket.on("monitorModeConnect", () => {
        io.emit("occupyWebCamTV", webCamTVConnections)
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

    socket.on("occupyWebCamTV", (chooseTvData) => {
        const { userId, tvNumber } = chooseTvData;
        const isTvOccupied = webCamTVConnections.some(a => a.tvNumber === tvNumber);
        if (isTvOccupied) {
            io.emit("occupyWebCamTV", webCamTVConnections)
            return
        }
        const updatedConnections = webCamTVConnections.filter(a => a.userId !== userId);

        updatedConnections.push(chooseTvData);

        webCamTVConnections = [...updatedConnections]
        io.emit("occupyWebCamTV", webCamTVConnections)
                
        const userToUpdate = users.find((u) => u.id === userId);
        if (userToUpdate) {
            userToUpdate.isVisible = false
            io.emit("users", users);
        }
    })

    socket.on("freeWebCamTV", (chooseTvData) => {
        const { userId } = chooseTvData;
        const isTvOccupied = webCamTVConnections.some(a => a.userId === userId);
        if (isTvOccupied) {
            const updatedConnections = webCamTVConnections.filter(a => a.userId !== userId);
            webCamTVConnections = [...updatedConnections]
            io.emit("occupyWebCamTV", webCamTVConnections)

            const userToUpdate = users.find((u) => u.id === userId);
            if (userToUpdate) {
                userToUpdate.isVisible = true
                io.emit("users", users);
            }
            return
        }
    })

    socket.on("tvLink", (tvLink) => {
        curTvLink = tvLink
        socket.broadcast.emit("tvLink", tvLink)
    })

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        const webCamIndex = webCamTVConnections.findIndex((u) => u.userId === socket.id);
        if (webCamIndex !== -1) webCamTVConnections.splice(webCamIndex, 1);
        console.log(webCamTVConnections)
        io.emit("occupyWebCamTV", webCamTVConnections);

        const index = users.findIndex((u) => u.id === socket.id);
        if (index !== -1) users.splice(index, 1);
        console.log("Updated users:", users);
        io.emit("users", users);
    });
});

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

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
