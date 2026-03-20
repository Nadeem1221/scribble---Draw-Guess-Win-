import { useSocket } from "../context/SocketContext";

type Props = {
  words: string[];
};

export default function WordPicker({ words }: Props) {
  const socket = useSocket();

  function pickWord(word: string) {
    socket.emit("word_chosen", { word });
  }

  return (
    <div className="word-picker-overlay">
      <div className="word-picker-box">
        <p className="word-picker-title">Pick a word to draw ✏️</p>
        <div className="word-picker-options">
          {words.map(word => (
            <button
              key={word}
              className="word-option"
              onClick={() => pickWord(word)}
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}