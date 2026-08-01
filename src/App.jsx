import { useState, useEffect, useRef, useMemo } from "react";
import Papa from "papaparse";
import { Music, Mic2, Trophy, Plus, Trash2, Users, Play, Shuffle, ChevronLeft, ChevronRight, RotateCcw, Star, ExternalLink, Eye, EyeOff, Sparkles, Upload, Check, Copy, Globe, UserPlus } from "lucide-react";
import { db } from "./firebase";
import { doc, setDoc, getDoc, updateDoc, onSnapshot, arrayUnion, serverTimestamp, collection, query, where, getDocs, limit } from "firebase/firestore";

const C = { bg: "#150C2E", pink: "#FF3D8A", gold: "#FFC93C", teal: "#2EE6D0", white: "#FFFFFF" };
const DEFAULT_MOODS = ["Despecho", "Enamorado", "Venganza", "Neutro"];
const DEFAULT_GENRES = ["Salsa", "Vallenato", "Bachata", "Reggaetón", "Balada", "Merengue", "Pop"];
const FORMATOS = ["Solo", "Dúo", "Grupo"];
const AVATARS = ["/avatars/avatar1.png", "/avatars/avatar2.png", "/avatars/avatar3.png", "/avatars/avatar4.png", "/avatars/avatar5.png", "/avatars/avatar6.png", "/avatars/avatar7.png", "/avatars/avatar8.png"];
const CLUE_SECONDS = 5;
const CLUE3_SECONDS = 5;
const ANSWER_SECONDS = 15;
const COUNT_SECONDS = 3;
const REVEAL_DELAY = 3;
const GUESS_POINTS = 10;
const STEAL_POINTS = 5;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function genreEmoji(g) {
  const key = (g || "").toLowerCase();
  const map = {
    rock: "🎸", salsa: "🎺", vallenato: "🤠", popular: "🤠", ranchera: "🤠",
    reggaeton: "🎧", "reggaetón": "🎧", urbano: "🎧", metal: "🤘", pop: "🎤",
    banda: "🐄", balada: "🎼", merengue: "💃", bachata: "💃", cumbia: "🪗",
    tejano: "🪗", "reggae": "🌴",
  };
  for (const k in map) if (key.includes(k)) return map[k];
  return "🎵";
}

