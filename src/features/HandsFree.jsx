import React, { useEffect, useRef, useState } from "react";
import { Mic, X, Volume2, Pause, RotateCcw, Send, ListChecks } from "lucide-react";
import { Spinner } from "../ui.jsx";

export const HANDS_FREE_ADDON = `\n\nThe mechanic is using HANDS-FREE VOICE MODE: your reply will be read out loud by text-to-speech while their hands are busy on the bike. Rules for this mode:
- Plain spoken sentences only. No markdown, no bullet symbols, no headings, no tables, no emoji, no URLs.
- Keep it under about 80 words.
- For a multi-step job, give only the next one to three steps, then end with "Say next when you're ready."
- Say units the way a mechanic would say them out loud, e.g. "35 foot-pounds", "10 millimeter socket".
- Still flag uncertain torque specs briefly, e.g. "double-check that in the manual".`;

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

// Call inside the click that opens hands-free: iPhones only allow speech that starts from a tap.
export function primeSpeech() {
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    synth?.speak(u);
  } catch (e) {}
}

export function cleanForSpeech(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>|]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\bft[- .]?lbs?\b/gi, "foot-pounds")
    .replace(/\bin[- .]?lbs?\b/gi, "inch-pounds")
    .replace(/\bN[·.]?m\b/g, "newton meters")
    .replace(/\be\.g\./gi, "for example")
    .replace(/\bi\.e\./gi, "that is")
    .replace(/~\s?/g, "about ")
    .replace(/&/g, " and ")
    .replace(/([^.!?:])\n+/g, "$1. ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text, max = 180) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > max && cur) { chunks.push(cur.trim()); cur = ""; }
    cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function pickVoice() {
  const voices = synth?.getVoices?.() || [];
  const en = voices.filter((v) => /^en[-_]US/i.test(v.lang));
  return en.find((v) => /Google|Natural|Samantha|Aaron|Evan/i.test(v.name)) || en[0] || voices.find((v) => /^en/i.test(v.lang)) || null;
}

function normalize(t) {
  return t.toLowerCase().replace(/[.,!?]/g, "").replace(/\s+/g, " ").trim();
}

export default function HandsFree({ open, onClose, ask, onLogPart, contextLabel, modeLabel }) {
  const [status, setStatusState] = useState("idle"); // idle | listening | thinking | speaking | paused | error
  const [interim, setInterim] = useState("");
  const [turns, setTurns] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [typed, setTyped] = useState("");

  const statusRef = useRef("idle");
  const activeRef = useRef(false);
  const recRef = useRef(null);
  const speakIdRef = useRef(0);
  const lastAnswerRef = useRef("");
  const wakeLockRef = useRef(null);
  const askRef = useRef(ask);
  const logRef = useRef(onLogPart);
  const closeRef = useRef(onClose);
  askRef.current = ask;
  logRef.current = onLogPart;
  closeRef.current = onClose;

  const setStatus = (s) => { statusRef.current = s; setStatusState(s); };
  const addTurn = (role, text) => setTurns((t) => [...t.slice(-5), { role, text, at: Date.now() }]);

  function stopListening() {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) { rec.onend = null; rec.onresult = null; rec.onerror = null; try { rec.abort(); } catch (e) {} }
  }

  function stopSpeaking() {
    speakIdRef.current++;
    try { synth?.cancel(); } catch (e) {}
  }

  function startListening() {
    if (!SR || !activeRef.current) { if (!SR) setStatus("paused"); return; }
    stopListening();
    let finalText = "";
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else live += e.results[i][0].transcript;
      }
      setInterim((finalText + " " + live).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        activeRef.current = false;
        setErrorMsg("Microphone access is blocked. Allow the microphone for this site in your browser settings, then tap the button.");
        setStatus("error");
      } else if (e.error === "network") {
        activeRef.current = false;
        setErrorMsg("Voice recognition couldn't connect. It needs internet and works in Chrome, Edge or Safari (not the desktop app). You can still type below — answers are read out loud.");
        setStatus("error");
      } else if (e.error === "audio-capture") {
        activeRef.current = false;
        setErrorMsg("No microphone found on this device.");
        setStatus("error");
      }
      // "no-speech" and "aborted" are normal — onend restarts the loop.
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      recRef.current = null;
      if (!activeRef.current) return;
      const t = finalText.trim();
      if (t) handleUtterance(t);
      else if (statusRef.current === "listening") startListening();
    };
    recRef.current = rec;
    setInterim("");
    setErrorMsg(null);
    setStatus("listening");
    try { rec.start(); } catch (e) { setTimeout(() => activeRef.current && startListening(), 300); }
  }

  function speak(text, { thenListen = true } = {}) {
    const clean = cleanForSpeech(text);
    if (!synth || !clean) {
      if (thenListen && activeRef.current) startListening(); else setStatus("paused");
      return;
    }
    stopSpeaking();
    const myId = ++speakIdRef.current;
    const chunks = chunkText(clean);
    const voice = pickVoice();
    setStatus("speaking");
    chunks.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c);
      if (voice) u.voice = voice;
      u.rate = 1.03;
      if (i === chunks.length - 1) {
        const done = () => {
          if (speakIdRef.current !== myId) return;
          if (thenListen && activeRef.current) startListening();
          else setStatus("paused");
        };
        u.onend = done;
        u.onerror = done;
      }
      synth.speak(u);
    });
  }

  async function handleUtterance(text) {
    setInterim("");
    const cmd = normalize(text);
    if (/^(stop|pause|quiet|be quiet|hold on|wait)$/.test(cmd)) {
      stopSpeaking();
      activeRef.current = false;
      setStatus("paused");
      return;
    }
    if (/^(exit|close|done|goodbye|exit hands free|close hands free|turn off hands free)$/.test(cmd)) {
      closeRef.current();
      return;
    }
    if (/^(repeat|repeat that|say that again|say again|what did you say)$/.test(cmd)) {
      if (lastAnswerRef.current) speak(lastAnswerRef.current);
      else speak("Nothing to repeat yet.");
      return;
    }
    const log = text.trim().match(/^(log|logged|removed|remove|took off|pulled off|pulled)\s+(.+)$/i);
    if (log) {
      const name = log[2].replace(/[.!?]+$/, "").trim();
      const pretty = name.charAt(0).toUpperCase() + name.slice(1);
      logRef.current(pretty);
      addTurn("log", pretty);
      speak(`Logged ${pretty}.`);
      return;
    }
    addTurn("user", text);
    setStatus("thinking");
    let answer = null;
    try { answer = await askRef.current(text); } catch (e) { answer = null; }
    if (!activeRef.current && statusRef.current !== "thinking") return;
    if (!answer) {
      speak("Sorry, I couldn't reach the assistant. Try asking again.");
      return;
    }
    addTurn("assistant", answer);
    lastAnswerRef.current = answer;
    speak(answer);
  }

  function onBigButton() {
    const s = statusRef.current;
    if (s === "thinking") return;
    if (s === "speaking") {
      stopSpeaking();
      activeRef.current = true;
      startListening();
      return;
    }
    if (s === "listening") {
      activeRef.current = false;
      stopListening();
      setStatus("paused");
      return;
    }
    activeRef.current = true;
    if (SR) startListening();
  }

  function submitTyped(e) {
    e.preventDefault();
    const t = typed.trim();
    if (!t || statusRef.current === "thinking") return;
    setTyped("");
    stopListening();
    stopSpeaking();
    activeRef.current = !!SR;
    handleUtterance(t);
  }

  useEffect(() => {
    if (!open) return;
    activeRef.current = true;
    setTurns([]);
    lastAnswerRef.current = "";
    (async () => {
      try { wakeLockRef.current = await navigator.wakeLock?.request("screen"); } catch (e) {}
    })();
    if (SR) speak("Hands-free on. Go ahead.");
    else setStatus("paused");
    return () => {
      activeRef.current = false;
      stopListening();
      stopSpeaking();
      try { wakeLockRef.current?.release(); } catch (e) {}
      wakeLockRef.current = null;
      setStatus("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const label = {
    idle: "Starting…",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking — tap to interrupt",
    paused: SR ? "Paused — tap to talk" : "Type below — answers are read out loud",
    error: "Tap to try again",
  }[status];

  const ring = status === "listening" ? "tt-ring-listen" : status === "speaking" ? "tt-ring-speak" : "";
  const lastAnswer = [...turns].reverse().find((t) => t.role === "assistant");
  const lastUser = [...turns].reverse().find((t) => t.role === "user" || t.role === "log");

  return (
    <div className="fixed inset-0 z-50 flex flex-col tt-root" style={{ backgroundColor: "#050505", backgroundImage: "radial-gradient(ellipse 70% 45% at 50% 38%, rgba(225,6,0,0.18), transparent 70%)", color: "var(--offwhite)" }}>
      <style>{`
        @keyframes tt-pulse { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(1.55); opacity: 0 } }
        @keyframes tt-wave { 0%,100% { transform: scale(1) } 50% { transform: scale(1.06) } }
        .tt-ring-listen::before, .tt-ring-listen::after { content: ""; position: absolute; inset: 0; border-radius: 9999px; border: 2px solid var(--mw-red); animation: tt-pulse 1.6s ease-out infinite; }
        .tt-ring-listen::after { animation-delay: .8s; }
        .tt-ring-speak { animation: tt-wave 1.1s ease-in-out infinite; }
      `}</style>

      <div className="flex items-center justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="min-w-0 flex items-center gap-3">
          <img src="/logo-wordmark-sm.webp" alt="Throttle Tech" className="h-8 w-auto shrink-0" draggable="false" />
          <div className="min-w-0">
          <p className="text-sm font-bold leading-none tracking-widest uppercase" style={{ color: "var(--mw-red)" }}>Hands-free</p>
          <p className="text-xs mt-1 truncate" style={{ color: "var(--steel)" }}>{modeLabel} mode · {contextLabel}</p>
        </div>
        </div>
        <button onClick={onClose} aria-label="Exit hands-free" className="tt-btn flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}>
          <X size={16} /> Exit
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 min-h-0">
        <button
          onClick={onBigButton}
          aria-label={label}
          className={`tt-btn relative w-44 h-44 sm:w-52 sm:h-52 rounded-full flex items-center justify-center shrink-0 ${ring}`}
          style={{
            backgroundColor: status === "listening" || status === "speaking" ? "var(--mw-red)" : "var(--panel)",
            border: `2px solid ${status === "paused" || status === "error" || status === "idle" ? "var(--panel-border)" : "var(--mw-red)"}`,
            boxShadow: status === "listening" || status === "speaking" ? "0 0 80px rgba(225,6,0,0.45)" : "none",
          }}
        >
          {status === "thinking" ? <Spinner size={64} /> : status === "speaking" ? <Volume2 size={64} color="#fff" /> : status === "paused" || status === "error" ? <Mic size={64} style={{ color: "var(--steel)" }} /> : <Mic size={64} color="#fff" />}
        </button>
        <p className="text-lg font-semibold text-center" style={{ color: status === "error" ? "var(--caution)" : "var(--offwhite)" }}>{label}</p>
        {errorMsg && <p className="text-sm text-center max-w-md" style={{ color: "var(--steel)" }}>{errorMsg}</p>}
        {!SR && <p className="text-sm text-center max-w-md" style={{ color: "var(--steel)" }}>Voice input isn't available in this browser. Use Chrome, Edge or Safari for talk-to-ask — typed questions still get spoken answers.</p>}

        <div className="w-full max-w-2xl flex flex-col gap-3 min-h-0 overflow-y-auto">
          {interim ? (
            <p className="text-2xl sm:text-3xl font-semibold text-center leading-snug">"{interim}"</p>
          ) : lastUser ? (
            <p className="text-base text-center" style={{ color: "var(--steel)" }}>
              {lastUser.role === "log" ? <span className="inline-flex items-center gap-1.5"><ListChecks size={15} style={{ color: "#22C55E" }} /> Logged to Track list: <b style={{ color: "var(--offwhite)" }}>{lastUser.text}</b></span> : <>You: "{lastUser.text}"</>}
            </p>
          ) : null}
          {lastAnswer && !interim && (
            <div className="rounded-2xl px-5 py-4 text-lg sm:text-xl leading-relaxed" style={{ backgroundColor: "rgba(22,22,22,0.85)", border: "1px solid var(--panel-border)" }}>
              {cleanForSpeech(lastAnswer.text)}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 flex flex-col gap-3 items-center">
        <div className="flex gap-2">
          <button onClick={() => lastAnswerRef.current && speak(lastAnswerRef.current)} disabled={!lastAnswer || status === "thinking"} className="tt-btn inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl disabled:opacity-30" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
            <RotateCcw size={15} /> Repeat
          </button>
          <button onClick={() => { stopSpeaking(); stopListening(); activeRef.current = false; setStatus("paused"); }} disabled={status === "paused" || status === "error"} className="tt-btn inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl disabled:opacity-30" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
            <Pause size={15} /> Stop
          </button>
        </div>
        <form onSubmit={submitTyped} className="w-full max-w-2xl flex gap-2">
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type a question…" className="flex-1 min-w-0 rounded-xl px-4 py-2.5 text-sm outline-none" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }} />
          <button type="submit" disabled={!typed.trim()} aria-label="Send" className="tt-btn w-11 rounded-xl flex items-center justify-center disabled:opacity-40" style={{ backgroundColor: "var(--mw-red)" }}><Send size={16} color="#fff" /></button>
        </form>
        <p className="text-xs text-center" style={{ color: "var(--steel)" }}>
          Try: "how do I bleed the rear brake" · "next" · "log front axle nut" · "repeat" · "stop" · "exit"
        </p>
      </div>
    </div>
  );
}
