// Shared UI building blocks for the Throttle Tech design system.
// Colors come from the CSS variables defined in App.jsx (themeVars).
import React, { useEffect } from "react";
import { X } from "lucide-react";

export const inputStyle = {
  backgroundColor: "var(--panel-2)",
  border: "1px solid var(--panel-border)",
  color: "var(--offwhite)",
};

export const cardStyle = {
  backgroundColor: "var(--panel)",
  border: "1px solid var(--panel-border)",
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function money(n) {
  const v = Number(n);
  if (!isFinite(v)) return "";
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function Spinner({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size, animation: "tt-gauge-spin 1.4s linear infinite" }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="#2A2A2A" strokeWidth="2" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--mw-red)" strokeWidth="2" strokeLinecap="round" strokeDasharray="14 42" />
    </svg>
  );
}

export function Btn({ variant = "primary", size = "md", className = "", children, ...props }) {
  const sizes = { sm: "text-xs px-2.5 py-1.5 gap-1.5", md: "text-sm px-4 py-2 gap-2", lg: "text-base px-5 py-3 gap-2" };
  const variants = {
    primary: { backgroundColor: "var(--mw-red)", color: "var(--on-accent)", border: "1px solid var(--mw-red)" },
    light: { backgroundColor: "var(--offwhite)", color: "#0A0A0A", border: "1px solid var(--offwhite)" },
    ghost: { backgroundColor: "transparent", color: "var(--steel)", border: "1px solid var(--panel-border)" },
    subtle: { backgroundColor: "var(--panel-2)", color: "var(--offwhite)", border: "1px solid var(--panel-border)" },
    danger: { backgroundColor: "transparent", color: "var(--caution)", border: "1px solid rgba(255,59,48,0.4)" },
  };
  return (
    <button
      type="button"
      className={`tt-btn inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none ${sizes[size]} ${className}`}
      style={variants[variant]}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconBtn({ title, children, active, className = "", ...props }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`tt-btn inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${className}`}
      style={{
        backgroundColor: active ? "var(--mw-red)" : "var(--panel)",
        color: active ? "var(--on-accent)" : "var(--steel)",
        border: "1px solid var(--panel-border)",
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 min-w-0 ${className}`}>
      <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: "var(--steel)" }}>{label}</span>
      {children}
    </label>
  );
}

export function TextInput({ className = "", ...props }) {
  return <input className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${className}`} style={inputStyle} {...props} />;
}

export function TextArea({ className = "", ...props }) {
  return <textarea className={`w-full rounded-lg px-3 py-2 text-sm outline-none resize-none ${className}`} style={inputStyle} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <select className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${className}`} style={inputStyle} {...props}>
      {children}
    </select>
  );
}

export function Card({ className = "", children, style, ...props }) {
  return (
    <div className={`rounded-2xl ${className}`} style={{ ...cardStyle, ...style }} {...props}>
      {children}
    </div>
  );
}

export function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <h3 className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: "var(--steel)" }}>{children}</h3>
      {right}
    </div>
  );
}

export function Pill({ color = "var(--steel)", solid = false, children }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={
        solid
          ? { backgroundColor: color, color: "#fff" }
          : { color, backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${color}55` }
      }
    >
      {children}
    </span>
  );
}

export function StatCard({ label, value, hint, accent, onClick, icon: Icon }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`text-left rounded-2xl p-3 sm:p-4 flex flex-col gap-0.5 sm:gap-1 min-w-0 ${onClick ? "tt-btn" : ""}`}
      style={{ ...cardStyle, borderColor: accent ? "rgba(225,6,0,0.5)" : "var(--panel-border)" }}
    >
      <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium tracking-wider uppercase truncate" style={{ color: "var(--steel)" }}>
        {Icon && <Icon size={13} style={{ color: accent ? "var(--mw-red)" : undefined }} />} {label}
      </span>
      <span className="text-xl sm:text-2xl font-bold" style={{ color: accent ? "var(--caution)" : "var(--offwhite)" }}>{value}</span>
      {hint && <span className="text-xs truncate" style={{ color: "var(--steel)" }}>{hint}</span>}
    </Comp>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-12 px-4 rounded-2xl" style={{ border: "1px dashed var(--panel-border)" }}>
      {Icon && (
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1" style={{ backgroundColor: "rgba(225,6,0,0.1)" }}>
          <Icon size={22} style={{ color: "var(--mw-red)" }} />
        </div>
      )}
      <p className="text-sm font-semibold" style={{ color: "var(--offwhite)" }}>{title}</p>
      {children && <p className="text-sm max-w-sm" style={{ color: "var(--steel)" }}>{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// Bottom sheet on phones, centered dialog on larger screens.
export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div
        className={`tt-sheet w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl`}
        style={{ backgroundColor: "var(--panel)", border: "1px solid var(--panel-border)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b" style={{ backgroundColor: "var(--panel)", borderColor: "var(--panel-border)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--offwhite)" }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="tt-btn w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: "var(--steel)", backgroundColor: "var(--panel-2)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// Shrinks a photo on the device before upload, so a 5 MB phone photo becomes ~200 KB.
export function compressImage(file, maxSide = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("That file isn't an image this browser can open."));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export const JOB_STATUS_COLORS = {
  Quoted: "#A3A3A3",
  "Waiting on Parts": "#F59E0B",
  "In Progress": "#E10600",
  "Ready for Pickup": "#22C55E",
  Closed: "#6B6B6B",
};

export function bikeLabel(b) {
  if (!b) return "";
  return [b.year, b.make, b.model].filter(Boolean).join(" ") || "Unnamed bike";
}
