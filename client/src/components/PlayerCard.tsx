// This component renders one player entry.
// It shows different action buttons depending on who you are:
//
//   If YOU are the host:
//     - Ban button   (removes, cannot rejoin)
//
//   If YOU are a regular player:
//     - Vote Kick button (contributes to 50% vote threshold)
//
// Neither button shows for yourself.
// In the lobby it's a horizontal card.
// In the game sidebar it's a compact vertical card.

import { useSocket } from "../context/SocketContext";
import type { Player } from "../types";

type Props = {
  player:     Player;
  mySocketId: string;
  isHost:     boolean;      // am I the host?
  compact?:   boolean;      // true = game sidebar, false = lobby
  voteCount?: number;       // current votes against this player
  needed?:    number;       // votes needed to kick
};

export default function PlayerCard({
  player,
  mySocketId,
  isHost,
  compact = false,
  voteCount = 0,
  needed = 0,
}: Props) {
  const socket = useSocket();

  const isMe     = player.socketId === mySocketId;
  const showBtns = !isMe && !player.isHost; // never show buttons for self or host

  function ban() {
    if (window.confirm(`Ban ${player.name}? They won't be able to rejoin.`)) {
      socket.emit("ban_player", { targetSocketId: player.socketId });
    }
  }

  function voteKick() {
    socket.emit("vote_kick", { targetSocketId: player.socketId });
  }

  // ── Compact version (game sidebar) ────────────────────────
  if (compact) {
    return (
      <div className="sidebar-card-wrap">
        <div className="sidebar-avatar">{player.avatar || "🐱"}</div>
        <div className="sidebar-info">
          <span className="sidebar-name">{player.name}</span>
          <span className="sidebar-score">{player.score}</span>
        </div>

        {showBtns && (
          <div className="sidebar-actions">
            {isHost ? (
              <>
                <button className="mod-btn ban"  title="Ban"  onClick={ban}>🚫</button>
              </>
            ) : (
              <button
                className="mod-btn vote"
                title={`Vote kick (${voteCount}/${needed})`}
                onClick={voteKick}
              >
                👎
                {voteCount > 0 && (
                  <span className="vote-count">{voteCount}</span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Full version (lobby) ───────────────────────────────────
  return (
    <div className={`lobby-player-card ${player.isHost ? "is-host" : ""}`}>
      <span className="lobby-avatar">{player.avatar || "🐱"}</span>
      <div style={{ flex: 1 }}>
        <div className="lobby-player-name">{player.name}</div>
        {player.isHost         && <div className="lobby-host-tag">👑 Host</div>}
        {isMe && !player.isHost && <div className="lobby-you-tag">You</div>}
        {/* Show vote progress under player name */}
        {!isHost && !isMe && !player.isHost && voteCount > 0 && (
          <div className="vote-progress-text">
            Vote kick: {voteCount}/{needed}
          </div>
        )}
      </div>

      {showBtns && (
        <div className="lobby-mod-btns">
          {isHost ? (
            <>
              <button className="mod-btn ban"  onClick={ban}>Ban</button>
            </>
          ) : (
            <button className="mod-btn vote" onClick={voteKick}>
              👎 Vote {voteCount > 0 ? `(${voteCount}/${needed})` : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}