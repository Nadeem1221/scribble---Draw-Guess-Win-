// One new socket event added: "quick_join"
// Everything else is identical to the previous version.
//
// quick_join flow:
//   client emits "quick_join" { name, avatar }
//   → findOrCreatePublicRoom() finds or makes a public room
//   → if room was just created: emit "room_created" (player goes to lobby as host)
//   → if room already existed: emit "room_joined"  (player goes to lobby as guest)
//                              + broadcast "player_joined" to existing players

const { nanoid }              = require("nanoid");
const Player                  = require("./classes/Player");
const Room                    = require("./classes/Room");
const defaultWords            = require("./data/words");
const GameResult              = require("./models/GameResult");
const { findOrCreatePublicRoom } = require("./matchmaking");

const rooms        = {};
const pendingWords = {};

// ── helpers ──────────────────────────────────────────────────

function toBlank(word) {
  return word.split("").map(c => c === " " ? "   " : "_").join(" ");
}

function toHint(word, revealCount) {
  const positions = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== " ") positions.push(i);
  }
  const toReveal = new Set(
    [...positions].sort(() => Math.random() - 0.5).slice(0, revealCount)
  );
  return word.split("").map((c, i) => {
    if (c === " ")       return "   ";
    if (toReveal.has(i)) return c;
    return "_";
  }).join(" ");
}

function revealOneMore(word, revealedSet) {
  const unrevealed = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== " " && !revealedSet.has(i)) unrevealed.push(i);
  }
  if (unrevealed.length === 0) return;
  revealedSet.add(unrevealed[Math.floor(Math.random() * unrevealed.length)]);
}

function buildHintFromSet(word, revealedSet) {
  return word.split("").map((c, i) =>
    c === " " ? "   " : revealedSet.has(i) ? c : "_"
  ).join(" ");
}

function findRoom(socketId) {
  return Object.values(rooms).find(r => r.getPlayer(socketId)) || null;
}

function getWordChoices(room, count) {
  const available      = room.getAvailableCustomWords();
  const shuffledCustom = [...available].sort(() => Math.random() - 0.5);
  const picked         = shuffledCustom.slice(0, count);
  if (picked.length < count) {
    const shuffledDefault = [...defaultWords].sort(() => Math.random() - 0.5);
    picked.push(...shuffledDefault.slice(0, count - picked.length));
  }
  return picked;
}

function removePlayerFromRoom(io, room, targetSocketId, reason) {
  const target = room.getPlayer(targetSocketId);
  if (!target) return;
  io.to(targetSocketId).emit("you_were_kicked", { reason });
  const s = io.sockets.sockets.get(targetSocketId);
  if (s) s.leave(room.id);
  room.removePlayer(targetSocketId);
  io.to(room.id).emit("player_removed", {
    playerName: target.name, reason, players: room.players,
  });
  if (room.isEmpty()) {
    clearInterval(room.timer);
    clearTimeout(room.wordPickTimeout);
    delete pendingWords[room.id];
    delete rooms[room.id];
  }
}

function broadcastWordList(io, room) {
  const host = room.players.find(p => p.isHost);
  if (host) {
    io.to(host.socketId).emit("word_list_update", {
      customWords: room.customWords, isHost: true,
    });
    io.to(host.socketId).emit("suggestions_update", {
      suggestions: Array.from(room.pendingSuggestions.entries()).map(
        ([id, s]) => ({ id, word: s.word, playerName: s.playerName })
      ),
    });
  }
  room.players.filter(p => !p.isHost).forEach(p => {
    io.to(p.socketId).emit("word_list_update", {
      customWords: [], customWordCount: room.customWords.length, isHost: false,
    });
  });
}

// ── game loop ─────────────────────────────────────────────────

