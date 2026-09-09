"use client";

import { use, useEffect, useMemo, useState, type ChangeEvent, type MouseEvent } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { fetchBoat, type Boat } from "@/app/data/boats";
import { supabase } from "@/lib/supabase";
import { DUE_SOON_DAYS, isOverdue, isWithinDays, summarizeDueDates } from "@/lib/due";
import { engineServiceInterval, isEngineServiceDue } from "@/lib/engine-service";

const tabs = ["Overview", "Maintenance", "To-Do"] as const;
const maintenanceTabs = ["Vessel Maintenance", "Engine Maintenance"] as const;
const categories = ["Repair", "Routine Maintenance", "Observation", "Admin"] as const;
const statuses = ["Open Issue", "Scheduled", "Done"] as const;

const vesselSystems = [
  "Hull", "Deck", "Fuel System", "Electrical",
  "Helm / Controls", "Console", "Equipment", "Trailer", "Administrative",
];

const engineSystems = [
  "Fuel System",
  "Cooling System",
  "Engine Oil",
  "Electrical",
  "Ignition",
  "Sensors & ECU",
  "Trim & Tilt",
  "Midsection",
  "Lower Unit",
  "Propeller",
  "Tiller",
  "Exterior & Cowling",
];

const MAINTENANCE_PHOTO_BUCKET = "maintenance-photos";

type Category = typeof categories[number];
type Status = typeof statuses[number];
type TargetType = "boat" | "engine";

type Engine = {
  id: number;
  engine_code: string;
  boat_id: number | null;
  position: "Single" | "Port" | "Starboard" | "Other";
  make: string | null;
  model: string | null;
  year: string | null;
  serial_number: string | null;
  horsepower: number | null;
  engine_url: string | null;
  schematic: string | null;
  lifetime_hours: number;
  service_hours: number;
  service_interval_hours: number;
  notes: string | null;
};

type Pin = {
  id: number;
  x: number;
  y: number;
  name: string;
  system: string;
};

type MaintenanceRecord = {
  id: number;
  target_type: TargetType;
  boat_id: number | null;
  engine_id: number | null;
  boat_id_at_time: number | null;
  pin_id: number | null;
  engine_pin_id: number | null;
  title: string;
  item: string | null;
  description: string | null;
  system: string;
  category: Category;
  status: Status;
  date_created: string;
  due_date: string | null;
  completed_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  work_order: string | null;
  notes: string;
  attachments: string[];
  cost: number | null;
};

type EditorState = {
  record_id: number | null;
  target_type: TargetType;
  engine_id: number | null;
  pin_id: number | null;
  engine_pin_id: number | null;
  title: string;
  item: string;
  description: string;
  system: string;
  category: Category;
  status: Status;
  date_created: string;
  due_date: string;
  completed_date: string;
  completed_at: string | null;
  completed_by: string;
  work_order: string;
  notes: string;
  cost: string;
  attachments: string[];
};

const emptyEditor = (target_type: TargetType = "boat", system?: string, engine_id: number | null = null): EditorState => ({
  record_id: null,
  target_type,
  engine_id,
  pin_id: null,
  engine_pin_id: null,
  title: "",
  item: "",
  description: "",
  system: system ?? (target_type === "engine" ? engineSystems[0] : vesselSystems[0]),
  category: "Repair",
  status: "Open Issue",
  date_created: hawaiiDate(),
  due_date: "",
  completed_date: "",
  completed_at: null,
  completed_by: "",
  work_order: "",
  notes: "",
  cost: "",
  attachments: [],
});

function safeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function maintenancePhotoUrl(path: string) {
  return supabase.storage.from(MAINTENANCE_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export default function BoatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const boat_id = Number(id);
  const [boat, setBoat] = useState<Boat | null>(null);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    if (!Number.isInteger(boat_id)) return;
    setLoading(true);
    setError(null);
    try {
      const loadedBoat = await fetchBoat(supabase, boat_id);
      if (!loadedBoat) throw new Error("Boat not found");
      setBoat(loadedBoat);

      const engineResult = await supabase.from("engines").select("*").eq("boat_id", boat_id).order("position");
      if (engineResult.error) throw engineResult.error;
      const loadedEngines = (engineResult.data ?? []) as Engine[];
      setEngines(loadedEngines);

      const boatRecordsResult = await supabase
        .from("maintenance_records")
        .select("*")
        .eq("boat_id", boat_id)
        .eq("target_type", "boat")
        .order("date_created", { ascending: false });
      if (boatRecordsResult.error) throw boatRecordsResult.error;

      let engineRecords: MaintenanceRecord[] = [];
      const engineIds = loadedEngines.map((engine) => engine.id);
      if (engineIds.length) {
        const engineRecordsResult = await supabase
          .from("maintenance_records")
          .select("*")
          .in("engine_id", engineIds)
          .eq("target_type", "engine")
          .order("date_created", { ascending: false });
        if (engineRecordsResult.error) throw engineRecordsResult.error;
        engineRecords = (engineRecordsResult.data ?? []) as MaintenanceRecord[];
      }

      setRecords([...(boatRecordsResult.data ?? []), ...engineRecords] as MaintenanceRecord[]);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Could not load vessel data.");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void loadAll(); }, [boat_id]);

  if (loading) return <main className="page-shell" style={{ color: "#f8fafc" }}>Loading vessel…</main>;
  if (error) return <main className="page-shell" style={{ color: "#fca5a5" }}>{error}</main>;
  if (!boat) return <main className="page-shell">Boat not found.</main>;

  const activeItems = records.filter((record) => record.status !== "Done");
  const dueSummary = summarizeDueDates(activeItems);
  const serviceDue = engines.filter(isEngineServiceDue);

  return (
    <main className="page-shell" style={{ color: "#f8fafc" }}>
      <Link href="/" style={{ color: "#38bdf8", textDecoration: "none" }}>← Back to Fleet</Link>
      <h1 style={{ fontSize: "3rem", margin: "1rem 0 0" }}>{boat.name}</h1>
      <p style={{ fontSize: "1.1rem", margin: ".25rem 0" }}>{boat.boat_code} · {boat.type}</p>

      <div className="boat-status-row">
        <span style={badgeStyle(boat.status === "Active" ? "#166534" : "#475569")}>{boat.status}</span>
        {dueSummary.overdue > 0 && <span style={badgeStyle("#991b1b")}>{dueSummary.overdue} overdue</span>}
        {dueSummary.dueSoon > 0 && <span style={badgeStyle("#92400e")}>{dueSummary.dueSoon} due within {DUE_SOON_DAYS} days</span>}
        {serviceDue.length > 0 && <span style={badgeStyle("#991b1b")}>{serviceDue.length} engine service {serviceDue.length === 1 ? "due" : "items due"}</span>}
        {dueSummary.overdue === 0 && dueSummary.dueSoon === 0 && serviceDue.length === 0 && <span style={badgeStyle("#1e3a5f")}>Nothing due soon</span>}
      </div>

      <nav className="boat-tabs">
        {tabs.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`boat-tab ${activeTab === tab ? "boat-tab-active" : ""}`}>{tab}</button>)}
      </nav>

      {activeTab === "Overview" && <Overview boat={boat} engines={engines} onChanged={loadAll} />}
      {activeTab === "Maintenance" && <MaintenanceLog boat={boat} engines={engines} records={records} onChanged={loadAll} />}
      {activeTab === "To-Do" && <TodoView boat={boat} engines={engines} records={records} onChanged={loadAll} />}
    </main>
  );
}

