import React, { useState, useRef, useEffect } from "react";
import {
  Send, Wrench, Plus, BookMarked, MessageSquare, Copy, Check, Trash2, X, Menu,
  Camera, ImagePlus, ListChecks, Package, RotateCcw, Sparkles, CircleCheck, Circle, Upload, Info,
  GraduationCap, Zap, Stethoscope, MessageCircle, ShieldAlert,
  Store, FileText, Mic, MicOff, ChevronDown, Shield, Lock,
  Search, ExternalLink, BookmarkPlus, Database,
} from "lucide-react";

const SYSTEM_PROMPT_BASE = `You are Throttle Tech, an AI shop assistant for a motorcycle repair business that works on everything from dirt bikes and pit bikes to street bikes and sportbikes (Kawasaki, Honda, and similar makes).

Your job is to help two mechanics with:
- Removal and reinstallation steps for parts (what order, what to watch for)
- Required tools for a given job (they primarily use Milwaukee tools)
- Torque specs, fluid capacities, and service intervals when known
- General diagnostic reasoning for engine, suspension, brake, and electrical issues
- Parts lookup reasoning (part categories, what's commonly needed for a given job)

Rules:
- Always mention torque specs and safety-critical steps clearly and cautiously. If you are not certain of an exact spec, say so plainly and recommend checking the OEM service manual rather than guessing a number.
- Keep answers practical and shop-floor usable: short steps, tool call-outs, and warnings about common mistakes.
- Speak like an experienced, no-nonsense mechanic talking to another mechanic. Confident, direct, no fluff.
- If asked about something outside mechanical/shop scope, answer briefly and steer back to the shop.`;

const SHOP_SYSTEM_ADDON = `\n\nYou are now in SHOP ASSISTANT mode. The mechanic has sent you one or more photos of a bike or part they're currently working on, along with a description of what they want to do (fix, change, upgrade, diagnose, etc). Structure your answer as:
1. What you can see in the photo(s) — identify the bike/part/component as specifically as you can. If you're not confident about the exact model or part, say so rather than guessing.
2. Tools needed — call out Milwaukee tools where applicable, plus anything else required.
3. Step-by-step how to do it.
4. Parts they may need to order, if any.
5. Any safety warnings relevant to this specific job.
Keep it practical and shop-floor usable.`;

const STARTER_PROMPTS = [
  "What tools do I need to pull a countershaft sprocket?",
  "Steps to bleed front brakes on a dirt bike",
  "Torque spec for a rear axle nut, ballpark",
];

const BIKE_CONTEXTS = ["General", "Dirt Bike", "Off-Road / Dual Sport", "Street / Sportbike", "Custom..."];

const MODE_LIST = [
  { id: "beginner", label: "Beginner" },
  { id: "pro", label: "Pro" },
  { id: "diagnostic", label: "Diagnostic" },
  { id: "quickref", label: "Quick Ref" },
  { id: "customer", label: "Customer" },
  { id: "safety", label: "Safety Check" },
];

const MODE_PROMPTS = {
  beginner: `\n\nThe person asking is a BEGINNER mechanic. Adjust your answers accordingly:
- Define any part name, tool, or term the first time you use it (e.g. "the countershaft sprocket (the small sprocket on the engine side, under the front sprocket cover)").
- Explain WHY a step matters, not just what to do — beginners follow instructions better when they understand the reasoning.
- Spell out obvious-seeming safety steps explicitly (e.g. "make sure the bike is on a stand and can't tip before you start").
- Break steps into smaller, more granular pieces rather than combining multiple actions into one step.
- Call out common beginner mistakes for this specific task.
- Don't assume they know what a tool looks like or how to use it — briefly describe it if it's not a common household tool.
- Keep a patient, encouraging tone. Never make someone feel dumb for asking something basic.`,
  pro: `\n\nThe person asking is an EXPERIENCED mechanic. Keep it tight and efficient:
- Skip basic definitions and obvious safety reminders — assume competence.
- Use standard shop terminology and abbreviations freely.
- Get straight to specs, steps, and gotchas without hand-holding.`,
  diagnostic: `\n\nSwitch into DIAGNOSTIC mode. This is for troubleshooting, not a known repair:
- Do NOT jump straight to an answer. First ask 1-3 sharp clarifying questions if the symptom description is ambiguous (when does it happen, any recent work done, sounds/smells/warning lights, hot vs cold, etc.) — unless the person has already given enough detail to narrow it down.
- Once you have enough info, walk through a logical elimination process: most likely cause first, with a quick way to test/confirm it, before moving to less likely causes.
- Keep it systematic — like a flowchart in words. Don't list 10 possible causes with no order or way to narrow them down.
- Note which checks are free/quick (visual inspection, wiggle test) vs which require teardown, so they check the easy stuff first.`,
  quickref: `\n\nSwitch into QUICK REFERENCE mode. The person needs a fast answer, not a tutorial:
- Lead with the number, spec, or fact they need in the first line.
- Use short bullet points only. No intro sentences, no "here's how" preamble, no explanations unless truly essential.
- Max brevity. If they want more detail they'll ask.
- Still flag if a spec is uncertain and should be manual-checked, but do it in as few words as possible (e.g. "~unverified, check manual").`,
  customer: `\n\nSwitch into CUSTOMER EXPLANATION mode. The output is meant to be read or paraphrased to a paying customer who is NOT a mechanic:
- Zero jargon. If you must use a technical term, immediately explain it in plain language.
- Focus on: what's wrong, why it matters (what happens if it's not fixed), roughly what's involved in fixing it. Do not include internal shop details like specific tool names or torque specs — the customer doesn't need those.
- Keep a reassuring, professional tone — like explaining to someone who is a little worried about cost and doesn't want to feel talked down to.
- Keep it short enough to read comfortably out loud or paste into a text message.`,
  safety: `\n\nSwitch into SAFETY CHECK mode. This is for a job with real injury or failure risk (brakes, suspension, wheels, anything load-bearing or safety-critical):
- Lead with PPE and setup requirements (stand/lift stability, eye protection, etc.) before any steps.
- Flag every torque spec, and be explicit that under- or over-torquing on this type of part can cause a failure while riding — no casual tone here.
- Call out any step where doing it wrong is dangerous, not just wrong, and say what the failure mode looks like.
- Recommend a second person double-check safety-critical fasteners/assemblies before the bike goes back to the customer.
- Do not soften or skip a warning to keep the answer short — safety mode prioritizes completeness over brevity.`,
};

const PACKOUT_TIP =
  "Store every bolt, nut, washer, and small part in a labeled Milwaukee Packout bin or tray as you remove it. Label it with the job name so nothing gets lost or mixed up with another bike.";

const SHOP_STATUS_OPTIONS = [
  { id: "open", label: "Open — Taking New Jobs", color: "#4C8B4C" },
  { id: "appointment", label: "By Appointment Only", color: "#A0692F" },
  { id: "full", label: "Full — Not Taking New Work", color: "#C1272D" },
];

const JOB_STATUSES = ["Quoted", "Waiting on Parts", "In Progress", "Ready for Pickup", "Closed"];

const ESTIMATE_SYSTEM_ADDON = `\n\nYou are now generating a customer-facing ESTIMATE. Given the job details provided, produce a clean, itemized estimate:
- A short 1-2 sentence summary of the work in plain English (no jargon).
- A bulleted list of likely line items (labor, parts, anything else), each with a rough description. If you don't have exact pricing, say "price TBD" rather than inventing a number — never fabricate a dollar figure.
- A closing line noting this is a preliminary estimate and final pricing may vary once the bike is inspected.
Keep it professional, friendly, and ready to hand or read directly to a customer.`;

const PART_FINDER_SYSTEM_ADDON = `\n\nYou are now in PART FINDER mode. The mechanic is trying to identify or source a specific part for a specific bike. Structure your answer as:
1. Confirm what part you understand they're looking for, for the bike described.
2. If a specific OEM or common aftermarket part number is well-known and you're genuinely confident in it, give it — but say plainly when you're not fully certain, and always recommend confirming against the parts diagram/VIN before ordering. NEVER state a part number confidently if you're just guessing — say "check the parts fiche for your exact part number" instead of inventing one.
3. Note common cross-reference/compatibility info if relevant (e.g. "this often fits several years of the same model").
4. If the mechanic's own parts memory (provided below, if any) has a matching entry, lead with that — it's more reliable than general knowledge since it's this shop's own sourcing history.
Keep it tight and shop-floor usable, not a wall of text.`;

const PART_RETAILERS = [
  { name: "RockyMountainATVMC", domain: "rockymountainatvmc.com" },
  { name: "PartsUnlimited", domain: "parts-unlimited.com" },
  { name: "Partzilla", domain: "partzilla.com" },
  { name: "RevZilla", domain: "revzilla.com" },
  { name: "BikeBandit", domain: "bikebandit.com" },
];

function buildSmartLinks(bike, part) {
  const q = `${bike} ${part}`.trim();
  if (!q) return [];
  const links = PART_RETAILERS.map((r) => ({
    label: r.name,
    url: `https://www.google.com/search?q=${encodeURIComponent(`site:${r.domain} ${q}`)}`,
  }));
  links.push({
    label: "General web search",
    url: `https://www.google.com/search?q=${encodeURIComponent(`${q} part number`)}`,
  });
  return links;
}

const SHOP_LOCATIONS = [
  { code: "MO", label: "Missouri" },
  { code: "MN", label: "Minnesota" },
  { code: "OTHER", label: "Other" },
];

const COMPANY_CODE = "cjshops";
const ADMIN_CODE = "cjmechsshop";

