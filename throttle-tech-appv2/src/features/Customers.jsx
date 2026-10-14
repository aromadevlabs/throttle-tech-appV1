import React, { useMemo, useState } from "react";
import { Users, Search, Phone, Mail, Pencil, Trash2, Plus, Bike, ArrowLeft, MessageSquare, Wrench, Camera, ChevronRight } from "lucide-react";
import {
  Btn, Card, Field, TextInput, TextArea, Modal, Pill, EmptyState, SectionLabel, inputStyle,
  uid, formatDate, money, bikeLabel, JOB_STATUS_COLORS,
} from "../ui.jsx";

const MAKES = ["Honda", "Kawasaki", "Yamaha", "Suzuki", "KTM", "Husqvarna", "GasGas", "Beta", "Sherco", "Harley-Davidson", "Ducati", "BMW", "Triumph", "Indian", "Aprilia", "Royal Enfield"];

export function CustomerForm({ initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [err, setErr] = useState(null);
  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setErr("Enter the customer's name.");
    onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim(), notes: notes.trim() });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jake Miller" autoFocus /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Phone"><TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" /></Field>
        <Field label="Email"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></Field>
      </div>
      <Field label="Notes"><TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Prefers texts, pays cash, etc." /></Field>
      {err && <p className="text-sm" style={{ color: "var(--caution)" }}>{err}</p>}
      <div className="flex gap-2 justify-end pt-1">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn type="submit">{initial ? "Save changes" : "Add customer"}</Btn>
      </div>
    </form>
  );
}

export function BikeForm({ initial, onSubmit, onCancel }) {
  const [f, setF] = useState({
    year: initial?.year || "", make: initial?.make || "", model: initial?.model || "",
    vin: initial?.vin || "", mileage: initial?.mileage || "", color: initial?.color || "", notes: initial?.notes || "",
  });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  function submit(e) {
    e.preventDefault();
    if (!f.make.trim() && !f.model.trim()) return setErr("Enter at least the make or model.");
    const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, String(v).trim()]));
    clean.vin = clean.vin.toUpperCase();
    onSubmit(clean);
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Year"><TextInput inputMode="numeric" value={f.year} onChange={set("year")} placeholder="2023" autoFocus /></Field>
        <Field label="Make" className="col-span-2">
          <TextInput list="tt-makes" value={f.make} onChange={set("make")} placeholder="Kawasaki" />
          <datalist id="tt-makes">{MAKES.map((m) => <option key={m} value={m} />)}</datalist>
        </Field>
      </div>
      <Field label="Model"><TextInput value={f.model} onChange={set("model")} placeholder="KX450F" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="VIN"><TextInput value={f.vin} onChange={set("vin")} placeholder="17 characters" maxLength={17} style={{ ...inputStyle, textTransform: "uppercase" }} /></Field>
        <Field label="Miles / hours"><TextInput value={f.mileage} onChange={set("mileage")} placeholder="e.g. 12,400 mi or 85 hrs" /></Field>
      </div>
      <Field label="Color"><TextInput value={f.color} onChange={set("color")} placeholder="Green" /></Field>
      <Field label="Notes"><TextArea rows={2} value={f.notes} onChange={set("notes")} placeholder="Aftermarket exhaust, stiffer springs…" /></Field>
      {err && <p className="text-sm" style={{ color: "var(--caution)" }}>{err}</p>}
      <div className="flex gap-2 justify-end pt-1">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn type="submit">{initial ? "Save bike" : "Add bike"}</Btn>
      </div>
    </form>
  );
}

function initials(name) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function Avatar({ name, size = 40 }) {
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 font-semibold" style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: "rgba(225,6,0,0.14)", color: "var(--caution)" }}>
      {initials(name)}
    </div>
  );
}

