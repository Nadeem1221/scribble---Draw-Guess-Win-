import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";

// ─── WHY THIS FILE EXISTS ────────────────────────────────────
// Socket.IO needs ONE connection for the whole app.
// If we created it inside each component separately, we'd end up
// with multiple connections which causes bugs.
// So we create it here once and share it using React Context.
// Any component that needs the socket just calls useSocket().
// ────────────────────────────────────────────────────────────

const SocketContext = createContext<Socket | null>(null);

// Create the socket connection once, outside any component
const socket: Socket = io(import.meta.env.VITE_SERVER_URL);

export function SocketProvider({ children }: { children: ReactNode }) {
  // We track connection status but don't really use it yet.
  // It's useful later for showing "Connecting..." UI.
  const [, setConnected] = useState(false);

  useEffect(() => {
    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

// Components use this hook to get the socket:
//   const socket = useSocket()
export function useSocket(): Socket {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside <SocketProvider>");
  return ctx;
}