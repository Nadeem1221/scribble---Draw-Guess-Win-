// This file does 3 things:
// 1. Start an Express web server
// 2. Attach Socket.IO to it (for real-time features)
// 3. Connect to MongoDB

require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const { setupSockets } = require("./socketHandler");

const app = express();
app.use(cors());

// We need a raw http server so Socket.IO can attach to it
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB error:", err));

// Hand off all socket logic to socketHandler.js
setupSockets(io);

app.get("/", (req, res) => res.send("Server is running"));

server.listen(process.env.PORT, () => {
  console.log("Server running on port", process.env.PORT);
});