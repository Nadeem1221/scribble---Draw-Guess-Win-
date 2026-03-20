// Fix: players no longer see the actual custom words.
// They only see:  "3 custom words in pool 🔒"
// Host still sees the full list with remove buttons + suggestions.

import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";

type Suggestion = {
  id:         string;
  word:       string;
  playerName: string;
};

type Props = {
  isHost:          boolean;
  customWords:     string[];  // only populated for host, empty for players
  customWordCount: number;    // always available for everyone
};

export default function WordPanel({ isHost, customWords, customWordCount }: Props) {
  const socket = useSocket();

  const [input,       setInput]       = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [feedback,    setFeedback]    = useState("");

  useEffect(() => {
    // Only host gets suggestions_update
    socket.on("suggestions_update", ({ suggestions }: { suggestions: Suggestion[] }) => {
      setSuggestions(suggestions);
    });

    socket.on("suggestion_sent", ({ word }: { word: string }) => {
      setFeedback(`✓ "${word}" sent to host for review`);
      setTimeout(() => setFeedback(""), 4000);
    });

    socket.on("suggestion_approved", ({ word }: { word: string }) => {
      setFeedback(`🎉 "${word}" was approved by the host!`);
      setTimeout(() => setFeedback(""), 4000);
    });

    socket.on("suggestion_rejected", ({ word }: { word: string }) => {
      setFeedback(`❌ "${word}" was not approved.`);
      setTimeout(() => setFeedback(""), 4000);
    });

    return () => {
      socket.off("suggestions_update");
      socket.off("suggestion_sent");
      socket.off("suggestion_approved");
      socket.off("suggestion_rejected");
    };
  }, []);

  function addWord() {
    const w = input.trim();
    if (!w) return;
    socket.emit("host_add_word", { word: w });
    setInput("");
  }

  function removeWord(word: string) {
    socket.emit("host_remove_word", { word });
  }

  function suggestWord() {
    const w = input.trim();
    if (!w) return;
    socket.emit("suggest_word", { word: w });
    setInput("");
  }

  // ── HOST VIEW ─────────────────────────────────────────────
  if (isHost) {
    return (
      <div className="word-panel">
        <div className="word-panel-header">
          <span className="word-panel-title">Custom Words 🎨</span>
          {customWords.length > 0 && (
            <span className="word-panel-count">{customWords.length} words</span>
          )}
        </div>

        <div className="word-panel-input-row">
          <input
            className="word-panel-input"
            placeholder="Type a word and add…"
            value={input}
            maxLength={30}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addWord()}
          />
          <button className="word-panel-add-btn" onClick={addWord}>Add</button>
        </div>

        {/* Full word list — only host sees this */}
        {customWords.length > 0 && (
          <div className="word-panel-section">
            <div className="word-panel-section-label">
              Your words (used first — hidden from players)
            </div>
            <div className="word-chips">
              {customWords.map(w => (
                <div key={w} className="word-chip">
                  <span>{w}</span>
                  <button className="chip-remove" onClick={() => removeWord(w)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending suggestions */}
        {suggestions.length > 0 && (
          <div className="word-panel-section">
            <div className="word-panel-section-label">
              Pending suggestions ({suggestions.length})
            </div>
            <div className="suggestions-list">
              {suggestions.map(s => (
                <div key={s.id} className="suggestion-row">
                  <div className="suggestion-info">
                    <span className="suggestion-word">{s.word}</span>
                    <span className="suggestion-by">by {s.playerName}</span>
                  </div>
                  <div className="suggestion-btns">
                    <button className="suggestion-btn approve"
                      onClick={() => socket.emit("approve_suggestion", { suggestionId: s.id })}>
                      ✓
                    </button>
                    <button className="suggestion-btn reject"
                      onClick={() => socket.emit("reject_suggestion", { suggestionId: s.id })}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {customWords.length === 0 && suggestions.length === 0 && (
          <p className="word-panel-hint">
            Add words above — they'll be used before the default list.
          </p>
        )}
      </div>
    );
  }

  // ── PLAYER VIEW ───────────────────────────────────────────
  // Players can ONLY suggest words — they never see the word list.
  return (
    <div className="word-panel">
      <div className="word-panel-header">
        <span className="word-panel-title">Suggest a Word 💡</span>
        {/* Show count only — no actual words */}
        {customWordCount > 0 && (
          <span className="word-panel-count word-panel-count-hidden">
            🔒 {customWordCount} custom
          </span>
        )}
      </div>

      <div className="word-panel-input-row">
        <input
          className="word-panel-input"
          placeholder="Suggest a word to host…"
          value={input}
          maxLength={30}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && suggestWord()}
        />
        <button className="word-panel-add-btn" onClick={suggestWord}>Send</button>
      </div>

      {/* Feedback */}
      {feedback && <p className="word-panel-feedback">{feedback}</p>}

      {/* Small note — no word list shown */}
      <p className="word-panel-hint">
        Host will review your suggestion before adding it.
      </p>
    </div>
  );
}