/* ---------- estilos reutilizables (CSS normal, no Tailwind) ---------- */
const S = {
  stage: { position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "'Nunito', sans-serif", boxSizing: "border-box" },
  glowA: { position: "absolute", pointerEvents: "none", top: -160, left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", opacity: 0.35, filter: "blur(80px)", background: `radial-gradient(circle, ${C.pink} 0%, transparent 70%)` },
  glowB: { position: "absolute", pointerEvents: "none", bottom: 0, right: 0, width: 400, height: 400, borderRadius: "50%", opacity: 0.25, filter: "blur(80px)", background: `radial-gradient(circle, ${C.teal} 0%, transparent 70%)` },
  container: { position: "relative", zIndex: 10, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", minHeight: "100vh", padding: "0 20px 32px", boxSizing: "border-box" },
  headerRow: { display: "flex", alignItems: "center", gap: 12, padding: "24px 0 16px" },
  backBtn: { padding: 8, borderRadius: 999, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", border: "none", cursor: "pointer", display: "flex" },
  title: { fontSize: 30, fontWeight: 800, color: C.white, fontFamily: "'Baloo 2', sans-serif", margin: 0, letterSpacing: "0.5px" },
  card: { background: "rgba(255,255,255,0.07)", borderRadius: 16, padding: 16, border: "1px solid rgba(255,255,255,0.1)", boxSizing: "border-box", backdropFilter: "blur(16px)", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" },
  input: { width: "100%", background: "rgba(255,255,255,0.1)", borderRadius: 14, padding: "12px 14px", color: C.white, border: "2px solid rgba(255,255,255,0.15)", outline: "none", boxSizing: "border-box", fontSize: 15, fontFamily: "'Nunito', sans-serif", fontWeight: 700, marginBottom: 8, boxShadow: "inset 0 2px 6px rgba(0,0,0,0.2)" },
  label: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 },
};

function btnStyle(variant, disabled) {
  const base = { width: "100%", padding: "16px", borderRadius: 16, fontWeight: 800, fontSize: 17, letterSpacing: "0.4px", fontFamily: "'Baloo 2', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", cursor: disabled ? "default" : "pointer", boxSizing: "border-box", opacity: disabled ? 0.35 : 1, transition: "transform 0.15s ease, box-shadow 0.15s ease" };
  const variants = {
    primary: { background: C.pink, color: C.white, boxShadow: `0 10px 25px -8px ${C.pink}88` },
    secondary: { background: "rgba(255,255,255,0.1)", color: C.white, border: "1px solid rgba(255,255,255,0.15)" },
    gold: { background: C.gold, color: C.bg },
    teal: { background: C.teal, color: C.bg },
    ghost: { background: "transparent", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" },
  };
  return { ...base, ...variants[variant] };
}

function Btn({ children, onClick, variant = "primary", disabled, style }) {
  return (
    <button className="pz-btn" onClick={onClick} disabled={disabled} style={{ ...btnStyle(variant, disabled), ...style }}>
      {children}
    </button>
  );
}

function Ring({ pct, size = 180, stroke = 10, color = C.gold, track = "rgba(255,255,255,0.12)" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }).map((_, i) => ({
        id: i, left: Math.random() * 100, color: [C.pink, C.gold, C.teal, "#ffffff"][i % 4],
        delay: Math.random() * 0.3, duration: 1.6 + Math.random() * 1.2, rotate: Math.random() * 360,
      })),
    []
  );
  return (
    <div style={{ pointerEvents: "none", position: "fixed", inset: 0, overflow: "hidden", zIndex: 50 }}>
      {pieces.map((p) => (
        <span key={p.id} style={{ position: "absolute", left: `${p.left}%`, top: -16, width: 8, height: 14, background: p.color, transform: `rotate(${p.rotate}deg)`, animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`, borderRadius: 2 }} />
      ))}
    </div>
  );
}

function Stage({ children }) {
  return (
    <div style={S.stage}>
      <div style={S.glowA} />
      <div style={S.glowB} />
      <div style={S.container}>{children}</div>
    </div>
  );
}

function AvatarPicker({ selected, onSelect }) {
  const idx = Math.max(0, AVATARS.indexOf(selected));
  function go(delta) {
    const next = (idx + delta + AVATARS.length) % AVATARS.length;
    onSelect(AVATARS[next]);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <button onClick={() => go(-1)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 999, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, cursor: "pointer", flexShrink: 0 }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ position: "relative", width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: -14, borderRadius: "50%", background: `radial-gradient(circle, ${C.gold}55 0%, transparent 70%)`, animation: "pz-glow 1.6s ease-in-out infinite" }} />
          <span style={{ position: "absolute", top: 2, left: 6, fontSize: 20, animation: "pz-twinkle 1.4s ease-in-out infinite" }}>✨</span>
          <span style={{ position: "absolute", bottom: 4, right: 8, fontSize: 16, animation: "pz-twinkle 1.4s ease-in-out infinite 0.4s" }}>⭐</span>
          <img
            key={selected}
            src={selected}
            alt="avatar"
            style={{
              position: "relative", width: 130, height: 130, borderRadius: "50%", objectFit: "cover",
              border: `4px solid ${C.gold}`, boxSizing: "border-box",
              animation: "pz-bounce 0.35s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          />
        </div>
        <button onClick={() => go(1)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 999, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, cursor: "pointer", flexShrink: 0 }}>
          <ChevronRight size={22} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {AVATARS.map((a, i) => (
          <span key={a} style={{ width: 7, height: 7, borderRadius: "50%", background: i === idx ? C.gold : "rgba(255,255,255,0.25)" }} />
        ))}
      </div>
    </div>
  );
}

function MiniScoreboard({ teams }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 16 }}>
      {sorted.map((t) => (
        <div key={t.id} style={{ flexShrink: 0, background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          {t.avatar && <img src={t.avatar} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />}
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, fontFamily: "'Baloo 2', sans-serif" }}>{t.name}</span>
          <span style={{ color: C.gold, fontSize: 16, fontFamily: "'Bungee', cursive" }}>{t.score}</span>
        </div>
      ))}
    </div>
  );
}

function Header({ title, onBack }) {
  return (
    <div style={S.headerRow}>
      {onBack && (
        <button onClick={onBack} style={S.backBtn}>
          <ChevronLeft size={20} />
        </button>
      )}
      <h1 style={S.title}>{title}</h1>
    </div>
  );
}

export default function Pistazo() {
  const [screen, setScreen] = useState("home");
  const [teams, setTeams] = useState([]);
  const [teamInput, setTeamInput] = useState("");
  const [library, setLibrary] = useState({});
  const [moods, setMoods] = useState(DEFAULT_MOODS);
  const [genres, setGenres] = useState(DEFAULT_GENRES);
  const [csvLoadError, setCsvLoadError] = useState(false);
  const [roundGenre, setRoundGenre] = useState("Todos");
  const [roundFormato, setRoundFormato] = useState("Todos");
  const [pendingGenero, setPendingGenero] = useState(null);
  const [pendingTipo, setPendingTipo] = useState(null);
  const [usedIds, setUsedIds] = useState([]);
  const [performerId, setPerformerId] = useState(null);
  const [juryId, setJuryId] = useState(null);
  const [selectedMood, setSelectedMood] = useState(null);
  const [currentSong, setCurrentSong] = useState(null);
  const [timeLeft, setTimeLeft] = useState(CLUE_SECONDS);
  const [correct, setCorrect] = useState(null);
  const [scores, setScores] = useState({ afinacion: 3, ritmo: 3, actitud: 3 });
  const [juryRevealed, setJuryRevealed] = useState(false);
  const [isSteal, setIsSteal] = useState(false);
  const [attemptedIds, setAttemptedIds] = useState([]);
  const [wonById, setWonById] = useState(null);
  const [guessInput, setGuessInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [roomCode, setRoomCode] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [newTeamNameOnline, setNewTeamNameOnline] = useState("");
  const [onlineError, setOnlineError] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [soloNameInput, setSoloNameInput] = useState("");
  const [myTeamId, setMyTeamId] = useState(null);
  const [guessInputRoom, setGuessInputRoom] = useState("");
  const [isListeningRoom, setIsListeningRoom] = useState(false);
  const [roomScores, setRoomScores] = useState({ afinacion: 3, ritmo: 3, actitud: 3 });
  const [, forceTick] = useState(0);
  const roomUnsubRef = useRef(null);
  const timerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [albumTeamId, setAlbumTeamId] = useState(null);
  const wakeLockRef = useRef(null);
  const spotifyApiRef = useRef(null);
  const spotifyControllerRef = useRef(null);
  const clue3ContainerRef = useRef(null);
  const [spotifyApiReady, setSpotifyApiReady] = useState(false);

  // Cargar la API oficial de Spotify (iFrame API) una sola vez
  useEffect(() => {
    if (window.SpotifyIframeApi) {
      spotifyApiRef.current = window.SpotifyIframeApi;
      setSpotifyApiReady(true);
      return;
    }
    const existing = document.querySelector('script[src="https://open.spotify.com/embed/iframe-api/v1"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      document.body.appendChild(script);
    }
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      window.SpotifyIframeApi = IFrameAPI;
      spotifyApiRef.current = IFrameAPI;
      setSpotifyApiReady(true);
    };
  }, []);
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);
  const [hasSeenInstructions, setHasSeenInstructions] = useState(true);

  function handleLogoTap() {
    const now = Date.now();
    if (now - lastTapRef.current > 1500) tapCountRef.current = 1;
    else tapCountRef.current += 1;
    lastTapRef.current = now;
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setScreen("library");
    }
  }

  function vibrate(pattern) {
    try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) { /* no soportado */ }
  }
  async function requestWakeLock() {
    try { wakeLockRef.current = await navigator.wakeLock.request("screen"); } catch (e) { /* no soportado */ }
  }
  function releaseWakeLock() {
    try { wakeLockRef.current && wakeLockRef.current.release(); } catch (e) { /* ignore */ }
    wakeLockRef.current = null;
  }
  function goHome() {
    releaseWakeLock();
    setScreen("home");
  }

  function normalizeHeader(f) {
    return f.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }
  function findHeaderNorm(fields, ...candidates) {
    return fields.find((f) => candidates.some((c) => normalizeHeader(f).includes(c)));
  }

  // Carga las canciones automáticamente desde /canciones.csv (archivo del proyecto, editado por el administrador)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}canciones.csv`)
      .then((r) => {
        if (!r.ok) throw new Error("no encontrado");
        return r.text();
      })
      .then((text) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const fields = results.meta.fields || [];
            const generoKey = findHeaderNorm(fields, "genero");
            const tipoKey = findHeaderNorm(fields, "tipo", "tema");
            const tituloKey = findHeaderNorm(fields, "titulo", "cancion");
            const adiv1Key = findHeaderNorm(fields, "adivinanza 1", "adivinanza1", "pista 1", "pista1");
            const adiv2Key = findHeaderNorm(fields, "adivinanza 2", "adivinanza2", "pista 2", "pista2");
            const formatoKey = findHeaderNorm(fields, "formato");
            const artistaKey = findHeaderNorm(fields, "artista", "interprete");
            const spotifyKey = findHeaderNorm(fields, "spotify");
            if (!tituloKey || !tipoKey || !adiv1Key || !adiv2Key) { setCsvLoadError(true); return; }
            const grouped = {};
            const moodSet = new Set();
            const genreSet = new Set();
            results.data.filter((r) => r[tituloKey]).forEach((r) => {
              const tipoVal = (r[tipoKey] || "Neutro").trim();
              const generoVal = generoKey ? (r[generoKey] || "").trim() : "";
              const formatoRaw = formatoKey ? (r[formatoKey] || "").trim() : "";
              const formatoVal = FORMATOS.find((f) => f.toLowerCase() === formatoRaw.toLowerCase()) || "Solo";
              const song = { id: uid(), genero: generoVal, formato: formatoVal, title: r[tituloKey], artist: artistaKey ? r[artistaKey] || "" : "", clue1: r[adiv1Key] || "", clue2: r[adiv2Key] || "", spotify: spotifyKey ? r[spotifyKey] || "" : "" };
              grouped[tipoVal] = grouped[tipoVal] || [];
              grouped[tipoVal].push(song);
              moodSet.add(tipoVal);
              if (generoVal) genreSet.add(generoVal);
            });
            setLibrary(grouped);
            if (moodSet.size) setMoods(Array.from(moodSet));
            if (genreSet.size) setGenres(Array.from(genreSet));
          },
        });
      })
      .catch(() => setCsvLoadError(true));
  }, []);

  useEffect(() => {
    try {
      const t = localStorage.getItem("pistazo-teams");
      if (t) setTeams(JSON.parse(t));
    } catch (e) { /* sin datos aún */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("pistazo-teams", JSON.stringify(teams)); } catch (e) {}
  }, [teams, loaded]);

  function runCountdown(seconds, onTick, onDone) {
    clearInterval(timerRef.current);
    let t = seconds;
    onTick(t);
    timerRef.current = setInterval(() => {
      t -= 1;
      onTick(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        onDone();
      }
    }, 1000);
  }
  useEffect(() => () => clearInterval(timerRef.current), []);

  useEffect(() => {
    try {
      const seen = localStorage.getItem("pistazo-seen-instructions");
      setHasSeenInstructions(!!seen);
    } catch (e) { /* ignore */ }
  }, []);

  function dismissInstructions(goToPlay) {
    try { localStorage.setItem("pistazo-seen-instructions", "1"); } catch (e) {}
    setHasSeenInstructions(true);
    setScreen(goToPlay ? "onlineHome" : "home");
  }

  function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function subscribeToRoom(code) {
    if (roomUnsubRef.current) roomUnsubRef.current();
    const roomRef = doc(db, "rooms", code);
    roomUnsubRef.current = onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
        setRoomData({ id: snap.id, ...snap.data() });
        setRoomCode(snap.id);
      }
    });
    try {
      const saved = localStorage.getItem(`pistazo-myteam-${code}`);
      if (saved) setMyTeamId(saved);
    } catch (e) { /* ignore */ }
  }

  async function createRoom(isPublic) {
    setOnlineError("");
    const code = generateRoomCode();
    const roomRef = doc(db, "rooms", code);
    await setDoc(roomRef, {
      code,
      public: isPublic,
      status: "waiting",
      createdAt: serverTimestamp(),
      teams: [],
    });
    subscribeToRoom(code);
    setScreen("onlineLobby");
  }

  async function joinRoomWithCode() {
    setOnlineError("");
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;
    try {
      const roomRef = doc(db, "rooms", code);
      const snap = await getDoc(roomRef);
      if (!snap.exists()) { setOnlineError("No existe una sala con ese código."); return; }
      subscribeToRoom(code);
      setScreen("joinTeamName");
    } catch (e) {
      setOnlineError("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    }
  }

  async function joinRandomRoom() {
    setOnlineError("Buscando partida...");
    try {
      const q = query(collection(db, "rooms"), where("public", "==", true), where("status", "==", "waiting"), limit(5));
      const snaps = await getDocs(q);
      if (!snaps.empty) {
        const roomDoc = snaps.docs[0];
        subscribeToRoom(roomDoc.id);
        setOnlineError("");
        setScreen("joinTeamName");
      } else {
        await createRoom(true);
      }
    } catch (e) {
      setOnlineError("No se pudo buscar partida. Intenta de nuevo.");
    }
  }

  async function addTeamToRoom() {
    if (!roomCode || !newTeamNameOnline.trim()) return;
    const roomRef = doc(db, "rooms", roomCode);
    const newTeam = { id: uid(), name: newTeamNameOnline.trim(), avatar: selectedAvatar, score: 0 };
    await updateDoc(roomRef, { teams: arrayUnion(newTeam) });
    try { localStorage.setItem(`pistazo-myteam-${roomCode}`, newTeam.id); } catch (e) {}
    setMyTeamId(newTeam.id);
    setNewTeamNameOnline("");
    setScreen("onlineLobby");
  }

  function startSoloPractice() {
    const name = soloNameInput.trim() || "Tú";
    const team = { id: uid(), name, avatar: selectedAvatar, score: 0, album: [] };
    setTeams([team]);
    setUsedIds([]);
    setPerformerId(team.id);
    setJuryId(null);
    requestWakeLock();
    setScreen("pickGenero");
  }

  function leaveRoom() {
    if (roomUnsubRef.current) { roomUnsubRef.current(); roomUnsubRef.current = null; }
    setRoomData(null);
    setRoomCode(null);
    setOnlineError("");
    setScreen("home");
  }

  function copyRoomLink() {
    const link = `${window.location.origin}${window.location.pathname}?join=${roomCode}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    alert("Link copiado: " + link);
  }

  // Si alguien abre la app con un link de invitación (?join=CODIGO), precarga el código
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinParam = params.get("join");
    if (joinParam) setJoinCodeInput(joinParam.toUpperCase());
  }, []);

  function addTeam() {
    if (!teamInput.trim() || teams.length >= 5) return;
    setTeams([...teams, { id: uid(), name: teamInput.trim(), score: 0, album: [] }]);
    setTeamInput("");
  }
  function removeTeam(id) {
    setTeams(teams.filter((t) => t.id !== id));
  }

  const totalSongs = useMemo(() => Object.values(library).reduce((a, arr) => a + arr.length, 0), [library]);

  function startRound() {
    requestWakeLock();
    setScreen("lobby");
    setPerformerId(teams[0]?.id || null);
    const other = teams.find((t) => t.id !== teams[0]?.id);
    setJuryId(other?.id || null);
  }

  function endSession() {
    releaseWakeLock();
    setTeams([]);
    setUsedIds([]);
    try { localStorage.removeItem("pistazo-teams"); } catch (e) {}
    setScreen("home");
  }

  function getAllSongsFlat() {
    return Object.entries(library).flatMap(([mood, arr]) => arr.map((s) => ({ ...s, mood })));
  }

  function selectSongByGenero(generoFilter) {
    const pool = getAllSongsFlat().filter((s) => {
      if (usedIds.includes(s.id)) return false;
      if (generoFilter && generoFilter !== "Todos" && s.genero !== generoFilter) return false;
      return true;
    });
    if (pool.length === 0) {
      alert("No quedan canciones sin usar en ese género. Vuelve al lobby e intenta otro.");
      return;
    }
    const song = pool[Math.floor(Math.random() * pool.length)];
    setSelectedMood(song.mood);
    setRoundGenre(generoFilter || "Todos");
    setCurrentSong(song);
    setUsedIds((u) => [...u, song.id]);
    setIsSteal(false);
    setAttemptedIds([]);
    setWonById(null);
    setScreen("getReady");
  }

  function getSpotifyTrackId(url) {
    if (!url) return null;
    const m = url.match(/track\/([a-zA-Z0-9]+)/);
    return m ? m[1] : null;
  }

  // Crea el reproductor de Spotify (API oficial) cuando entramos a la pista 3 (modo local o sala), e intenta reproducir de una vez.
  useEffect(() => {
    const inLocalClue3 = screen === "clue3" && currentSong;
    const inRoomClue3 = screen === "roomGame" && roomData?.game?.phase === "clue3" && roomData.game.currentSong;
    const activeSong = inLocalClue3 ? currentSong : inRoomClue3 ? roomData.game.currentSong : null;
    if (!activeSong) return;
    const trackId = getSpotifyTrackId(activeSong.spotify);
    if (!trackId || !spotifyApiReady || !spotifyApiRef.current || !clue3ContainerRef.current) return;
    clue3ContainerRef.current.innerHTML = "";
    spotifyApiRef.current.createController(
      clue3ContainerRef.current,
      { uri: `spotify:track:${trackId}`, width: "100%", height: "152" },
      (EmbedController) => {
        spotifyControllerRef.current = EmbedController;
        try {
          EmbedController.seek(0);
          EmbedController.play();
        } catch (e) { /* algunos navegadores bloquean el autoplay */ }
      }
    );
    return () => { spotifyControllerRef.current = null; };
  }, [screen, currentSong, spotifyApiReady, roomData?.game?.phase, roomData?.game?.currentSong]);

  function stopClue3Audio() {
    try { spotifyControllerRef.current && spotifyControllerRef.current.pause(); } catch (e) { /* ignore */ }
  }

  function toggleClue3Audio() {
    try { spotifyControllerRef.current && spotifyControllerRef.current.togglePlay(); } catch (e) { /* ignore */ }
  }

  function goToCountdown() {
    stopClue3Audio();
    setGuessInput("");
    setScreen("countdown");
    runCountdown(COUNT_SECONDS, (t) => { setTimeLeft(t); vibrate(60); }, () => {
      setScreen("answerInput");
      runCountdown(ANSWER_SECONDS, setTimeLeft, () => checkAnswer());
    });
  }

  function startClueSequence() {
    setScreen("clue1");
    runCountdown(CLUE_SECONDS, setTimeLeft, () => {
      setScreen("clue2");
      runCountdown(CLUE_SECONDS, setTimeLeft, () => {
        if (getSpotifyTrackId(currentSong?.spotify)) {
          setScreen("clue3");
          runCountdown(CLUE3_SECONDS, setTimeLeft, goToCountdown);
        } else {
          goToCountdown();
        }
      });
    });
  }

  function offerSteal(teamId) {
    setPerformerId(teamId);
    setIsSteal(true);
    setScreen("stealReady");
  }

  function startStealSequence() {
    setGuessInput("");
    setScreen("countdown");
    runCountdown(COUNT_SECONDS, (t) => { setTimeLeft(t); vibrate(60); }, () => {
      setScreen("answerInput");
      runCountdown(ANSWER_SECONDS, setTimeLeft, () => checkAnswer());
    });
  }

  function normalizeAnswer(str) {
    return (str || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(el|la|los|las|un|una|unos|unas|de|del|y|feat)\b/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function isCloseEnough(guess, title) {
    const a = normalizeAnswer(guess);
    const b = normalizeAnswer(title);
    if (!a) return false;
    if (a === b) return true;
    const dist = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    return maxLen > 0 && 1 - dist / maxLen >= 0.75;
  }

  function checkAnswer() {
    clearInterval(timerRef.current);
    const isCorrect = isCloseEnough(guessInput, currentSong?.title || "");
    handleVerdict(isCorrect);
  }

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Este navegador no soporta reconocimiento de voz (pasa seguido en iPhone). Escribe la respuesta.");
      return;
    }
    const recognition = new SR();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsListening(true);
    recognition.onresult = (e) => {
      setGuessInput(e.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }

  function handleVerdict(isCorrect) {
    setCorrect(isCorrect);
    if (isCorrect) {
      vibrate([80, 40, 80, 40, 160]);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2200);
      const pts = isSteal ? STEAL_POINTS : GUESS_POINTS;
      setTeams((ts) => ts.map((t) => (t.id === performerId ? { ...t, score: t.score + pts } : t)));
      setWonById(performerId);
      setScreen("titleReveal");
    } else {
      vibrate(200);
      setAttemptedIds((ids) => [...ids, performerId]);
      setScreen("steal");
    }
  }

  function submitJudging() {
    const bonus = scores.afinacion + scores.ritmo + scores.actitud;
    const rarity = bonus >= 13 ? "brillante" : bonus >= 9 ? "rara" : "normal";
    const figurita = { id: uid(), title: currentSong.title, artist: currentSong.artist, mood: selectedMood, rarity };
    if (rarity === "brillante") {
      vibrate([100, 60, 100, 60, 200]);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2200);
    }
    setTeams((ts) => ts.map((t) => (t.id === performerId ? { ...t, score: t.score + bonus, album: [...(t.album || []), figurita] } : t)));
    setJuryRevealed(true);
  }

  function finishRound() {
    setJuryRevealed(false);
    setScores({ afinacion: 3, ritmo: 3, actitud: 3 });
    setCorrect(null);
    setCurrentSong(null);
    setSelectedMood(null);
    setIsSteal(false);
    setAttemptedIds([]);
    setWonById(null);
    setScreen("scoreboard");
  }

  function roomUpdateGame(patch) {
    if (!roomCode) return Promise.resolve();
    const flat = {};
    Object.entries(patch).forEach(([k, v]) => { flat[`game.${k}`] = v; });
    return updateDoc(doc(db, "rooms", roomCode), flat).catch(() => {});
  }

  function startGroupRound() {
    if (!roomData?.teams || roomData.teams.length < 1) return;
    const t = roomData.teams;
    const perfId = t[0].id;
    const jrId = t.length > 1 ? t[1].id : null;
    updateDoc(doc(db, "rooms", roomCode), {
      game: {
        phase: "pickGenero", performerId: perfId, juryId: jrId, currentSong: null, roundGenre: "Todos",
        usedIds: [], isSteal: false, attemptedIds: [], wonById: null, juryRevealed: false,
        scores: { afinacion: 3, ritmo: 3, actitud: 3 }, clueStartedAt: null,
      },
    }).catch(() => {});
    setScreen("roomGame");
  }

  // Cualquier celular en la sala de espera pasa solo a la partida en cuanto alguien la arranca.
  useEffect(() => {
    if (!roomCode) return;
    if (roomData?.game?.phase && screen === "onlineLobby") {
      setScreen("roomGame");
    }
  }, [roomData, roomCode, screen]);

  // Solo el celular de quien adivina "conduce" el reloj de las pistas — evita que dos celulares escriban a la vez.
  useEffect(() => {
    if (!roomCode || !roomData?.game) return;
    const g = roomData.game;
    if (myTeamId !== g.performerId) return;
    if (g.phase === "clue1") {
      const t = setTimeout(() => roomUpdateGame({ phase: "clue2", clueStartedAt: Date.now() }), CLUE_SECONDS * 1000);
      return () => clearTimeout(t);
    }
    if (g.phase === "clue2") {
      const hasAudio = !!getSpotifyTrackId(g.currentSong?.spotify);
      const t = setTimeout(() => roomUpdateGame(hasAudio ? { phase: "clue3", clueStartedAt: Date.now() } : { phase: "answering", clueStartedAt: Date.now() }), CLUE_SECONDS * 1000);
      return () => clearTimeout(t);
    }
    if (g.phase === "clue3") {
      const t = setTimeout(() => roomUpdateGame({ phase: "answering", clueStartedAt: Date.now() }), CLUE3_SECONDS * 1000);
      return () => clearTimeout(t);
    }
  }, [roomData?.game?.phase, roomData?.game?.clueStartedAt, myTeamId, roomCode]);

  // Ticker liviano solo para refrescar los anillos de tiempo en pantalla (no escribe nada).
  useEffect(() => {
    if (screen !== "roomGame") return;
    const t = setInterval(() => forceTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [screen]);

  function roomTimeLeft(seconds, startedAt) {
    if (!startedAt) return seconds;
    return Math.max(0, seconds - (Date.now() - startedAt) / 1000);
  }

  function roomSelectGenero(g) {
    const gm = roomData.game;
    const pool = getAllSongsFlat().filter((s) => !(gm.usedIds || []).includes(s.id) && (g === "Todos" || s.genero === g));
    if (pool.length === 0) { alert("No quedan canciones sin usar en ese género."); return; }
    const song = pool[Math.floor(Math.random() * pool.length)];
    roomUpdateGame({
      phase: "clue1", roundGenre: g, currentSong: song,
      usedIds: [...(gm.usedIds || []), song.id], clueStartedAt: Date.now(),
      isSteal: false, wonById: null, attemptedIds: [],
    });
  }

  function roomCheckAnswer() {
    const gm = roomData.game;
    const isCorrect = isCloseEnough(guessInputRoom, gm.currentSong?.title || "");
    setGuessInputRoom("");
    if (isCorrect) {
      vibrate([80, 40, 80, 40, 160]);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2200);
      const pts = gm.isSteal ? STEAL_POINTS : GUESS_POINTS;
      const newTeams = roomData.teams.map((t) => (t.id === gm.performerId ? { ...t, score: t.score + pts } : t));
      updateDoc(doc(db, "rooms", roomCode), { teams: newTeams }).catch(() => {});
      roomUpdateGame({ phase: "reveal", wonById: gm.performerId });
    } else {
      vibrate(200);
      roomUpdateGame({ phase: "steal", attemptedIds: [...(gm.attemptedIds || []), gm.performerId] });
    }
  }

  function roomOfferSteal(teamId) {
    roomUpdateGame({ performerId: teamId, isSteal: true, phase: "answering", clueStartedAt: Date.now() });
  }

  function roomSubmitJury() {
    const gm = roomData.game;
    const bonus = roomScores.afinacion + roomScores.ritmo + roomScores.actitud;
    const rarity = bonus >= 13 ? "brillante" : bonus >= 9 ? "rara" : "normal";
    const figurita = { id: uid(), title: gm.currentSong.title, artist: gm.currentSong.artist, mood: gm.roundGenre, rarity };
    const newTeams = roomData.teams.map((t) => (t.id === gm.performerId ? { ...t, score: t.score + bonus, album: [...(t.album || []), figurita] } : t));
    updateDoc(doc(db, "rooms", roomCode), { teams: newTeams }).catch(() => {});
    roomUpdateGame({ juryRevealed: true, scores: roomScores });
  }

  function roomNextRound() {
    const t = roomData.teams;
    const idx = t.findIndex((x) => x.id === roomData.game.wonById) ?? 0;
    const nextPerformer = t[(idx + 1) % t.length] || t[0];
    const nextJury = t.find((x) => x.id !== nextPerformer.id) || null;
    setRoomScores({ afinacion: 3, ritmo: 3, actitud: 3 });
    updateDoc(doc(db, "rooms", roomCode), {
      game: {
        phase: "pickGenero", performerId: nextPerformer.id, juryId: nextJury?.id || null,
        currentSong: null, roundGenre: "Todos", usedIds: roomData.game.usedIds || [],
        isSteal: false, attemptedIds: [], wonById: null, juryRevealed: false,
        scores: { afinacion: 3, ritmo: 3, actitud: 3 }, clueStartedAt: null,
      },
    }).catch(() => {});
  }

  const performer = teams.find((t) => t.id === performerId);
  const jury = teams.find((t) => t.id === juryId);
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Baloo+2:wght@500;700;800&family=Nunito:wght@400;600;700;800&family=Bungee&display=swap');
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.35); }
        .pz-btn:active { transform: scale(0.98); }
        @keyframes confetti-fall { to { transform: translateY(115vh) rotate(720deg); opacity: 0.2; } }
        @keyframes pistazo-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes pz-glow { 0%,100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.12); } }
        @keyframes pz-bounce { 0% { transform: scale(0.85); } 60% { transform: scale(1.16); } 100% { transform: scale(1.1); } }
        @keyframes pz-twinkle { 0%,100% { opacity: 0.3; transform: scale(0.8) rotate(0deg); } 50% { opacity: 1; transform: scale(1.15) rotate(15deg); } }
        @keyframes pz-pop { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.25); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pz-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pz-zoomin { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes pz-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pz-shine { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
      {showConfetti && <Confetti />}

      {screen === "home" && (
        <Stage>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 20 }}>
            <div style={{ fontSize: 20, letterSpacing: 6, color: C.gold }}>⭐ ⭐ ⭐</div>
            <div>
              <h1 style={{
                fontSize: 54, color: C.white, fontFamily: "'Lilita One', cursive", margin: 0, letterSpacing: 2,
                textShadow: "0 4px 0 #7626ff, 0 8px 16px rgba(0,0,0,0.45)",
              }}>PISTAZO</h1>
              <p style={{ color: "rgba(255,255,255,0.6)", marginTop: 10, fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>Adivina • Canta • Gana</p>
            </div>
            <div onClick={handleLogoTap} style={{ userSelect: "none", animation: "pz-float 3s ease-in-out infinite" }}>
              <img src={AVATARS[7]} alt="" style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", border: `3px solid ${C.gold}`, boxShadow: `0 10px 30px -8px ${C.gold}88` }} />
            </div>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              <Btn onClick={() => setScreen(hasSeenInstructions ? "onlineHome" : "instructions")}><Users size={18} /> Jugar</Btn>
              <Btn variant="secondary" onClick={() => setScreen("instructions")}>Cómo jugar</Btn>
            </div>
          </div>
        </Stage>
      )}

      {screen === "onlineHome" && (
        <Stage>
          <Header title="Jugar" onBack={() => setScreen("home")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>¿Cómo quieres jugar?</p>
            <Btn variant="gold" onClick={() => setScreen("groupHome")}><Users size={18} /> Jugar en grupo</Btn>
            <Btn variant="teal" onClick={() => setScreen("randomHome")}><Shuffle size={18} /> Aleatorio</Btn>
          </div>
        </Stage>
      )}

      {screen === "groupHome" && (
        <Stage>
          <Header title="Jugar en grupo" onBack={() => setScreen("onlineHome")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Crea una sala e invita a tus amigos con un código, o únete a una que ya exista.</p>
            <Btn variant="gold" onClick={() => createRoom(false)}><UserPlus size={18} /> Crear sala e invitar amigos</Btn>
            <Btn variant="secondary" onClick={() => setScreen("joinCode")}>Unirme con un código</Btn>
            {onlineError && <p style={{ color: C.pink, fontSize: 13 }}>{onlineError}</p>}
          </div>
        </Stage>
      )}

      {screen === "randomHome" && (
        <Stage>
          <Header title="Aleatorio" onBack={() => setScreen("onlineHome")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>¿Con quién juegas?</p>
            <Btn variant="teal" onClick={joinRandomRoom}><Globe size={18} /> Con alguien conectado</Btn>
            <Btn variant="secondary" onClick={() => setScreen("soloSetup")}>Solo, contra el reloj</Btn>
            {onlineError && <p style={{ color: C.pink, fontSize: 13 }}>{onlineError}</p>}
          </div>
        </Stage>
      )}

      {screen === "soloSetup" && (
        <Stage>
          <Header title="Práctica solo" onBack={() => setScreen("randomHome")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Juegas solo, contra el reloj — sin jurado ni karaoke calificado.</p>
            <input value={soloNameInput} onChange={(e) => setSoloNameInput(e.target.value)} placeholder="Tu nombre (opcional)" style={S.input} />
            <p style={S.label}>Elige tu avatar</p>
            <AvatarPicker selected={selectedAvatar} onSelect={setSelectedAvatar} />
            <Btn variant="gold" onClick={startSoloPractice}>Empezar</Btn>
          </div>
        </Stage>
      )}

      {screen === "joinCode" && (
        <Stage>
          <Header title="Unirme a una sala" onBack={() => setScreen("groupHome")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Pide el código de 4 letras a quien creó la sala.</p>
            <input
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="EJ: AB3X"
              maxLength={4}
              style={{ ...S.input, textAlign: "center", fontSize: 28, letterSpacing: 6, fontWeight: 900, textTransform: "uppercase" }}
            />
            {onlineError && <p style={{ color: C.pink, fontSize: 13 }}>{onlineError}</p>}
            <Btn variant="gold" onClick={joinRoomWithCode}>Unirme</Btn>
          </div>
        </Stage>
      )}

      {screen === "joinTeamName" && (
        <Stage>
          <Header title="Crea tu equipo" onBack={leaveRoom} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Sala <strong style={{ color: C.gold }}>{roomCode}</strong> — ponle nombre a tu equipo.</p>
            <input
              value={newTeamNameOnline}
              onChange={(e) => setNewTeamNameOnline(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTeamToRoom()}
              placeholder="Nombre del equipo"
              style={S.input}
            />
            <p style={S.label}>Elige un avatar</p>
            <AvatarPicker selected={selectedAvatar} onSelect={setSelectedAvatar} />
            <Btn variant="gold" onClick={addTeamToRoom}>Crear equipo y entrar</Btn>
          </div>
        </Stage>
      )}

      {screen === "onlineLobby" && (
        <Stage>
          <Header title="Sala de espera" onBack={leaveRoom} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            <div style={{ ...S.card, textAlign: "center" }}>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Código de la sala</p>
              <p style={{ color: C.gold, fontSize: 52, fontFamily: "'Bungee', cursive", letterSpacing: 6, margin: 0 }}>{roomCode}</p>
              <Btn variant="secondary" onClick={copyRoomLink} style={{ marginTop: 12 }}><Copy size={16} /> Copiar link para invitar</Btn>
            </div>
            <p style={S.label}>Equipos en la sala ({(roomData?.teams || []).length})</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(roomData?.teams || []).map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 16px", color: C.white, fontWeight: 600 }}>
                  <img src={t.avatar || AVATARS[0]} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} /> {t.name}
                </div>
              ))}
              {(!roomData?.teams || roomData.teams.length === 0) && (
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Todavía no se ha unido ningún equipo.</p>
              )}
            </div>
            {!(roomData?.teams || []).some((t) => t.name === newTeamNameOnline) && (
              <Btn variant="ghost" onClick={() => setScreen("joinTeamName")}>+ Agregar mi equipo también</Btn>
            )}
          </div>
          {(roomData?.teams || []).length >= 1 && (
            <Btn variant="gold" onClick={startGroupRound}><Play size={18} /> Empezar partida en este celular</Btn>
          )}
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center", marginTop: 8 }}>
            La partida corre en el celular de quien la empieza; los demás ven el marcador en vivo aquí mismo.
          </p>
        </Stage>
      )}

      {screen === "roomGame" && roomData?.game && (() => {
        const g = roomData.game;
        const rTeams = roomData.teams || [];
        const rPerformer = rTeams.find((t) => t.id === g.performerId);
        const rJury = rTeams.find((t) => t.id === g.juryId);
        const iAmPerformer = myTeamId === g.performerId;
        const iAmJury = myTeamId === g.juryId && !iAmPerformer;
        const sorted = [...rTeams].sort((a, b) => b.score - a.score);

        const ScoreStrip = () => (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 8 }}>
            {sorted.map((t) => (
              <div key={t.id} style={{ flexShrink: 0, background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                {t.avatar && <img src={t.avatar} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />}
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, fontFamily: "'Baloo 2', sans-serif" }}>{t.name}</span>
                <span style={{ color: C.gold, fontSize: 15, fontFamily: "'Bungee', cursive" }}>{t.score}</span>
              </div>
            ))}
          </div>
        );

        // --- Elegir género (solo el que adivina puede tocar) ---
        if (g.phase === "pickGenero") {
          const availableGenres = genres.filter((gg) => getAllSongsFlat().some((s) => !(g.usedIds || []).includes(s.id) && s.genero === gg));
          return (
            <Stage>
              <Header title="Elige el género" onBack={leaveRoom} />
              <ScoreStrip />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
                {rPerformer?.avatar && <img src={rPerformer.avatar} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.gold}` }} />}
                {iAmPerformer ? (
                  <>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Te toca elegir el género</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%" }}>
                      {availableGenres.map((gg) => (
                        <button key={gg} onClick={() => roomSelectGenero(gg)} style={{ padding: "16px 8px", borderRadius: 16, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: C.white, fontWeight: 800, fontFamily: "'Baloo 2', sans-serif", cursor: "pointer" }}>
                          <div style={{ fontSize: 22 }}>{genreEmoji(gg)}</div>{gg}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>Esperando a que <strong style={{ color: C.white }}>{rPerformer?.name}</strong> elija el género...</p>
                )}
              </div>
            </Stage>
          );
        }

        // --- Pistas 1, 2 y 3 ---
        if (g.phase === "clue1" || g.phase === "clue2" || g.phase === "clue3") {
          const seconds = g.phase === "clue3" ? CLUE3_SECONDS : CLUE_SECONDS;
          const left = roomTimeLeft(seconds, g.clueStartedAt);
          if (!iAmPerformer) {
            return (
              <Stage>
                <Header title="En curso" onBack={leaveRoom} />
                <ScoreStrip />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
                  {rPerformer?.avatar && <img src={rPerformer.avatar} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.teal}` }} />}
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}><strong style={{ color: C.white }}>{rPerformer?.name}</strong> está viendo sus pistas...</p>
                </div>
              </Stage>
            );
          }
          return (
            <Stage>
              <Header title="Tus pistas" onBack={leaveRoom} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
                <p style={{ color: C.teal, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 14, fontFamily: "'Baloo 2', sans-serif" }}>
                  Pista {g.phase === "clue1" ? "1" : g.phase === "clue2" ? "2" : "3 · Escucha"}
                </p>
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ring pct={left / seconds} />
                  <span style={{ position: "absolute", fontSize: 32, fontWeight: 900, color: C.white }}>{Math.ceil(left)}</span>
                </div>
                {g.phase !== "clue3" ? (
                  <div style={{ background: "rgba(255,61,138,0.12)", borderRadius: 24, padding: "30px 22px", border: `2px solid ${C.pink}55`, maxWidth: 340 }}>
                    <p style={{ color: C.gold, fontSize: 26, fontWeight: 800, lineHeight: 1.35, margin: 0 }}>
                      {g.phase === "clue1" ? g.currentSong?.artist : g.currentSong?.clue2}
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ position: "relative", width: "100%", maxWidth: 340, height: 60, overflow: "hidden", borderRadius: 12, background: C.bg }}>
                      <div ref={clue3ContainerRef} style={{ position: "absolute", top: -92, left: 0, width: "100%" }} />
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>⚠️ ¡No mires si alguien más va a escuchar contigo!</p>
                  </>
                )}
              </div>
            </Stage>
          );
        }

        // --- Responder ---
        if (g.phase === "answering") {
          if (!iAmPerformer) {
            return (
              <Stage>
                <Header title="En curso" onBack={leaveRoom} />
                <ScoreStrip />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}><strong style={{ color: C.white }}>{rPerformer?.name}</strong> está respondiendo...</p>
                </div>
              </Stage>
            );
          }
          return (
            <Stage>
              <Header title="¡Responde!" onBack={leaveRoom} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
                {g.isSteal && <p style={{ color: C.gold, fontSize: 12, textTransform: "uppercase" }}>Intento de robo</p>}
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15 }}>Escribe el título de la canción</p>
                <input
                  autoFocus value={guessInputRoom} onChange={(e) => setGuessInputRoom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && roomCheckAnswer()}
                  placeholder="Título de la canción..." style={{ ...S.input, textAlign: "center", fontSize: 18, marginBottom: 0 }}
                />
                <div style={{ display: "flex", gap: 12, width: "100%" }}>
                  <Btn variant="secondary" onClick={() => {
                    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                    if (!SR) { alert("Este navegador no soporta reconocimiento de voz."); return; }
                    const r = new SR(); r.lang = "es-ES"; r.interimResults = false; r.maxAlternatives = 1;
                    setIsListeningRoom(true);
                    r.onresult = (e) => { setGuessInputRoom(e.results[0][0].transcript); setIsListeningRoom(false); };
                    r.onerror = () => setIsListeningRoom(false);
                    r.onend = () => setIsListeningRoom(false);
                    r.start();
                  }} disabled={isListeningRoom}>
                    <Mic2 size={18} /> {isListeningRoom ? "Escuchando..." : "Hablar"}
                  </Btn>
                  <Btn variant="teal" onClick={roomCheckAnswer}>Comprobar</Btn>
                </div>
              </div>
            </Stage>
          );
        }

        // --- Robo de turno ---
        if (g.phase === "steal") {
          const eligible = rTeams.filter((t) => !(g.attemptedIds || []).includes(t.id));
          const iCanSteal = eligible.some((t) => t.id === myTeamId);
          return (
            <Stage>
              <Header title="¿Alguien roba?" onBack={leaveRoom} />
              <ScoreStrip />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15 }}>No la acertaron. {eligible.length > 0 ? "¿Quién quiere robar?" : "Nadie más puede robar."}</p>
                {iCanSteal && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                    <Btn variant="gold" onClick={() => roomOfferSteal(myTeamId)}>¡Yo quiero robar! (vale {STEAL_POINTS} pts)</Btn>
                  </div>
                )}
                {!iCanSteal && eligible.length === 0 && (
                  <Btn variant="ghost" onClick={() => roomUpdateGame({ phase: "reveal", wonById: null })}>Revelar respuesta</Btn>
                )}
                {!iCanSteal && eligible.length > 0 && (
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Esperando a que algún equipo decida robar...</p>
                )}
              </div>
            </Stage>
          );
        }

        // --- Revelar título ---
        if (g.phase === "reveal") {
          const winner = rTeams.find((t) => t.id === g.wonById);
          return (
            <Stage>
              <Header title="La respuesta" onBack={leaveRoom} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textTransform: "uppercase" }}>La canción era</p>
                <div>
                  <h2 style={{ fontSize: 28, fontWeight: 900, color: C.white, fontFamily: "'Baloo 2', sans-serif", margin: 0 }}>{g.currentSong?.title}</h2>
                  <p style={{ color: C.teal, fontWeight: 600, marginTop: 4 }}>{g.currentSong?.artist}</p>
                </div>
                {winner ? (
                  <>
                    <div style={{ background: `linear-gradient(135deg, ${C.gold}33, rgba(255,255,255,0.08), ${C.pink}22)`, border: `2px solid ${C.gold}`, borderRadius: 20, padding: "16px 22px", boxShadow: `0 0 30px -6px ${C.gold}99` }}>
                      <p style={{ fontSize: 12, letterSpacing: 3, color: C.gold, fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, margin: 0 }}>🥳 ¡GANADORES! 🥳</p>
                      <p style={{ color: C.white, fontSize: 18, fontWeight: 800, fontFamily: "'Baloo 2', sans-serif", margin: 0 }}>{winner.name}</p>
                    </div>
                    <Btn variant="gold" onClick={() => roomUpdateGame({ phase: "karaoke" })}><Mic2 size={18} /> Ir al karaoke</Btn>
                  </>
                ) : (
                  <Btn onClick={() => roomUpdateGame({ phase: "scoreboard" })}>Ver marcador</Btn>
                )}
              </div>
            </Stage>
          );
        }

        // --- Karaoke ---
        if (g.phase === "karaoke") {
          const winner = rTeams.find((t) => t.id === g.wonById);
          return (
            <Stage>
              <Header title="¡A cantar!" onBack={leaveRoom} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
                {winner?.avatar && <img src={winner.avatar} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: `3px solid ${C.teal}` }} />}
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{g.currentSong?.title} · {g.currentSong?.artist}</p>
                {g.currentSong?.spotify && (
                  <a href={g.currentSong.spotify} target="_blank" rel="noreferrer" style={{ width: "100%", textDecoration: "none" }}>
                    <Btn variant="gold"><ExternalLink size={18} /> Abrir en Spotify</Btn>
                  </a>
                )}
                {myTeamId === g.juryId ? (
                  <Btn onClick={() => roomUpdateGame({ phase: "jury" })}><Star size={18} /> Calificar el karaoke</Btn>
                ) : (
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{rJury ? `${rJury.name} va a calificar.` : "Sin jurado esta ronda."}</p>
                )}
                {!rJury && <Btn onClick={() => roomUpdateGame({ phase: "scoreboard" })}>Ver marcador</Btn>}
              </div>
            </Stage>
          );
        }

        // --- Calificación del jurado ---
        if (g.phase === "jury") {
          if (myTeamId !== g.juryId) {
            return (
              <Stage>
                <Header title="Calificando..." onBack={leaveRoom} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>{rJury?.name} está calificando el karaoke...</p>
                </div>
              </Stage>
            );
          }
          if (g.juryRevealed) {
            return (
              <Stage>
                <Header title="Puntaje" onBack={leaveRoom} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
                  <Trophy size={40} color={C.gold} />
                  <span style={{ fontSize: 48, fontWeight: 900, color: C.white }}>+{(g.scores?.afinacion || 0) + (g.scores?.ritmo || 0) + (g.scores?.actitud || 0)}</span>
                  <Btn onClick={() => roomUpdateGame({ phase: "scoreboard" })}>Ver marcador</Btn>
                </div>
              </Stage>
            );
          }
          return (
            <Stage>
              <Header title="Califica el karaoke" onBack={leaveRoom} />
              <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
                {[{ key: "afinacion", label: "Afinación" }, { key: "ritmo", label: "Ritmo y sincronía" }, { key: "actitud", label: "Show y actitud" }].map((c) => (
                  <div key={c.key}>
                    <p style={{ color: C.white, fontWeight: 600, marginBottom: 8 }}>{c.label}</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setRoomScores({ ...roomScores, [c.key]: n })} style={{ flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700, border: "none", cursor: "pointer", background: roomScores[c.key] >= n ? C.gold : "rgba(255,255,255,0.1)", color: roomScores[c.key] >= n ? C.bg : "rgba(255,255,255,0.4)" }}>{n}</button>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{ flex: 1 }} />
                <Btn variant="gold" onClick={roomSubmitJury}><Eye size={18} /> Revelar puntaje</Btn>
              </div>
            </Stage>
          );
        }

        // --- Marcador ---
        return (
          <Stage>
            <Header title="Marcador" onBack={leaveRoom} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {sorted.map((t, i) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 900, width: 18 }}>{i + 1}</span>
                    {t.avatar && <img src={t.avatar} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />}
                    <span style={{ color: C.white, fontWeight: 600 }}>{t.name}</span>
                  </div>
                  <span style={{ color: C.gold, fontWeight: 900, fontSize: 18 }}>{t.score}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <Btn variant="gold" onClick={roomNextRound}><Shuffle size={18} /> Siguiente ronda</Btn>
          </Stage>
        );
      })()}

      {screen === "instructions" && (
        <Stage>
          <Header title="Cómo jugar" onBack={() => setScreen("home")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            {[
              { n: "1", t: "Formen equipos", d: "Hasta 5 equipos. Un integrante pasa a adivinar; otro equipo completo es el jurado secreto." },
              { n: "2", t: "Elijan en cadena", d: "El equipo que adivina elige el género musical, el siguiente equipo elige el tema, y el siguiente el formato." },
              { n: "3", t: "Tres pistas", d: "Una frase textual de la canción, una pista indirecta y, si hay audio disponible, un fragmento para escuchar. Luego, a la cuenta de 3, digan el título." },
              { n: "4", t: "¿No la acertaron?", d: "Otro equipo puede robar el turno por la mitad de los puntos." },
              { n: "5", t: "Karaoke y calificación", d: "Si aciertan, cantan con la letra en Spotify mientras el jurado califica en secreto: afinación, ritmo y actitud." },
              { n: "6", t: "Álbum de figuritas", d: "Cada canción ganada se suma al álbum del equipo — las más brillantes son las mejor cantadas." },
            ].map((s) => (
              <div key={s.n} style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 999, background: C.pink, color: C.white, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13 }}>{s.n}</div>
                <div>
                  <p style={{ color: C.white, fontWeight: 700, margin: 0 }}>{s.t}</p>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: "2px 0 0 0" }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
          <Btn variant="gold" onClick={() => dismissInstructions(true)}>Entendido, ¡a jugar!</Btn>
        </Stage>
      )}

      {screen === "teams" && (
        <Stage>
          <Header title="Equipos" onBack={goHome} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {teams.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 16px", color: C.white }}>
                <span style={{ fontWeight: 600 }}>{t.name}</span>
                <button onClick={() => removeTeam(t.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={16} color="rgba(255,255,255,0.4)" /></button>
              </div>
            ))}
          </div>
          {teams.length < 5 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <input value={teamInput} onChange={(e) => setTeamInput(e.target.value)} placeholder="Nombre del equipo"
                onKeyDown={(e) => e.key === "Enter" && addTeam()} style={{ ...S.input, flex: 1, marginBottom: 0 }} />
              <button onClick={addTeam} style={{ background: C.teal, borderRadius: 12, border: "none", padding: "0 16px", cursor: "pointer", display: "flex", alignItems: "center" }}><Plus size={20} color={C.bg} /></button>
            </div>
          )}
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 16 }}>Mínimo 2 equipos, máximo 5. Un integrante pasa a adivinar; otro equipo completo hace de jurado secreto.</p>
          <div style={{ flex: 1 }} />
          <Btn disabled={teams.length < 2 || totalSongs === 0} onClick={startRound}>
            <Play size={18} /> Empezar juego
          </Btn>
          {totalSongs === 0 && <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 12 }}>Agrega canciones en la Biblioteca antes de jugar.</p>}
        </Stage>
      )}

      {screen === "library" && (
        <Stage>
          <Header title="Canciones cargadas" onBack={goHome} />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 16 }}>
            Esta lista se carga automáticamente desde <code>public/canciones.csv</code> en el proyecto. Para agregar o editar canciones, edita ese archivo y súbelo a GitHub — no se hace desde aquí.
          </p>
          {totalSongs === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
              <span style={{ fontSize: 36 }}>🎵</span>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Todavía no hay canciones cargadas. Agrega <code>canciones.csv</code> al proyecto.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 16 }}>
              {moods.map((m) => (
                <div key={m}>
                  <p style={{ color: C.gold, fontWeight: 700, fontSize: 14, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>{m} ({(library[m] || []).length})</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(library[m] || []).map((s) => (
                      <div key={s.id} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 12px" }}>
                        <p style={{ color: C.white, fontSize: 14, fontWeight: 500, margin: 0 }}>{s.title}</p>
                        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: 0 }}>{s.artist}{s.genero ? ` · ${s.genero}` : ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Stage>
      )}

      {screen === "lobby" && (
        <Stage>
          <Header title="Nueva ronda" onBack={() => setScreen("teams")} />
          <MiniScoreboard teams={teams} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <p style={S.label}>¿Quién adivina?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {teams.map((t) => (
                  <button key={t.id} onClick={() => setPerformerId(t.id)} style={{ padding: "8px 16px", borderRadius: 999, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", background: performerId === t.id ? C.pink : "rgba(255,255,255,0.1)", color: performerId === t.id ? C.white : "rgba(255,255,255,0.6)" }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={S.label}>¿Quién es el jurado secreto?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {teams.filter((t) => t.id !== performerId).map((t) => (
                  <button key={t.id} onClick={() => setJuryId(t.id)} style={{ padding: "8px 16px", borderRadius: 999, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", background: juryId === t.id ? C.teal : "rgba(255,255,255,0.1)", color: juryId === t.id ? C.bg : "rgba(255,255,255,0.6)" }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Pasa el celular al participante que va a adivinar. El equipo jurado no debe ver la pantalla durante el karaoke.</p>
          </div>
          <div style={{ flex: 1 }} />
          {usedIds.length > 0 && (
            <button onClick={() => setUsedIds([])} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 12, cursor: "pointer", width: "100%" }}>
              <RotateCcw size={12} /> Reiniciar canciones ya usadas
            </button>
          )}
          <Btn disabled={!performerId || !juryId} onClick={() => setScreen("pickGenero")}>Continuar</Btn>
        </Stage>
      )}

      {screen === "pickGenero" && (() => {
        const availableGenres = genres.filter((g) => getAllSongsFlat().some((s) => !usedIds.includes(s.id) && s.genero === g));
        if (availableGenres.length === 0) {
          return (
            <Stage>
              <Header title="Elige el género" onBack={() => setScreen("lobby")} />
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>No quedan canciones sin usar. Agrega más en <code>canciones.csv</code> o reinicia las usadas desde el lobby.</p>
            </Stage>
          );
        }
        const current = availableGenres.includes(pendingGenero) ? pendingGenero : availableGenres[0];
        const idx = availableGenres.indexOf(current);
        function goGenre(delta) {
          const next = (idx + delta + availableGenres.length) % availableGenres.length;
          setPendingGenero(availableGenres[next]);
        }
        return (
          <Stage>
            <Header title="Elige el género" onBack={() => setScreen("lobby")} />
            <MiniScoreboard teams={teams} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
              {performer?.avatar && <img src={performer.avatar} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.gold}` }} />}
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: 0 }}>
                Le toca a <strong style={{ color: C.white }}>{performer?.name}</strong>
              </p>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <button onClick={() => goGenre(-1)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 999, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, cursor: "pointer" }}>
                  <ChevronLeft size={22} />
                </button>
                <div key={current} style={{ width: 160, height: 160, borderRadius: 24, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 10px 26px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, animation: "pz-zoomin 0.3s ease" }}>
                  <span style={{ fontSize: 56 }}>{genreEmoji(current)}</span>
                  <span style={{ color: C.white, fontWeight: 800, fontFamily: "'Baloo 2', sans-serif", fontSize: 18 }}>{current}</span>
                </div>
                <button onClick={() => goGenre(1)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 999, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, cursor: "pointer" }}>
                  <ChevronRight size={22} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {availableGenres.map((g, i) => (
                  <span key={g} style={{ width: 6, height: 6, borderRadius: "50%", background: i === idx ? C.gold : "rgba(255,255,255,0.25)" }} />
                ))}
              </div>
            </div>
            <Btn variant="gold" onClick={() => selectSongByGenero(current)}>Elegir {current}</Btn>
          </Stage>
        );
      })()}

      {screen === "getReady" && currentSong && (
        <Stage>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
            {performer?.avatar ? (
              <img src={performer.avatar} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: `3px solid ${C.gold}`, animation: "pz-bounce 0.4s cubic-bezier(0.34,1.56,0.64,1)" }} />
            ) : (
              <Sparkles color={C.gold} size={36} />
            )}
            <div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: C.white, fontFamily: "'Baloo 2', sans-serif", margin: 0 }}>¡Se vienen las pistas!</h2>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8 }}>
                Le toca adivinar a <strong style={{ color: C.white }}>{performer?.name}</strong>. Van a ver 2 pistas de texto y, si hay audio disponible, una pista para escuchar — luego tienen que decir el nombre.
              </p>
            </div>
            {jury && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{jury.name} es el jurado secreto de esta ronda.</p>}
            <Btn variant="gold" onClick={startClueSequence}>Comenzar</Btn>
          </div>
        </Stage>
      )}

      {screen === "stealReady" && currentSong && (
        <Stage>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
            <Sparkles color={C.teal} size={36} />
            <h2 style={{ fontSize: 24, fontWeight: 900, color: C.white, fontFamily: "'Baloo 2', sans-serif", margin: 0 }}>¡Oportunidad de robo!</h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              Pasa el celular a <strong style={{ color: C.white }}>{performer?.name}</strong>. A la cuenta de 3 deben decir el nombre.
            </p>
            <Btn variant="teal" onClick={startStealSequence}>Listo</Btn>
          </div>
        </Stage>
      )}

      {(screen === "clue1" || screen === "clue2") && currentSong && (
        <Stage>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, textAlign: "center" }}>
            <p style={{ color: C.teal, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 14, fontFamily: "'Baloo 2', sans-serif" }}>Pista {screen === "clue1" ? "1" : "2"}</p>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ring pct={timeLeft / CLUE_SECONDS} />
              <span style={{ position: "absolute", fontSize: 36, fontWeight: 900, color: C.white }}>{timeLeft}</span>
            </div>
            <div style={{ background: "rgba(255,61,138,0.12)", borderRadius: 24, padding: "36px 24px", border: `2px solid ${C.pink}55`, maxWidth: 340 }}>
              <p style={{ color: C.gold, fontSize: 28, fontWeight: 800, lineHeight: 1.35, margin: 0 }}>
                {screen === "clue1" ? currentSong.artist : currentSong.clue2}
              </p>
            </div>
            {performer && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {performer.avatar && <img src={performer.avatar} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />}
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: 0 }}>{performer.name} está adivinando</p>
              </div>
            )}
          </div>
        </Stage>
      )}

      {screen === "clue3" && currentSong && (
        <Stage>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
            <p style={{ color: C.teal, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 14, fontFamily: "'Baloo 2', sans-serif" }}>Pista 3 · Escucha</p>
            <div style={{ background: "rgba(255,61,138,0.12)", border: `2px solid ${C.pink}55`, borderRadius: 16, padding: "12px 16px" }}>
              <p style={{ color: C.gold, fontWeight: 800, fontSize: 15, margin: 0 }}>
                ⚠️ {performer?.name}: ¡no miren la pantalla! Que alguien más sostenga el celular y solo escuchen.
              </p>
            </div>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ring pct={timeLeft / CLUE3_SECONDS} />
              <span style={{ position: "absolute", fontSize: 36, fontWeight: 900, color: C.white }}>{timeLeft}</span>
            </div>
            <div style={{ position: "relative", width: "100%", maxWidth: 340, height: 60, overflow: "hidden", borderRadius: 12, background: C.bg }}>
              <div ref={clue3ContainerRef} style={{ position: "absolute", top: -92, left: 0, width: "100%" }} />
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Debería sonar solo. Si no arrancó, toca el botón de abajo.</p>
            <Btn variant="secondary" onClick={toggleClue3Audio}>Reproducir / pausar</Btn>
          </div>
        </Stage>
      )}


      {screen === "countdown" && (
        <Stage>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 14 }}>¡Digan el nombre ya!</p>
            <span key={timeLeft} style={{ fontSize: 70, fontFamily: "'Bungee', cursive", color: C.gold, animation: "pz-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>{timeLeft}</span>
          </div>
        </Stage>
      )}

      {screen === "answerInput" && currentSong && (
        <Stage>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
            {isSteal && <p style={{ color: C.gold, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Intento de robo</p>}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ring pct={timeLeft / ANSWER_SECONDS} color={C.teal} />
              <span style={{ position: "absolute", fontSize: 30, fontWeight: 900, color: C.white }}>{timeLeft}</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15 }}>
              <strong style={{ color: C.white }}>{performer?.name}</strong>, escribe el título de la canción
            </p>
            <input
              autoFocus
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && checkAnswer()}
              placeholder="Título de la canción..."
              style={{ ...S.input, textAlign: "center", fontSize: 18, marginBottom: 0 }}
            />
            <div style={{ display: "flex", gap: 12, width: "100%" }}>
              <Btn variant="secondary" onClick={startListening} disabled={isListening}>
                <Mic2 size={18} /> {isListening ? "Escuchando..." : "Hablar"}
              </Btn>
              <Btn variant="teal" onClick={checkAnswer}>Comprobar</Btn>
            </div>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>La app compara automáticamente, tolera tildes y pequeños errores de escritura.</p>
          </div>
        </Stage>
      )}

      {screen === "steal" && (
        <Stage>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16 }}>No la acertaron. ¿Algún otro equipo quiere robar?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              {teams.filter((t) => !attemptedIds.includes(t.id)).map((t) => (
                <button key={t.id} onClick={() => offerSteal(t.id)} style={{ padding: "14px", borderRadius: 16, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: C.white, fontWeight: 700, cursor: "pointer" }}>
                  {t.name} roba (vale {STEAL_POINTS} pts)
                </button>
              ))}
            </div>
            <Btn variant="ghost" onClick={() => setScreen("titleReveal")}>Nadie más, revelar respuesta</Btn>
          </div>
        </Stage>
      )}

      {screen === "titleReveal" && currentSong && (
        <Stage>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>La canción era</p>
            <div>
              <h2 style={{ fontSize: 30, fontWeight: 900, color: C.white, fontFamily: "'Baloo 2', sans-serif", margin: 0 }}>{currentSong.title}</h2>
              <p style={{ color: C.teal, fontWeight: 600, marginTop: 4 }}>{currentSong.artist}</p>
            </div>
            {wonById ? (
              <>
                <div style={{
                  animation: "pz-zoomin 0.5s cubic-bezier(0.34,1.56,0.64,1)",
                  background: `linear-gradient(135deg, ${C.gold}33, rgba(255,255,255,0.08), ${C.pink}22)`,
                  border: `2px solid ${C.gold}`, borderRadius: 20, padding: "18px 24px",
                  boxShadow: `0 0 30px -6px ${C.gold}99`, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                }}>
                  <img src={AVATARS[2]} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.gold}` }} />
                  <p style={{ fontSize: 13, letterSpacing: 3, color: C.gold, fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, margin: 0 }}>🥳 ¡GANADORES! 🥳</p>
                  <p style={{ color: C.white, fontSize: 18, fontWeight: 800, fontFamily: "'Baloo 2', sans-serif", margin: 0 }}>{teams.find((t) => t.id === wonById)?.name}</p>
                </div>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Pasa el celular a {teams.find((t) => t.id === wonById)?.name} para cantar.</p>
                <Btn variant="gold" onClick={() => setScreen("karaoke")}><Mic2 size={18} /> Ir al karaoke</Btn>
              </>
            ) : (
              <Btn onClick={finishRound}>Terminar ronda</Btn>
            )}
          </div>
        </Stage>
      )}

      {screen === "karaoke" && currentSong && (
        <Stage>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, textAlign: "center" }}>
            <img src={AVATARS[5]} alt="" style={{ width: 76, height: 76, borderRadius: "50%", objectFit: "cover", border: `3px solid ${C.teal}`, animation: "pz-float 2.4s ease-in-out infinite" }} />
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: C.white, fontFamily: "'Baloo 2', sans-serif", margin: 0 }}>¡A cantar!</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 4 }}>{currentSong.title} · {currentSong.artist}</p>
            </div>
            {currentSong.spotify ? (
              <a href={currentSong.spotify} target="_blank" rel="noreferrer" style={{ width: "100%", textDecoration: "none" }}>
                <Btn variant="gold"><ExternalLink size={18} /> Abrir en Spotify (modo letra)</Btn>
              </a>
            ) : (
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>No hay link de Spotify guardado para esta canción.</p>
            )}
            {jury ? (
              <>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{jury.name}: tapen la pantalla, van a calificar en secreto.</p>
                <Btn onClick={() => setScreen("juryHandoff")}><Star size={18} /> Calificar el karaoke</Btn>
              </>
            ) : (
              <Btn onClick={finishRound}>Terminar ronda</Btn>
            )}
          </div>
        </Stage>
      )}

      {screen === "juryHandoff" && (
        <Stage>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
            <EyeOff color={C.teal} size={36} />
            <h2 style={{ fontSize: 24, fontWeight: 900, color: C.white, fontFamily: "'Baloo 2', sans-serif", margin: 0 }}>Turno del jurado</h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              Pasa el celular al equipo jurado: <strong style={{ color: C.white }}>{jury?.name}</strong>. Que el resto no vea la pantalla.
            </p>
            <Btn variant="teal" onClick={() => setScreen("jury")}>Continuar</Btn>
          </div>
        </Stage>
      )}

      {screen === "jury" && (
        <Stage>
          <Header title={`Jurado: ${jury?.name || ""}`} />
          {!juryRevealed ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><EyeOff size={14} /> Solo el equipo jurado debe ver esto.</p>
              {[
                { key: "afinacion", label: "Afinación" },
                { key: "ritmo", label: "Ritmo y sincronía" },
                { key: "actitud", label: "Show y actitud" },
              ].map((c) => (
                <div key={c.key}>
                  <p style={{ color: C.white, fontWeight: 600, marginBottom: 8 }}>{c.label}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setScores({ ...scores, [c.key]: n })} style={{ flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700, border: "none", cursor: "pointer", background: scores[c.key] >= n ? C.gold : "rgba(255,255,255,0.1)", color: scores[c.key] >= n ? C.bg : "rgba(255,255,255,0.4)" }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ flex: 1 }} />
              <Btn variant="gold" onClick={submitJudging}><Eye size={18} /> Revelar puntaje</Btn>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
              <Trophy size={40} color={C.gold} />
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Puntos de karaoke para {performer?.name}</p>
              <span style={{ fontSize: 48, fontWeight: 900, color: C.white }}>+{scores.afinacion + scores.ritmo + scores.actitud}</span>
              <Btn onClick={finishRound}>Ver marcador</Btn>
            </div>
          )}
        </Stage>
      )}

      {screen === "scoreboard" && (
        <Stage>
          <Header title="Marcador" onBack={goHome} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {sortedTeams.map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 900, width: 20 }}>{i + 1}</span>
                  {t.avatar && <img src={t.avatar} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />}
                  <span style={{ color: C.white, fontWeight: 600 }}>{t.name}</span>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>🎴 {(t.album || []).length}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: C.gold, fontWeight: 900, fontSize: 18 }}>{t.score}</span>
                  <button onClick={() => { setAlbumTeamId(t.id); setScreen("album"); }} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.1)", borderRadius: 999, padding: "4px 10px", border: "none", cursor: "pointer" }}>Álbum</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <Btn onClick={startRound}><Shuffle size={18} /> Siguiente ronda</Btn>
          <Btn variant="ghost" onClick={() => setScreen("endConfirm")} style={{ marginTop: 8 }}>Cerrar esta partida</Btn>
        </Stage>
      )}

      {screen === "endConfirm" && (
        <Stage>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: C.white, fontFamily: "'Baloo 2', sans-serif", margin: 0 }}>¿Cerrar esta partida?</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Se borran los equipos, puntajes y álbumes de esta partida para armar una nueva desde cero. La biblioteca de canciones no se toca.</p>
            <div style={{ display: "flex", gap: 12, width: "100%" }}>
              <Btn variant="secondary" onClick={() => setScreen("scoreboard")}>Cancelar</Btn>
              <Btn variant="gold" onClick={endSession}>Sí, cerrar</Btn>
            </div>
          </div>
        </Stage>
      )}

      {screen === "album" && (
        <Stage>
          <Header title={`Álbum · ${teams.find((t) => t.id === albumTeamId)?.name || ""}`} onBack={() => setScreen("scoreboard")} />
          {(teams.find((t) => t.id === albumTeamId)?.album || []).length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
              <span style={{ fontSize: 36 }}>🎴</span>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Todavía no hay figuritas. ¡Acierten una canción para empezar a coleccionar!</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, paddingBottom: 24 }}>
              {(teams.find((t) => t.id === albumTeamId)?.album || []).map((f) => {
                const rarityColor = f.rarity === "brillante" ? C.gold : f.rarity === "rara" ? C.teal : "rgba(255,255,255,0.3)";
                const background = f.rarity === "brillante"
                  ? `linear-gradient(160deg, #2a1a4a, #150C2E 60%)`
                  : f.rarity === "rara"
                  ? `linear-gradient(160deg, #163a3a, #150C2E 60%)`
                  : `linear-gradient(160deg, #241a38, #150C2E 60%)`;
                return (
                  <div key={f.id} style={{
                    position: "relative", overflow: "hidden", borderRadius: 18, padding: "3px",
                    background: `linear-gradient(135deg, ${rarityColor}, rgba(255,255,255,0.08) 60%, ${rarityColor}88)`,
                    boxShadow: f.rarity === "brillante" ? `0 0 20px -4px ${C.gold}aa` : "0 6px 16px rgba(0,0,0,0.3)",
                  }}>
                    <div style={{ borderRadius: 15, padding: 12, background, height: "100%", position: "relative", overflow: "hidden" }}>
                      {f.rarity === "brillante" && (
                        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, transparent 40%, ${C.gold}33 50%, transparent 60%)`, backgroundSize: "250% 100%", animation: "pz-shine 2.5s linear infinite" }} />
                      )}
                      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em", color: rarityColor, fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, margin: 0 }}>{f.mood}</p>
                        <span style={{ fontSize: 12 }}>{f.rarity === "brillante" ? "🌟" : f.rarity === "rara" ? "✨" : "🎵"}</span>
                      </div>
                      <p style={{ position: "relative", color: C.white, fontWeight: 800, fontSize: 14, lineHeight: 1.3, margin: 0, fontFamily: "'Baloo 2', sans-serif" }}>{f.title}</p>
                      <p style={{ position: "relative", color: "rgba(255,255,255,0.5)", fontSize: 12, margin: "2px 0 0 0" }}>{f.artist}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Stage>
      )}
    </>
  );
}
