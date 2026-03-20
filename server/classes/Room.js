// Added getActivePlayers() — returns only non-spectator players.
// All game logic (drawer rotation, "all guessed" check, round start)
// uses getActivePlayers() so spectators are never included.
// room.players still holds everyone so broadcasts reach spectators.

class Room {
  constructor(id, code, settings, isPrivate = false, inviteCode = null) {
    this.id                 = id;
    this.code               = code;
    this.isPrivate          = isPrivate;
    this.inviteCode         = inviteCode;
    this.players            = [];   // everyone — active + spectators
    this.settings           = settings;
    this.status             = "waiting";
    this.currentWord        = null;
    this.currentDrawerIndex = 0;
    this.round              = 0;
    this.timeLeft           = 0;
    this.strokes            = [];
    this.timer              = null;
    this.wordPickTimeout    = null;
    this.revealedSet        = new Set();

    // Moderation
    this.bannedIds = new Set();
    this.voteKicks = new Map();

    // Custom words
    this.customWords        = [];
    this.pendingSuggestions = new Map();
    this.usedCustomWords    = new Set();
  }

  addPlayer(player) {
    this.players.push(player);
  }

  removePlayer(socketId) {
    this.players = this.players.filter(p => p.socketId !== socketId);
    this.voteKicks.delete(socketId);
    this.voteKicks.forEach(voters => voters.delete(socketId));
    if (this.players.length > 0 && !this.players.find(p => p.isHost)) {
      // Give host to first non-spectator if possible
      const nextHost = this.players.find(p => !p.isSpectator) || this.players[0];
      nextHost.isHost = true;
    }
  }

  getPlayer(socketId) {
    return this.players.find(p => p.socketId === socketId);
  }

  // Only non-spectators participate in drawing / guessing / turns
  getActivePlayers() {
    return this.players.filter(p => !p.isSpectator);
  }

  // Drawer is picked from active players only
  getDrawer() {
    const active = this.getActivePlayers();
    if (active.length === 0) return null;
    return active[this.currentDrawerIndex % active.length];
  }

  isBanned(socketId) {
    return this.bannedIds.has(socketId);
  }

  isEmpty() {
    return this.players.length === 0;
  }

  getAvailableCustomWords() {
    return this.customWords.filter(w => !this.usedCustomWords.has(w));
  }
}

module.exports = Room;