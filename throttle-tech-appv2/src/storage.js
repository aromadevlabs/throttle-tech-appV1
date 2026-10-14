// Storage shim: reproduces the window.storage.{get,set,delete,list} interface
// the app was originally built against.
//
// "session" (which shop this browser is currently logged into) is kept in the
// browser's localStorage — it's device-specific and should NOT be shared
// between different computers signing into different shops.
//
// Everything else (chats, notes, track list, job board, shop registry) is
// persisted on our own backend, scoped by whatever key the app already builds
// (the app prefixes shop data with `${shopId}::` itself, so the backend just
// needs a flat key/value store).

const API_BASE = "/api/kv";

function isSessionKey(key) {
  return key === "session";
}

async function get(key /*, shared */) {
  if (isSessionKey(key)) {
    const raw = localStorage.getItem(key);
    if (raw === null) throw new Error("not found");
    return { key, value: raw, shared: false };
  }
  const res = await fetch(`${API_BASE}/${encodeURIComponent(key)}`);
  if (res.status === 404) throw new Error("not found");
  if (!res.ok) throw new Error("storage get failed: " + res.status);
  const data = await res.json();
  return { key, value: data.value, shared: !!data.shared };
}

async function set(key, value, shared) {
  if (isSessionKey(key)) {
    localStorage.setItem(key, value);
    return { key, value, shared: false };
  }
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, shared: !!shared }),
  });
  if (!res.ok) throw new Error("storage set failed: " + res.status);
  return { key, value, shared: !!shared };
}

async function del(key) {
  if (isSessionKey(key)) {
    localStorage.removeItem(key);
    return { key, deleted: true, shared: false };
  }
  const res = await fetch(`${API_BASE}/${encodeURIComponent(key)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("storage delete failed: " + res.status);
  return { key, deleted: true, shared: false };
}

async function list(prefix) {
  const q = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
  const res = await fetch(`${API_BASE}${q}`);
  if (!res.ok) throw new Error("storage list failed: " + res.status);
  const data = await res.json();
  return { keys: data.keys || [], prefix, shared: false };
}

if (typeof window !== "undefined") {
  window.storage = { get, set, delete: del, list };
}

export default { get, set, delete: del, list };