function startNewRound(io, room) {
  room.round++;
  if (room.round > room.settings.rounds) { endGame(io, room); return; }

  room.getActivePlayers().forEach(p => { p.hasGuessed = false; });
  room.currentWord = null;
  room.strokes     = [];
  room.revealedSet = new Set();

  const drawer      = room.getDrawer();
  if (!drawer)      { endGame(io, room); return; }

  const wordChoices = getWordChoices(room, room.settings.wordCount);
  pendingWords[room.id] = wordChoices;

  io.to(room.id).emit("new_round", {
    round:      room.round,
    maxRounds:  room.settings.rounds,
    drawerName: drawer.name,
    drawerId:   drawer.socketId,
    players:    room.players,
    wordMode:   room.settings.wordMode,
  });

  setTimeout(() => {
    if (!room.currentWord) {
      io.to(drawer.socketId).emit("pick_word", { words: wordChoices });
    }
  }, 300);

  room.wordPickTimeout = setTimeout(() => {
    if (!room.currentWord) startDrawingPhase(io, room, wordChoices[0]);
  }, 15000);
}

function startDrawingPhase(io, room, word) {
  clearTimeout(room.wordPickTimeout);
  delete pendingWords[room.id];
  if (room.customWords.includes(word)) room.usedCustomWords.add(word);
  room.currentWord = word;
  room.strokes     = [];
  room.revealedSet = new Set();

  const drawer   = room.getDrawer();
  const wordMode = room.settings.wordMode || "normal";

  io.to(drawer.socketId).emit("game_update", { phase:"drawing", word, hint:word, wordMode });
  io.to(room.id).except(drawer.socketId).emit("game_update", {
    phase:   "drawing",
    word:    null,
    hint:    wordMode === "hidden" ? "" : toBlank(word),
    wordMode,
  });
  startTimer(io, room);
}

function startTimer(io, room) {
  room.timeLeft  = room.settings.drawTime;
  const wordMode = room.settings.wordMode || "normal";
  const hint1At  = Math.floor(room.settings.drawTime * 0.50);
  const hint2At  = Math.floor(room.settings.drawTime * 0.75);
  const combInterval = Math.floor(room.settings.drawTime / 10);

  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(room.id).emit("timer", { timeLeft: room.timeLeft });

    const drawer = room.getDrawer();

    if (wordMode === "normal") {
      if (room.settings.hints >= 1 && room.timeLeft === hint1At) {
        io.to(room.id).except(drawer.socketId).emit("hint_update", { hint: toHint(room.currentWord, 1) });
      }
      if (room.settings.hints >= 2 && room.timeLeft === hint2At) {
        io.to(room.id).except(drawer.socketId).emit("hint_update", { hint: toHint(room.currentWord, 2) });
      }
    } else if (wordMode === "combination") {
      if (room.timeLeft % combInterval === 0 && room.timeLeft > 0) {
        revealOneMore(room.currentWord, room.revealedSet);
        io.to(room.id).except(drawer.socketId).emit("hint_update", {
          hint: buildHintFromSet(room.currentWord, room.revealedSet),
        });
      }
    }

    if (room.timeLeft <= 0) endRound(io, room);
  }, 1000);
}

function endRound(io, room) {
  clearInterval(room.timer);
  clearTimeout(room.wordPickTimeout);
  room.timer = null;
  io.to(room.id).emit("round_over", { word: room.currentWord, players: room.players });
  room.currentWord = null;
  setTimeout(() => { room.currentDrawerIndex++; startNewRound(io, room); }, 5000);
}

async function endGame(io, room) {
  const active      = room.getActivePlayers();
  const leaderboard = [...active].sort((a, b) => b.score - a.score);
  const isTie       = leaderboard.length >= 2 &&
                      leaderboard[0].score === leaderboard[1].score;
  io.to(room.id).emit("game_over", {
    winner: isTie ? null : leaderboard[0], leaderboard, isTie,
  });
  room.status = "finished";
  try {
    await GameResult.create({
      roomId:  room.id,
      players: leaderboard.map(p => ({ name: p.name, score: p.score })),
      winner:  isTie ? null : leaderboard[0]?.name,
    });
  } catch (err) {
    console.error("Could not save game result:", err.message);
  }
}

// ── socket events ─────────────────────────────────────────────

