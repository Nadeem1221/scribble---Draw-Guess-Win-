import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";
import WordPanel from "./WordPanel";
import type { Player, RoomData, RoundData } from "../types";

type Props = {
  data: RoomData;
  onGameStart: (roundData: RoundData) => void;
};

type VoteMap = Record<string, { count: number; needed: number }>;

export default function LobbyScreen({ data, onGameStart }: Props) {
  const socket = useSocket();

  const [players,         setPlayers]         = useState<Player[]>(data.players);
  // Host gets the full word list, players get empty array
  const [customWords,     setCustomWords]     = useState<string[]>(data.customWords ?? []);
  // Everyone gets the count
  const [customWordCount, setCustomWordCount] = useState<number>(data.customWordCount ?? 0);
  const [voteMap,         setVoteMap]         = useState<VoteMap>({});
  const [kicked,          setKicked]          = useState(false);
  const [kickMsg,         setKickMsg]         = useState("");
  const [starting,        setStarting]        = useState(false);

  const me     = players.find(p => p.name === data.myName);
  const isHost = me?.isHost ?? false;

  const inviteUrl = data.inviteCode
    ? `${window.location.origin}/?invite=${data.inviteCode}`
    : null;

  useEffect(() => {
    socket.on("player_joined", ({ players }: { players: Player[] }) => setPlayers(players));
    socket.on("player_left",   ({ players }: { players: Player[] }) => setPlayers(players));
    socket.on("new_round",     (roundData: RoundData) => onGameStart(roundData));
    socket.on("player_removed",({ players }: { players: Player[] }) => setPlayers(players));

    socket.on("you_were_kicked", ({ reason }: { reason: string }) => {
      setKicked(true);
      setKickMsg(
        reason === "banned"     ? "You have been banned from this room."       :
        reason === "votekicked" ? "You were vote kicked by the other players." :
                                  "You have been kicked from this room."
      );
    });

    socket.on("vote_kick_update", ({ targetSocketId, voteCount, needed }: {
      targetSocketId: string; targetName: string; voteCount: number; needed: number;
    }) => {
      setVoteMap(prev => ({ ...prev, [targetSocketId]: { count: voteCount, needed } }));
    });

    // word_list_update: host gets full list, players get only count
    socket.on("word_list_update", ({ customWords: words, customWordCount: count }: {
      customWords: string[];
      customWordCount: number;
      isHost: boolean;
    }) => {
      setCustomWords(words);           // empty array for players
      setCustomWordCount(count);       // actual count for everyone
    });

    return () => {
      socket.off("player_joined");
      socket.off("player_left");
      socket.off("new_round");
      socket.off("player_removed");
      socket.off("you_were_kicked");
      socket.off("vote_kick_update");
      socket.off("word_list_update");
    };
  }, []);

  if (kicked) {
    return (
      <div className="lobby-screen">
        <div className="lobby-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🚪</div>
          <h2 style={{ color: "#ff7d45", marginBottom: 8 }}>Removed from room</h2>
          <p style={{ color: "#aaa", marginBottom: 24 }}>{kickMsg}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Go back home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-screen">
      <div className="lobby-card" style={{ maxWidth: 520 }}>

        <div className="lobby-title">
          scrib<span style={{ color: "#ffd166" }}>b</span>le! 🎨
        </div>
        <div className="lobby-sub">Waiting for players to join…</div>

        <div className="lobby-code-box">
          <div className="lobby-code-label">Room Code</div>
          <div className="lobby-code-val">{data.code}</div>
          <button className="lobby-copy-btn"
            onClick={() => navigator.clipboard.writeText(data.code)}>
            Copy
          </button>
        </div>

        {inviteUrl && (
          <div className="lobby-invite-box">
            <span className="lobby-invite-label">Invite</span>
            <span className="lobby-invite-url">{inviteUrl}</span>
            <button className="lobby-invite-btn"
              onClick={() => navigator.clipboard.writeText(inviteUrl)}>
              Copy
            </button>
          </div>
        )}

        <div className="lobby-settings">
          <span className="lobby-setting-chip">{data.settings.rounds} rounds</span>
          <span className="lobby-setting-chip">{data.settings.drawTime}s</span>
          <span className="lobby-setting-chip">max {data.settings.maxPlayers}</span>
          {data.isPrivate && <span className="lobby-private-chip">🔒 Private</span>}
        </div>

        <div className="lobby-players">
          {players.map(p => {
            const isMe = p.name === data.myName;
            return (
              <div key={p.socketId}
                className={`lobby-player-card ${p.isHost ? "is-host" : ""}`}>
                <span className="lobby-avatar">{p.avatar || "🐱"}</span>
                <div style={{ flex: 1 }}>
                  <div className="lobby-player-name">{p.name}</div>
                  {p.isHost && <div className="lobby-host-tag">👑 Host</div>}
                  {isMe && !p.isHost && <div className="lobby-you-tag">You</div>}
                  {!isHost && !isMe && !p.isHost && (voteMap[p.socketId]?.count ?? 0) > 0 && (
                    <div className="vote-progress-text">
                      Vote kick: {voteMap[p.socketId]?.count}/{voteMap[p.socketId]?.needed}
                    </div>
                  )}
                </div>
                {!isMe && !p.isHost && (
                  <div className="lobby-mod-btns">
                    {isHost ? (
                      <>
                        <button className="mod-btn kick"
                          onClick={() => socket.emit("kick_player", { targetSocketId: p.socketId })}>
                          Kick
                        </button>
                        <button className="mod-btn ban"
                          onClick={() => { if (window.confirm(`Ban ${p.name}?`)) socket.emit("ban_player", { targetSocketId: p.socketId }); }}>
                          Ban
                        </button>
                      </>
                    ) : (
                      <button className="mod-btn vote"
                        onClick={() => socket.emit("vote_kick", { targetSocketId: p.socketId })}>
                        👎 {(voteMap[p.socketId]?.count ?? 0) > 0
                          ? `(${voteMap[p.socketId]?.count}/${voteMap[p.socketId]?.needed})`
                          : "Vote"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {players.length < data.settings.maxPlayers && (
            <div className="lobby-player-card" style={{ opacity: 0.4, borderStyle: "dashed" }}>
              <span className="lobby-avatar">➕</span>
              <div className="lobby-player-name" style={{ color: "#bbb" }}>Waiting…</div>
            </div>
          )}
        </div>

        {/* Word panel — host sees full list, players see only suggest input */}
        <WordPanel
          isHost={isHost}
          customWords={customWords}
          customWordCount={customWordCount}
        />

        <p className="lobby-hint" style={{ marginTop: 16 }}>
          {starting
            ? "Game is starting… 🎨"
            : players.length < 2
            ? "Need at least one more player…"
            : isHost
            ? "Everyone here? Let's go! 🎉"
            : "Waiting for the host to start…"}
        </p>

        {isHost && players.length >= 2 && !starting && (
          <button className="btn-primary"
            onClick={() => { setStarting(true); socket.emit("start_game"); }}>
            Start Game 🎨
          </button>
        )}
      </div>
    </div>
  );
}