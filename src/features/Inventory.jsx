import React, { useMemo, useState } from "react";
import { Boxes, Search, Plus, Minus, Pencil, Trash2, Package, MapPin, X } from "lucide-react";
import { Btn, Card, Field, TextInput, TextArea, Select, Modal, Pill, EmptyState, StatCard, inputStyle, uid, money } from "../ui.jsx";

export const PART_CATEGORIES = [
  "Brakes", "Engine", "Drivetrain", "Suspension", "Electrical", "Tires & Wheels",
  "Fluids & Filters", "Hardware", "Controls", "Body & Plastics", "Other",
];

export function stockState(item) {
  const qty = Number(item.qty) || 0;
  const min = Number(item.minQty) || 0;
  if (qty <= 0) return "out";
  if (min > 0 && qty <= min) return "low";
  return "ok";
}

export function inventoryMatches(items, text) {
  const words = (text || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return [];
  return items.filter((it) => {
    const hay = `${it.name} ${it.partNumber || ""} ${it.fitment || ""} ${it.category || ""}`.toLowerCase();
    return words.every((w) => hay.includes(w)) || (it.partNumber && text.toLowerCase().includes(it.partNumber.toLowerCase()));
  });
}

function StockPill({ item }) {
  const s = stockState(item);
  if (s === "out") return <Pill color="#FF3B30" solid>Out of stock</Pill>;
  if (s === "low") return <Pill color="#F59E0B">Low stock</Pill>;
  return null;
}

function PartForm({ initial, onSubmit, onCancel }) {
  const [f, setF] = useState({
    name: initial?.name || "", partNumber: initial?.partNumber || "", category: initial?.category || "Other",
    fitment: initial?.fitment || "", qty: initial?.qty ?? 1, minQty: initial?.minQty ?? 1, location: initial?.location || "",
    cost: initial?.cost || "", price: initial?.price || "", supplier: initial?.supplier || "", notes: initial?.notes || "",
  });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  function submit(e) {
    e.preventDefault();
    if (!f.name.trim()) return setErr("Give the part a name.");
    if (Number(f.qty) < 0 || Number.isNaN(Number(f.qty))) return setErr("Quantity should be 0 or more.");
    onSubmit({
      ...f,
      name: f.name.trim(), partNumber: f.partNumber.trim(), fitment: f.fitment.trim(), location: f.location.trim(),
      supplier: f.supplier.trim(), notes: f.notes.trim(),
      qty: Math.max(0, Math.round(Number(f.qty) || 0)), minQty: Math.max(0, Math.round(Number(f.minQty) || 0)),
      cost: f.cost === "" ? "" : String(f.cost).replace(/[$,]/g, ""), price: f.price === "" ? "" : String(f.price).replace(/[$,]/g, ""),
    });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Part name"><TextInput value={f.name} onChange={set("name")} placeholder="e.g. Front brake pads" autoFocus /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Part number"><TextInput value={f.partNumber} onChange={set("partNumber")} placeholder="e.g. FA185HH" /></Field>
        <Field label="Category">
          <Select value={f.category} onChange={set("category")}>{PART_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
        </Field>
      </div>
      <Field label="Fits"><TextInput value={f.fitment} onChange={set("fitment")} placeholder="e.g. KX250/450 2019–2024" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="In stock"><TextInput type="number" min="0" inputMode="numeric" value={f.qty} onChange={set("qty")} /></Field>
        <Field label="Alert at"><TextInput type="number" min="0" inputMode="numeric" value={f.minQty} onChange={set("minQty")} /></Field>
        <Field label="Bin / shelf"><TextInput value={f.location} onChange={set("location")} placeholder="A4" /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Your cost $"><TextInput inputMode="decimal" value={f.cost} onChange={set("cost")} placeholder="0.00" /></Field>
        <Field label="Sell price $"><TextInput inputMode="decimal" value={f.price} onChange={set("price")} placeholder="0.00" /></Field>
        <Field label="Supplier"><TextInput value={f.supplier} onChange={set("supplier")} placeholder="Parts Unlimited" /></Field>
      </div>
      <Field label="Notes"><TextArea rows={2} value={f.notes} onChange={set("notes")} /></Field>
      <p className="text-xs" style={{ color: "var(--steel)" }}>"Alert at" flags the part as low stock once you're down to that many.</p>
      {err && <p className="text-sm" style={{ color: "var(--caution)" }}>{err}</p>}
      <div className="flex gap-2 justify-end pt-1">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn type="submit">{initial ? "Save part" : "Add to inventory"}</Btn>
      </div>
    </form>
  );
}

export default function Inventory({ items, onSaveItem, onDeleteItem, onAdjust, formOpen, setFormOpen }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | low | out
  const [category, setCategory] = useState("All");
  const [editing, setEditing] = useState(null);

  const stats = useMemo(() => {
    let units = 0, value = 0, low = 0, out = 0;
    for (const it of items) {
      const q = Number(it.qty) || 0;
      units += q;
      value += q * (Number(it.cost) || 0);
      const s = stockState(it);
      if (s === "low") low++;
      if (s === "out") out++;
    }
    return { units, value, low, out };
  }, [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => (filter === "all" ? true : filter === "low" ? stockState(it) !== "ok" : stockState(it) === "out"))
      .filter((it) => category === "All" || it.category === category)
      .filter((it) => !q || `${it.name} ${it.partNumber} ${it.fitment} ${it.location} ${it.supplier}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const rank = { out: 0, low: 1, ok: 2 };
        return rank[stockState(a)] - rank[stockState(b)] || a.name.localeCompare(b.name);
      });
  }, [items, query, filter, category]);

  function save(data) {
    if (editing) onSaveItem({ ...editing, ...data, updatedAt: Date.now() });
    else onSaveItem({ id: uid(), ...data, createdAt: Date.now(), updatedAt: Date.now() });
    setEditing(null);
    setFormOpen(false);
  }

  const chip = (id, label, count) => (
    <button
      key={id}
      onClick={() => setFilter(id)}
      className="tt-btn inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap"
      style={{
        backgroundColor: filter === id ? "var(--offwhite)" : "var(--panel)",
        color: filter === id ? "#0A0A0A" : "var(--steel)",
        border: `1px solid ${filter === id ? "var(--offwhite)" : "var(--panel-border)"}`,
      }}
    >
      {label} {count !== undefined && <span className="opacity-70">{count}</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Parts" value={items.length} hint="different items" icon={Boxes} />
        <StatCard label="Units" value={stats.units} hint="on the shelf" icon={Package} />
        <StatCard label="Low / out" value={stats.low + stats.out} hint={stats.out ? `${stats.out} out of stock` : "need reorder"} accent={stats.low + stats.out > 0} onClick={() => setFilter("low")} />
        <StatCard label="Stock value" value={money(stats.value) || "$0.00"} hint="at your cost" />
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Boxes} title="Your inventory is empty" action={<Btn onClick={() => setFormOpen(true)}><Plus size={15} /> Add a part</Btn>}>
          Track what's on the shelf, where it lives, and get flagged when it's time to reorder. Parts you use on a job come out of stock automatically.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--steel)" }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parts, numbers, bins…" className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "var(--panel)" }} />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl px-3 py-2.5 text-sm outline-none sm:w-48" style={{ ...inputStyle, backgroundColor: "var(--panel)" }}>
              <option>All</option>
              {PART_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="tt-scroll-x flex gap-2 overflow-x-auto">
            {chip("all", "All", items.length)}
            {chip("low", "Needs reorder", stats.low + stats.out)}
            {chip("out", "Out of stock", stats.out)}
          </div>

          {shown.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--steel)" }}>Nothing matches those filters.</p>
          ) : (
            <Card className="overflow-hidden">
              {shown.map((it, i) => {
                const s = stockState(it);
                return (
                  <div key={it.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--panel-border)" : "none" }}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium" style={{ color: "var(--offwhite)" }}>{it.name}</p>
                        <StockPill item={it} />
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--steel)" }}>
                        {[it.partNumber && `#${it.partNumber}`, it.category, it.fitment].filter(Boolean).join(" · ")}
                      </p>
                      <p className="text-xs mt-0.5 flex flex-wrap items-center gap-x-3" style={{ color: "var(--steel)" }}>
                        {it.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> Bin {it.location}</span>}
                        {it.price && <span>Sells {money(it.price)}</span>}
                        {it.supplier && <span>{it.supplier}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid var(--panel-border)" }}>
                        <button onClick={() => onAdjust(it.id, -1)} disabled={!Number(it.qty)} aria-label={`Remove one ${it.name}`} className="tt-btn w-9 h-9 flex items-center justify-center disabled:opacity-30" style={{ backgroundColor: "var(--panel-2)", color: "var(--offwhite)" }}><Minus size={14} /></button>
                        <span className="w-12 text-center text-sm font-bold tabular-nums" style={{ color: s === "ok" ? "var(--offwhite)" : s === "low" ? "#F59E0B" : "var(--caution)" }}>{Number(it.qty) || 0}</span>
                        <button onClick={() => onAdjust(it.id, 1)} aria-label={`Add one ${it.name}`} className="tt-btn w-9 h-9 flex items-center justify-center" style={{ backgroundColor: "var(--panel-2)", color: "var(--offwhite)" }}><Plus size={14} /></button>
                      </div>
                      <button onClick={() => setEditing(it)} title="Edit" className="tt-btn w-9 h-9 rounded-lg flex items-center justify-center" style={{ color: "var(--steel)" }}><Pencil size={14} /></button>
                      <button onClick={() => { if (window.confirm(`Delete ${it.name} from inventory?`)) onDeleteItem(it.id); }} title="Delete" className="tt-btn w-9 h-9 rounded-lg flex items-center justify-center" style={{ color: "var(--steel)" }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}

      <Modal open={formOpen || !!editing} onClose={() => { setFormOpen(false); setEditing(null); }} title={editing ? "Edit part" : "Add a part"}>
        <PartForm key={editing?.id || "new"} initial={editing} onSubmit={save} onCancel={() => { setFormOpen(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}

// Used inside a job card: pull parts from inventory onto a job.
export function JobParts({ job, inventory, onUsePart, onReturnPart }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("");
  const [qty, setQty] = useState(1);
  const [q, setQ] = useState("");
  const used = job.partsUsed || [];
  const total = used.reduce((s, p) => s + (Number(p.price) || 0) * (p.qty || 1), 0);
  const options = inventory
    .filter((it) => !q.trim() || `${it.name} ${it.partNumber} ${it.fitment}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const chosen = inventory.find((it) => it.id === pick);

  function add() {
    if (!chosen) return;
    const n = Math.max(1, Math.round(Number(qty) || 1));
    onUsePart(job, chosen, n);
    setPick(""); setQty(1); setQ(""); setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: "var(--steel)" }}>
          Parts used {used.length > 0 && `· ${money(total)}`}
        </span>
        <button onClick={() => setOpen((o) => !o)} className="tt-btn inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--offwhite)" }}>
          {open ? <X size={13} /> : <Plus size={13} />} {open ? "Close" : "Add part"}
        </button>
      </div>
      {used.length > 0 && (
        <div className="flex flex-col gap-1">
          {used.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "var(--panel-2)" }}>
              <span className="font-semibold tabular-nums" style={{ color: "var(--offwhite)" }}>{p.qty}×</span>
              <span className="flex-1 truncate" style={{ color: "var(--offwhite)" }}>{p.name}{p.partNumber ? <span style={{ color: "var(--steel)" }}> #{p.partNumber}</span> : null}</span>
              {p.price ? <span style={{ color: "var(--steel)" }}>{money(Number(p.price) * p.qty)}</span> : null}
              <button onClick={() => onReturnPart(job, p)} title="Remove from job and put back in stock" className="tt-btn opacity-60 hover:opacity-100" style={{ color: "var(--steel)" }}><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
      {open && (
        <div className="flex flex-col gap-2 rounded-xl p-3 tt-msg" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)" }}>
          {inventory.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--steel)" }}>No parts in inventory yet. Add some on the Inventory page first.</p>
          ) : (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter parts…" className="w-full rounded-lg px-3 py-2 text-xs outline-none" style={inputStyle} />
              <div className="flex gap-2">
                <select value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1 min-w-0 rounded-lg px-2 py-2 text-xs outline-none" style={inputStyle}>
                  <option value="">Choose a part…</option>
                  {options.map((it) => (
                    <option key={it.id} value={it.id} disabled={!Number(it.qty)}>
                      {it.name}{it.partNumber ? ` #${it.partNumber}` : ""} — {Number(it.qty) || 0} in stock
                    </option>
                  ))}
                </select>
                <input type="number" min="1" max={chosen ? Number(chosen.qty) || 1 : undefined} value={qty} onChange={(e) => setQty(e.target.value)} className="w-16 rounded-lg px-2 py-2 text-xs outline-none" style={inputStyle} aria-label="Quantity" />
                <Btn size="sm" onClick={add} disabled={!chosen || Number(qty) > (Number(chosen?.qty) || 0)}>Use</Btn>
              </div>
              {chosen && Number(qty) > (Number(chosen.qty) || 0) && <p className="text-xs" style={{ color: "var(--caution)" }}>Only {Number(chosen.qty) || 0} in stock.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