function setupSockets(io) {
  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    // ── CREATE ROOM (private or custom) ───────────────────────
    socket.on("create_room", ({ name, avatar, settings, isPrivate }) => {
      const roomId     = nanoid(8);
      const code       = nanoid(5).toUpperCase();
      const inviteCode = isPrivate ? nanoid(6).toUpperCase() : null;

      const room = new Room(roomId, code, {
        rounds:     settings.rounds     || 3,
        drawTime:   settings.drawTime   || 80,
        maxPlayers: settings.maxPlayers || 8,
        wordCount:  settings.wordCount  || 3,
        hints:      settings.hints      || 2,
        wordMode:   settings.wordMode   || "normal",
      }, isPrivate || false, inviteCode);

      const player  = new Player(socket.id, name, avatar || "🐱", false);
      player.isHost = true;
      room.addPlayer(player);
      rooms[roomId] = room;
      socket.join(roomId);

      socket.emit("room_created", {
        roomId: room.id, code: room.code, isPrivate: room.isPrivate,
        inviteCode: room.inviteCode, players: room.players,
        settings: room.settings, customWords: room.customWords,
        customWordCount: 0, isHost: true, isSpectator: false,
      });
      console.log(`Room created: ${code} by ${name}`);
    });


    // ── QUICK JOIN (public matchmaking) ───────────────────────
    // Finds an open public room or creates one automatically.

    socket.on("quick_join", ({ name, avatar }) => {
      if (!name?.trim()) {
        socket.emit("error_msg", "Enter your name first.");
        return;
      }

      const { room, player, created } = findOrCreatePublicRoom(
        io, socket, name.trim(), avatar || "🐱", rooms
      );

      const basePayload = {
        roomId:          room.id,
        code:            room.code,
        isPrivate:       false,
        inviteCode:      null,
        players:         room.players,
        settings:        room.settings,
        customWords:     [],
        customWordCount: 0,
        isSpectator:     false,
        currentStrokes:  [],
      };

      if (created) {
        // First player in a new auto-created room → they are host
        socket.emit("room_created", { ...basePayload, isHost: true });
        console.log(`Quick join: new room ${room.code} created by ${name}`);
      } else {
        // Joined an existing room
        socket.emit("room_joined", { ...basePayload, isHost: false });
        // Tell others someone joined
        socket.to(room.id).emit("player_joined", { players: room.players });
        console.log(`Quick join: ${name} joined existing room ${room.code} (${room.players.length} players)`);
      }
    });


    // ── JOIN ROOM (by code or invite) ─────────────────────────
    socket.on("join_room", ({ name, avatar, code, inviteCode, isSpectator }) => {
      const room = Object.values(rooms).find(r => {
        if (code       && r.code       === code.toUpperCase())       return true;
        if (inviteCode && r.inviteCode === inviteCode.toUpperCase()) return true;
        return false;
      });

      if (!room)                                            { socket.emit("error_msg", "Room not found.");      return; }
      if (room.isBanned(socket.id))                         { socket.emit("error_msg", "You are banned.");       return; }
      if (room.players.length >= room.settings.maxPlayers)  { socket.emit("error_msg", "Room is full.");         return; }
      if (!isSpectator && room.status !== "waiting")        { socket.emit("error_msg", "Game already started. Join as spectator?"); return; }

      const player = new Player(socket.id, name, avatar || "🐱", !!isSpectator);
      room.addPlayer(player);
      socket.join(room.id);

      socket.emit("room_joined", {
        roomId: room.id, code: room.code, isPrivate: room.isPrivate,
        inviteCode: room.inviteCode, players: room.players,
        settings: room.settings, customWords: [],
        customWordCount: room.customWords.length,
        isHost: false, isSpectator: !!isSpectator,
        currentStrokes: isSpectator && room.status === "playing" ? room.strokes : [],
      });
      socket.to(room.id).emit("player_joined", { players: room.players });
    });


    socket.on("start_game", () => {
      const room = findRoom(socket.id);
      if (!room) return;
      if (!room.getPlayer(socket.id)?.isHost) return;
      if (room.getActivePlayers().length < 2) {
        socket.emit("error_msg", "Need at least 2 active players.");
        return;
      }
      room.status = "playing";
      startNewRound(io, room);
    });

    socket.on("host_add_word", ({ word }) => {
      const room = findRoom(socket.id);
      if (!room || !room.getPlayer(socket.id)?.isHost) return;
      const cleaned = word.trim().toLowerCase();
      if (!cleaned || cleaned.length > 30 || room.customWords.includes(cleaned)) return;
      room.customWords.push(cleaned);
      broadcastWordList(io, room);
    });

    socket.on("host_remove_word", ({ word }) => {
      const room = findRoom(socket.id);
      if (!room || !room.getPlayer(socket.id)?.isHost) return;
      room.customWords = room.customWords.filter(w => w !== word);
      broadcastWordList(io, room);
    });

    socket.on("suggest_word", ({ word }) => {
      const room   = findRoom(socket.id);
      if (!room) return;
      const player = room.getPlayer(socket.id);
      if (!player) return;
      const cleaned = word.trim().toLowerCase();
      if (!cleaned || cleaned.length > 30 || room.customWords.includes(cleaned)) return;
      const alreadySuggested = Array.from(room.pendingSuggestions.values())
        .some(s => s.word === cleaned && s.socketId === socket.id);
      if (alreadySuggested) return;
      const sid = nanoid(6);
      room.pendingSuggestions.set(sid, { word: cleaned, playerName: player.name, socketId: socket.id });
      socket.emit("suggestion_sent", { word: cleaned });
      broadcastWordList(io, room);
    });

    socket.on("approve_suggestion", ({ suggestionId }) => {
      const room = findRoom(socket.id);
      if (!room || !room.getPlayer(socket.id)?.isHost) return;
      const s = room.pendingSuggestions.get(suggestionId);
      if (!s) return;
      if (!room.customWords.includes(s.word)) room.customWords.push(s.word);
      room.pendingSuggestions.delete(suggestionId);
      broadcastWordList(io, room);
      io.to(s.socketId).emit("suggestion_approved", { word: s.word });
    });

    socket.on("reject_suggestion", ({ suggestionId }) => {
      const room = findRoom(socket.id);
      if (!room || !room.getPlayer(socket.id)?.isHost) return;
      const s = room.pendingSuggestions.get(suggestionId);
      if (!s) return;
      room.pendingSuggestions.delete(suggestionId);
      broadcastWordList(io, room);
      io.to(s.socketId).emit("suggestion_rejected", { word: s.word });
    });

    socket.on("kick_player", ({ targetSocketId }) => {
      const room = findRoom(socket.id);
      if (!room || !room.getPlayer(socket.id)?.isHost) return;
      if (targetSocketId === socket.id || !room.getPlayer(targetSocketId)) return;
      removePlayerFromRoom(io, room, targetSocketId, "kicked");
    });

    socket.on("ban_player", ({ targetSocketId }) => {
      const room = findRoom(socket.id);
      if (!room || !room.getPlayer(socket.id)?.isHost) return;
      if (targetSocketId === socket.id || !room.getPlayer(targetSocketId)) return;
      room.bannedIds.add(targetSocketId);
      removePlayerFromRoom(io, room, targetSocketId, "banned");
    });

    socket.on("vote_kick", ({ targetSocketId }) => {
      const room  = findRoom(socket.id);
      if (!room) return;
      const voter  = room.getPlayer(socket.id);
      const target = room.getPlayer(targetSocketId);
      if (!voter || !target || targetSocketId === socket.id || voter.isHost) return;
      if (!room.voteKicks.has(targetSocketId)) room.voteKicks.set(targetSocketId, new Set());
      room.voteKicks.get(targetSocketId).add(socket.id);
      const voteCount = room.voteKicks.get(targetSocketId).size;
      const needed    = Math.floor((room.players.length - 1) / 2) + 1;
      io.to(room.id).emit("vote_kick_update", {
        targetSocketId, targetName: target.name, voteCount, needed,
      });
      if (voteCount >= needed) removePlayerFromRoom(io, room, targetSocketId, "votekicked");
    });

    socket.on("drawer_ready", () => {
      const room = findRoom(socket.id);
      if (!room) return;
      const drawer = room.getDrawer();
      if (!drawer || socket.id !== drawer.socketId) return;
      if (!room.currentWord && pendingWords[room.id]) {
        socket.emit("pick_word", { words: pendingWords[room.id] });
      }
    });

    socket.on("word_chosen", ({ word }) => {
      const room = findRoom(socket.id);
      if (!room) return;
      const drawer = room.getDrawer();
      if (!drawer || socket.id !== drawer.socketId) return;
      startDrawingPhase(io, room, word);
    });

    socket.on("draw_start", (data) => {
      const room = findRoom(socket.id); if (!room) return;
      if (socket.id !== room.getDrawer()?.socketId) return;
      room.strokes.push({ type: "start", ...data });
      socket.to(room.id).emit("draw_data", { type: "start", ...data });
    });

    socket.on("draw_move", (data) => {
      const room = findRoom(socket.id); if (!room) return;
      if (socket.id !== room.getDrawer()?.socketId) return;
      room.strokes.push({ type: "move", ...data });
      socket.to(room.id).emit("draw_data", { type: "move", ...data });
    });

    socket.on("draw_end", () => {
      const room = findRoom(socket.id); if (!room) return;
      if (socket.id !== room.getDrawer()?.socketId) return;
      room.strokes.push({ type: "end" });
      socket.to(room.id).emit("draw_data", { type: "end" });
    });

    socket.on("canvas_clear", () => {
      const room = findRoom(socket.id); if (!room) return;
      if (socket.id !== room.getDrawer()?.socketId) return;
      room.strokes = [];
      socket.to(room.id).emit("draw_data", { type: "clear" });
    });

    socket.on("draw_undo", () => {
      const room = findRoom(socket.id); if (!room) return;
      if (socket.id !== room.getDrawer()?.socketId) return;
      let i = room.strokes.length - 1;
      while (i > 0 && room.strokes[i].type !== "start") i--;
      room.strokes = room.strokes.slice(0, Math.max(0, i));
      io.to(room.id).emit("canvas_redraw", { strokes: room.strokes });
    });

    socket.on("guess", ({ text }) => {
      const room = findRoom(socket.id);
      if (!room || !room.currentWord) return;
      const player = room.getPlayer(socket.id);
      const drawer = room.getDrawer();
      if (player?.isSpectator) return;
      if (!player || !drawer) return;
      if (player.socketId === drawer.socketId || player.hasGuessed) return;

      const isCorrect = text.trim().toLowerCase() === room.currentWord.toLowerCase();
      if (isCorrect) {
        player.hasGuessed = true;
        const points = Math.max(50, Math.floor((room.timeLeft / room.settings.drawTime) * 300));
        player.score += points;
        drawer.score += 30;
        io.to(room.id).emit("correct_guess", { playerName: player.name, points, players: room.players });
        const allGuessed = room.getActivePlayers()
          .filter(p => p.socketId !== drawer.socketId)
          .every(p => p.hasGuessed);
        if (allGuessed) endRound(io, room);
      } else {
        io.to(room.id).emit("chat_msg", { name: player.name, text });
      }
    });

    socket.on("chat", ({ text }) => {
      const room = findRoom(socket.id); if (!room) return;
      const player = room.getPlayer(socket.id); if (!player) return;
      const displayName = player.isSpectator ? `👁 ${player.name}` : player.name;
      io.to(room.id).emit("chat_msg", { name: displayName, text });
    });

    socket.on("disconnect", () => {
      const room = findRoom(socket.id); if (!room) return;
      const player = room.getPlayer(socket.id);
      console.log(`${player?.name} disconnected from room ${room.code}`);
      room.removePlayer(socket.id);
      if (room.isEmpty()) {
        clearInterval(room.timer);
        clearTimeout(room.wordPickTimeout);
        delete pendingWords[room.id];
        delete rooms[room.id];
      } else {
        io.to(room.id).emit("player_left", { players: room.players });
      }
    });

  });
}

module.exports = { setupSockets };