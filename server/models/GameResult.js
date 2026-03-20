const mongoose = require("mongoose");

// This is the only thing we store in MongoDB.
// We save it once when the game ends — nothing else.

const gameResultSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
  },
  players: [
    {
      name:  { type: String, required: true },
      score: { type: Number, required: true },
    },
  ],
  // winner is null when it's a tie
  winner: {
    type: String,
    default: null,
  },
  playedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("GameResult", gameResultSchema);