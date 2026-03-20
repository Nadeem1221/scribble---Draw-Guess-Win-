import { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";
import type { ChatMessage, Player } from "../types";

type Props = {
  isDrawer:    boolean;
  isSpectator: boolean;
  myName:      string;
};

export default function Chat({ isDrawer, isSpectator, myName }: Props) {
  const socket    = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input,    setInput]    = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function addMessage(msg: ChatMessage) {
    setMessages(prev => [...prev, msg]);
  }

  useEffect(() => {
    socket.on("chat_msg", ({ name, text }: { name: string; text: string }) => {
      addMessage({ id: Date.now(), name, text });
    });

    socket.on("correct_guess", ({ playerName, points }: { playerName: string; points: number; players: Player[] }) => {
      addMessage({ id: Date.now(), name: playerName, text: `guessed it! +${points} pts 🎉`, isCorrect: true });
    });

    socket.on("round_over", ({ word }: { word: string }) => {
      addMessage({ id: Date.now(), name: "", text: `The word was: ${word} 🎨`, isSystem: true });
    });

    socket.on("new_round", () => setMessages([]));

    return () => {
      socket.off("chat_msg");
      socket.off("correct_guess");
      socket.off("round_over");
      socket.off("new_round");
    };
  }, []);

  function send() {
    const text = input.trim();
    if (!text) return;
    // Spectators always use "chat" — they cannot guess
    if (isSpectator || isDrawer) {
      socket.emit("chat", { text });
    } else {
      socket.emit("guess", { text });
    }
    setInput("");
  }

  function placeholder() {
    if (isSpectator) return "Chat as spectator…";
    if (isDrawer)    return "Chat…";
    return "Type your guess…";
  }

  return (
    <div className="chat-area">
      <div className="chat-box">
        <div className="chat-title">💬 GUESSES</div>

        <div className="chat-messages">
          {messages.map(msg => (
            <div key={msg.id}
              className={msg.isCorrect?"chat-msg correct":msg.isSystem?"chat-msg system":"chat-msg"}>
              {msg.name && <strong>{msg.name}: </strong>}
              {msg.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-row">
          <input
            className="chat-input"
            placeholder={placeholder()}
            value={input}
            maxLength={60}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
          />
          <button className="chat-send" onClick={send}>➤</button>
        </div>
      </div>
    </div>
  );
}