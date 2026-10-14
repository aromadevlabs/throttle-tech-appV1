import React, { useRef, useState } from "react";
import { Camera, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Btn, Modal, Spinner, compressImage, uid, formatDate } from "../ui.jsx";

export const PHOTO_TAGS = [
  { id: "before", label: "Before", color: "#A3A3A3" },
  { id: "damage", label: "Damage", color: "#FF3B30" },
  { id: "after", label: "After", color: "#22C55E" },
];

const tagInfo = (id) => PHOTO_TAGS.find((t) => t.id === id) || PHOTO_TAGS[0];

export async function uploadPhoto(dataUrl) {
  const res = await fetch("/api/photos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  if (!res.ok) throw new Error("upload failed");
  return res.json(); // { id, url }
}

export async function deletePhotoFile(photo) {
  try { await fetch(`/api/photos/${encodeURIComponent(photo.fileId || photo.id)}`, { method: "DELETE" }); } catch (e) {}
}

export default function JobPhotos({ job, onChange }) {
  const photos = job.photos || [];
  const [tag, setTag] = useState(job.status === "Ready for Pickup" || job.status === "Closed" ? "after" : "before");
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState(null);
  const [viewIdx, setViewIdx] = useState(null);
  const inputRef = useRef(null);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError(null);
    setBusy(files.length);
    const added = [];
    for (const file of files) {
      try {
        const dataUrl = await compressImage(file);
        const { id, url } = await uploadPhoto(dataUrl);
        added.push({ id: uid(), fileId: id, url, tag, takenAt: Date.now() });
      } catch (e) {
        setError("A photo didn't upload — check your connection and try again.");
      }
      setBusy((n) => n - 1);
    }
    if (added.length) onChange([...photos, ...added]);
  }

  function retag(photo, newTag) {
    onChange(photos.map((p) => (p.id === photo.id ? { ...p, tag: newTag } : p)));
  }

  async function remove(photo) {
    onChange(photos.filter((p) => p.id !== photo.id));
    setViewIdx(null);
    deletePhotoFile(photo);
  }

  const viewing = viewIdx !== null ? photos[viewIdx] : null;
  const counts = PHOTO_TAGS.map((t) => ({ ...t, n: photos.filter((p) => p.tag === t.id).length })).filter((t) => t.n);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: "var(--steel)" }}>
          Photos {counts.length > 0 && `· ${counts.map((t) => `${t.n} ${t.label.toLowerCase()}`).join(", ")}`}
        </span>
      </div>
      <div className="tt-scroll-x flex gap-2 overflow-x-auto pb-1">
        {photos.map((p, i) => (
          <button key={p.id} onClick={() => setViewIdx(i)} className="tt-btn relative w-20 h-20 shrink-0 rounded-xl overflow-hidden" style={{ border: "1px solid var(--panel-border)" }} title={`${tagInfo(p.tag).label} photo`}>
            <img src={p.url} alt={`${tagInfo(p.tag).label} photo`} className="w-full h-full object-cover" loading="lazy" />
            <span className="absolute bottom-1 left-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md" style={{ backgroundColor: tagInfo(p.tag).color, color: "#fff" }}>
              {tagInfo(p.tag).label}
            </span>
          </button>
        ))}
        {Array.from({ length: Math.max(0, busy) }).map((_, i) => (
          <div key={`b${i}`} className="w-20 h-20 shrink-0 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)" }}>
            <Spinner />
          </div>
        ))}
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => inputRef.current?.click()}
            className="tt-btn w-20 h-[58px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium"
            style={{ border: "1px dashed var(--panel-border)", color: "var(--steel)", backgroundColor: "var(--panel-2)" }}
          >
            <Camera size={16} style={{ color: "var(--mw-red)" }} /> Add photo
          </button>
          <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Photo type" className="w-20 rounded-md px-1 py-0.5 text-[10px] outline-none" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: tagInfo(tag).color }}>
            {PHOTO_TAGS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {error && <p className="text-xs" style={{ color: "var(--caution)" }}>{error}</p>}

      <Modal open={!!viewing} onClose={() => setViewIdx(null)} title={viewing ? `${tagInfo(viewing.tag).label} photo · ${formatDate(viewing.takenAt)}` : ""} wide>
        {viewing && (
          <div className="flex flex-col gap-4">
            <div className="relative rounded-xl overflow-hidden" style={{ backgroundColor: "#000" }}>
              <img src={viewing.url} alt={`${tagInfo(viewing.tag).label} photo`} className="w-full max-h-[60vh] object-contain" />
              {photos.length > 1 && (
                <>
                  <button onClick={() => setViewIdx((viewIdx - 1 + photos.length) % photos.length)} aria-label="Previous photo" className="tt-btn absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}><ChevronLeft size={18} /></button>
                  <button onClick={() => setViewIdx((viewIdx + 1) % photos.length)} aria-label="Next photo" className="tt-btn absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}><ChevronRight size={18} /></button>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1.5">
                {PHOTO_TAGS.map((t) => (
                  <button key={t.id} onClick={() => retag(viewing, t.id)} className="tt-btn text-xs font-medium px-3 py-1.5 rounded-full" style={{ backgroundColor: viewing.tag === t.id ? t.color : "var(--panel-2)", color: viewing.tag === t.id ? "#fff" : "var(--steel)", border: "1px solid var(--panel-border)" }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <Btn variant="danger" size="sm" onClick={() => remove(viewing)}><Trash2 size={13} /> Delete photo</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