async function hashPassword(pw) {
  try {
    const enc = new TextEncoder().encode(pw);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    return "plain:" + pw; // fallback if SubtleCrypto unavailable — keeps the app functional, not secure
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function ControlsRow({ mode, setMode, bikeContext, setBikeContext, customContext, setCustomContext }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-2)" }}>
      <span className="text-[10px] shrink-0" style={{ color: "var(--steel)" }}>MODE:</span>
      <div className="flex rounded overflow-x-auto text-[11px] font-medium shrink-0" style={{ border: "1px solid var(--panel-border)" }}>
        {MODE_LIST.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="tt-btn px-2.5 py-1 whitespace-nowrap"
            style={{
              backgroundColor: mode === m.id ? "var(--caution)" : "var(--panel)",
              color: mode === m.id ? "#161616" : "var(--steel)",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <span className="text-[10px] ml-2 shrink-0" style={{ color: "var(--steel)" }}>BIKE:</span>
      <select
        value={bikeContext}
        onChange={(e) => setBikeContext(e.target.value)}
        className="text-xs rounded px-2 py-1.5 outline-none"
        style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
      >
        {BIKE_CONTEXTS.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      {bikeContext === "Custom..." && (
        <input
          value={customContext}
          onChange={(e) => setCustomContext(e.target.value)}
          placeholder="e.g. 2023 KX450F"
          className="text-xs rounded px-2 py-1.5 outline-none w-32"
          style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
        />
      )}
    </div>
  );
}

function MicButton({ onTranscript, size = 16 }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setSupported(false);
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      onTranscript(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      try { recognition.stop(); } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    if (!supported || !recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (e) {}
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Stop listening" : "Speak instead of typing"}
      className="tt-btn flex items-center justify-center w-10 h-10 rounded shrink-0"
      style={{
        backgroundColor: listening ? "var(--mw-red)" : "var(--panel)",
        border: "1px solid var(--panel-border)",
        animation: listening ? "tt-blink 1s ease-in-out infinite" : "none",
      }}
    >
      {listening ? <Mic size={size} color="#fff" /> : <Mic size={size} style={{ color: "var(--steel)" }} />}
    </button>
  );
}

export default function ThrottleTech() {
  // auth state
  const [authChecked, setAuthChecked] = useState(false);
  const [session, setSession] = useState(null); // { shopId, shopName, shopState }
  const [shopsRegistry, setShopsRegistry] = useState([]);
  const [authView, setAuthView] = useState("signin"); // 'signin' | 'signup'
  const [signInShopId, setSignInShopId] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInMasterCode, setSignInMasterCode] = useState("");
  const [signInError, setSignInError] = useState(null);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signUpName, setSignUpName] = useState("");
  const [signUpStateCode, setSignUpStateCode] = useState("MO");
  const [signUpCustomState, setSignUpCustomState] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirm, setSignUpConfirm] = useState("");
  const [signUpMasterCode, setSignUpMasterCode] = useState("");
  const [signUpError, setSignUpError] = useState(null);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [shopDataLoaded, setShopDataLoaded] = useState(false);

  // admin panel state
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState("");
  const [adminError, setAdminError] = useState(null);
  const [adminShops, setAdminShops] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // part finder state
  const [pfBike, setPfBike] = useState("");
  const [pfQuery, setPfQuery] = useState("");
  const [pfLoading, setPfLoading] = useState(false);
  const [pfError, setPfError] = useState(null);
  const [pfResult, setPfResult] = useState(null);
  const [pfView, setPfView] = useState("search"); // 'search' | 'memory'
  const [partsMemory, setPartsMemory] = useState([]);
  const [pfMemorySearch, setPfMemorySearch] = useState("");
  const [pfSaveOpen, setPfSaveOpen] = useState(false);
  const [pfSavePartNumber, setPfSavePartNumber] = useState("");
  const [pfSaveSource, setPfSaveSource] = useState("");
  const [pfSavePrice, setPfSavePrice] = useState("");
  const [pfSaveNotes, setPfSaveNotes] = useState("");
  const [pfSavedFlag, setPfSavedFlag] = useState(false);

  const [activeTab, setActiveTab] = useState("chat"); // 'chat' | 'shop' | 'track'

  // shared context
  const [mode, setMode] = useState("beginner");
  const [bikeContext, setBikeContext] = useState("General");
  const [customContext, setCustomContext] = useState("");

  // chat tab state
  const [threads, setThreads] = useState({});
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [sidebarView, setSidebarView] = useState("chat"); // 'chat' | 'notes'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [chatImages, setChatImages] = useState([]); // {id, dataUrl, mediaType, base64}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const scrollRef = useRef(null);
  const chatFileInputRef = useRef(null);

  // shop assistant tab state
  const [shopFiles, setShopFiles] = useState([]); // {id, dataUrl, mediaType, base64}
  const [shopPrompt, setShopPrompt] = useState("");
  const [shopLoading, setShopLoading] = useState(false);
  const [shopError, setShopError] = useState(null);
  const [shopResult, setShopResult] = useState(null);
  const [shopHistory, setShopHistory] = useState([]);
  const [shopSavedFlag, setShopSavedFlag] = useState(false);
  const fileInputRef = useRef(null);

  // track assistant tab state
  const [jobLabel, setJobLabel] = useState("");
  const [trackItems, setTrackItems] = useState([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemNotes, setNewItemNotes] = useState("");
  const [trackAiLoading, setTrackAiLoading] = useState(false);
  const [trackAiError, setTrackAiError] = useState(null);
  const [trackSuggestion, setTrackSuggestion] = useState(null);

  // shop board tab state
  const [shopStatus, setShopStatusState] = useState("open");
  const [jobs, setJobs] = useState([]);
  const [newJobCustomer, setNewJobCustomer] = useState("");
  const [newJobBike, setNewJobBike] = useState("");
  const [newJobNotes, setNewJobNotes] = useState("");
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [estimatingJobId, setEstimatingJobId] = useState(null);
  const [estimateError, setEstimateError] = useState(null);

  const messages = activeThreadId && threads[activeThreadId] ? threads[activeThreadId].messages : [];

  const shopKey = (key) => (session ? `${session.shopId}::${key}` : key);

  // Check for an existing session + load the shop registry on mount
  useEffect(() => {
    (async () => {
      try {
        const [registryRes, sessionRes] = await Promise.all([
          window.storage.get("shops-registry", true).catch(() => null),
          window.storage.get("session").catch(() => null),
        ]);
        const registry = registryRes ? JSON.parse(registryRes.value) : [];
        setShopsRegistry(registry);
        if (sessionRes) {
          const s = JSON.parse(sessionRes.value);
          const shop = registry.find((sh) => sh.id === s.shopId);
          if (shop) {
            setSession({ shopId: shop.id, shopName: shop.name, shopState: shop.stateLabel });
          }
        }
      } catch (e) {
        console.error("Auth check error", e);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  // Load this shop's data once signed in
  useEffect(() => {
    if (!session) return;
    setShopDataLoaded(false);
    (async () => {
      try {
        const [threadsRes, notesRes, shopHistRes, trackRes, boardRes, partsMemRes] = await Promise.all([
          window.storage.get(`${session.shopId}::threads-index`).catch(() => null),
          window.storage.get(`${session.shopId}::shop-notes`).catch(() => null),
          window.storage.get(`${session.shopId}::shop-history`).catch(() => null),
          window.storage.get(`${session.shopId}::track-state`).catch(() => null),
          window.storage.get(`${session.shopId}::shop-board`, true).catch(() => null),
          window.storage.get(`${session.shopId}::parts-memory`, true).catch(() => null),
        ]);
        const threadIndex = threadsRes ? JSON.parse(threadsRes.value) : [];
        const loadedThreads = {};
        for (const tId of threadIndex) {
          try {
            const t = await window.storage.get(`${session.shopId}::thread:${tId}`);
            if (t) loadedThreads[tId] = JSON.parse(t.value);
          } catch (e) {}
        }
        setThreads(loadedThreads);
        setActiveThreadId(threadIndex.length > 0 ? threadIndex[threadIndex.length - 1] : null);
        setNotes(notesRes ? JSON.parse(notesRes.value) : []);
        setShopHistory(shopHistRes ? JSON.parse(shopHistRes.value) : []);
        if (trackRes) {
          const t = JSON.parse(trackRes.value);
          setJobLabel(t.jobLabel || "");
          setTrackItems(t.items || []);
        } else {
          setJobLabel("");
          setTrackItems([]);
        }
        if (boardRes) {
          const b = JSON.parse(boardRes.value);
          setShopStatusState(b.status || "open");
          setJobs(b.jobs || []);
        } else {
          setShopStatusState("open");
          setJobs([]);
        }
        setPartsMemory(partsMemRes ? JSON.parse(partsMemRes.value) : []);
      } catch (e) {
        console.error("Shop data load error", e);
      } finally {
        setShopDataLoaded(true);
      }
    })();
  }, [session]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function persistThread(threadId, updatedThread) {
    if (!session) return;
    try {
      await window.storage.set(`${session.shopId}::thread:${threadId}`, JSON.stringify(updatedThread));
      const idxRes = await window.storage.get(`${session.shopId}::threads-index`).catch(() => null);
      const idx = idxRes ? JSON.parse(idxRes.value) : [];
      if (!idx.includes(threadId)) {
        idx.push(threadId);
        await window.storage.set(`${session.shopId}::threads-index`, JSON.stringify(idx));
      }
    } catch (e) {
      console.error("Persist thread error", e);
    }
  }

  async function persistNotes(updatedNotes) {
    if (!session) return;
    try { await window.storage.set(`${session.shopId}::shop-notes`, JSON.stringify(updatedNotes)); } catch (e) {}
  }

  async function persistShopHistory(list) {
    if (!session) return;
    try { await window.storage.set(`${session.shopId}::shop-history`, JSON.stringify(list.slice(0, 30))); } catch (e) {}
  }

  async function persistTrack(label, items) {
    if (!session) return;
    try { await window.storage.set(`${session.shopId}::track-state`, JSON.stringify({ jobLabel: label, items })); } catch (e) {}
  }

  async function persistBoard(status, jobList) {
    if (!session) return;
    try { await window.storage.set(`${session.shopId}::shop-board`, JSON.stringify({ status, jobs: jobList }), true); } catch (e) {}
  }

  async function persistPartsMemory(list) {
    if (!session) return;
    try { await window.storage.set(`${session.shopId}::parts-memory`, JSON.stringify(list), true); } catch (e) {}
  }

  function startNewThread() {
    const id = uid();
    const thread = { id, title: "New chat", messages: [], updatedAt: Date.now() };
    setThreads((prev) => ({ ...prev, [id]: thread }));
    setActiveThreadId(id);
    setSidebarView("chat");
    setSidebarOpen(false);
  }

  async function deleteThread(id, e) {
    e.stopPropagation();
    const next = { ...threads };
    delete next[id];
    setThreads(next);
    if (session) {
      try {
        await window.storage.delete(`${session.shopId}::thread:${id}`);
        const idxRes = await window.storage.get(`${session.shopId}::threads-index`).catch(() => null);
        const idx = idxRes ? JSON.parse(idxRes.value) : [];
        await window.storage.set(`${session.shopId}::threads-index`, JSON.stringify(idx.filter((t) => t !== id)));
      } catch (err) {}
    }
    if (activeThreadId === id) {
      const remaining = Object.keys(next);
      setActiveThreadId(remaining.length ? remaining[remaining.length - 1] : null);
    }
  }

  // ---------- Auth handlers ----------
  function resolveStateLabel(code, custom) {
    if (code === "OTHER") return custom.trim() || "Other";
    const found = SHOP_LOCATIONS.find((s) => s.code === code);
    return found ? found.label : code;
  }

  async function handleSignUp() {
    setSignUpError(null);
    if (!signUpName.trim()) return setSignUpError("Enter a shop name.");
    if (signUpStateCode === "OTHER" && !signUpCustomState.trim()) return setSignUpError("Enter the state.");
    if (signUpPassword.length < 4) return setSignUpError("Password should be at least 4 characters.");
    if (signUpPassword !== signUpConfirm) return setSignUpError("Passwords don't match.");
    if (signUpMasterCode.trim().toLowerCase() !== COMPANY_CODE) return setSignUpError("Company code is incorrect.");

    setSignUpLoading(true);
    try {
      const registryRes = await window.storage.get("shops-registry", true).catch(() => null);
      const registry = registryRes ? JSON.parse(registryRes.value) : [];
      const stateLabel = resolveStateLabel(signUpStateCode, signUpCustomState);
      const dup = registry.find(
        (s) => s.name.toLowerCase() === signUpName.trim().toLowerCase() && s.stateLabel.toLowerCase() === stateLabel.toLowerCase()
      );
      if (dup) {
        setSignUpError("A shop with that name and state is already registered. Try signing in instead.");
        setSignUpLoading(false);
        return;
      }
      const passwordHash = await hashPassword(signUpPassword);
      const shop = { id: uid(), name: signUpName.trim(), stateCode: signUpStateCode, stateLabel, passwordHash, createdAt: Date.now() };
      const updatedRegistry = [...registry, shop];
      await window.storage.set("shops-registry", JSON.stringify(updatedRegistry), true);
      setShopsRegistry(updatedRegistry);

      const newSession = { shopId: shop.id, shopName: shop.name, shopState: shop.stateLabel };
      await window.storage.set("session", JSON.stringify({ shopId: shop.id }));
      setSession(newSession);
      setSignUpName("");
      setSignUpPassword("");
      setSignUpConfirm("");
      setSignUpCustomState("");
      setSignUpMasterCode("");
    } catch (e) {
      setSignUpError("Something went wrong registering the shop — try again.");
    } finally {
      setSignUpLoading(false);
    }
  }

  async function handleSignIn() {
    setSignInError(null);
    if (!signInShopId) return setSignInError("Choose a shop.");
    if (!signInPassword) return setSignInError("Enter the shop password.");
    if (signInMasterCode.trim().toLowerCase() !== COMPANY_CODE) return setSignInError("Company code is incorrect.");

    setSignInLoading(true);
    try {
      const registryRes = await window.storage.get("shops-registry", true).catch(() => null);
      const registry = registryRes ? JSON.parse(registryRes.value) : [];
      const shop = registry.find((s) => s.id === signInShopId);
      if (!shop) {
        setSignInError("Shop not found — try refreshing.");
        setSignInLoading(false);
        return;
      }
      const hash = await hashPassword(signInPassword);
      if (hash !== shop.passwordHash) {
        setSignInError("Wrong password for that shop.");
        setSignInLoading(false);
        return;
      }
      await window.storage.set("session", JSON.stringify({ shopId: shop.id }));
      setSession({ shopId: shop.id, shopName: shop.name, shopState: shop.stateLabel });
      setSignInPassword("");
      setSignInMasterCode("");
    } catch (e) {
      setSignInError("Something went wrong signing in — try again.");
    } finally {
      setSignInLoading(false);
    }
  }

  async function handleSignOut() {
    try { await window.storage.delete("session"); } catch (e) {}
    setSession(null);
    setActiveTab("chat");
    setThreads({});
    setActiveThreadId(null);
    setNotes([]);
    setShopHistory([]);
    setJobLabel("");
    setTrackItems([]);
    setShopStatusState("open");
    setJobs([]);
    setAdminUnlocked(false);
    setAdminCodeInput("");
    setAdminError(null);
    setPartsMemory([]);
    setPfResult(null);
    setPfBike("");
    setPfQuery("");
  }

  // ---------- Admin panel ----------
  async function refreshAdminShops() {
    setAdminLoading(true);
    try {
      const res = await window.storage.get("shops-registry", true).catch(() => null);
      setAdminShops(res ? JSON.parse(res.value) : []);
    } catch (e) {
      setAdminError("Couldn't load the shop list.");
    } finally {
      setAdminLoading(false);
    }
  }

  function handleAdminUnlock() {
    setAdminError(null);
    if (adminCodeInput.trim() !== ADMIN_CODE) {
      setAdminError("Incorrect admin code.");
      return;
    }
    setAdminUnlocked(true);
    setAdminCodeInput("");
    refreshAdminShops();
  }

  async function deleteShopEverywhere(shop) {
    setDeletingId(shop.id);
    try {
      // remove every piece of data scoped to this shop
      const listRes = await window.storage.list(`${shop.id}::`).catch(() => ({ keys: [] }));
      const keys = listRes?.keys || [];
      for (const k of keys) {
        try { await window.storage.delete(k); } catch (e) {}
      }
      // remove the shop from the registry itself
      const updatedRegistry = adminShops.filter((s) => s.id !== shop.id);
      await window.storage.set("shops-registry", JSON.stringify(updatedRegistry), true);
      setAdminShops(updatedRegistry);
      setShopsRegistry(updatedRegistry);
      setConfirmDeleteId(null);

      // if you just deleted the shop you're currently signed into, sign out
      if (session && session.shopId === shop.id) {
        await handleSignOut();
      }
    } catch (e) {
      setAdminError("Something went wrong deleting that shop — try again.");
    } finally {
      setDeletingId(null);
    }
  }

  // ---------- Part Finder ----------
  function matchingMemory(bike, part) {
    const q = `${bike} ${part}`.toLowerCase();
    const bikeWords = bike.toLowerCase().split(/\s+/).filter(Boolean);
    return partsMemory.filter((m) => {
      const hay = `${m.bike} ${m.partName} ${m.partNumber || ""}`.toLowerCase();
      const bikeMatch = bikeWords.length === 0 || bikeWords.some((w) => w.length > 1 && hay.includes(w));
      const partMatch = !part.trim() || hay.includes(part.toLowerCase().split(/\s+/)[0] || "");
      return bikeMatch && partMatch;
    });
  }

  async function askPartFinder() {
    if (!pfQuery.trim() || pfLoading) return;
    setPfLoading(true);
    setPfError(null);
    setPfResult(null);
    setPfSaveOpen(false);
    setPfSavedFlag(false);

    try {
      const memHits = matchingMemory(pfBike, pfQuery).slice(0, 5);
      const memNote = memHits.length
        ? `\n\nThis shop's own parts memory has these possibly-relevant past entries:\n${memHits
            .map((m) => `- ${m.bike}: ${m.partName}${m.partNumber ? ` (#${m.partNumber})` : ""}${m.source ? `, sourced from ${m.source}` : ""}${m.price ? ` for $${m.price}` : ""}`)
            .join("\n")}`
        : "";

      const prompt = `Bike: ${pfBike || "not specified"}\nLooking for: ${pfQuery.trim()}`;
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 900,
          system: SYSTEM_PROMPT_BASE + PART_FINDER_SYSTEM_ADDON + memNote,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok) throw new Error("Request failed: " + response.status);
      const data = await response.json();
      const textBlocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      setPfResult(textBlocks || "No response.");
    } catch (err) {
      setPfError("Stripped a bolt on that request — try again.");
    } finally {
      setPfLoading(false);
    }
  }

  async function savePartToMemory() {
    if (!pfQuery.trim()) return;
    const record = {
      id: uid(),
      bike: pfBike.trim(),
      partName: pfQuery.trim(),
      partNumber: pfSavePartNumber.trim(),
      source: pfSaveSource.trim(),
      price: pfSavePrice.trim(),
      notes: pfSaveNotes.trim(),
      savedAt: Date.now(),
    };
    const updated = [record, ...partsMemory];
    setPartsMemory(updated);
    persistPartsMemory(updated);
    setPfSaveOpen(false);
    setPfSavePartNumber("");
    setPfSaveSource("");
    setPfSavePrice("");
    setPfSaveNotes("");
    setPfSavedFlag(true);
    setTimeout(() => setPfSavedFlag(false), 1800);
  }

  function deleteMemoryItem(id) {
    const updated = partsMemory.filter((m) => m.id !== id);
    setPartsMemory(updated);
    persistPartsMemory(updated);
  }

  function contextLabel() {
    if (bikeContext === "Custom..." && customContext.trim()) return customContext.trim();
    if (bikeContext === "Custom...") return "General";
    return bikeContext;
  }

  async function sendMessage(text, imagesOverride) {
    const content = text.trim();
    const images = imagesOverride !== undefined ? imagesOverride : chatImages;
    if ((!content && images.length === 0) || loading) return;

    let threadId = activeThreadId;
    let currentThread = threadId ? threads[threadId] : null;
    if (!threadId || !currentThread) {
      threadId = uid();
      const title = content ? content.slice(0, 40) : "Part ID";
      currentThread = { id: threadId, title, messages: [], updatedAt: Date.now() };
      setActiveThreadId(threadId);
    }

    const userMsg = {
      id: uid(),
      role: "user",
      content: content || "What is this part?",
      images: images.map((im) => ({ dataUrl: im.dataUrl, mediaType: im.mediaType, base64: im.base64 })),
    };

    const newMessages = [...currentThread.messages, userMsg];
    const updatedThread = {
      ...currentThread,
      messages: newMessages,
      title: currentThread.messages.length === 0 ? (content ? content.slice(0, 40) : "Part ID") : currentThread.title,
      updatedAt: Date.now(),
    };
    setThreads((prev) => ({ ...prev, [threadId]: updatedThread }));
    setInput("");
    setChatImages([]);
    setLoading(true);
    setError(null);

    try {
      const ctxNote = `\n\nCurrent job context: working on a ${contextLabel()} bike.`;
      const expNote = MODE_PROMPTS[mode] || "";
      const idNote = images.length > 0
        ? `\n\nThe mechanic has sent a photo of a part, bolt, or component and wants to know what it is. Identify it as specifically as you can (name, where it's typically used, what it does). If you're not fully certain, say what you're confident about and what's a best guess. Keep it brief unless they asked for more.`
        : "";

      const apiMessages = newMessages.map((m) => {
        if (m.images && m.images.length > 0) {
          return {
            role: m.role,
            content: [
              ...m.images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.mediaType, data: im.base64 } })),
              { type: "text", text: m.content },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: SYSTEM_PROMPT_BASE + ctxNote + expNote + idNote,
          messages: apiMessages,
        }),
      });

      if (!response.ok) throw new Error("Request failed: " + response.status);

      const data = await response.json();
      const textBlocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");

      const finalMessages = [...newMessages, { id: uid(), role: "assistant", content: textBlocks || "No response." }];
      const finalThread = { ...updatedThread, messages: finalMessages, updatedAt: Date.now() };
      setThreads((prev) => ({ ...prev, [threadId]: finalThread }));
      persistThread(threadId, finalThread);
    } catch (err) {
      setError("Stripped a bolt on that request — try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleChatFileSelect(fileList) {
    const files = Array.from(fileList).slice(0, 2 - chatImages.length);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(",")[1];
        setChatImages((prev) => [...prev, { id: uid(), dataUrl, mediaType: file.type, base64 }].slice(0, 2));
      };
      reader.readAsDataURL(file);
    });
  }

  function removeChatImage(id) {
    setChatImages((prev) => prev.filter((f) => f.id !== id));
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  async function copyMessage(msg) {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {}
  }

  async function saveAsNote(text, label) {
    const note = { id: uid(), text, bikeContext: label || contextLabel(), createdAt: Date.now() };
    const updated = [note, ...notes];
    setNotes(updated);
    persistNotes(updated);
  }

  async function saveMsgAsNote(msg) {
    await saveAsNote(msg.content);
    setSavedId(msg.id);
    setTimeout(() => setSavedId(null), 1500);
  }

  async function deleteNote(id) {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    persistNotes(updated);
  }

  const threadList = Object.values(threads).sort((a, b) => b.updatedAt - a.updatedAt);

  // ---------- Shop Assistant handlers ----------
  function handleFileSelect(fileList) {
    const files = Array.from(fileList).slice(0, 3 - shopFiles.length);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(",")[1];
        setShopFiles((prev) => [...prev, { id: uid(), dataUrl, mediaType: file.type, base64 }].slice(0, 3));
      };
      reader.readAsDataURL(file);
    });
  }

  function removeShopFile(id) {
    setShopFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function analyzeShopRequest() {
    if (!shopPrompt.trim() || shopLoading) return;
    setShopLoading(true);
    setShopError(null);
    setShopResult(null);
    setShopSavedFlag(false);

    try {
      const contentBlocks = [
        ...shopFiles.map((f) => ({
          type: "image",
          source: { type: "base64", media_type: f.mediaType, data: f.base64 },
        })),
        { type: "text", text: shopPrompt.trim() },
      ];

      const ctxNote = `\n\nCurrent job context: working on a ${contextLabel()} bike.`;
      const expNote = MODE_PROMPTS[mode] || "";

      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: SYSTEM_PROMPT_BASE + SHOP_SYSTEM_ADDON + ctxNote + expNote,
          messages: [{ role: "user", content: contentBlocks }],
        }),
      });

      if (!response.ok) throw new Error("Request failed: " + response.status);
      const data = await response.json();
      const textBlocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const result = textBlocks || "No response.";
      setShopResult(result);

      const histEntry = { id: uid(), prompt: shopPrompt.trim(), response: result, createdAt: Date.now(), imageCount: shopFiles.length };
      const updatedHist = [histEntry, ...shopHistory];
      setShopHistory(updatedHist);
      persistShopHistory(updatedHist);
    } catch (err) {
      setShopError("Stripped a bolt on that request — try again.");
    } finally {
      setShopLoading(false);
    }
  }

  function saveShopResultAsNote() {
    if (!shopResult) return;
    saveAsNote(shopResult);
    setShopSavedFlag(true);
    setTimeout(() => setShopSavedFlag(false), 1500);
  }

  function resetShopForm() {
    setShopFiles([]);
    setShopPrompt("");
    setShopResult(null);
    setShopError(null);
  }

  // ---------- Shop Board handlers ----------
  function setShopStatus(status) {
    setShopStatusState(status);
    persistBoard(status, jobs);
  }

  function addJob() {
    if (!newJobCustomer.trim() && !newJobBike.trim()) return;
    const job = {
      id: uid(),
      customer: newJobCustomer.trim(),
      bike: newJobBike.trim(),
      notes: newJobNotes.trim(),
      status: "Quoted",
      createdAt: Date.now(),
      estimate: null,
    };
    const updated = [job, ...jobs];
    setJobs(updated);
    persistBoard(shopStatus, updated);
    setNewJobCustomer("");
    setNewJobBike("");
    setNewJobNotes("");
    setShowNewJobForm(false);
  }

  function updateJobStatus(id, status) {
    const updated = jobs.map((j) => (j.id === id ? { ...j, status } : j));
    setJobs(updated);
    persistBoard(shopStatus, updated);
  }

  function deleteJob(id) {
    const updated = jobs.filter((j) => j.id !== id);
    setJobs(updated);
    persistBoard(shopStatus, updated);
  }

  async function generateEstimate(job) {
    if (estimatingJobId) return;
    setEstimatingJobId(job.id);
    setEstimateError(null);
    try {
      const ctxNote = `\n\nCurrent job context: working on a ${contextLabel()} bike.`;
      const prompt = `Job details:\nCustomer: ${job.customer || "N/A"}\nBike: ${job.bike || "N/A"}\nNotes / work requested: ${job.notes || "N/A"}\n\nGenerate the estimate.`;
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM_PROMPT_BASE + ESTIMATE_SYSTEM_ADDON + ctxNote,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok) throw new Error("Request failed: " + response.status);
      const data = await response.json();
      const textBlocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const updated = jobs.map((j) => (j.id === job.id ? { ...j, estimate: textBlocks || "No response." } : j));
      setJobs(updated);
      persistBoard(shopStatus, updated);
    } catch (err) {
      setEstimateError("Stripped a bolt on that request — try again.");
    } finally {
      setEstimatingJobId(null);
    }
  }

  // ---------- Track Assistant handlers ----------
  function addTrackItem() {
    if (!newItemName.trim()) return;
    const item = { id: uid(), name: newItemName.trim(), notes: newItemNotes.trim(), removedAt: Date.now(), reinstalled: false };
    const updated = [item, ...trackItems];
    setTrackItems(updated);
    persistTrack(jobLabel, updated);
    setNewItemName("");
    setNewItemNotes("");
  }

  function toggleReinstalled(id) {
    const updated = trackItems.map((it) => (it.id === id ? { ...it, reinstalled: !it.reinstalled } : it));
    setTrackItems(updated);
    persistTrack(jobLabel, updated);
  }

  function deleteTrackItem(id) {
    const updated = trackItems.filter((it) => it.id !== id);
    setTrackItems(updated);
    persistTrack(jobLabel, updated);
  }

  function updateJobLabel(val) {
    setJobLabel(val);
    persistTrack(val, trackItems);
  }

  function clearJob() {
    setTrackItems([]);
    setJobLabel("");
    setTrackSuggestion(null);
    persistTrack("", []);
  }

  async function getReinstallOrder() {
    const pending = trackItems.filter((it) => !it.reinstalled);
    if (pending.length === 0 || trackAiLoading) return;
    setTrackAiLoading(true);
    setTrackAiError(null);
    setTrackSuggestion(null);

    try {
      const listText = pending
        .map((it, i) => `${i + 1}. ${it.name}${it.notes ? ` (${it.notes})` : ""}`)
        .join("\n");
      const prompt = `Here is the list of parts/bolts/hardware I've removed so far for this job${jobLabel ? ` ("${jobLabel}")` : ""}, in the order I took them off:\n${listText}\n\nGive me the recommended reinstallation order (likely reverse of removal, but flag if it's not), plus any torque specs or warnings I should keep in mind for reinstalling these.`;

      const ctxNote = `\n\nCurrent job context: working on a ${contextLabel()} bike.`;
      const expNote = MODE_PROMPTS[mode] || "";

      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1200,
          system: SYSTEM_PROMPT_BASE + ctxNote + expNote,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) throw new Error("Request failed: " + response.status);
      const data = await response.json();
      const textBlocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      setTrackSuggestion(textBlocks || "No response.");
    } catch (err) {
      setTrackAiError("Stripped a bolt on that request — try again.");
    } finally {
      setTrackAiLoading(false);
    }
  }

  const pendingCount = trackItems.filter((it) => !it.reinstalled).length;

  const NAV_TABS = [
    { id: "board", label: "Shop Board", icon: Store },
    { id: "chat", label: "Chat Assistant", icon: MessageSquare },
    { id: "shop", label: "Shop Assistant", icon: Camera },
    { id: "parts", label: "Part Finder", icon: Search },
    { id: "track", label: "Track Assistant", icon: ListChecks },
    { id: "info", label: "Info", icon: Info },
    { id: "admin", label: "Admin", icon: Shield },
  ];

  const themeVars = {
    "--asphalt": "#141110",
    "--panel": "#241E1A",
    "--panel-2": "#1B1613",
    "--panel-border": "#4A3C30",
    "--steel": "#9C948A",
    "--offwhite": "#EDE7DF",
    "--mw-red": "#C1272D",
    "--caution": "#A0692F",
  };

  const sharedStyleBlock = (
    <style>{`
      @keyframes tt-slide-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes tt-gauge-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes tt-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      .tt-msg { animation: tt-slide-in 0.22s ease-out; }
      .tt-btn { transition: transform 0.08s ease, filter 0.15s ease, background-color 0.15s ease; }
      .tt-btn:active { transform: scale(0.94); }
      .tt-btn:hover { filter: brightness(1.12); }
      .tt-rivet { width: 5px; height: 5px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #6b6b6b, #2a2a2a 70%); box-shadow: 0 0 0 1px rgba(0,0,0,0.4); }
      .tt-bg-texture {
        background-color: var(--asphalt);
        background-image:
          linear-gradient(rgba(237,231,223,0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(237,231,223,0.035) 1px, transparent 1px),
          radial-gradient(circle at 85% 8%, rgba(193,39,45,0.06), transparent 45%),
          radial-gradient(circle at 10% 92%, rgba(160,105,47,0.07), transparent 40%);
        background-size: 26px 26px, 26px 26px, 100% 100%, 100% 100%;
        background-position: -1px -1px, -1px -1px, 0 0, 0 0;
      }
      .tt-watermark { position: absolute; pointer-events: none; opacity: 0.05; right: -30px; bottom: -30px; width: 260px; height: 260px; z-index: 0; }
    `}</style>
  );

  // ---------- Auth gate: loading ----------
  if (!authChecked) {
    return (
      <div style={themeVars} className="w-full h-full min-h-[700px] flex items-center justify-center bg-[var(--asphalt)] text-[var(--offwhite)] font-sans">
        {sharedStyleBlock}
        <svg viewBox="0 0 24 24" className="w-8 h-8" style={{ animation: "tt-gauge-spin 1.4s linear infinite" }}>
          <circle cx="12" cy="12" r="9" fill="none" stroke="#3a3a3a" strokeWidth="2" />
          <circle cx="12" cy="12" r="9" fill="none" stroke="var(--caution)" strokeWidth="2" strokeLinecap="round" strokeDasharray="14 42" />
        </svg>
      </div>
    );
  }

  // ---------- Auth gate: sign in / sign up ----------
  if (!session) {
    return (
      <div style={themeVars} className="tt-bg-texture w-full h-full min-h-[700px] flex items-center justify-center px-4 py-8 relative bg-[var(--asphalt)] text-[var(--offwhite)] font-sans">
        {sharedStyleBlock}
        <Wrench className="tt-watermark" strokeWidth={0.5} color="var(--offwhite)" />
        <div className="w-full max-w-sm relative z-10">
          <div className="flex flex-col items-center gap-2 mb-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-sm" style={{ backgroundColor: "var(--mw-red)" }}>
              <Wrench size={24} color="#161616" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl leading-none tracking-tight" style={{ fontFamily: "'Arial Black', Impact, sans-serif", letterSpacing: "0.02em" }}>
              THROTTLE TECH
            </h1>
            <p className="text-[10px] tracking-widest" style={{ color: "var(--steel)" }}>SHOP ASSISTANT SUITE</p>
          </div>

          <div className="rounded-md p-5 relative" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
            <span className="tt-rivet absolute top-2 left-2" />
            <span className="tt-rivet absolute top-2 right-2" />

            <div className="flex rounded overflow-hidden text-sm font-medium mb-5" style={{ border: "1px solid var(--panel-border)" }}>
              <button
                onClick={() => { setAuthView("signin"); setSignInError(null); }}
                className="tt-btn flex-1 py-2"
                style={{ backgroundColor: authView === "signin" ? "var(--mw-red)" : "transparent", color: authView === "signin" ? "#161616" : "var(--steel)" }}
              >
                Sign In
              </button>
              <button
                onClick={() => { setAuthView("signup"); setSignUpError(null); }}
                className="tt-btn flex-1 py-2"
                style={{ backgroundColor: authView === "signup" ? "var(--mw-red)" : "transparent", color: authView === "signup" ? "#161616" : "var(--steel)" }}
              >
                Register a Shop
              </button>
            </div>

            {authView === "signin" ? (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: "var(--steel)" }}>SHOP</label>
                  {shopsRegistry.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--steel)" }}>No shops registered yet — register one under the "Register a Shop" tab.</p>
                  ) : (
                    <select
                      value={signInShopId}
                      onChange={(e) => setSignInShopId(e.target.value)}
                      className="w-full rounded px-3 py-2.5 text-sm outline-none"
                      style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                    >
                      <option value="">Choose your shop...</option>
                      {shopsRegistry.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} — {s.stateLabel}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: "var(--steel)" }}>SHOP PASSWORD</label>
                  <input
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="Shop password"
                    className="w-full rounded px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                  />
                </div>
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: "var(--steel)" }}>COMPANY CODE</label>
                  <input
                    type="password"
                    value={signInMasterCode}
                    onChange={(e) => setSignInMasterCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                    placeholder="Company code"
                    className="w-full rounded px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                  />
                </div>
                {signInError && <p className="text-sm" style={{ color: "var(--mw-red)" }}>{signInError}</p>}
                <button
                  onClick={handleSignIn}
                  disabled={signInLoading}
                  className="tt-btn w-full py-2.5 rounded font-medium text-sm disabled:opacity-50"
                  style={{ backgroundColor: "var(--mw-red)", color: "#161616" }}
                >
                  {signInLoading ? "Signing in..." : "Sign In"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: "var(--steel)" }}>SHOP NAME</label>
                  <input
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    placeholder="e.g. Throttle Tech Fairmont"
                    className="w-full rounded px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                  />
                </div>
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: "var(--steel)" }}>STATE</label>
                  <select
                    value={signUpStateCode}
                    onChange={(e) => setSignUpStateCode(e.target.value)}
                    className="w-full rounded px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                  >
                    {SHOP_LOCATIONS.map((s) => (
                      <option key={s.code} value={s.code}>{s.label}</option>
                    ))}
                  </select>
                </div>
                {signUpStateCode === "OTHER" && (
                  <input
                    value={signUpCustomState}
                    onChange={(e) => setSignUpCustomState(e.target.value)}
                    placeholder="Enter state"
                    className="w-full rounded px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                  />
                )}
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: "var(--steel)" }}>SET A SHOP PASSWORD</label>
                  <input
                    type="password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="At least 4 characters"
                    className="w-full rounded px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                  />
                </div>
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: "var(--steel)" }}>CONFIRM PASSWORD</label>
                  <input
                    type="password"
                    value={signUpConfirm}
                    onChange={(e) => setSignUpConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                  />
                </div>
                <div>
                  <label className="text-[10px] tracking-widest block mb-1" style={{ color: "var(--steel)" }}>COMPANY CODE</label>
                  <input
                    type="password"
                    value={signUpMasterCode}
                    onChange={(e) => setSignUpMasterCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
                    placeholder="Company code"
                    className="w-full rounded px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                  />
                </div>
                {signUpError && <p className="text-sm" style={{ color: "var(--mw-red)" }}>{signUpError}</p>}
                <button
                  onClick={handleSignUp}
                  disabled={signUpLoading}
                  className="tt-btn w-full py-2.5 rounded font-medium text-sm disabled:opacity-50"
                  style={{ backgroundColor: "var(--mw-red)", color: "#161616" }}
                >
                  {signUpLoading ? "Registering..." : "Register Shop & Sign In"}
                </button>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--steel)" }}>
                  Everyone at this shop will sign in with this same shop name/state and password — it's a shared
                  shop login, not an individual account. The company code confirms this shop belongs on the network.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={themeVars}
      className="w-full h-full min-h-[700px] flex bg-[var(--asphalt)] text-[var(--offwhite)] font-sans relative overflow-hidden"
    >
      {sharedStyleBlock}

      {/* Sidebar (chat tab only) */}
      {activeTab === "chat" && (
        <div
          className={`absolute md:relative z-20 h-full w-64 shrink-0 flex flex-col border-r transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
          style={{ borderColor: "var(--panel-border)", backgroundColor: "#191510" }}
        >
          <div className="p-3 flex flex-col gap-2 border-b" style={{ borderColor: "var(--panel-border)" }}>
            <button onClick={startNewThread} className="tt-btn flex items-center gap-2 text-sm px-3 py-2 rounded font-medium" style={{ backgroundColor: "var(--mw-red)", color: "#161616" }}>
              <Plus size={16} /> New chat
            </button>
            <div className="flex gap-1 text-xs">
              <button onClick={() => setSidebarView("chat")} className="tt-btn flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded" style={{ backgroundColor: sidebarView === "chat" ? "var(--panel)" : "transparent", color: sidebarView === "chat" ? "var(--offwhite)" : "var(--steel)", border: "1px solid var(--panel-border)" }}>
                <MessageSquare size={13} /> Chats
              </button>
              <button onClick={() => setSidebarView("notes")} className="tt-btn flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded" style={{ backgroundColor: sidebarView === "notes" ? "var(--panel)" : "transparent", color: sidebarView === "notes" ? "var(--offwhite)" : "var(--steel)", border: "1px solid var(--panel-border)" }}>
                <BookMarked size={13} /> Notes ({notes.length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {sidebarView === "chat" &&
              threadList.map((t) => (
                <button key={t.id} onClick={() => { setActiveThreadId(t.id); setSidebarOpen(false); }} className="group flex items-center justify-between text-left text-xs px-3 py-2 rounded" style={{ backgroundColor: activeThreadId === t.id ? "var(--panel)" : "transparent", color: activeThreadId === t.id ? "var(--offwhite)" : "var(--steel)" }}>
                  <span className="truncate">{t.title || "New chat"}</span>
                  <Trash2 size={13} className="opacity-0 group-hover:opacity-100 shrink-0 ml-2" onClick={(e) => deleteThread(t.id, e)} />
                </button>
              ))}
            {sidebarView === "chat" && threadList.length === 0 && <p className="text-xs px-3 py-2" style={{ color: "var(--steel)" }}>No chats yet.</p>}

            {sidebarView === "notes" &&
              notes.map((n) => (
                <div key={n.id} className="text-xs px-3 py-2 rounded" style={{ backgroundColor: "var(--panel)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ color: "var(--caution)" }} className="text-[10px] tracking-wide">{n.bikeContext}</span>
                    <Trash2 size={12} className="cursor-pointer opacity-60 hover:opacity-100" onClick={() => deleteNote(n.id)} />
                  </div>
                  <p className="line-clamp-4" style={{ color: "var(--offwhite)" }}>{n.text}</p>
                </div>
              ))}
            {sidebarView === "notes" && notes.length === 0 && <p className="text-xs px-3 py-2" style={{ color: "var(--steel)" }}>Save answers here for quick reference later.</p>}
          </div>
        </div>
      )}

      {activeTab === "chat" && sidebarOpen && <div className="absolute inset-0 bg-black/50 z-10 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Brand row */}
        <div
          className="relative px-4 py-3 flex items-center gap-3"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, #1a1512 0px, #1a1512 10px, #201a16 10px, #201a16 20px)" }}
        >
          <span className="tt-rivet absolute top-2 left-2 hidden sm:block" />
          <span className="tt-rivet absolute top-2 right-2 hidden sm:block" />
          {activeTab === "chat" && (
            <button className="md:hidden shrink-0" onClick={() => setSidebarOpen((s) => !s)}>
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
          <div className="flex items-center justify-center w-9 h-9 rounded-sm shrink-0" style={{ backgroundColor: "var(--mw-red)" }}>
            <Wrench size={18} color="#161616" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl leading-none tracking-tight truncate" style={{ fontFamily: "'Arial Black', Impact, sans-serif", letterSpacing: "0.02em" }}>
              THROTTLE TECH
            </h1>
            <p className="text-[10px] mt-1" style={{ color: "var(--steel)", letterSpacing: "0.08em" }}>SHOP ASSISTANT SUITE</p>
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-medium truncate max-w-[160px]" style={{ color: "var(--offwhite)" }}>{session.shopName}</span>
              <span className="text-[10px]" style={{ color: "var(--caution)" }}>{session.shopState}</span>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="tt-btn text-xs px-2.5 py-1.5 rounded border"
              style={{ borderColor: "var(--panel-border)", color: "var(--steel)" }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="flex border-b-4" style={{ borderColor: "var(--mw-red)", backgroundColor: "#191510" }}>
          {NAV_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="tt-btn flex-1 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium px-2 py-2.5"
                style={{
                  backgroundColor: active ? "var(--panel)" : "transparent",
                  color: active ? "var(--caution)" : "var(--steel)",
                  borderBottom: active ? "2px solid var(--caution)" : "2px solid transparent",
                }}
              >
                <Icon size={15} /> <span className="truncate">{t.label}</span>
                {t.id === "track" && pendingCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--mw-red)", color: "#fff" }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ===================== SHOP BOARD ===================== */}
        {activeTab === "board" && (
          <div className="tt-bg-texture relative flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
            <Store className="tt-watermark" strokeWidth={0.5} color="var(--offwhite)" />

            {/* Shop status */}
            <div>
              <p className="text-[10px] tracking-widest mb-2" style={{ color: "var(--steel)" }}>SHOP STATUS — shared, visible to anyone using this app</p>
              <div className="flex flex-col sm:flex-row gap-2">
                {SHOP_STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setShopStatus(s.id)}
                    className="tt-btn flex-1 flex items-center gap-2 px-4 py-3 rounded-md text-sm font-medium"
                    style={{
                      backgroundColor: shopStatus === s.id ? s.color : "var(--panel)",
                      color: shopStatus === s.id ? "#161616" : "var(--steel)",
                      border: `1px solid ${shopStatus === s.id ? s.color : "var(--panel-border)"}`,
                    }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: shopStatus === s.id ? "#161616" : s.color }} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* New job */}
            <div>
              {!showNewJobForm ? (
                <button
                  onClick={() => setShowNewJobForm(true)}
                  className="tt-btn flex items-center gap-2 text-sm px-4 py-2.5 rounded font-medium"
                  style={{ backgroundColor: "var(--mw-red)", color: "#161616" }}
                >
                  <Plus size={16} /> New job / project
                </button>
              ) : (
                <div className="rounded-md p-3 flex flex-col gap-2 tt-msg" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                  <p className="text-[10px] tracking-widest" style={{ color: "var(--steel)" }}>NEW JOB</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={newJobCustomer} onChange={(e) => setNewJobCustomer(e.target.value)} placeholder="Customer name" className="flex-1 rounded px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }} />
                    <input value={newJobBike} onChange={(e) => setNewJobBike(e.target.value)} placeholder="Bike — e.g. 2023 KX450F" className="flex-1 rounded px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }} />
                  </div>
                  <textarea value={newJobNotes} onChange={(e) => setNewJobNotes(e.target.value)} placeholder="What's the job? (optional)" rows={2} className="w-full resize-none rounded px-3 py-2 text-sm outline-none" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }} />
                  <div className="flex gap-2">
                    <button onClick={addJob} className="tt-btn flex items-center gap-2 text-sm px-4 py-2 rounded font-medium" style={{ backgroundColor: "var(--mw-red)", color: "#161616" }}>
                      <Plus size={15} /> Add to board
                    </button>
                    <button onClick={() => setShowNewJobForm(false)} className="tt-btn text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--panel-border)", color: "var(--steel)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Job list */}
            <div className="flex flex-col gap-3">
              {jobs.length === 0 && (
                <p className="text-sm" style={{ color: "var(--steel)" }}>
                  No jobs on the board yet. Add one above to start tracking what's in the shop.
                </p>
              )}
              {jobs.map((job) => (
                <div key={job.id} className="rounded-md p-4 flex flex-col gap-3 tt-msg" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--offwhite)" }}>{job.customer || "Unnamed customer"}</p>
                      <p className="text-xs truncate" style={{ color: "var(--steel)" }}>{job.bike || "Bike not specified"}</p>
                    </div>
                    <Trash2 size={14} className="shrink-0 opacity-50 hover:opacity-100 cursor-pointer" onClick={() => deleteJob(job.id)} />
                  </div>
                  {job.notes && <p className="text-sm" style={{ color: "var(--offwhite)" }}>{job.notes}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={job.status}
                      onChange={(e) => updateJobStatus(job.id, e.target.value)}
                      className="text-xs rounded px-2 py-1.5 outline-none"
                      style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                    >
                      {JOB_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => generateEstimate(job)}
                      disabled={estimatingJobId === job.id}
                      className="tt-btn flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium disabled:opacity-40"
                      style={{ backgroundColor: "var(--caution)", color: "#161616" }}
                    >
                      <FileText size={13} /> {job.estimate ? "Regenerate estimate" : "Generate estimate"}
                    </button>
                  </div>

                  {estimatingJobId === job.id && (
                    <div className="rounded px-3 py-2 text-xs flex items-center gap-2" style={{ backgroundColor: "var(--panel-2)" }}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ animation: "tt-gauge-spin 1.4s linear infinite" }}>
                        <circle cx="12" cy="12" r="9" fill="none" stroke="#4A3C30" strokeWidth="2" />
                        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--caution)" strokeWidth="2" strokeLinecap="round" strokeDasharray="14 42" />
                      </svg>
                      <span style={{ color: "var(--steel)" }}>Drafting estimate...</span>
                    </div>
                  )}
                  {job.estimate && estimatingJobId !== job.id && (
                    <div className="rounded px-3 py-2 text-sm whitespace-pre-wrap" style={{ backgroundColor: "var(--panel-2)", color: "var(--offwhite)" }}>
                      {job.estimate}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {estimateError && <div className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--mw-red)", color: "var(--mw-red)" }}>{estimateError}</div>}
          </div>
        )}

        {/* ===================== CHAT ASSISTANT ===================== */}
        {activeTab === "chat" && (
          <>
            <ControlsRow mode={mode} setMode={setMode} bikeContext={bikeContext} setBikeContext={setBikeContext} customContext={customContext} setCustomContext={setCustomContext} />

            <div ref={scrollRef} className="tt-bg-texture relative flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
              <Wrench className="tt-watermark" strokeWidth={0.5} color="var(--offwhite)" />
              {messages.length === 0 && (
                <div className="flex flex-col gap-3 mt-2">
                  <p className="text-sm" style={{ color: "var(--steel)" }}>
                    Ask about teardown steps, tools, torque specs, or diagnostics.
                    {contextLabel() !== "General" && <span> Context set to <b style={{ color: "var(--caution)" }}>{contextLabel()}</b>.</span>}{" "}
                    Running in <b style={{ color: "var(--caution)" }}>{MODE_LIST.find((m) => m.id === mode)?.label || mode}</b> mode.
                    {" "}Or snap a photo of a bolt or part with the <ImagePlus size={11} className="inline" style={{ verticalAlign: "-1px" }} /> icon below to ID it.
                  </p>
                  <div className="flex flex-col gap-2">
                    {STARTER_PROMPTS.map((p) => (
                      <button key={p} onClick={() => sendMessage(p)} className="tt-btn text-left text-sm px-3 py-2 rounded border transition-colors" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel)", color: "var(--offwhite)" }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={`flex tt-msg ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[85%] rounded-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                    style={m.role === "user" ? { backgroundColor: "var(--mw-red)", color: "#161616", fontWeight: 500 } : { backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                  >
                    {m.role === "assistant" && (
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] tracking-widest" style={{ color: "var(--caution)" }}>THROTTLE TECH</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => copyMessage(m)} title="Copy" className="opacity-70 hover:opacity-100">{copiedId === m.id ? <Check size={13} /> : <Copy size={13} />}</button>
                          <button onClick={() => saveMsgAsNote(m)} title="Save as shop note" className="opacity-70 hover:opacity-100">{savedId === m.id ? <Check size={13} /> : <BookMarked size={13} />}</button>
                        </div>
                      </div>
                    )}
                    {m.images && m.images.length > 0 && (
                      <div className="flex gap-1.5 mb-2">
                        {m.images.map((im, i) => (
                          <img key={i} src={im.dataUrl} alt="attached" className="w-16 h-16 object-cover rounded" style={{ border: "1px solid rgba(0,0,0,0.2)" }} />
                        ))}
                      </div>
                    )}
                    {m.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start tt-msg">
                  <div className="rounded-md px-4 py-3 text-sm flex items-center gap-3" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                    <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ animation: "tt-gauge-spin 1.4s linear infinite" }}>
                      <circle cx="12" cy="12" r="9" fill="none" stroke="#3a3a3a" strokeWidth="2" />
                      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--caution)" strokeWidth="2" strokeLinecap="round" strokeDasharray="14 42" />
                    </svg>
                    <span style={{ color: "var(--steel)" }}>Wrenching on it<span style={{ animation: "tt-blink 1.2s ease-in-out infinite" }}>...</span></span>
                  </div>
                </div>
              )}
              {error && <div className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--mw-red)", color: "var(--mw-red)" }}>{error}</div>}
            </div>

            <div className="border-t" style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-2)" }}>
              {chatImages.length > 0 && (
                <div className="flex gap-2 px-4 pt-3">
                  {chatImages.map((im) => (
                    <div key={im.id} className="relative w-14 h-14 rounded overflow-hidden border" style={{ borderColor: "var(--panel-border)" }}>
                      <img src={im.dataUrl} alt="attached" className="w-full h-full object-cover" />
                      <button onClick={() => removeChatImage(im.id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
                        <X size={10} color="#fff" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleSubmit} className="px-4 py-3 flex gap-2 items-end">
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  disabled={chatImages.length >= 2}
                  title="Attach a photo of a part or bolt"
                  className="tt-btn flex items-center justify-center w-10 h-10 rounded shrink-0 disabled:opacity-40"
                  style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}
                >
                  <ImagePlus size={16} style={{ color: "var(--steel)" }} />
                </button>
                <input ref={chatFileInputRef} type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) handleChatFileSelect(e.target.files); e.target.value = ""; }} className="hidden" />
                <MicButton onTranscript={(t) => setInput((prev) => (prev ? prev + " " : "") + t)} />
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  placeholder={chatImages.length > 0 ? "Add a note, or just send to identify it..." : "Ask about torque specs, teardown steps, parts..."}
                  rows={1}
                  className="flex-1 resize-none rounded px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                />
                <button type="submit" disabled={loading || (!input.trim() && chatImages.length === 0)} className="tt-btn flex items-center justify-center w-10 h-10 rounded shrink-0 disabled:opacity-40" style={{ backgroundColor: "var(--mw-red)" }}>
                  <Send size={16} color="#161616" />
                </button>
              </form>
            </div>
          </>
        )}

        {/* ===================== SHOP ASSISTANT ===================== */}
        {activeTab === "shop" && (
          <>
            <ControlsRow mode={mode} setMode={setMode} bikeContext={bikeContext} setBikeContext={setBikeContext} customContext={customContext} setCustomContext={setCustomContext} />
            <div className="tt-bg-texture relative flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
              <Camera className="tt-watermark" strokeWidth={0.5} color="var(--offwhite)" />
              <p className="text-sm" style={{ color: "var(--steel)" }}>
                Snap a photo of what you're working on, tell it what you need to fix, change, or upgrade, and it'll tell you the tools and steps.
              </p>

              {/* Upload area */}
              <div>
                <div className="flex gap-2 flex-wrap mb-2">
                  {shopFiles.map((f) => (
                    <div key={f.id} className="relative w-20 h-20 rounded overflow-hidden border" style={{ borderColor: "var(--panel-border)" }}>
                      <img src={f.dataUrl} alt="upload" className="w-full h-full object-cover" />
                      <button onClick={() => removeShopFile(f.id)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
                        <X size={12} color="#fff" />
                      </button>
                    </div>
                  ))}
                  {shopFiles.length < 3 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="tt-btn w-20 h-20 rounded border-2 border-dashed flex flex-col items-center justify-center gap-1"
                      style={{ borderColor: "var(--panel-border)", color: "var(--steel)" }}
                    >
                      <ImagePlus size={18} />
                      <span className="text-[10px]">Add photo</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => e.target.files && handleFileSelect(e.target.files)} className="hidden" />
                </div>
                {shopFiles.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--steel)" }}>
                    Tip: a clear photo of the part or area gets you a much more accurate answer.
                  </p>
                )}
              </div>

              <div className="flex gap-2 items-end">
                <textarea
                  value={shopPrompt}
                  onChange={(e) => setShopPrompt(e.target.value)}
                  placeholder="What do you need to do? e.g. 'Need to replace the fork seals, what's involved?' or 'Want to upgrade this exhaust, what do I need?'"
                  rows={3}
                  className="flex-1 resize-none rounded px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                />
                <MicButton onTranscript={(t) => setShopPrompt((prev) => (prev ? prev + " " : "") + t)} />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={analyzeShopRequest}
                  disabled={shopLoading || !shopPrompt.trim()}
                  className="tt-btn flex items-center gap-2 text-sm px-4 py-2.5 rounded font-medium disabled:opacity-40"
                  style={{ backgroundColor: "var(--mw-red)", color: "#161616" }}
                >
                  <Sparkles size={15} /> Analyze
                </button>
                {(shopFiles.length > 0 || shopPrompt || shopResult) && (
                  <button onClick={resetShopForm} className="tt-btn flex items-center gap-2 text-sm px-3 py-2.5 rounded border" style={{ borderColor: "var(--panel-border)", color: "var(--steel)" }}>
                    <RotateCcw size={14} /> Clear
                  </button>
                )}
              </div>

              {shopLoading && (
                <div className="rounded-md px-4 py-3 text-sm flex items-center gap-3 tt-msg" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                  <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ animation: "tt-gauge-spin 1.4s linear infinite" }}>
                    <circle cx="12" cy="12" r="9" fill="none" stroke="#3a3a3a" strokeWidth="2" />
                    <circle cx="12" cy="12" r="9" fill="none" stroke="var(--caution)" strokeWidth="2" strokeLinecap="round" strokeDasharray="14 42" />
                  </svg>
                  <span style={{ color: "var(--steel)" }}>Looking it over<span style={{ animation: "tt-blink 1.2s ease-in-out infinite" }}>...</span></span>
                </div>
              )}
              {shopError && <div className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--mw-red)", color: "var(--mw-red)" }}>{shopError}</div>}

              {shopResult && (
                <div className="rounded-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap tt-msg" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] tracking-widest" style={{ color: "var(--caution)" }}>THROTTLE TECH</span>
                    <button onClick={saveShopResultAsNote} className="flex items-center gap-1 text-[11px] opacity-80 hover:opacity-100">
                      {shopSavedFlag ? <Check size={13} /> : <BookMarked size={13} />} Save as note
                    </button>
                  </div>
                  {shopResult}
                </div>
              )}

              {shopHistory.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] tracking-widest mb-2" style={{ color: "var(--steel)" }}>RECENT LOOKUPS</p>
                  <div className="flex flex-col gap-2">
                    {shopHistory.slice(0, 5).map((h) => (
                      <div key={h.id} className="text-xs px-3 py-2 rounded" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)" }}>
                        <p className="truncate" style={{ color: "var(--offwhite)" }}>{h.prompt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===================== PART FINDER ===================== */}
        {activeTab === "parts" && (
          <div className="tt-bg-texture relative flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
            <Search className="tt-watermark" strokeWidth={0.5} color="var(--offwhite)" />

            {/* sub-nav */}
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setPfView("search")}
                className="tt-btn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded"
                style={{ backgroundColor: pfView === "search" ? "var(--panel)" : "transparent", color: pfView === "search" ? "var(--offwhite)" : "var(--steel)", border: "1px solid var(--panel-border)" }}
              >
                <Search size={13} /> Find a Part
              </button>
              <button
                onClick={() => setPfView("memory")}
                className="tt-btn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded"
                style={{ backgroundColor: pfView === "memory" ? "var(--panel)" : "transparent", color: pfView === "memory" ? "var(--offwhite)" : "var(--steel)", border: "1px solid var(--panel-border)" }}
              >
                <Database size={13} /> Parts Memory ({partsMemory.length})
              </button>
            </div>

            {pfView === "search" ? (
              <>
                <p className="text-sm" style={{ color: "var(--steel)" }}>
                  Tell it the bike and the part — it checks your shop's own sourcing history first, then asks the AI, then gives you one-click search links to real parts retailers.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={pfBike}
                    onChange={(e) => setPfBike(e.target.value)}
                    placeholder="Bike — e.g. 2019 Honda CBR650R"
                    className="flex-1 rounded px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                  />
                  <input
                    value={pfQuery}
                    onChange={(e) => setPfQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && askPartFinder()}
                    placeholder="Part — e.g. front brake pads"
                    className="flex-1 rounded px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                  />
                  <button
                    onClick={askPartFinder}
                    disabled={pfLoading || !pfQuery.trim()}
                    className="tt-btn flex items-center gap-2 text-sm px-4 py-2.5 rounded font-medium disabled:opacity-40 shrink-0"
                    style={{ backgroundColor: "var(--mw-red)", color: "#161616" }}
                  >
                    <Sparkles size={15} /> Ask
                  </button>
                </div>

                {/* live memory matches */}
                {(pfBike.trim() || pfQuery.trim()) && matchingMemory(pfBike, pfQuery).length > 0 && (
                  <div className="rounded-md px-4 py-3" style={{ backgroundColor: "rgba(160,105,47,0.12)", border: "1px solid var(--caution)" }}>
                    <p className="text-[10px] tracking-widest mb-2" style={{ color: "var(--caution)" }}>WE'VE SOURCED THIS BEFORE</p>
                    <div className="flex flex-col gap-2">
                      {matchingMemory(pfBike, pfQuery).slice(0, 4).map((m) => (
                        <div key={m.id} className="text-xs" style={{ color: "var(--offwhite)" }}>
                          <span className="font-medium">{m.bike}</span> — {m.partName}
                          {m.partNumber && <span style={{ color: "var(--steel)" }}> · #{m.partNumber}</span>}
                          {m.source && <span style={{ color: "var(--steel)" }}> · {m.source}</span>}
                          {m.price && <span style={{ color: "var(--steel)" }}> · ${m.price}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pfLoading && (
                  <div className="rounded-md px-4 py-3 text-sm flex items-center gap-3 tt-msg" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                    <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ animation: "tt-gauge-spin 1.4s linear infinite" }}>
                      <circle cx="12" cy="12" r="9" fill="none" stroke="#3a3a3a" strokeWidth="2" />
                      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--caution)" strokeWidth="2" strokeLinecap="round" strokeDasharray="14 42" />
                    </svg>
                    <span style={{ color: "var(--steel)" }}>Looking it up...</span>
                  </div>
                )}
                {pfError && <div className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--mw-red)", color: "var(--mw-red)" }}>{pfError}</div>}

                {pfResult && (
                  <div className="rounded-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap tt-msg" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] tracking-widest" style={{ color: "var(--caution)" }}>THROTTLE TECH</span>
                      <button onClick={() => setPfSaveOpen((s) => !s)} className="flex items-center gap-1 text-[11px] opacity-80 hover:opacity-100">
                        {pfSavedFlag ? <Check size={13} /> : <BookmarkPlus size={13} />} Save to Parts Memory
                      </button>
                    </div>
                    {pfResult}

                    {pfSaveOpen && (
                      <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--panel-border)" }}>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input value={pfSavePartNumber} onChange={(e) => setPfSavePartNumber(e.target.value)} placeholder="Part # (optional)" className="flex-1 rounded px-3 py-2 text-xs outline-none" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }} />
                          <input value={pfSaveSource} onChange={(e) => setPfSaveSource(e.target.value)} placeholder="Where you got it (optional)" className="flex-1 rounded px-3 py-2 text-xs outline-none" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }} />
                          <input value={pfSavePrice} onChange={(e) => setPfSavePrice(e.target.value)} placeholder="Price (optional)" className="w-full sm:w-24 rounded px-3 py-2 text-xs outline-none" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }} />
                        </div>
                        <input value={pfSaveNotes} onChange={(e) => setPfSaveNotes(e.target.value)} placeholder="Notes (optional)" className="w-full rounded px-3 py-2 text-xs outline-none" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }} />
                        <button onClick={savePartToMemory} className="tt-btn self-start flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium" style={{ backgroundColor: "var(--caution)", color: "#161616" }}>
                          <BookmarkPlus size={13} /> Save this part
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {(pfBike.trim() || pfQuery.trim()) && (
                  <div>
                    <p className="text-[10px] tracking-widest mb-2" style={{ color: "var(--steel)" }}>SEARCH REAL RETAILERS</p>
                    <div className="flex flex-wrap gap-2">
                      {buildSmartLinks(pfBike, pfQuery).map((link) => (
                        <a
                          key={link.label}
                          href={link.url}
                          target="_blank"
                          rel="noopener"
                          className="tt-btn flex items-center gap-1.5 text-xs px-3 py-2 rounded border"
                          style={{ borderColor: "var(--panel-border)", color: "var(--offwhite)", backgroundColor: "var(--panel)" }}
                        >
                          {link.label} <ExternalLink size={12} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <input
                  value={pfMemorySearch}
                  onChange={(e) => setPfMemorySearch(e.target.value)}
                  placeholder="Search saved parts..."
                  className="w-full rounded px-3 py-2.5 text-sm outline-none"
                  style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                />
                <div className="flex flex-col gap-2">
                  {partsMemory.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--steel)" }}>
                      Nothing saved yet. Every part you save from a lookup shows up here — shared across the whole shop.
                    </p>
                  ) : (
                    partsMemory
                      .filter((m) => {
                        const q = pfMemorySearch.toLowerCase();
                        if (!q) return true;
                        return `${m.bike} ${m.partName} ${m.partNumber || ""} ${m.source || ""}`.toLowerCase().includes(q);
                      })
                      .map((m) => (
                        <div key={m.id} className="rounded-md px-4 py-3 flex items-start justify-between gap-3 tt-msg" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                          <div className="min-w-0">
                            <p className="text-sm font-medium" style={{ color: "var(--offwhite)" }}>{m.partName}</p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--caution)" }}>{m.bike || "Bike not specified"}</p>
                            <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>
                              {m.partNumber && <span>#{m.partNumber}  </span>}
                              {m.source && <span>· {m.source}  </span>}
                              {m.price && <span>· ${m.price}</span>}
                            </p>
                            {m.notes && <p className="text-xs mt-1 italic" style={{ color: "var(--steel)" }}>{m.notes}</p>}
                            <p className="text-[10px] mt-1" style={{ color: "var(--steel)" }}>{new Date(m.savedAt).toLocaleDateString()}</p>
                          </div>
                          <Trash2 size={14} className="shrink-0 opacity-50 hover:opacity-100 cursor-pointer" onClick={() => deleteMemoryItem(m.id)} />
                        </div>
                      ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ===================== TRACK ASSISTANT ===================== */}
        {activeTab === "track" && (
          <div className="tt-bg-texture relative flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
            <Package className="tt-watermark" strokeWidth={0.5} color="var(--offwhite)" />
            {/* Packout reminder banner */}
            <div className="flex items-start gap-3 rounded-md px-4 py-3" style={{ backgroundColor: "rgba(255,199,44,0.12)", border: "1px solid var(--caution)" }}>
              <Package size={18} style={{ color: "var(--caution)" }} className="shrink-0 mt-0.5" />
              <p className="text-sm" style={{ color: "var(--offwhite)" }}>{PACKOUT_TIP}</p>
            </div>

            <div>
              <label className="text-[10px] tracking-widest block mb-1" style={{ color: "var(--steel)" }}>CURRENT JOB / BIKE</label>
              <input
                value={jobLabel}
                onChange={(e) => updateJobLabel(e.target.value)}
                placeholder="e.g. Front fork rebuild — 2023 KX450F"
                className="w-full rounded px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
              />
            </div>

            {/* Add item form */}
            <div className="rounded-md p-3 flex flex-col gap-2" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
              <p className="text-[10px] tracking-widest" style={{ color: "var(--steel)" }}>LOG A REMOVED PART</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTrackItem()}
                  placeholder="Part name — e.g. Front axle nut"
                  className="flex-1 rounded px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                />
                <input
                  value={newItemNotes}
                  onChange={(e) => setNewItemNotes(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTrackItem()}
                  placeholder="Notes — bolt size, torque, etc (optional)"
                  className="flex-1 rounded px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                />
                <button onClick={addTrackItem} disabled={!newItemName.trim()} className="tt-btn flex items-center justify-center gap-1 text-sm px-3 py-2 rounded font-medium disabled:opacity-40 shrink-0" style={{ backgroundColor: "var(--mw-red)", color: "#161616" }}>
                  <Plus size={15} /> Log it
                </button>
              </div>
            </div>

            {/* Items list */}
            <div className="flex flex-col gap-2">
              {trackItems.length === 0 && (
                <p className="text-sm" style={{ color: "var(--steel)" }}>
                  Nothing logged yet. As you pull parts off, add them here so nothing gets lost or forgotten during reassembly.
                </p>
              )}
              {trackItems.map((it) => (
                <div key={it.id} className="flex items-center gap-3 rounded-md px-3 py-2.5 tt-msg" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", opacity: it.reinstalled ? 0.55 : 1 }}>
                  <button onClick={() => toggleReinstalled(it.id)} className="shrink-0" title={it.reinstalled ? "Mark as still off" : "Mark as reinstalled"}>
                    {it.reinstalled ? <CircleCheck size={18} style={{ color: "var(--caution)" }} /> : <Circle size={18} style={{ color: "var(--steel)" }} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: "var(--offwhite)", textDecoration: it.reinstalled ? "line-through" : "none" }}>{it.name}</p>
                    {it.notes && <p className="text-xs truncate" style={{ color: "var(--steel)" }}>{it.notes}</p>}
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--steel)" }}>{it.reinstalled ? "Reinstalled" : "Pending"}</span>
                  <Trash2 size={14} className="shrink-0 opacity-50 hover:opacity-100 cursor-pointer" onClick={() => deleteTrackItem(it.id)} />
                </div>
              ))}
            </div>

            {trackItems.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={getReinstallOrder}
                  disabled={trackAiLoading || pendingCount === 0}
                  className="tt-btn flex items-center gap-2 text-sm px-4 py-2.5 rounded font-medium disabled:opacity-40"
                  style={{ backgroundColor: "var(--caution)", color: "#161616" }}
                >
                  <Sparkles size={15} /> Get reinstall order & warnings
                </button>
                <button onClick={clearJob} className="tt-btn flex items-center gap-2 text-sm px-3 py-2.5 rounded border" style={{ borderColor: "var(--panel-border)", color: "var(--steel)" }}>
                  <RotateCcw size={14} /> Start new job
                </button>
              </div>
            )}

            {trackAiLoading && (
              <div className="rounded-md px-4 py-3 text-sm flex items-center gap-3 tt-msg" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                <svg viewBox="0 0 24 24" className="w-6 h-6" style={{ animation: "tt-gauge-spin 1.4s linear infinite" }}>
                  <circle cx="12" cy="12" r="9" fill="none" stroke="#3a3a3a" strokeWidth="2" />
                  <circle cx="12" cy="12" r="9" fill="none" stroke="var(--caution)" strokeWidth="2" strokeLinecap="round" strokeDasharray="14 42" />
                </svg>
                <span style={{ color: "var(--steel)" }}>Working out the order<span style={{ animation: "tt-blink 1.2s ease-in-out infinite" }}>...</span></span>
              </div>
            )}
            {trackAiError && <div className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--mw-red)", color: "var(--mw-red)" }}>{trackAiError}</div>}
            {trackSuggestion && (
              <div className="rounded-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap tt-msg" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}>
                <span className="text-[10px] tracking-widest block mb-2" style={{ color: "var(--caution)" }}>THROTTLE TECH</span>
                {trackSuggestion}
              </div>
            )}
          </div>
        )}

        {/* ===================== INFO ===================== */}
        {activeTab === "info" && (
          <div className="tt-bg-texture relative flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
            <Info className="tt-watermark" strokeWidth={0.5} color="var(--offwhite)" />
            <div className="max-w-3xl relative z-10 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--offwhite)" }}>What is Throttle Tech?</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--steel)" }}>
                Throttle Tech is your shop's AI assistant — it helps with parts, tools, teardown/reassembly steps,
                diagnostics, and part identification. It's built around a shop board plus working tabs and this
                reference page. It isn't a replacement for the OEM service manual — always double-check torque specs
                and critical steps against the manual when it's available.
              </p>
            </div>

            <div>
              <h3 className="text-xs tracking-widest mb-3" style={{ color: "var(--caution)" }}>SHOP ACCOUNTS</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--steel)" }}>
                Each shop location (e.g. the MO shop and the MN shop) is registered separately with its own name,
                state, and password — this is one shared login per shop, not individual accounts per person.
                Everyone at a given shop signs in the same way: pick the shop, enter its password, and enter the
                company code. The company code is a second, company-wide code required on top of the shop password —
                for both registering a new shop and signing into an existing one — so only someone who has it can
                add or access a shop. Chats, notes, the Track Assistant list, and the Shop Board are all kept
                separate per shop, so the two locations never see each other's data. You can sign out from the
                button in the top-right of the header.
              </p>
            </div>

            {/* Tabs section */}
            <div>
              <h3 className="text-xs tracking-widest mb-3" style={{ color: "var(--caution)" }}>THE TABS</h3>
              <div className="flex flex-col gap-3">
                <div className="rounded-md p-4 flex gap-3" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                  <Store size={20} className="shrink-0 mt-0.5" style={{ color: "var(--mw-red)" }} />
                  <div>
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--offwhite)" }}>Shop Board</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--steel)" }}>
                      The big-picture view of the shop. Set your shop status (Open for new jobs / By appointment /
                      Full) so it's clear at a glance whether you're taking new work — this is shared, so both of you
                      see the same status. Add a job for each customer/bike with notes on what's being done, track its
                      status (Quoted → Waiting on Parts → In Progress → Ready for Pickup → Closed), and generate a
                      customer-friendly estimate for any job with one click.
                    </p>
                  </div>
                </div>

                <div className="rounded-md p-4 flex gap-3" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                  <MessageSquare size={20} className="shrink-0 mt-0.5" style={{ color: "var(--mw-red)" }} />
                  <div>
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--offwhite)" }}>Chat Assistant</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--steel)" }}>
                      Your general-purpose Q&A. Ask about tools, torque specs, teardown steps, or diagnostics. Every
                      question is saved as a chat thread in the sidebar so you can pick a conversation back up later.
                      You can also send a photo of a bolt or part right in the chat and ask "what is this?" — it'll ID
                      it for you. Answers you want to keep can be saved as a Shop Note from the bookmark icon.
                    </p>
                  </div>
                </div>

                <div className="rounded-md p-4 flex gap-3" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                  <Camera size={20} className="shrink-0 mt-0.5" style={{ color: "var(--mw-red)" }} />
                  <div>
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--offwhite)" }}>Shop Assistant</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--steel)" }}>
                      For a full job, not just a quick question. Upload up to 3 photos of what you're working on,
                      describe what you want done (fix, upgrade, change), and it gives you: what it sees in the
                      photo, the tools you'll need, step-by-step how to do it, parts you may need to order, and any
                      safety warnings for that specific job.
                    </p>
                  </div>
                </div>

                <div className="rounded-md p-4 flex gap-3" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                  <Search size={20} className="shrink-0 mt-0.5" style={{ color: "var(--mw-red)" }} />
                  <div>
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--offwhite)" }}>Part Finder</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--steel)" }}>
                      Type a bike and a part, hit Ask. It checks your shop's own Parts Memory first (your own past
                      sourcing — more reliable than anything generic), then gives you an AI answer, then one-click
                      search links straight to real parts retailers (RockyMountainATVMC, PartsUnlimited, Partzilla,
                      RevZilla, BikeBandit). Save any part you look up to Parts Memory so next time the same bike
                      comes in, the answer is already sitting there. Parts Memory is shared across the whole shop.
                    </p>
                  </div>
                </div>

                <div className="rounded-md p-4 flex gap-3" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                  <ListChecks size={20} className="shrink-0 mt-0.5" style={{ color: "var(--mw-red)" }} />
                  <div>
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--offwhite)" }}>Track Assistant</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--steel)" }}>
                      Keeps track of every part, bolt, nut, or washer you pull off a bike mid-job so nothing gets
                      lost or forgotten. Log each item as you remove it. There's a standing reminder to bin everything
                      in a labeled Milwaukee Packout (or similar) so hardware doesn't get mixed up between bikes.
                      Check items off as you reinstall them, and when you're ready to button it up, hit
                      "Get reinstall order & warnings" for the correct order plus torque/safety notes on what's still
                      pending. The number badge on this tab shows how many parts are still off the bike.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modes section */}
            <div>
              <h3 className="text-xs tracking-widest mb-3" style={{ color: "var(--caution)" }}>MODES (Chat &amp; Shop tabs)</h3>
              <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--steel)" }}>
                Modes change how detailed or fast the answer is. Pick whichever fits the moment — you can switch mid-conversation.
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { icon: GraduationCap, name: "Beginner", desc: "Defines every part/tool the first time it's mentioned, explains why each step matters, spells out safety steps a pro would skip, and breaks jobs into smaller steps. Good for learning a new system or bike you don't work on often." },
                  { icon: Zap, name: "Pro", desc: "Fast and to the point. No definitions, no hand-holding — straight to specs and steps, assumes you know the shop terms." },
                  { icon: Stethoscope, name: "Diagnostic", desc: "For 'why is it doing this' troubleshooting. Asks clarifying questions first if needed, then walks through likely causes in order, cheapest/easiest checks first." },
                  { icon: Sparkles, name: "Quick Ref", desc: "Bare specs and bullets only. No explanation. Use it when you just need a number fast." },
                  { icon: MessageCircle, name: "Customer", desc: "Plain-English output meant to be read or texted to a customer — explains what's wrong and why it matters, no internal jargon, tool names, or torque specs." },
                  { icon: ShieldAlert, name: "Safety Check", desc: "For brakes, suspension, wheels — anything load-bearing. Leads with PPE, spells out failure modes for every torque spec, and recommends a second set of eyes before the bike goes back out. Never shortens a warning to save space." },
                ].map((m) => (
                  <div key={m.name} className="rounded-md p-3 flex gap-3" style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}>
                    <m.icon size={17} className="shrink-0 mt-0.5" style={{ color: "var(--caution)" }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--offwhite)" }}>{m.name}</p>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--steel)" }}>{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bike context section */}
            <div>
              <h3 className="text-xs tracking-widest mb-3" style={{ color: "var(--caution)" }}>BIKE CONTEXT</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--steel)" }}>
                The BIKE dropdown next to the mode selector tells the AI what kind of bike you're working on
                (Dirt Bike, Street/Sportbike, etc), or you can type a specific model under "Custom...". This gets
                added to every question so answers are more targeted instead of generic.
              </p>
            </div>

            {/* Notes & history */}
            <div>
              <h3 className="text-xs tracking-widest mb-3" style={{ color: "var(--caution)" }}>SHOP NOTES</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--steel)" }}>
                Any answer in the Chat or Shop tab can be saved as a Shop Note by tapping the bookmark icon. Notes
                are permanent reference material — think of it as your shop's own growing knowledge base of specs,
                steps, and fixes you've already figured out. View them in the Chat tab's sidebar under "Notes."
              </p>
            </div>

            <div>
              <h3 className="text-xs tracking-widest mb-3" style={{ color: "var(--caution)" }}>VOICE INPUT</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--steel)" }}>
                The mic icon next to the Chat and Shop Assistant text boxes lets you talk instead of type — handy
                when your hands are greasy. Tap it, speak, tap again to stop; your words get added to the text box
                so you can review before sending. Only works in browsers that support voice recognition (Chrome-based
                browsers work best); the button won't show up if it's not supported.
              </p>
            </div>

            {/* Data note */}
            <div className="rounded-md p-4 flex gap-3" style={{ backgroundColor: "rgba(160,105,47,0.1)", border: "1px solid var(--panel-border)" }}>
              <Info size={17} className="shrink-0 mt-0.5" style={{ color: "var(--caution)" }} />
              <p className="text-sm leading-relaxed" style={{ color: "var(--steel)" }}>
                Chats, notes, and your Track Assistant list are tied to this device and this shop login. The Shop
                Board (status and job list) is shared across everyone signed into that shop. This is a working
                prototype — the shop login is a functional password gate, not enterprise-grade security, so don't
                treat it as a vault for anything truly sensitive. Torque specs, capacities, and any estimate it
                drafts should still be double-checked before they go to a customer.
              </p>
            </div>
            </div>
          </div>
        )}

        {/* ===================== ADMIN ===================== */}
        {activeTab === "admin" && (
          <div className="tt-bg-texture relative flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
            <Shield className="tt-watermark" strokeWidth={0.5} color="var(--offwhite)" />

            {!adminUnlocked ? (
              <div className="max-w-sm mx-auto mt-10 flex flex-col gap-3 relative z-10">
                <div className="flex flex-col items-center gap-2 mb-2">
                  <Lock size={28} style={{ color: "var(--caution)" }} />
                  <p className="text-sm text-center" style={{ color: "var(--steel)" }}>
                    Enter the admin code to manage registered shops.
                  </p>
                </div>
                <input
                  type="password"
                  value={adminCodeInput}
                  onChange={(e) => setAdminCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdminUnlock()}
                  placeholder="Admin code"
                  className="w-full rounded px-3 py-2.5 text-sm outline-none text-center"
                  style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}
                />
                {adminError && <p className="text-sm text-center" style={{ color: "var(--mw-red)" }}>{adminError}</p>}
                <button
                  onClick={handleAdminUnlock}
                  className="tt-btn w-full py-2.5 rounded font-medium text-sm"
                  style={{ backgroundColor: "var(--mw-red)", color: "#161616" }}
                >
                  Unlock
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold" style={{ color: "var(--offwhite)" }}>Registered Shops</h2>
                    <p className="text-sm" style={{ color: "var(--steel)" }}>
                      Deleting a shop permanently removes its login, chats, notes, tracker, and job board.
                    </p>
                  </div>
                  <button
                    onClick={refreshAdminShops}
                    className="tt-btn text-xs px-3 py-1.5 rounded border"
                    style={{ borderColor: "var(--panel-border)", color: "var(--steel)" }}
                  >
                    Refresh
                  </button>
                </div>

                {adminError && <div className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--mw-red)", color: "var(--mw-red)" }}>{adminError}</div>}

                {adminLoading ? (
                  <div className="flex items-center gap-3 text-sm" style={{ color: "var(--steel)" }}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ animation: "tt-gauge-spin 1.4s linear infinite" }}>
                      <circle cx="12" cy="12" r="9" fill="none" stroke="#3a3a3a" strokeWidth="2" />
                      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--caution)" strokeWidth="2" strokeLinecap="round" strokeDasharray="14 42" />
                    </svg>
                    Loading shops...
                  </div>
                ) : adminShops.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--steel)" }}>No shops registered yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {adminShops.map((shop) => (
                      <div
                        key={shop.id}
                        className="flex items-center justify-between gap-3 rounded-md px-4 py-3 tt-msg"
                        style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--offwhite)" }}>
                            {shop.name}{" "}
                            {session?.shopId === shop.id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded ml-1" style={{ backgroundColor: "var(--caution)", color: "#161616" }}>
                                current
                              </span>
                            )}
                          </p>
                          <p className="text-xs" style={{ color: "var(--steel)" }}>
                            {shop.stateLabel} · registered {shop.createdAt ? new Date(shop.createdAt).toLocaleDateString() : "—"}
                          </p>
                        </div>

                        {confirmDeleteId === shop.id ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs" style={{ color: "var(--mw-red)" }}>Delete for good?</span>
                            <button
                              onClick={() => deleteShopEverywhere(shop)}
                              disabled={deletingId === shop.id}
                              className="tt-btn text-xs px-3 py-1.5 rounded font-medium disabled:opacity-50"
                              style={{ backgroundColor: "var(--mw-red)", color: "#161616" }}
                            >
                              {deletingId === shop.id ? "Deleting..." : "Confirm"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="tt-btn text-xs px-3 py-1.5 rounded border"
                              style={{ borderColor: "var(--panel-border)", color: "var(--steel)" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(shop.id)}
                            className="tt-btn flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border shrink-0"
                            style={{ borderColor: "var(--panel-border)", color: "var(--mw-red)" }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
