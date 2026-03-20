import { useState } from "react";
import { SocketProvider } from "./context/SocketContext";
import HomeScreen  from "./components/HomeScreen";
import LobbyScreen from "./components/LobbyScreen";
import GameScreen  from "./components/GameScreen";
import type { RoomData, RoundData, Stroke } from "./types";

type Screen = "home" | "lobby" | "game";

export default function App() {
  const [screen,         setScreen]         = useState<Screen>("home");
  const [roomData,       setRoomData]       = useState<RoomData | null>(null);
  const [roundData,      setRoundData]      = useState<RoundData | null>(null);
  const [isSpectator,    setIsSpectator]    = useState(false);
  const [initialStrokes, setInitialStrokes] = useState<Stroke[]>([]);

  return (
    <SocketProvider>
      {screen === "home" && (
        <HomeScreen
          onEnterLobby={(data: RoomData) => {
            setRoomData(data);
            setIsSpectator(data.isSpectator ?? false);
            setScreen("lobby");
          }}
          onJoinMidGame={(data: RoomData) => {
            // Spectator joining a game already in progress
            setRoomData(data);
            setIsSpectator(true);
            setInitialStrokes(data.currentStrokes ?? []);
            // Create a minimal roundData so GameScreen can render
            setRoundData({
              round:      1,
              maxRounds:  data.settings.rounds,
              drawerName: "",
              drawerId:   "",
              players:    data.players,
              wordMode:   data.settings.wordMode,
            });
            setScreen("game");
          }}
        />
      )}

      {screen === "lobby" && roomData && (
        <LobbyScreen
          data={roomData}
          onGameStart={(data: RoundData) => {
            setRoundData(data);
            setScreen("game");
          }}
        />
      )}

      {screen === "game" && roomData && roundData && (
        <GameScreen
          myName={roomData.myName}
          roundData={roundData}
          isSpectator={isSpectator}
          initialStrokes={initialStrokes}
        />
      )}
    </SocketProvider>
  );
}