function Overview({ boat, engines, onChanged }: { boat: Boat; engines: Engine[]; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...boat });
  const [engineInventory, setEngineInventory] = useState<Engine[]>([]);
  const [assigningEngine, setAssigningEngine] = useState(false);

  async function loadEngineInventory() {
    const { data, error } = await supabase.from("engines").select("*").order("engine_code");
    if (error) {
      console.error("Could not load engine inventory:", error);
      return;
    }
    setEngineInventory((data ?? []) as Engine[]);
  }

  useEffect(() => { void loadEngineInventory(); }, [boat.id]);

  async function assignEngine(position: Engine["position"], engineId: string) {
    setAssigningEngine(true);
    try {
      const current = engines.find((engine) => engine.position === position);
      const nextId = engineId ? Number(engineId) : null;

      if (current && current.id !== nextId) {
        const { error } = await supabase.from("engines").update({ boat_id: null, position: "Other" }).eq("id", current.id);
        if (error) throw error;
      }

      if (nextId) {
        const { error } = await supabase.from("engines").update({ boat_id: boat.id, position }).eq("id", nextId);
        if (error) throw error;
      }

      await Promise.all([onChanged(), loadEngineInventory()]);
    } catch (error) {
      alert(`Could not change engine assignment:

${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setAssigningEngine(false);
    }
  }

  async function saveBoat() {
    if (!form.name.trim() || !form.boat_code.trim()) return alert("Vessel name and Boat ID are required.");
    setSaving(true);
    const values = {
      boat_code: form.boat_code.trim(), name: form.name.trim(), nickname: form.nickname?.trim() || null,
      type: form.type.trim(), status: form.status, location: form.location.trim(), make: form.make?.trim() || null,
      model: form.model?.trim() || null, year: form.year?.trim() || null, length: form.length?.trim() || null,
      hull_number: form.hull_number?.trim() || null, registration: form.registration?.trim() || null,
      fuel_capacity: form.fuel_capacity?.trim() || null, battery_type: form.battery_type?.trim() || null,
      photo: form.photo?.trim() || null, schematic: form.schematic?.trim() || null, notes: form.notes?.trim() || null,
    };
    const { error } = await supabase.from("boats").update(values).eq("id", boat.id);
    setSaving(false);
    if (error) return alert(`Could not save vessel details:\n\n${error.message}`);
    setEditing(false);
    await onChanged();
  }

  const field = (key: keyof Boat, label: string) => <label><div style={labelStyle}>{label}</div><input value={String(form[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={inputStyle} /></label>;

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0 }}>Vessel Overview</h2>
        <button style={buttonStyle} onClick={() => { setForm({ ...boat }); setEditing(true); }}>Edit Vessel Details</button>
      </div>
      <div className="responsive-grid">
        <div>
          {boat.photo ? <img src={boat.photo} alt={boat.name} style={{ width: "100%", borderRadius: "16px", display: "block" }} /> : <div style={cardStyle}>No vessel photo entered.</div>}
        </div>
        <div style={{ display: "grid", gap: "1rem" }}>
          <div style={infoCardStyle}>
            <h3 style={{ marginTop: 0 }}>Vessel Details</h3>
            <InfoRow label="Boat ID" value={boat.boat_code} />
            <InfoRow label="Make" value={boat.make ?? "TBD"} />
            <InfoRow label="Model" value={boat.model ?? "TBD"} />
            <InfoRow label="Year" value={boat.year ?? "TBD"} />
            <InfoRow label="Length" value={boat.length ?? "TBD"} />
            <InfoRow label="Hull Number" value={boat.hull_number ?? "TBD"} />
            <InfoRow label="Registration" value={boat.registration ?? "TBD"} />
            <InfoRow label="Fuel Capacity" value={boat.fuel_capacity ?? "TBD"} />
            <InfoRow label="Battery Type" value={boat.battery_type ?? "TBD"} />
            <InfoRow label="Location" value={boat.location} />
          </div>
        </div>
      </div>

      <h2 style={{ marginTop: "1.5rem" }}>Installed Engines</h2>
      <div style={{ ...cardStyle, marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Change Installed Engines</h3>
        <p style={{ color: "#94a3b8", marginTop: 0 }}>Choose an available motor for each position. Removing a motor keeps its hours and maintenance history in the engine inventory.</p>
        <div className="responsive-grid-equal">
          {(["Single", "Port", "Starboard"] as const).map((position) => {
            const current = engines.find((engine) => engine.position === position);
            const available = engineInventory.filter((engine) => engine.boat_id == null || engine.boat_id === boat.id);
            return <label key={position}><div style={labelStyle}>{position}</div><select disabled={assigningEngine} value={current?.id ?? ""} onChange={(e) => void assignEngine(position, e.target.value)} style={inputStyle}>
              <option value="">No engine</option>
              {available.map((engine) => <option key={engine.id} value={engine.id}>{engine.engine_code} · {[engine.make, engine.model].filter(Boolean).join(" ") || "Engine"}{engine.horsepower ? ` · ${engine.horsepower} hp` : ""}</option>)}
            </select></label>;
          })}
        </div>
      </div>
      {engines.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "1rem" }}>
        {engines.map((engine) => <EngineCard key={engine.id} engine={engine} onChanged={onChanged} />)}
      </div> : <div style={cardStyle}>No engines are currently assigned to this boat.</div>}

      <div style={{ ...cardStyle, marginTop: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Notes</h3>
        <p style={{ color: "#cbd5e1", marginBottom: 0 }}>{boat.notes ?? "No notes entered."}</p>
      </div>
      {editing && <RecordEditorModal onClose={() => setEditing(false)}>
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}><h2 style={{ marginTop: 0 }}>Edit Vessel Details</h2><button style={{ ...buttonStyle, background: "#475569" }} onClick={() => setEditing(false)}>Close</button></div>
          <div className="responsive-grid-equal">
            {field("boat_code", "Boat ID")}{field("name", "Name")}{field("nickname", "Nickname")}{field("type", "Vessel Type")}
            <label><div style={labelStyle}>Status</div><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Boat["status"] })} style={inputStyle}><option>Active</option><option>Inactive</option></select></label>
            {field("location", "Location")}{field("make", "Make")}{field("model", "Model")}{field("year", "Year")}{field("length", "Length")}{field("hull_number", "Hull Number")}{field("registration", "Registration")}{field("fuel_capacity", "Fuel Capacity")}{field("battery_type", "Battery Type")}{field("photo", "Photo URL")}{field("schematic", "Schematic URL")}
          </div>
          <label style={{ display: "block", marginTop: ".75rem" }}><div style={labelStyle}>Notes</div><textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, minHeight: "110px" }} /></label>
          <button disabled={saving} style={{ ...buttonStyle, marginTop: "1rem", opacity: saving ? .65 : 1 }} onClick={() => void saveBoat()}>{saving ? "Saving…" : "Save Vessel Details"}</button>
        </div>
      </RecordEditorModal>}
    </section>
  );
}

function EngineCard({ engine, onChanged }: { engine: Engine; onChanged: () => Promise<void> }) {
  const [lifetime_hours, setLifetime] = useState(String(engine.lifetime_hours ?? 0));
  const [service_hours, setService] = useState(String(engine.service_hours ?? 0));
  const serviceDue = isEngineServiceDue({ ...engine, service_hours: Number(service_hours) });

  async function saveHours(reset = false) {
    const values = reset ? { lifetime_hours: Number(lifetime_hours) || 0, service_hours: 0 } : { lifetime_hours: Number(lifetime_hours) || 0, service_hours: Number(service_hours) || 0 };
    const { error } = await supabase.from("engines").update(values).eq("id", engine.id);
    if (error) return alert(`Could not save engine hours:\n\n${error.message}`);
    if (reset) setService("0");
    await onChanged();
  }

  return <div style={{ ...infoCardStyle, borderColor: serviceDue ? "#ef4444" : "#334155" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start" }}>
      <div><h3 style={{ margin: 0 }}>{engine.position} Engine</h3><div style={{ color: "#94a3b8" }}>{engine.engine_code} · {[engine.make, engine.model].filter(Boolean).join(" ") || "Engine"}</div></div>
      {serviceDue && <span style={badgeStyle("#991b1b")}>SERVICE DUE</span>}
    </div>
    <InfoRow label="Serial" value={engine.serial_number ?? "TBD"} />
    <InfoRow label="Horsepower" value={engine.horsepower ? `${engine.horsepower} hp` : "TBD"} />
    <div style={{ marginTop: ".75rem" }}>
      <label><div style={labelStyle}>Lifetime Hours</div><input type="number" step="0.1" min="0" value={lifetime_hours} onChange={(e) => setLifetime(e.target.value)} style={inputStyle} /></label>
      <label style={{ display: "block", marginTop: ".6rem" }}><div style={labelStyle}>Since Last Service</div><input type="number" step="0.1" min="0" value={service_hours} onChange={(e) => setService(e.target.value)} style={inputStyle} /></label>
      <div style={{ color: serviceDue ? "#fca5a5" : "#94a3b8", marginTop: ".5rem" }}>Service interval: {engineServiceInterval(engine)} hrs</div>
      <div style={{ display: "flex", gap: ".5rem", marginTop: ".75rem", flexWrap: "wrap" }}>
        <button style={buttonStyle} onClick={() => void saveHours(false)}>Save Hours</button>
        <button style={{ ...buttonStyle, background: "#475569" }} onClick={() => void saveHours(true)}>Reset Since Service</button>
      </div>
    </div>
  </div>;
}

function MaintenanceLog({ boat, engines, records, onChanged }: { boat: Boat; engines: Engine[]; records: MaintenanceRecord[]; onChanged: () => Promise<void> }) {
  const [maintenanceTab, setMaintenanceTab] = useState<typeof maintenanceTabs[number]>("Vessel Maintenance");
  const [systemFilter, setSystemFilter] = useState("All");
  const [boatPins, setBoatPins] = useState<Pin[]>([]);
  const [enginePins, setEnginePins] = useState<Record<number, Pin[]>>({});
  const [placing, setPlacing] = useState<{ target_type: TargetType; engine_id: number | null } | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [selectedPin, setSelectedPin] = useState<{ pin: Pin; target_type: TargetType; engine_id: number | null } | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [draftPin, setDraftPin] = useState<{ target_type: TargetType; id: number } | null>(null);
  const [reportPeriod, setReportPeriod] = useState("30");

  const targetType: TargetType = maintenanceTab === "Vessel Maintenance" ? "boat" : "engine";
  const baseSystems = targetType === "boat" ? vesselSystems : engineSystems;
  const tabRecords = records.filter((record) => record.target_type === targetType);

  async function loadPins() {
    const boatResult = await supabase.from("maintenance_pins").select("*").eq("boat_id", boat.id).order("created_at");
    if (!boatResult.error) setBoatPins((boatResult.data ?? []) as Pin[]);
    if (engines.length) {
      const engineResult = await supabase.from("engine_pins").select("*").in("engine_id", engines.map((engine) => engine.id)).order("created_at");
      if (!engineResult.error) {
        const grouped: Record<number, Pin[]> = {};
        for (const pin of engineResult.data ?? []) (grouped[pin.engine_id] ??= []).push(pin as Pin);
        setEnginePins(grouped);
      }
    } else {
      setEnginePins({});
    }
  }

  const engineIdKey = engines.map((engine) => engine.id).join(",");
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void loadPins(); }, [boat.id, engineIdKey]);

  function switchMaintenanceTab(tab: typeof maintenanceTabs[number]) {
    setMaintenanceTab(tab);
    setSystemFilter("All");
    setPlacing(null);
  }

  const systemOptions = useMemo(
    () => Array.from(new Set(["All", ...baseSystems, ...tabRecords.map((record) => record.system).filter(Boolean)])),
    [baseSystems, tabRecords],
  );
  const filteredRecords = systemFilter === "All" ? tabRecords : tabRecords.filter((record) => record.system === systemFilter);

  async function placePin(event: MouseEvent<HTMLDivElement>, target_type: TargetType, engine_id: number | null) {
    if (!placing || placing.target_type !== target_type || placing.engine_id !== engine_id) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;

    if (target_type === "boat") {
      const initialSystem = vesselSystems[0];
      const { data, error } = await supabase.from("maintenance_pins").insert({ boat_id: boat.id, x, y, name: "", system: initialSystem }).select().single();
      if (error) return alert(`Could not save pin:\n\n${error.message}`);
      setPlacing(null);
      await loadPins();
      setEditor({ ...emptyEditor("boat", initialSystem), pin_id: data.id });
      setDraftPin({ target_type: "boat", id: data.id });
      return;
    }

    const initialSystem = engineSystems[0];
    const { data, error } = await supabase.from("engine_pins").insert({ engine_id, x, y, name: "", system: initialSystem }).select().single();
    if (error) return alert(`Could not save pin:\n\n${error.message}`);
    setPlacing(null);
    await loadPins();
    setEditor({ ...emptyEditor("engine", initialSystem, engine_id), engine_pin_id: data.id });
    setDraftPin({ target_type: "engine", id: data.id });
  }

  function openBoatPin(pin: Pin) {
    setSelectedPin({ pin, target_type: "boat", engine_id: null });
  }

  function openEnginePin(pin: Pin, engine_id: number) {
    setSelectedPin({ pin, target_type: "engine", engine_id });
  }

  function addRecordToSelectedPin() {
    if (!selectedPin) return;
    setDraftPin(null);
    if (selectedPin.target_type === "boat") {
      setEditor({ ...emptyEditor("boat", selectedPin.pin.system), pin_id: selectedPin.pin.id });
      return;
    }
    setEditor({ ...emptyEditor("engine", selectedPin.pin.system, selectedPin.engine_id), engine_pin_id: selectedPin.pin.id });
  }

  function startEdit(record: MaintenanceRecord) {
    setDraftPin(null);
    setEditor(toEditorState(record));
  }

  async function deleteRecord(record: MaintenanceRecord) {
    if (!confirm(`Delete "${record.title}"?`)) return;
    const { error } = await supabase.from("maintenance_records").delete().eq("id", record.id);
    if (error) return alert(`Could not delete record:\n\n${error.message}`);
    if (record.attachments?.length) await supabase.storage.from(MAINTENANCE_PHOTO_BUCKET).remove(record.attachments);
    await onChanged();
    await loadPins();
  }

  async function deleteEmptyPin() {
    if (!selectedPin || selectedPinRecords.length) return;
    if (!confirm("Delete this empty pin?")) return;
    const table = selectedPin.target_type === "boat" ? "maintenance_pins" : "engine_pins";
    const { error } = await supabase.from(table).delete().eq("id", selectedPin.pin.id);
    if (error) return alert(`Could not delete pin:\n\n${error.message}`);
    setSelectedPin(null);
    await loadPins();
  }

  async function closeEditor() {
    if (draftPin) {
      const table = draftPin.target_type === "boat" ? "maintenance_pins" : "engine_pins";
      await supabase.from(table).delete().eq("id", draftPin.id);
      setDraftPin(null);
      await loadPins();
    }
    setEditor(null);
  }

  function exportCompletedReport() {
    const cutoff = reportPeriod === "all" ? null : new Date(Date.now() - Number(reportPeriod) * 86400000);
    const done = records.filter((record) => {
      if (record.status !== "Done") return false;
      if (!record.completed_at && !record.completed_date) return false;
      const completed = new Date(record.completed_at ?? `${record.completed_date}T12:00:00-10:00`);
      return !cutoff || completed >= cutoff;
    });
    const engineById = Object.fromEntries(engines.map((engine) => [engine.id, engine]));
    downloadCsv(`${boat.boat_code}-completed-work-${reportPeriod === "all" ? "all-time" : `last-${reportPeriod}-days`}.csv`, done.map((record) => ({
      boat_code: boat.boat_code, completed_at: record.completed_at ?? "", completed_date: record.completed_date ?? "",
      record_type: record.target_type === "engine" ? "Engine" : "Vessel", engine_code: record.engine_id ? engineById[record.engine_id]?.engine_code ?? "" : "",
      title: record.title, system: record.system, category: record.category, completed_by: record.completed_by ?? "",
      work_order: record.work_order ?? "", cost: record.cost ?? "", notes: record.notes ?? "",
    })));
  }

  function exportCsv() {
    const engineById = Object.fromEntries(engines.map((engine) => [engine.id, engine]));
    const rows = filteredRecords.map((record) => ({
      boat_code: boat.boat_code,
      record_type: record.target_type === "engine" ? "Engine" : "Vessel",
      engine_code: record.engine_id ? engineById[record.engine_id]?.engine_code ?? "" : "",
      engine_position: record.engine_id ? engineById[record.engine_id]?.position ?? "" : "",
      title: record.title,
      system: record.system,
      category: record.category,
      status: record.status,
      date_created: record.date_created,
      due_date: record.due_date ?? "",
      completed_date: record.completed_date ?? "",
      completed_by: record.completed_by ?? "",
      work_order: record.work_order ?? "",
      cost: record.cost ?? "",
      notes: record.notes ?? "",
    }));
    downloadCsv(`${boat.boat_code}-${targetType === "boat" ? "vessel" : "engine"}-maintenance.csv`, rows);
  }

  function addRecord() {
    setDraftPin(null);
    const selectedSystem = systemFilter === "All" ? baseSystems[0] : systemFilter;
    if (targetType === "engine" && !engines.length) return alert("No engines are assigned to this vessel yet.");
    setEditor(emptyEditor(targetType, selectedSystem, targetType === "engine" ? engines[0]?.id ?? null : null));
  }

  const selectedPinRecords = selectedPin
    ? records
      .filter((record) => selectedPin.target_type === "boat"
        ? record.target_type === "boat" && record.pin_id === selectedPin.pin.id
        : record.target_type === "engine" && record.engine_id === selectedPin.engine_id && record.engine_pin_id === selectedPin.pin.id)
      .sort((a, b) => b.date_created.localeCompare(a.date_created) || b.id - a.id)
    : [];

  return <section style={panelStyle}>
    <div style={{ ...cardStyle, marginBottom: "1rem", display: "flex", alignItems: "end", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
      <div><h3 style={{ margin: 0 }}>Completed Work Report</h3><div style={{ color: "#94a3b8", marginTop: ".35rem" }}>Export completed vessel and engine work for this boat.</div></div>
      <div style={{ display: "flex", gap: ".5rem", alignItems: "end", flexWrap: "wrap" }}><label><div style={labelStyle}>Period</div><select value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)} style={inputStyle}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="365">Last year</option><option value="all">All time</option></select></label><button style={{ ...buttonStyle, background: "#0f766e" }} onClick={exportCompletedReport}>Export Completed CSV</button></div>
    </div>
    <nav className="maintenance-tabs" aria-label="Maintenance type">
      {maintenanceTabs.map((tab) => <button key={tab} type="button" onClick={() => switchMaintenanceTab(tab)} className={`maintenance-tab ${maintenanceTab === tab ? "maintenance-tab-active" : ""}`}>{tab}</button>)}
    </nav>

    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
      <div style={{ flex: "1 1 320px" }}>
        <h2 style={{ marginTop: 0 }}>{maintenanceTab}</h2>
        <label><div style={{ ...labelStyle, fontSize: "1.05rem" }}>SYSTEM FILTER</div>
          <select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)} style={{ ...inputStyle, borderColor: "#38bdf8", fontWeight: 700 }}>
            {systemOptions.map((system) => <option key={system}>{system}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <button style={buttonStyle} onClick={addRecord}>Add Maintenance Record</button>
        <button style={{ ...buttonStyle, background: "#0f766e" }} onClick={exportCsv}>Export CSV</button>
      </div>
    </div>

    {targetType === "boat" ? (
      <SchematicPanel
        title={`${boat.boat_code} Vessel Schematic`}
        schematic={boat.schematic}
        pins={boatPins.filter((pin) => systemFilter === "All" || pin.system === systemFilter)}
        records={tabRecords}
        placing={placing?.target_type === "boat"}
        onAddPin={() => setPlacing(placing?.target_type === "boat" ? null : { target_type: "boat", engine_id: null })}
        onPlace={(event) => void placePin(event, "boat", null)}
        onPin={openBoatPin}
        pinField="pin_id"
      />
    ) : engines.length ? (
      <div className="maintenance-schematic-grid">
        {engines.map((engine) => <SchematicPanel
          key={engine.id}
          title={`${engine.position} Engine · ${engine.engine_code}`}
          schematic={engine.schematic}
          pins={(enginePins[engine.id] ?? []).filter((pin) => systemFilter === "All" || pin.system === systemFilter)}
          records={tabRecords.filter((record) => record.engine_id === engine.id)}
          placing={placing?.target_type === "engine" && placing.engine_id === engine.id}
          onAddPin={() => setPlacing(placing?.target_type === "engine" && placing.engine_id === engine.id ? null : { target_type: "engine", engine_id: engine.id })}
          onPlace={(event) => void placePin(event, "engine", engine.id)}
          onPin={(pin) => openEnginePin(pin, engine.id)}
          pinField="engine_pin_id"
        />)}
      </div>
    ) : <div style={{ ...cardStyle, marginTop: "1.25rem" }}>No engines are currently assigned to this vessel.</div>}

    <h2>{targetType === "boat" ? "Vessel" : "Engine"} Maintenance Records</h2>
    <div style={{ display: "grid", gap: ".75rem" }}>
      {filteredRecords.length ? filteredRecords.map((record) => <RecordCard key={record.id} record={record} engines={engines} onEdit={() => startEdit(record)} onDelete={() => void deleteRecord(record)} onPhoto={setSelectedPhotoUrl} />) : <div style={cardStyle}>No records match this system.</div>}
    </div>

    {selectedPin && <PinHistoryModal
      pin={selectedPin.pin}
      target_type={selectedPin.target_type}
      engine={selectedPin.engine_id ? engines.find((engine) => engine.id === selectedPin.engine_id) ?? null : null}
      records={selectedPinRecords}
      engines={engines}
      onClose={() => setSelectedPin(null)}
      onAddRecord={addRecordToSelectedPin}
      onEdit={(record) => setEditor(toEditorState(record))}
      onDelete={(record) => void deleteRecord(record)}
      onDeletePin={() => void deleteEmptyPin()}
      onPhoto={setSelectedPhotoUrl}
    />}
    {editor && <RecordEditorModal onClose={() => void closeEditor()}>
      <RecordEditor boat={boat} engines={engines} state={editor} setState={setEditor} onClose={() => void closeEditor()} onSaved={async () => { setDraftPin(null); setEditor(null); await onChanged(); await loadPins(); }} />
    </RecordEditorModal>}
    {selectedPhotoUrl && <div onClick={() => setSelectedPhotoUrl(null)} style={photoOverlayStyle}><img src={selectedPhotoUrl} alt="Maintenance attachment" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "95vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "10px" }} /></div>}
  </section>;
}

function PinHistoryModal({ pin, target_type, engine, records, engines, onClose, onAddRecord, onEdit, onDelete, onDeletePin, onPhoto }: {
  pin: Pin;
  target_type: TargetType;
  engine: Engine | null;
  records: MaintenanceRecord[];
  engines: Engine[];
  onClose: () => void;
  onAddRecord: () => void;
  onEdit: (record: MaintenanceRecord) => void;
  onDelete: (record: MaintenanceRecord) => void;
  onDeletePin: () => void;
  onPhoto: (url: string) => void;
}) {
  if (typeof document === "undefined") return null;
  const label = pin.name || pin.system || "Maintenance Pin";
  const locationLabel = target_type === "boat" ? "Vessel" : engine ? `${engine.position} Engine · ${engine.engine_code}` : "Engine";
  return createPortal(
    <div role="dialog" aria-modal="true" style={pinHistoryOverlayStyle} onMouseDown={onClose}>
      <div style={pinHistoryModalStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>{label}</h2>
            <div style={{ color: "#94a3b8", marginTop: ".35rem" }}>{locationLabel} · {pin.system}</div>
            <div style={{ color: "#cbd5e1", marginTop: ".35rem" }}>{records.length} maintenance record{records.length === 1 ? "" : "s"} on this pin</div>
          </div>
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            <button style={buttonStyle} onClick={onAddRecord}>Add a Record</button>
            {!records.length && <button style={dangerButtonStyle} onClick={onDeletePin}>Delete Empty Pin</button>}
            <button style={{ ...buttonStyle, background: "#475569" }} onClick={onClose}>Close</button>
          </div>
        </div>
        <div style={{ marginTop: "1rem", display: "grid", gap: ".75rem" }}>
          {records.length ? records.map((record) => <RecordCard
            key={record.id}
            record={record}
            engines={engines}
            onEdit={() => onEdit(record)}
            onDelete={() => onDelete(record)}
            onPhoto={onPhoto}
          />) : <div style={cardStyle}>No maintenance records are attached to this pin yet. Use <strong>Add a Record</strong> to create the first one.</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SchematicPanel({ title, schematic, pins, records, placing, onAddPin, onPlace, onPin, pinField }: { title: string; schematic: string | null; pins: Pin[]; records: MaintenanceRecord[]; placing: boolean; onAddPin: () => void; onPlace: (e: MouseEvent<HTMLDivElement>) => void; onPin: (pin: Pin) => void; pinField: "pin_id" | "engine_pin_id" }) {
  return <div className="schematic-panel">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}><h3 style={{ marginBottom: ".5rem" }}>{title}</h3><button style={{ ...buttonStyle, background: placing ? "#475569" : "#2563eb" }} onClick={onAddPin}>{placing ? "Cancel Pin Placement" : "Add Pin"}</button></div>
    {placing && <p style={{ color: "#7dd3fc" }}>Click the schematic to place a pin. The current System filter will be saved on that pin.</p>}
    {schematic ? <div onClick={onPlace} style={{ position: "relative", background: "#f8fafc", borderRadius: "12px", overflow: "hidden", cursor: placing ? "crosshair" : "default" }}>
      <img src={schematic} alt={title} style={{ width: "100%", display: "block", pointerEvents: "none" }} />
      {pins.map((pin) => {
        const related = records.filter((record) => record[pinField] === pin.id && record.status !== "Done");
        const color = related.some((record) => record.status === "Open Issue") ? "#ef4444" : related.some((record) => record.status === "Scheduled") ? "#3b82f6" : "#22c55e";
        return <button key={pin.id} title={`${pin.name || pin.system} · ${pin.system}`} onClick={(e) => { e.stopPropagation(); onPin(pin); }} style={pinStyle(pin.x, pin.y, color)}>•</button>;
      })}
    </div> : <div style={cardStyle}>No schematic set for this item.</div>}
  </div>;
}

function TodoView({ boat, engines, records, onChanged }: { boat: Boat; engines: Engine[]; records: MaintenanceRecord[]; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<EditorState | null>(null);
  const openIssues = records.filter((record) => record.status === "Open Issue").sort(sortDue);
  const scheduled = records.filter((record) => record.status === "Scheduled" && (isOverdue(record.due_date) || isWithinDays(record.due_date, DUE_SOON_DAYS))).sort(sortDue);

  async function markDone(record: MaintenanceRecord) {
    const { error } = await supabase.from("maintenance_records").update({ status: "Done", completed_date: hawaiiDate(), completed_at: new Date().toISOString() }).eq("id", record.id);
    if (error) return alert(`Could not update record:\n\n${error.message}`);
    await onChanged();
  }

  const list = (title: string, items: MaintenanceRecord[], empty: string) => <div style={cardStyle}>
    <h2 style={{ marginTop: 0 }}>{title}</h2>
    {items.length ? <div style={{ display: "grid", gap: ".75rem" }}>{items.map((record) => <div key={record.id} style={{ border: "1px solid #334155", borderRadius: "10px", padding: ".9rem" }}>
      <strong>{statusDot(record.status)} {record.title}</strong>
      <div style={{ color: "#94a3b8", marginTop: ".25rem" }}>{recordTargetLabel(record, engines)} · {record.system} · {record.category}</div>
      <div style={{ marginTop: ".35rem" }}>{record.due_date ? `Due ${formatDate(record.due_date)}` : "No due date"}{record.cost != null ? ` · $${Number(record.cost).toFixed(2)}` : ""}</div>
      {record.notes && <p style={{ color: "#cbd5e1" }}>{record.notes}</p>}
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}><button type="button" style={buttonStyle} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setEditing(toEditorState(record)); }}>Edit</button><button type="button" style={{ ...buttonStyle, background: "#166534" }} onClick={() => void markDone(record)}>Mark Done</button></div>
    </div>)}</div> : <p style={{ color: "#94a3b8", marginBottom: 0 }}>{empty}</p>}
  </div>;

  return <section style={panelStyle}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
      <p style={{ color: "#94a3b8", margin: 0 }}>To-Do is a live view of maintenance records, so a repair never has to be entered twice.</p>
      <button type="button" style={buttonStyle} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setEditing(emptyEditor("boat")); }}>Add To-Do</button>
    </div>
    <div className="responsive-grid-equal">{list("Open Issues", openIssues, "No open issues.")}{list(`Scheduled · within ${DUE_SOON_DAYS} days`, scheduled, `Nothing scheduled within ${DUE_SOON_DAYS} days.`)}</div>
    {editing && <RecordEditorModal onClose={() => setEditing(null)}>
      <RecordEditor boat={boat} engines={engines} state={editing} setState={setEditing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await onChanged(); }} />
    </RecordEditorModal>}
  </section>;
}

function RecordEditorModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div role="dialog" aria-modal="true" style={recordEditorOverlayStyle} onClick={onClose}>
      <div style={recordEditorModalStyle} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function RecordEditor({ boat, engines, state, setState, onClose, onSaved }: { boat: Boat; engines: Engine[]; state: EditorState; setState: (s: EditorState | null) => void; onClose: () => void; onSaved: () => Promise<void> }) {
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const options = state.target_type === "boat" ? vesselSystems : engineSystems;
  const update = <K extends keyof EditorState>(key: K, value: EditorState[K]) => setState({ ...state, [key]: value });
  const appliesTo = state.target_type === "boat" ? "boat" : `engine:${state.engine_id ?? ""}`;

  function changeTarget(value: string) {
    if (value === "boat") {
      setState({ ...state, target_type: "boat", engine_id: null, engine_pin_id: null, system: vesselSystems[0] });
      return;
    }
    const engine_id = Number(value.split(":")[1]);
    setState({ ...state, target_type: "engine", engine_id, pin_id: null, system: engineSystems[0] });
  }

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setPendingFiles((current) => [...current, ...files]);
    event.target.value = "";
  }

  async function save() {
    if (!state.title.trim()) return alert("Enter a title.");
    if (state.target_type === "engine" && !state.engine_id) return alert("Choose an engine.");

    setUploading(true);
    const uploadedPaths: string[] = [];
    try {
      for (const file of pendingFiles) {
        const path = `${boat.boat_code}/${crypto.randomUUID()}-${safeFileName(file.name) || "photo"}`;
        const { error } = await supabase.storage.from(MAINTENANCE_PHOTO_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (error) throw new Error(`Could not upload ${file.name}: ${error.message}`);
        uploadedPaths.push(path);
      }

      const attachments = [...state.attachments, ...uploadedPaths];
      const payload = {
        target_type: state.target_type,
        boat_id: state.target_type === "boat" ? boat.id : null,
        engine_id: state.target_type === "engine" ? state.engine_id : null,
        boat_id_at_time: state.target_type === "engine" ? boat.id : null,
        pin_id: state.target_type === "boat" ? state.pin_id : null,
        engine_pin_id: state.target_type === "engine" ? state.engine_pin_id : null,
        title: state.title.trim(),
        item: null,
        description: null,
        system: state.system,
        category: state.category,
        status: state.status,
        date_created: state.date_created,
        due_date: state.due_date || null,
        completed_date: state.status === "Done" ? (state.completed_date || hawaiiDate()) : null,
        completed_at: state.status === "Done" ? (state.completed_at || new Date().toISOString()) : null,
        completed_by: state.completed_by.trim() || null,
        work_order: state.work_order.trim() || null,
        notes: state.notes.trim(),
        attachments,
        cost: state.cost === "" ? null : Number(state.cost),
      };

      const result = state.record_id
        ? await supabase.from("maintenance_records").update(payload).eq("id", state.record_id)
        : await supabase.from("maintenance_records").insert(payload);
      if (result.error) throw new Error(`Could not save record: ${result.error.message}`);

      // The System chosen in this form is the source of truth for the pin too.
      if (state.target_type === "boat" && state.pin_id) {
        const pinResult = await supabase.from("maintenance_pins").update({ system: state.system, name: state.title.trim() }).eq("id", state.pin_id);
        if (pinResult.error) throw new Error(`Record saved, but the pin could not be updated: ${pinResult.error.message}`);
      } else if (state.target_type === "engine" && state.engine_pin_id) {
        const pinResult = await supabase.from("engine_pins").update({ system: state.system, name: state.title.trim() }).eq("id", state.engine_pin_id);
        if (pinResult.error) throw new Error(`Record saved, but the pin could not be updated: ${pinResult.error.message}`);
      }

      setPendingFiles([]);
      await onSaved();
    } catch (e) {
      if (uploadedPaths.length) await supabase.storage.from(MAINTENANCE_PHOTO_BUCKET).remove(uploadedPaths);
      alert(e instanceof Error ? e.message : "Could not save maintenance record.");
    } finally {
      setUploading(false);
    }
  }

  return <div style={{ ...cardStyle, borderColor: "#38bdf8" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}><h2 style={{ marginTop: 0 }}>{state.record_id ? "Edit Maintenance Record" : "Add Maintenance Record"}</h2><button onClick={onClose} style={{ ...buttonStyle, background: "#475569", alignSelf: "start" }}>Close</button></div>
    <div className="responsive-grid-equal">
      <label><div style={labelStyle}>Applies To</div><select value={appliesTo} onChange={(e) => changeTarget(e.target.value)} style={inputStyle}>
        <option value="boat">Vessel · {boat.boat_code}</option>
        {engines.map((engine) => <option key={engine.id} value={`engine:${engine.id}`}>{engine.position} Engine · {engine.engine_code} · {[engine.make, engine.model].filter(Boolean).join(" ")}</option>)}
      </select></label>
      <label><div style={labelStyle}>System</div><select value={state.system} onChange={(e) => update("system", e.target.value)} style={inputStyle}>{Array.from(new Set([...options, state.system])).map((system) => <option key={system}>{system}</option>)}</select></label>
      <label><div style={labelStyle}>Title</div><input value={state.title} onChange={(e) => update("title", e.target.value)} style={inputStyle} /></label>
      <label><div style={labelStyle}>Category</div><select value={state.category} onChange={(e) => update("category", e.target.value as Category)} style={inputStyle}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label><div style={labelStyle}>Status</div><select value={state.status} onChange={(e) => update("status", e.target.value as Status)} style={inputStyle}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label><div style={labelStyle}>Cost</div><input type="number" min="0" step="0.01" value={state.cost} onChange={(e) => update("cost", e.target.value)} style={inputStyle} placeholder="0.00" /></label>
      <label><div style={labelStyle}>Date Created</div><input type="date" value={state.date_created} onChange={(e) => update("date_created", e.target.value)} style={inputStyle} /></label>
      <label><div style={labelStyle}>Due Date</div><input type="date" value={state.due_date} onChange={(e) => update("due_date", e.target.value)} style={inputStyle} /></label>
      <label><div style={labelStyle}>Completed Date</div><input type="date" value={state.completed_date} onChange={(e) => update("completed_date", e.target.value)} style={inputStyle} /></label>
      <label><div style={labelStyle}>Completed By</div><input value={state.completed_by} onChange={(e) => update("completed_by", e.target.value)} style={inputStyle} /></label>
      <label><div style={labelStyle}>Work Order</div><input value={state.work_order} onChange={(e) => update("work_order", e.target.value)} style={inputStyle} /></label>
    </div>
    <label style={{ display: "block", marginTop: ".75rem" }}><div style={labelStyle}>Notes</div><textarea value={state.notes} onChange={(e) => update("notes", e.target.value)} style={{ ...inputStyle, minHeight: "100px" }} /></label>
    <label style={{ display: "block", marginTop: ".75rem" }}><div style={labelStyle}>Photos</div><input type="file" accept="image/*" multiple onChange={addPhotos} disabled={uploading} style={inputStyle} /></label>
    {pendingFiles.length > 0 && <div style={{ color: "#cbd5e1", marginTop: ".5rem" }}>{pendingFiles.length} photo{pendingFiles.length === 1 ? "" : "s"} selected: {pendingFiles.map((file) => file.name).join(", ")} <span style={{ color: "#94a3b8" }}>(uploads when you save)</span></div>}
    {state.attachments.length > 0 && <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginTop: ".75rem" }}>{state.attachments.map((path) => <a key={path} href={maintenancePhotoUrl(path)} target="_blank" rel="noreferrer" style={{ color: "#7dd3fc" }}>Uploaded photo</a>)}</div>}
    <button disabled={uploading} onClick={() => void save()} style={{ ...buttonStyle, marginTop: "1rem", opacity: uploading ? .65 : 1 }}>{uploading ? "Uploading & Saving…" : state.record_id ? "Save Changes" : "Save Record"}</button>
  </div>;
}

function RecordCard({ record, engines, onEdit, onDelete, onPhoto }: { record: MaintenanceRecord; engines: Engine[]; onEdit: () => void; onDelete: () => void; onPhoto: (url: string) => void }) {
  return <div style={cardStyle}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
      <div><h3 style={{ margin: 0 }}>{statusDot(record.status)} {record.title}</h3><div style={{ color: "#94a3b8", marginTop: ".25rem" }}>{recordTargetLabel(record, engines)} · {record.system}</div></div>
      <span style={badgeStyle(record.status === "Open Issue" ? "#991b1b" : record.status === "Scheduled" ? "#1d4ed8" : "#166534")}>{record.status}</span>
    </div>
    <p>{record.category}{record.cost != null ? ` · $${Number(record.cost).toFixed(2)}` : ""}</p>
    <p style={{ color: "#94a3b8" }}>Created {formatDate(record.date_created)}{record.due_date ? ` · Due ${formatDate(record.due_date)}` : ""}{record.completed_date ? ` · Completed ${formatDate(record.completed_date)}` : ""}</p>
    {record.notes && <p style={{ color: "#cbd5e1" }}>{record.notes}</p>}
    {record.attachments?.length > 0 && <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: ".75rem" }}>{record.attachments.map((path, i) => <button key={path} onClick={() => onPhoto(maintenancePhotoUrl(path))} style={{ ...buttonStyle, background: "#334155", padding: ".45rem .7rem" }}>Photo {i + 1}</button>)}</div>}
    <div style={{ display: "flex", gap: ".5rem" }}><button style={buttonStyle} onClick={onEdit}>Edit</button><button style={dangerButtonStyle} onClick={onDelete}>Delete</button></div>
  </div>;
}

function toEditorState(record: MaintenanceRecord): EditorState {
  return {
    record_id: record.id,
    target_type: record.target_type,
    engine_id: record.engine_id,
    pin_id: record.pin_id,
    engine_pin_id: record.engine_pin_id,
    title: record.title,
    item: record.item ?? "",
    description: record.description ?? "",
    system: record.system,
    category: record.category,
    status: record.status,
    date_created: record.date_created,
    due_date: record.due_date ?? "",
    completed_date: record.completed_date ?? "",
    completed_at: record.completed_at ?? null,
    completed_by: record.completed_by ?? "",
    work_order: record.work_order ?? "",
    notes: record.notes ?? "",
    cost: record.cost == null ? "" : String(record.cost),
    attachments: record.attachments ?? [],
  };
}

function recordTargetLabel(record: MaintenanceRecord, engines: Engine[]) {
  if (record.target_type === "boat") return "Vessel";
  const engine = engines.find((item) => item.id === record.engine_id);
  return engine ? `${engine.position} Engine · ${engine.engine_code}` : "Engine";
}
function sortDue(a: MaintenanceRecord, b: MaintenanceRecord) { return (a.due_date || "9999-99-99").localeCompare(b.due_date || "9999-99-99"); }
function statusDot(status: Status) { return status === "Open Issue" ? "🔴" : status === "Scheduled" ? "🔵" : "✅"; }
function formatDate(date: string) { if (!date) return "No date"; const [y,m,d] = date.split("-"); return new Date(Number(y), Number(m)-1, Number(d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function hawaiiDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Honolulu", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return alert("There are no records to export.");
  const headers = Object.keys(rows[0]);
  const esc = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map((row) => headers.map((header) => esc(row[header])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) { return <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: ".35rem 0", borderBottom: "1px solid #1e293b" }}><span style={{ color: "#94a3b8" }}>{label}</span><span style={{ textAlign: "right" }}>{value}</span></div>; }
function badgeStyle(bg: string) { return { background: bg, color: "white", padding: ".5rem .9rem", borderRadius: "8px", fontWeight: 700 }; }
function pinStyle(x: number, y: number, color: string) { return { position: "absolute" as const, left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)", width: "26px", height: "26px", borderRadius: "999px", border: "2px solid white", background: color, color: "white", fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,.45)" }; }
const infoCardStyle = { background: "#020617", border: "1px solid #334155", borderRadius: "12px", padding: "1rem" };
const labelStyle = { marginBottom: ".25rem", fontWeight: 700, color: "#cbd5e1" };
const panelStyle = { background: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "1rem" };
const cardStyle = { background: "#020617", border: "1px solid #334155", borderRadius: "12px", padding: "1rem" };
const inputStyle = { width: "100%", minWidth: 0, minHeight: "46px", boxSizing: "border-box" as const, padding: ".75rem", borderRadius: "8px", border: "1px solid #334155", background: "#020617", color: "#f8fafc" };
const buttonStyle = { padding: ".75rem 1rem", borderRadius: "10px", border: "none", background: "#2563eb", color: "white", fontWeight: 700, cursor: "pointer" };
const dangerButtonStyle = { ...buttonStyle, background: "#991b1b" };
const pinHistoryOverlayStyle = { position: "fixed" as const, inset: 0, zIndex: 900, display: "grid", placeItems: "center", background: "rgba(0,0,0,.78)", padding: "1rem", overflow: "hidden" };
const pinHistoryModalStyle = { width: "min(980px, 96vw)", maxHeight: "92vh", overflowY: "auto" as const, background: "#0f172a", border: "1px solid #334155", borderRadius: "14px", padding: "1rem", boxSizing: "border-box" as const, boxShadow: "0 24px 80px rgba(0,0,0,.6)" };
const recordEditorOverlayStyle = { position: "fixed" as const, inset: 0, zIndex: 1000, display: "grid", placeItems: "center", background: "rgba(0,0,0,.78)", padding: "1rem", overflow: "hidden" };
const recordEditorModalStyle = { width: "min(980px, 96vw)", maxHeight: "92vh", overflowY: "auto" as const, borderRadius: "14px", boxShadow: "0 24px 80px rgba(0,0,0,.6)" };
const photoOverlayStyle = { position: "fixed" as const, inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgba(0,0,0,.88)", padding: "1rem", cursor: "pointer" };
