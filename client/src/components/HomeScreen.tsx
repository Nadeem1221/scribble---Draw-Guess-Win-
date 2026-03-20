import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";
import type { RoomData, Settings } from "../types";

const AVATARS = ["🐱","🦊","🐧","🦄","🐸","🐼","🐨","🦋","🐙","🦁","🐮","🐰"];

type WordMode = "normal" | "hidden" | "combination";
const MODE_INFO = {
  normal:      { icon:"📝", label:"Normal",      desc:"Blanks + hints" },
  hidden:      { icon:"🙈", label:"Hidden",      desc:"No hints — hard!" },
  combination: { icon:"⭐", label:"Combination", desc:"Letters reveal slowly" },
};

type Props = {
  onEnterLobby:  (data: RoomData) => void;
  onJoinMidGame: (data: RoomData) => void;
};

export default function HomeScreen({ onEnterLobby, onJoinMidGame }: Props) {
  const socket = useSocket();

  const [name,        setName]        = useState("");
  const [code,        setCode]        = useState("");
  const [tab,         setTab]         = useState<"create" | "join">("create");
  const [isPrivate,   setIsPrivate]   = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [error,       setError]       = useState("");
  const [wordMode,    setWordMode]    = useState<WordMode>("normal");
  const [searching,   setSearching]   = useState(false); // loading state for quick join

  const [avatar] = useState(
    () => AVATARS[Math.floor(Math.random() * AVATARS.length)]
  );

  const [settings, setSettings] = useState<Settings>({
    rounds: 3, drawTime: 80, maxPlayers: 8,
    wordCount: 3, hints: 2, wordMode: "normal",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv = params.get("invite");
    if (inv) { setCode(inv.toUpperCase()); setTab("join"); }
  }, []);

  // ── Quick Join ─────────────────────────────────────────────
  // Emit quick_join → server finds or creates a public room.
  function handleQuickJoin() {
    if (!name.trim()) { setError("Enter your name first!"); return; }
    setError("");
    setSearching(true);

    socket.emit("quick_join", { name: name.trim(), avatar });

    // Server replies with room_created (new room) or room_joined (existing)
    socket.once("room_created", (data: Omit<RoomData, "myName" | "myAvatar">) => {
      setSearching(false);
      onEnterLobby({ ...data, myName: name.trim(), myAvatar: avatar });
    });

    socket.once("room_joined", (data: Omit<RoomData, "myName" | "myAvatar">) => {
      setSearching(false);
      onEnterLobby({ ...data, myName: name.trim(), myAvatar: avatar });
    });

    socket.once("error_msg", (msg: string) => {
      setSearching(false);
      setError(msg);
    });
  }

  // ── Create room ────────────────────────────────────────────
  function handleCreate() {
    if (!name.trim()) { setError("Enter your name first!"); return; }
    socket.emit("create_room", {
      name: name.trim(), avatar,
      settings: { ...settings, wordMode },
      isPrivate,
    });
    socket.once("room_created", (data: Omit<RoomData, "myName" | "myAvatar">) => {
      onEnterLobby({ ...data, myName: name.trim(), myAvatar: avatar });
    });
  }

  // ── Join by code ───────────────────────────────────────────
  function handleJoin() {
    if (!name.trim()) { setError("Enter your name first!"); return; }
    if (!code.trim()) { setError("Enter the room code!"); return; }

    const params = new URLSearchParams(window.location.search);
    const inv = params.get("invite");

    socket.emit("join_room", {
      name:        name.trim(),
      avatar,
      code:        inv?.toUpperCase() === code ? undefined : code,
      inviteCode:  inv?.toUpperCase() === code ? code : undefined,
      isSpectator,
    });

    socket.once("room_joined", (data: Omit<RoomData, "myName" | "myAvatar">) => {
      const full = { ...data, myName: name.trim(), myAvatar: avatar };
      if (data.isSpectator && (data.currentStrokes?.length ?? 0) > 0) {
        onJoinMidGame(full);
      } else {
        onEnterLobby(full);
      }
    });

    socket.once("error_msg", (msg: string) => {
      if (msg.includes("spectator")) { setError(msg); setIsSpectator(true); }
      else setError(msg);
    });
  }

  return (
    <div className="home-screen">
      <h1 className="home-logo">scrib<span>b</span>le!</h1>
      <p className="home-tagline">Draw · Guess · Win 🎨</p>

      <div className="home-card">

        {/* Name + avatar — always visible */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <span style={{ fontSize:32 }}>{avatar}</span>
          <input
            className="home-input"
            style={{ marginBottom:0, flex:1 }}
            placeholder="Your name"
            value={name}
            maxLength={16}
            onChange={e => { setName(e.target.value); setError(""); }}
          />
        </div>

        {/* ── Quick Join button — big and prominent ── */}
        <button
          className="quick-join-btn"
          onClick={handleQuickJoin}
          disabled={searching}
        >
          {searching
            ? <><span className="quick-join-spinner" />Searching…</>
            : <>🌍 Quick Join — Play Now!</>
          }
        </button>

        <div className="home-divider">
          <span>or</span>
        </div>

        {/* Tabs: Create / Join by code */}
        <div className="home-tabs">
          <button
            className={tab === "create" ? "home-tab active" : "home-tab"}
            onClick={() => { setTab("create"); setError(""); }}
          >
            Create room
          </button>
          <button
            className={tab === "join" ? "home-tab active" : "home-tab"}
            onClick={() => { setTab("join"); setError(""); }}
          >
            Join by code
          </button>
        </div>

        {tab === "join" && (
          <>
            <input
              className="home-input"
              placeholder="Room code"
              value={code}
              maxLength={6}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
            />
            <label className="spectator-toggle">
              <input type="checkbox" checked={isSpectator}
                onChange={e => setIsSpectator(e.target.checked)} />
              <span className="spectator-toggle-content">
                <span className="spectator-icon">👁</span>
                <span>
                  <span className="spectator-label">Join as spectator</span>
                  <span className="spectator-desc">Watch only — no drawing or guessing</span>
                </span>
              </span>
            </label>
          </>
        )}

        {tab === "create" && (
          <>
            <div className="home-sliders">
              <label>Rounds — {settings.rounds}
                <input type="range" min={2} max={10} value={settings.rounds}
                  onChange={e => setSettings({...settings, rounds: Number(e.target.value)})} />
              </label>
              <label>Draw time — {settings.drawTime}s
                <input type="range" min={30} max={180} step={10} value={settings.drawTime}
                  onChange={e => setSettings({...settings, drawTime: Number(e.target.value)})} />
              </label>
              <label>Max players — {settings.maxPlayers}
                <input type="range" min={2} max={12} value={settings.maxPlayers}
                  onChange={e => setSettings({...settings, maxPlayers: Number(e.target.value)})} />
              </label>
            </div>

            <div className="mode-selector">
              <div className="mode-selector-label">Word Mode</div>
              <div className="mode-options">
                {(Object.keys(MODE_INFO) as WordMode[]).map(m => (
                  <button key={m}
                    className={`mode-btn ${wordMode === m ? "active" : ""}`}
                    onClick={() => setWordMode(m)}>
                    <span className="mode-icon">{MODE_INFO[m].icon}</span>
                    <span className="mode-name">{MODE_INFO[m].label}</span>
                    <span className="mode-desc">{MODE_INFO[m].desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="private-toggle" style={{ marginTop:12 }}>
              <input type="checkbox" checked={isPrivate}
                onChange={e => setIsPrivate(e.target.checked)} />
              Private room (invite only)
            </label>
          </>
        )}

        {error && <p className="home-error" style={{ marginTop:10 }}>{error}</p>}

        <button
          className="btn-primary"
          style={{ marginTop:14 }}
          onClick={tab === "create" ? handleCreate : handleJoin}
        >
          {tab === "create"
            ? "Create room 🎨"
            : isSpectator ? "Watch game 👁" : "Join room 🚀"}
        </button>

      </div>
    </div>
  );
}