export default function Customers({
  customers, jobs, onSaveCustomer, onDeleteCustomer, onNewJob, onAskAboutBike, onOpenBoard,
  selectedId, setSelectedId, formOpen, setFormOpen,
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [bikeModal, setBikeModal] = useState(null); // { bike?: existing }
  const [confirmDelete, setConfirmDelete] = useState(false);

  const jobCountByCustomer = useMemo(() => {
    const m = {};
    for (const j of jobs) if (j.customerId) m[j.customerId] = (m[j.customerId] || 0) + 1;
    return m;
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...customers].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter((c) => {
      const hay = [c.name, c.phone, c.email, ...(c.bikes || []).flatMap((b) => [bikeLabel(b), b.vin])].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [customers, query]);

  const selected = customers.find((c) => c.id === selectedId) || null;
  const history = selected ? jobs.filter((j) => j.customerId === selected.id).sort((a, b) => b.createdAt - a.createdAt) : [];

  function saveNew(data) {
    const c = { id: uid(), ...data, bikes: [], createdAt: Date.now() };
    onSaveCustomer(c);
    setFormOpen(false);
    setSelectedId(c.id);
  }

  function saveEdit(data) {
    onSaveCustomer({ ...selected, ...data });
    setEditing(false);
  }

  function saveBike(data) {
    const bikes = selected.bikes || [];
    const updated = bikeModal?.bike
      ? bikes.map((b) => (b.id === bikeModal.bike.id ? { ...b, ...data } : b))
      : [...bikes, { id: uid(), ...data, addedAt: Date.now() }];
    onSaveCustomer({ ...selected, bikes: updated });
    setBikeModal(null);
  }

  function deleteBike(bikeId) {
    onSaveCustomer({ ...selected, bikes: (selected.bikes || []).filter((b) => b.id !== bikeId) });
  }

  const list = (
    <div className={`flex flex-col gap-3 min-w-0 ${selected ? "hidden lg:flex" : "flex"}`}>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--steel)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, bike or VIN"
          className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
          style={{ ...inputStyle, backgroundColor: "var(--panel)" }}
        />
      </div>
      {customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet" action={<Btn onClick={() => setFormOpen(true)}><Plus size={15} /> Add your first customer</Btn>}>
          Keep each customer's contact info, bikes and full service history in one place.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <p className="text-sm px-1" style={{ color: "var(--steel)" }}>No customers match "{query}".</p>
      ) : (
        <Card className="overflow-hidden">
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onClick={() => { setSelectedId(c.id); setEditing(false); }}
              className="tt-btn w-full text-left flex items-center gap-3 px-4 py-3"
              style={{
                borderTop: i ? "1px solid var(--panel-border)" : "none",
                backgroundColor: c.id === selectedId ? "rgba(225,6,0,0.08)" : "transparent",
                boxShadow: c.id === selectedId ? "inset 3px 0 0 var(--mw-red)" : "none",
              }}
            >
              <Avatar name={c.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: "var(--offwhite)" }}>{c.name}</p>
                <p className="text-xs truncate" style={{ color: "var(--steel)" }}>
                  {(c.bikes || []).length ? (c.bikes || []).map(bikeLabel).join(", ") : c.phone || "No bikes yet"}
                </p>
              </div>
              {jobCountByCustomer[c.id] ? <Pill>{jobCountByCustomer[c.id]} job{jobCountByCustomer[c.id] > 1 ? "s" : ""}</Pill> : null}
              <ChevronRight size={16} style={{ color: "var(--steel)" }} className="shrink-0" />
            </button>
          ))}
        </Card>
      )}
    </div>
  );

  const detail = selected ? (
    <div className="flex flex-col gap-5 min-w-0 tt-msg">
      <button onClick={() => setSelectedId(null)} className="lg:hidden tt-btn self-start inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--steel)" }}>
        <ArrowLeft size={16} /> All customers
      </button>

      {/* Contact card */}
      <Card className="p-5">
        {editing ? (
          <CustomerForm initial={selected} onSubmit={saveEdit} onCancel={() => setEditing(false)} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <Avatar name={selected.name} size={56} />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold truncate" style={{ color: "var(--offwhite)" }}>{selected.name}</h2>
                <p className="text-xs" style={{ color: "var(--steel)" }}>Customer since {formatDate(selected.createdAt)}</p>
              </div>
              <div className="flex gap-2">
                <Btn variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</Btn>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.phone && (
                <a href={`tel:${selected.phone}`} className="tt-btn inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}>
                  <Phone size={14} style={{ color: "var(--mw-red)" }} /> {selected.phone}
                </a>
              )}
              {selected.email && (
                <a href={`mailto:${selected.email}`} className="tt-btn inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg min-w-0" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)", color: "var(--offwhite)" }}>
                  <Mail size={14} style={{ color: "var(--mw-red)" }} /> <span className="truncate">{selected.email}</span>
                </a>
              )}
              {!selected.phone && !selected.email && <p className="text-sm" style={{ color: "var(--steel)" }}>No contact info yet — tap Edit to add a phone number.</p>}
            </div>
            {selected.notes && <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--steel)" }}>{selected.notes}</p>}
          </div>
        )}
      </Card>

      {/* Bikes */}
      <div>
        <SectionLabel right={<Btn size="sm" variant="subtle" onClick={() => setBikeModal({})}><Plus size={13} /> Add bike</Btn>}>
          Bikes ({(selected.bikes || []).length})
        </SectionLabel>
        {(selected.bikes || []).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--steel)" }}>No bikes on file. Add one to link jobs and service history to it.</p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {selected.bikes.map((b) => {
              const bikeJobs = history.filter((j) => j.bikeId === b.id);
              return (
                <Card key={b.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--panel-2)", border: "1px solid var(--panel-border)" }}>
                      <Bike size={18} style={{ color: "var(--mw-red)" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--offwhite)" }}>{bikeLabel(b)}</p>
                      <p className="text-xs truncate" style={{ color: "var(--steel)" }}>
                        {[b.color, b.mileage, bikeJobs.length ? `${bikeJobs.length} job${bikeJobs.length > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ") || "No details yet"}
                      </p>
                      {b.vin && <p className="text-[11px] mt-1 font-mono tracking-wide" style={{ color: "var(--steel)" }}>VIN {b.vin}</p>}
                    </div>
                    <button onClick={() => setBikeModal({ bike: b })} title="Edit bike" className="tt-btn p-1.5 rounded-md" style={{ color: "var(--steel)" }}><Pencil size={13} /></button>
                    <button onClick={() => { if (window.confirm(`Remove ${bikeLabel(b)} from ${selected.name}? Past jobs stay on the board.`)) deleteBike(b.id); }} title="Remove bike" className="tt-btn p-1.5 rounded-md" style={{ color: "var(--steel)" }}><Trash2 size={13} /></button>
                  </div>
                  {b.notes && <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--steel)" }}>{b.notes}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Btn size="sm" onClick={() => onNewJob(selected, b)}><Wrench size={13} /> New job</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => onAskAboutBike(b)}><MessageSquare size={13} /> Ask AI about this bike</Btn>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Service history */}
      <div>
        <SectionLabel>Service history ({history.length})</SectionLabel>
        {history.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--steel)" }}>No jobs yet. Use "New job" on a bike to start one.</p>
        ) : (
          <div className="relative flex flex-col gap-3 pl-5">
            <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ backgroundColor: "var(--panel-border)" }} />
            {history.map((j) => {
              const partsTotal = (j.partsUsed || []).reduce((s, p) => s + (Number(p.price) || 0) * (p.qty || 1), 0);
              const bike = (selected.bikes || []).find((b) => b.id === j.bikeId);
              return (
                <div key={j.id} className="relative">
                  <span className="absolute -left-5 top-4 w-[15px] h-[15px] rounded-full" style={{ backgroundColor: "var(--asphalt)", border: `3px solid ${JOB_STATUS_COLORS[j.status] || "#666"}` }} />
                  <button onClick={() => onOpenBoard(j.id)} className="tt-btn w-full text-left">
                    <Card className="p-4 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs" style={{ color: "var(--steel)" }}>{formatDate(j.createdAt)}</span>
                        <Pill color={JOB_STATUS_COLORS[j.status]}>{j.status}</Pill>
                        <span className="text-xs font-medium truncate" style={{ color: "var(--offwhite)" }}>{bike ? bikeLabel(bike) : j.bike}</span>
                      </div>
                      {j.notes && <p className="text-sm line-clamp-3" style={{ color: "var(--offwhite)" }}>{j.notes}</p>}
                      <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--steel)" }}>
                        {(j.photos || []).length > 0 && <span className="inline-flex items-center gap-1"><Camera size={12} /> {j.photos.length} photo{j.photos.length > 1 ? "s" : ""}</span>}
                        {(j.partsUsed || []).length > 0 && <span>{j.partsUsed.length} part{j.partsUsed.length > 1 ? "s" : ""} used{partsTotal ? ` · ${money(partsTotal)}` : ""}</span>}
                      </div>
                      {(j.photos || []).length > 0 && (
                        <div className="flex gap-1.5">
                          {j.photos.slice(0, 5).map((p) => <img key={p.id} src={p.url} alt={p.tag} className="w-12 h-12 rounded-lg object-cover" loading="lazy" />)}
                        </div>
                      )}
                    </Card>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-2">
        {!confirmDelete ? (
          <Btn variant="danger" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Delete customer</Btn>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--steel)" }}>
            Delete {selected.name} and their bikes? Jobs stay on the board.
            <Btn variant="primary" size="sm" onClick={() => { onDeleteCustomer(selected.id); setSelectedId(null); setConfirmDelete(false); }}>Yes, delete</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Btn>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="hidden lg:flex">
      {customers.length > 0 && (
        <EmptyState icon={Users} title="Pick a customer">Select someone from the list to see their bikes and service history.</EmptyState>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-5 items-start">
      {list}
      {detail}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="New customer">
        <CustomerForm onSubmit={saveNew} onCancel={() => setFormOpen(false)} />
      </Modal>
      <Modal open={!!bikeModal && !!selected} onClose={() => setBikeModal(null)} title={bikeModal?.bike ? "Edit bike" : `Add a bike for ${selected?.name || ""}`}>
        <BikeForm initial={bikeModal?.bike} onSubmit={saveBike} onCancel={() => setBikeModal(null)} />
      </Modal>
    </div>
  );
}
