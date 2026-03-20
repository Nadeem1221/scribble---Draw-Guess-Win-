// This module handles all public matchmaking logic.
// socketHandler.js calls findOrCreatePublicRoom() when
// a player clicks "Quick Join".
//
// How it works:
//   1. Look for an open public room (status: waiting, not full, not private)
//   2. If found → join that room
//   3. If none found → create a brand new public room with default settings
//      and put the player in it as host
//
// "Open" means: waiting + has space + isPrivate === false

const { nanoid } = require("nanoid");
const Player     = require("./classes/Player");
const Room       = require("./classes/Room");

// Default settings for auto-created public rooms
const DEFAULT_SETTINGS = {
  rounds:     3,
  drawTime:   80,
  maxPlayers: 8,
  wordCount:  3,
  hints:      2,
  wordMode:   "normal",
};

function findOpenPublicRoom(rooms) {
  return Object.values(rooms).find(room =>
    room.status    === "waiting"  &&
    !room.isPrivate               &&
    room.players.length < room.settings.maxPlayers
  ) || null;
}

// Main entry point called from socketHandler
// Returns { room, player, created }
// created = true  → new room was made, this player is host
// created = false → existing room found, player just joined
function findOrCreatePublicRoom(io, socket, name, avatar, rooms) {
  let room    = findOpenPublicRoom(rooms);
  let created = false;

  if (!room) {
    // No open room found — create one automatically
    const roomId = nanoid(8);
    const code   = nanoid(5).toUpperCase();

    room = new Room(roomId, code, { ...DEFAULT_SETTINGS }, false, null);
    rooms[roomId] = room;
    created = true;
  }

  const player     = new Player(socket.id, name, avatar || "🐱", false);
  player.isHost    = created; // first player in auto-created room becomes host
  room.addPlayer(player);
  socket.join(room.id);

  return { room, player, created };
}

module.exports = { findOrCreatePublicRoom };