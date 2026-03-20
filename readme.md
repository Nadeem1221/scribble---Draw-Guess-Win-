# Skribbl Clone

A real-time multiplayer drawing and guessing game built with
React + TypeScript + Node.js + Socket.IO + MongoDB.

## Live URL

<!-- Vercel URL  Live URL -->
https://scribble-red.vercel.app/

<!-- render url -->
https://scribble-zidd.onrender.com
---





## Stack

- **Frontend** — React + TypeScript + Vite
- **Backend** — Node.js + Express + Socket.IO
- **Database** — MongoDB Atlas (stores only final scores)
- **Hosting** — Vercel (client) + Render (server)



## Run Locally

**1. Get a MongoDB connection string**

Sign up at [mongodb.com/atlas](https://mongodb.com/atlas), create a free cluster, click Connect → copy the URI.

**2. Start the server**

```bash
cd server
```

Create `.env`:
```
MONGO_URI=your_uri_here
PORT=3001
```

```bash
npm install
npm run dev
```

**3. Start the client**

```bash
cd client
```

Create `.env`:
```
VITE_SERVER_URL=http://localhost:3001
```

```bash
npm install
npm run dev
```

Open **http://localhost:5173** in two tabs and test.

---

## Deploy

**Server → Render**

- New Web Service → connect your repo
- Root directory: `server`
- Build: `npm install` / Start: `node server.js`
- Add env vars: `MONGO_URI` and `PORT=3001`
- Copy the Render URL once it deploys

**Client → Vercel**

- New Project → import repo
- Root directory: `client`
- Add env var: `VITE_SERVER_URL` = your Render URL
- Deploy → done

---

## How It Works

**WebSockets** — Socket.IO keeps a persistent connection between each browser and the server. When something happens (player draws, guesses, joins), an event fires and the server broadcasts it to everyone in that room. No polling, no page refreshes.

**Drawing** — When the drawer moves their mouse, strokes are drawn locally first (so it feels instant) and also sent to the server. The server stores them and forwards to all other players. Viewers replay the exact same strokes on their canvas.

**Game state** — Everything lives in memory on the server (Room and Player objects). The database is only written to once per game — when it ends — to save the final scores. This keeps gameplay fast with zero DB latency.

**Word matching** — `text.trim().toLowerCase() === currentWord.toLowerCase()`. Simple exact match.

**Hints** — Normal mode reveals letters at 50% and 75% time. Combination mode reveals one letter every 10% of draw time. Hidden mode shows nothing.

---

## Features

- Real-time drawing sync
- Word selection (drawer picks from 3 options)
- Hints + countdown timer
- Scoring — more points for guessing early
- Custom words — host adds words, players can suggest
- Word modes — Normal, Hidden, Combination
- Private rooms with invite links
- Public matchmaking (Quick Join)
- Spectator mode — watch without playing
- Kick / ban / vote kick
- Tie detection
- Game results saved to MongoDB

---

## Project Structure

```
server/
  server.js          starts everything
  socketHandler.js   all game logic + socket events
  matchmaking.js     quick join logic
  classes/
    Player.js
    Room.js
  models/
    GameResult.js      the only mongoose model

client/src/
  App.tsx              screen router
  types.ts             all TypeScript types
  context/
    SocketContext.tsx    one socket, shared everywhere
  components/
    HomeScreen.tsx
    LobbyScreen.tsx
    GameScreen.tsx
    Canvas.tsx
    Chat.tsx
    WordPicker.tsx
    WordPanel.tsx
```