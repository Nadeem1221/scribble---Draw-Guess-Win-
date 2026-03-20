import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";
import Canvas     from "./Canvas";
import Chat       from "./Chat";
import WordPicker from "./WordPicker";
import type { Player, RoundData, Stroke } from "../types";

type Props = {
  myName:          string;
  roundData:       RoundData;
  isSpectator:     boolean;
  initialStrokes?: Stroke[]; // for spectators joining mid-game
};

type GamePhase    = "picking" | "drawing" | "roundOver" | "gameOver";
type WordMode     = "normal" | "hidden" | "combination";
type Winner       = { name: string; score: number; avatar?: string } | null;
type GameOverData = { winner: Winner; leaderboard: Player[]; isTie: boolean };
type VoteMap      = Record<string, { count: number; needed: number }>;

export default function GameScreen({
  myName, roundData, isSpectator, initialStrokes = [],
}: Props) {
  const socket = useSocket();

  const [phase,       setPhase]       = useState<GamePhase>("picking");
  const [players,     setPlayers]     = useState<Player[]>(roundData.players);
  const [drawerId,    setDrawerId]    = useState(roundData.drawerId);
  const [drawerName,  setDrawerName]  = useState(roundData.drawerName);
  const [round,       setRound]       = useState(roundData.round);
  const [maxRounds,   setMaxRounds]   = useState(roundData.maxRounds);
  const [hint,        setHint]        = useState("");
  const [timeLeft,    setTimeLeft]    = useState(0);
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [roundWord,   setRoundWord]   = useState("");
  const [gameOver,    setGameOver]    = useState<GameOverData | null>(null);
  const [voteMap,     setVoteMap]     = useState<VoteMap>({});
  const [kicked,      setKicked]      = useState(false);
  const [kickMsg,     setKickMsg]     = useState("");
  const [wordMode,    setWordMode]    = useState<WordMode>(
    (roundData.wordMode as WordMode) || "normal"
  );

  // Spectator never draws — always false
  const isDrawer = !isSpectator && socket.id === drawerId;
  const me       = players.find(p => p.name === myName);
  const isHost   = me?.isHost ?? false;

  useEffect(() => {
    if (isDrawer) socket.emit("drawer_ready");
  }, []);

  useEffect(() => {
    socket.on("pick_word", ({ words }: { words: string[] }) => {
      setWordOptions(words);
      setPhase("picking");
    });

    socket.on("game_update", ({ hint, wordMode: mode }: {
      phase: string; hint: string; wordMode: WordMode;
    }) => {
      setHint(hint);
      if (mode) setWordMode(mode);
      setPhase("drawing");
    });

    socket.on("timer",       ({ timeLeft }: { timeLeft: number }) => setTimeLeft(timeLeft));
    socket.on("hint_update", ({ hint }: { hint: string }) => setHint(hint));

    socket.on("correct_guess", ({ players }: { players: Player[] }) => setPlayers(players));

    socket.on("round_over", ({ word, players }: { word: string; players: Player[] }) => {
      setRoundWord(word);
      setPlayers(players);
      setPhase("roundOver");
    });

    socket.on("new_round", (data: RoundData) => {
      setRound(data.round);
      setMaxRounds(data.maxRounds);
      setDrawerId(data.drawerId);
      setDrawerName(data.drawerName);
      setPlayers(data.players);
      setHint("");
      setTimeLeft(0);
      setRoundWord("");
      setPhase("picking");
      if (data.wordMode) setWordMode(data.wordMode as WordMode);
    });

    socket.on("game_over", (data: GameOverData) => {
      setGameOver(data);
      setPhase("gameOver");
    });

    socket.on("player_joined",  ({ players }: { players: Player[] }) => setPlayers(players));
    socket.on("player_left",    ({ players }: { players: Player[] }) => setPlayers(players));
    socket.on("player_removed", ({ players }: { players: Player[] }) => setPlayers(players));

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

    return () => {
      ["pick_word","game_update","timer","hint_update","correct_guess",
       "round_over","new_round","game_over","player_joined","player_left",
       "player_removed","you_were_kicked","vote_kick_update"
      ].forEach(e => socket.off(e));
    };
  }, [drawerId]);

  if (kicked) {
    return (
      <div className="gameover-screen">
        <div className="gameover-card" style={{ textAlign: "center" }}>
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

  if (phase === "gameOver" && gameOver) {
    const { winner, leaderboard, isTie } = gameOver;
    const [first, second, third]         = leaderboard;
    const medals                         = ["🥇","🥈","🥉"];

    return (
      <div className="gameover-screen">
        <div className="gameover-card">
          <div className="gameover-trophy">{isTie ? "🤝" : "🏆"}</div>
          {isTie ? (
            <>
              <div className="gameover-winner" style={{ color: "#ff7d45" }}>It's a tie!</div>
              <div className="gameover-pts">All tied at {leaderboard[0]?.score} points</div>
            </>
          ) : (
            <>
              <div className="gameover-winner">{winner?.avatar} {winner?.name} wins!</div>
              <div className="gameover-pts">with {winner?.score} points</div>
            </>
          )}

          {!isTie && (
            <div className="podium">
              {second && <div className="podium-place">
                <div className="podium-emoji">{second.avatar}</div>
                <div className="podium-block" style={{ height:50, background:"#c0c0c0", color:"#666" }}>2</div>
                <div className="podium-name">{second.name}</div>
                <div className="podium-pts">{second.score} pts</div>
              </div>}
              {first && <div className="podium-place">
                <div className="podium-emoji">{first.avatar}</div>
                <div className="podium-block" style={{ height:75 }}>1</div>
                <div className="podium-name">{first.name}</div>
                <div className="podium-pts">{first.score} pts</div>
              </div>}
              {third && <div className="podium-place">
                <div className="podium-emoji">{third.avatar}</div>
                <div className="podium-block" style={{ height:35, background:"#cd7f32", color:"#7a4a18" }}>3</div>
                <div className="podium-name">{third.name}</div>
                <div className="podium-pts">{third.score} pts</div>
              </div>}
            </div>
          )}

          <div className="lb-list">
            {leaderboard.map((p, i) => (
              <div key={p.socketId}
                className={`lb-row ${i===0&&!isTie?"first":""} ${isTie?"tied":""}`}>
                <span className="lb-rank">{isTie ? "🤝" : (medals[i] || i+1)}</span>
                <span className="lb-emoji">{p.avatar}</span>
                <span className="lb-name">{p.name}</span>
                <span className="lb-pts">{p.score} pts</span>
              </div>
            ))}
          </div>

          {isSpectator && (
            <p style={{ color:"#bbb", fontSize:13, textAlign:"center", margin:"12px 0" }}>
              👁 You watched this game as a spectator
            </p>
          )}

          <button className="btn-primary" onClick={() => window.location.reload()}>
            {isSpectator ? "Watch again 👁" : "Play Again 🎨"}
          </button>
        </div>
      </div>
    );
  }

  function renderHint() {
    if (isDrawer) {
      return <div className="hint-display-text">{hint || "..."}</div>;
    }
    if (wordMode === "hidden") {
      return (
        <div className="hint-hidden">
          <span className="hint-mode-badge hidden-badge">🙈 Hidden mode</span>
        </div>
      );
    }
    if (!hint) return null;
    return hint.split(" ").map((ch, i) => {
      if (ch === "") return <span key={i} style={{ width:10 }} />;
      return <div key={i} className="letter-box">{ch !== "_" ? ch : ""}</div>;
    });
  }

  return (
    <div className="game-screen" style={{ position: "relative" }}>

      {/* ── Spectator banner ── */}
      {isSpectator && (
        <div className="spectator-banner">
          👁 You are watching as a spectator — sit back and enjoy!
        </div>
      )}

      <div className="game-topbar">
        <div className="topbar-logo">scrib<span>b</span>le!</div>
        <div className="topbar-round-badge">Round {round} of {maxRounds}</div>
        <div className={`topbar-timer ${timeLeft<=10&&timeLeft>0?"urgent":""}`}>
          {phase === "drawing" ? timeLeft : "—"}
        </div>
      </div>

      <div className="word-row">
        <div className="word-hint">
          {phase === "drawing"
            ? renderHint()
            : <span style={{ color:"#bbb", fontSize:14, fontWeight:700, letterSpacing:0 }}>
                {isDrawer
                  ? "Pick a word below!"
                  : `${drawerName} is picking a word…`}
              </span>
          }
        </div>
        {phase === "drawing" && !isDrawer && wordMode !== "normal" && (
          <div style={{ marginLeft:8 }}>
            {wordMode === "hidden"      && <span className="hint-mode-badge hidden-badge">🙈 Hidden</span>}
            {wordMode === "combination" && <span className="hint-mode-badge combo-badge">⭐ Combo</span>}
          </div>
        )}
      </div>

      <div className="game-main">

        {/* Player sidebar */}
        <div className="player-sidebar">
          {players.map((p, i) => {
            const activeIndex = players.filter(x => !x.isSpectator).indexOf(p);
            return (
              <div key={p.socketId}
                className={[
                  "sidebar-card",
                  p.isSpectator                               ? "is-spectator" : "",
                  p.socketId === drawerId                     ? "is-drawer"    : "",
                  p.hasGuessed && phase === "drawing"         ? "has-guessed"  : "",
                ].join(" ")}
              >
                {/* Crown only on top active scorer */}
                {!p.isSpectator && activeIndex === 0 && <div className="card-crown">👑</div>}

                {p.socketId === drawerId && <div className="card-badge pencil">✏️</div>}
                {p.hasGuessed && phase==="drawing" && p.socketId!==drawerId && (
                  <div className="card-badge check">✓</div>
                )}
                {p.isSpectator && <div className="card-badge spectator-badge">👁</div>}

                <div className="sidebar-emoji"
                  style={{ background: p.socketId===drawerId ? "#fff3ec" : p.isSpectator ? "#f0f0f0" : "#f5f5f5" }}>
                  {p.avatar || "🐱"}
                </div>
                <div className="sidebar-name" style={{ color: p.isSpectator ? "#bbb" : undefined }}>
                  {p.name}
                </div>
                {/* Spectators have no score — show "👁" instead */}
                <div className="sidebar-score">
                  {p.isSpectator ? "👁" : p.score}
                </div>

                {/* Mod buttons — can also kick/ban spectators */}
                {p.socketId !== socket.id && !p.isHost && (
                  <div className="sidebar-mod-btns">
                    {isHost ? (
                      <>
                        <button className="mod-btn kick" title="Kick"
                          onClick={() => socket.emit("kick_player", { targetSocketId: p.socketId })}>✕</button>
                        <button className="mod-btn ban" title="Ban"
                          onClick={() => { if (window.confirm(`Ban ${p.name}?`)) socket.emit("ban_player", { targetSocketId: p.socketId }); }}>🚫</button>
                      </>
                    ) : !isSpectator && !p.isSpectator ? (
                      <button className="mod-btn vote"
                        title={`Vote kick (${voteMap[p.socketId]?.count??0}/${voteMap[p.socketId]?.needed??"?"})`}
                        onClick={() => socket.emit("vote_kick", { targetSocketId: p.socketId })}>
                        👎
                        {(voteMap[p.socketId]?.count??0) > 0 && (
                          <span className="vote-count">{voteMap[p.socketId]?.count}</span>
                        )}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Canvas — isDrawer is false for spectators so no toolbar shows */}
        <Canvas
          isDrawer={isDrawer}
          initialStrokes={initialStrokes}
        />

        {/* Chat — spectators can chat but not guess */}
        <Chat
          isDrawer={isDrawer}
          isSpectator={isSpectator}
          myName={myName}
        />

      </div>

      {/* Word picker — spectators never see this */}
      {phase === "picking" && isDrawer && wordOptions.length > 0 && (
        <WordPicker words={wordOptions} />
      )}

      {phase === "roundOver" && (
        <div className="overlay">
          <div className="overlay-box">
            <div className="overlay-label">The word was</div>
            <div className="overlay-word">{roundWord}</div>
            <div className="overlay-sub">Next round starting… 🎨</div>
          </div>
        </div>
      )}

    </div>
  );
}