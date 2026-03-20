export type WordMode = "normal" | "hidden" | "combination";

export type Player = {
  socketId:    string;
  name:        string;
  avatar:      string;
  score:       number;
  isHost:      boolean;
  hasGuessed:  boolean;
  isSpectator: boolean;   // spectators watch only — no turns, no guessing
};

export type Settings = {
  rounds:     number;
  drawTime:   number;
  maxPlayers: number;
  wordCount:  number;
  hints:      number;
  wordMode:   WordMode;
};

export type RoomData = {
  roomId:          string;
  code:            string;
  isPrivate:       boolean;
  inviteCode:      string | null;
  players:         Player[];
  settings:        Settings;
  myName:          string;
  myAvatar:        string;
  customWords:     string[];
  customWordCount: number;
  isSpectator:     boolean;    // whether WE joined as spectator
  currentStrokes:  any[];      // strokes to replay if joining mid-game
};

export type RoundData = {
  round:      number;
  maxRounds:  number;
  drawerName: string;
  drawerId:   string;
  players:    Player[];
  wordMode?:  WordMode;
};

export type Stroke = {
  type:   "start" | "move" | "end" | "clear";
  x?:     number;
  y?:     number;
  color?: string;
  size?:  number;
};

export type ChatMessage = {
  id:         number;
  name:       string;
  text:       string;
  isCorrect?: boolean;
  isSystem?:  boolean;
};