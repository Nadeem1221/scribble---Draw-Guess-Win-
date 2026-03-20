// Added isSpectator flag.
// Spectators are stored in room.players so they receive
// all broadcast events (drawing, chat, scores) automatically.
// Server checks isSpectator before:
//   - allowing a guess
//   - including them in the drawer rotation
//   - counting them for "all guessed" check

class Player {
  constructor(socketId, name, avatar = "🐱", isSpectator = false) {
    this.socketId    = socketId;
    this.name        = name;
    this.avatar      = avatar;
    this.score       = 0;
    this.isHost      = false;
    this.hasGuessed  = false;
    this.isSpectator = isSpectator;
  }
}

module.exports = Player;