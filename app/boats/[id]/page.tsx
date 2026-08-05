"use client";

import { use, useEffect, useState, type ChangeEvent, type MouseEvent } from "react";

import { fetchBoat, type Boat } from "@/app/data/boats";
import { supabase } from "@/lib/supabase";
import { DUE_SOON_DAYS, summarizeDueDates } from "@/lib/due";

const tabs = ["Overview", "Maintenance Log", "To-Do"];

const systems = [
  "Port Outboard",
  "Starboard Outboard",
  "Sponsons",
  "Speed Tube",
  "Hull",
  "Deck",
  "Fuel System",
  "Electrical",
  "Helm / Controls",
  "Console",
  "Equipment",
  "Trailer",
  "Administrative",
];

const MAINTENANCE_PHOTO_BUCKET = "maintenance-photos";

function maintenancePhotoUrl(path: string) {
  return supabase.storage
    .from(MAINTENANCE_PHOTO_BUCKET)
    .getPublicUrl(path).data.publicUrl;
}

function safeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Todo = {
  id: number;
  pinId?: number | null;

  title: string;
  system: string;
  item: string;
  category: string;
  dueDate: string;
  status: "Open Issue" | "Monitor" | "Scheduled";
  notes: string;
};

type Category =
  | "Repair"
  | "Maintenance"
  | "Inspection"
  | "Admin";

type Status =
  | "Open"
  | "Monitor"
  | "Done"
  | "Scheduled";

type Pin = {
  id: number;
  x: number;
  y: number;
  name: string;
};

type MaintenanceRecord = {
  id: number;
  boatId: number;
  pinId: number | null;

  title: string;
  item: string;
  description?: string;
  system: string;

  category: Category;
  status: Status;

  dateCreated: string;
  dueDate?: string;
  completedDate?: string;

  completedBy?: string;
  workOrder?: string;

  notes: string;

  attachments?: string[];
  cost?: number;
};

export default function BoatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const boatId = Number(id);
  const [boat, setBoat] = useState<Boat | null>(null);
  const [boatLoaded, setBoatLoaded] = useState(false);
  const [boatError, setBoatError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("Overview");

  useEffect(() => {
    let cancelled = false;

    async function loadBoat() {
      if (!Number.isInteger(boatId)) {
        setBoatLoaded(true);
        return;
      }

      try {
        const loadedBoat = await fetchBoat(supabase, boatId);
        if (!cancelled) setBoat(loadedBoat);
      } catch (error) {
        console.error("Could not load boat:", error);
        if (!cancelled) setBoatError("The vessel could not be loaded.");
      } finally {
        if (!cancelled) setBoatLoaded(true);
      }
    }

    void loadBoat();
    return () => {
      cancelled = true;
    };
  }, [boatId]);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoaded, setTodosLoaded] = useState(false);

  useEffect(() => {
    if (!boat) return;

    const boatId = boat.id;
    let cancelled = false;

    async function loadTodos() {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("boat_id", boatId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Could not load To-Do items:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        if (!cancelled) setTodosLoaded(true);
        return;
      }

      const loadedTodos: Todo[] = (data ?? []).map((item) => ({
        id: item.id,
        pinId: item.pin_id,
        title: item.title,
        system: item.system ?? "",
        item: item.item ?? "",
        category: item.category ?? "Repair",
        dueDate: item.due_date ?? "",
        status: item.status,
        notes: item.notes ?? "",
      }));

      if (!cancelled) {
        setTodos(loadedTodos);
        setTodosLoaded(true);
      }
    }

    void loadTodos();

    return () => {
      cancelled = true;
    };
  }, [boat]);

  const [maintenanceRecords, setMaintenanceRecords] =
    useState<MaintenanceRecord[]>([]);

  useEffect(() => {
    if (!boat) return;

    const boatId = boat.id;
    let cancelled = false;

    async function loadMaintenanceRecords() {
      const { data, error } = await supabase
        .from("maintenance_records")
        .select("*")
        .eq("boat_id", boatId)
        .order("completed_date", {
          ascending: false,
          nullsFirst: false,
        })
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error("Could not load maintenance records:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        return;
      }

      const loadedRecords: MaintenanceRecord[] = (data ?? []).map(
        (record) => ({
          id: record.id,
          boatId: record.boat_id,
          pinId: record.pin_id,

          title: record.title,
          item: record.item ?? "",
          description: record.description ?? undefined,
          system: record.system ?? "",

          category: record.category as Category,
          status: record.status as Status,

          dateCreated: record.date_created,
          dueDate: record.due_date ?? undefined,
          completedDate: record.completed_date ?? undefined,

          completedBy: record.completed_by ?? undefined,
          workOrder: record.work_order ?? undefined,

          notes: record.notes ?? "",

          attachments: record.attachments ?? [],
          cost:
            record.cost === null || record.cost === undefined
              ? undefined
              : Number(record.cost),
        })
      );

      if (!cancelled) {
        setMaintenanceRecords(loadedRecords);
      }
    }

    void loadMaintenanceRecords();

    return () => {
      cancelled = true;
    };
  }, [boat]);

  if (!boatLoaded) {
    return <main style={{ padding: "2rem", color: "#f8fafc" }}>Loading vessel…</main>;
  }

  if (boatError) {
    return <main style={{ padding: "2rem", color: "#fca5a5" }}>{boatError}</main>;
  }

  if (!boat) return <main style={{ padding: "2rem" }}>Boat not found.</main>;

  const dueSummary = summarizeDueDates(todos);

  async function markDone(todoId: number) {
    const { error } = await supabase
      .from("todos")
      .delete()
      .eq("id", todoId);

    if (error) {
      console.error("Could not complete To-Do item:", error);
      alert("The To-Do item could not be completed.");
      return;
    }

    setTodos((current) =>
      current.filter((item) => item.id !== todoId)
    );
  }

  async function deleteMaintenance(id: number) {
    const record = maintenanceRecords.find(
      (maintenanceRecord) => maintenanceRecord.id === id
    );

    const { error } = await supabase
      .from("maintenance_records")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Could not delete maintenance record:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      alert(`The maintenance record could not be deleted:\n\n${error.message}`);
      return;
    }

    const attachments = record?.attachments ?? [];

    if (attachments.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(MAINTENANCE_PHOTO_BUCKET)
        .remove(attachments);

      if (storageError) {
        console.error("Maintenance record deleted, but photos could not be removed:", {
          message: storageError.message,
        });
      }
    }

    setMaintenanceRecords((current) =>
      current.filter(
        (maintenanceRecord) => maintenanceRecord.id !== id
      )
    );
  }

  async function addMaintenance(record: MaintenanceRecord) {
    const { data, error } = await supabase
      .from("maintenance_records")
      .insert({
        boat_id: record.boatId,
        pin_id: record.pinId,

        title: record.title,
        item: record.item || null,
        description: record.description || null,
        system: record.system,

        category: record.category,
        status: record.status,

        date_created: record.dateCreated,
        due_date: record.dueDate || null,
        completed_date: record.completedDate || null,

        completed_by: record.completedBy || null,
        work_order: record.workOrder || null,

        notes: record.notes,
        attachments: record.attachments ?? [],
        cost: record.cost ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("Could not save maintenance record:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      alert(`The maintenance record could not be saved:\n\n${error.message}`);
      throw error;
    }

    const savedRecord: MaintenanceRecord = {
      id: data.id,
      boatId: data.boat_id,
      pinId: data.pin_id,

      title: data.title,
      item: data.item ?? "",
      description: data.description ?? undefined,
      system: data.system ?? "",

      category: data.category as Category,
      status: data.status as Status,

      dateCreated: data.date_created,
      dueDate: data.due_date ?? undefined,
      completedDate: data.completed_date ?? undefined,

      completedBy: data.completed_by ?? undefined,
      workOrder: data.work_order ?? undefined,

      notes: data.notes ?? "",

      attachments: data.attachments ?? [],
      cost:
        data.cost === null || data.cost === undefined
          ? undefined
          : Number(data.cost),
    };

    setMaintenanceRecords((current) => [
      savedRecord,
      ...current,
    ]);
  }

  function exportMaintenance() {
    const blob = new Blob([JSON.stringify(maintenanceRecords, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${boat?.name ?? "boat"}-maintenance-log.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-shell" style={{ color: "#f8fafc" }}>
      <a href="/" style={{ color: "#38bdf8", textDecoration: "none" }}>
        ← Back to Fleet
      </a>

      <h1 style={{ fontSize: "3rem", margin: "1rem 0 0" }}>{boat.name}</h1>
      <p style={{ fontSize: "1.25rem", marginTop: ".25rem" }}>{boat.type}</p>

      <div className="boat-status-row">
        <span style={badgeStyle(boat.status === "Active" ? "#166534" : "#475569")}>{boat.status}</span>
        {dueSummary.overdue > 0 && (
          <span style={badgeStyle("#991b1b")}>
            {dueSummary.overdue} overdue
          </span>
        )}
        {dueSummary.dueSoon > 0 && (
          <span style={badgeStyle("#92400e")}>
            {dueSummary.dueSoon} due within {DUE_SOON_DAYS} days
          </span>
        )}
        {dueSummary.overdue === 0 && dueSummary.dueSoon === 0 && (
          <span style={badgeStyle("#1e3a5f")}>Nothing due soon</span>
        )}
      </div>

<nav className="boat-tabs">
  {tabs.map((tab) => (
    <button
      key={tab}
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`boat-tab ${activeTab === tab ? "boat-tab-active" : ""}`}
    >
      {tab === "Maintenance Log" ? "Maintenance" : tab}
    </button>
  ))}
</nav>

      {activeTab === "Overview" && <Overview boat={boat} />}
      {activeTab === "Maintenance Log" && (
        <MaintenanceLog
          boatId={boat.id}
          todos={todos}
          schematic={boat.schematic}
          maintenanceRecords={maintenanceRecords}
          addMaintenance={addMaintenance}
          deleteMaintenance={deleteMaintenance}
          exportMaintenance={exportMaintenance}
        />
      )}
      {activeTab === "To-Do" && (
        <TodoList
          boatId={boat.id}
          todos={todos}
          setTodos={setTodos}
          markDone={markDone}
        />
      )}
    </main>
  );
}

function Overview({
  boat,
}: {
  boat: Boat;
}) {
  return (
    <section style={panelStyle}>
      <div className="responsive-grid">
        {/* Photo and Title */}
        <div>
          <img
            src={boat.photo ?? "/placeholder.jpg"}
            alt={boat.name}
            style={{
              width: "100%",
              borderRadius: "16px",
              display: "block",
              marginBottom: "1rem",
            }}
          />


        </div>

        {/* Details Cards */}
        <div
          style={{
            display: "grid",
            gap: "1rem",
          }}
        >
          <div style={infoCardStyle}>
            <h3 style={{ marginTop: 0 }}>Vessel Details</h3>

            <InfoRow label="Make" value={boat.make ?? "TBD"} />
            <InfoRow label="Model" value={boat.model ?? "TBD"} />
            <InfoRow label="Year" value={boat.year ?? "TBD"} />
            <InfoRow label="Length" value={boat.length ?? "TBD"} />
            <InfoRow label="Hull Number" value={boat.hullNumber ?? "TBD"} />
            <InfoRow label="Registration" value={boat.registration ?? "TBD"} />
          </div>

          <div style={infoCardStyle}>
            <h3 style={{ marginTop: 0 }}>Systems</h3>


            <InfoRow label="Engines"
              value={
                boat.engineUrl ? (
                  <a
                    href={boat.engineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#60a5fa" }}
                  >
                    {boat.engines}
                  </a>
                ) : (
                  boat.engines ?? "TBD"
                )
              }
            />
            <InfoRow label="Fuel Capacity" value={boat.fuelCapacity ?? "TBD"} />
            <InfoRow label="Battery Type" value={boat.batteryType ?? "TBD"} />
            <InfoRow label="Location" value={boat.location} />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "1.5rem",
          background: "#020617",
          border: "1px solid #334155",
          borderRadius: "12px",
          padding: "1rem",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Notes</h3>

        <p style={{ color: "#cbd5e1" }}>
          {boat.notes ?? "No notes entered."}
        </p>
      </div>
    </section>
  );
}

function TodoList({
  boatId,
  todos,
  setTodos,
  markDone,
}: {
  boatId: number;
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  markDone: (todoId: number) => void;
}) {
  const [form, setForm] = useState<{
    title: string;
    system: string;
    item: string;
    category: Category;
    dueDate: string;
    status: Todo["status"];
    notes: string;
  }>({
    title: "",
    system: systems[0],
    item: "",
    category: "Repair",
    dueDate: "",
    status: "Open Issue",
    notes: "",
  });

  const statusOrder: Todo["status"][] = [
    "Open Issue",
    "Monitor",
    "Scheduled",
  ];

  const sortedByStatus = [...todos].sort((a, b) => {
    const statusCompare =
      statusOrder.indexOf(a.status) -
      statusOrder.indexOf(b.status);

    if (statusCompare !== 0) return statusCompare;

    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;

    return a.dueDate.localeCompare(b.dueDate);
  });

  const upcoming = [...todos]
    .filter((item) => item.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  function updateForm<K extends keyof typeof form>(
    field: K,
    value: (typeof form)[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function addTodo() {
    if (!form.title.trim()) {
      alert("Enter a title for the To-Do item.");
      return;
    }

    const { data, error } = await supabase
      .from("todos")
      .insert({
        boat_id: boatId,
        pin_id: null,
        title: form.title.trim(),
        system: form.system,
        item: form.item.trim(),
        category: form.category,
        due_date: form.dueDate || null,
        status: form.status,
        notes: form.notes.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error("Could not add To-Do item:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      alert(`The To-Do item could not be saved:\n\n${error.message}`);
      return;
    }

    const newTodo: Todo = {
      id: data.id,
      pinId: data.pin_id,
      title: data.title,
      system: data.system ?? "",
      item: data.item ?? "",
      category: data.category ?? "Repair",
      dueDate: data.due_date ?? "",
      status: data.status,
      notes: data.notes ?? "",
    };

    setTodos((current) => [newTodo, ...current]);

    setForm({
      title: "",
      system: systems[0],
      item: "",
      category: "Repair",
      dueDate: "",
      status: "Open Issue",
      notes: "",
    });
  }

  async function updateTodoStatus(
    todoId: number,
    newStatus: Todo["status"]
  ) {
    const { error } = await supabase
      .from("todos")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", todoId);

    if (error) {
      console.error("Could not update To-Do status:", error);
      alert(`The status could not be updated:\n\n${error.message}`);
      return;
    }

    setTodos((current) =>
      current.map((todo) =>
        todo.id === todoId
          ? { ...todo, status: newStatus }
          : todo
      )
    );
  }

  return (
    <section style={panelStyle}>
      <h2>To-Do</h2>

      <div className="responsive-grid">
        <div>
          <div
            style={{
              display: "grid",
              gap: ".75rem",
              marginBottom: "1.5rem",
              maxWidth: "700px",
              padding: "1rem",
              background: "#020617",
              border: "1px solid #334155",
              borderRadius: "12px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Add To-Do Item</h3>

            <label>
              <div style={labelStyle}>Title</div>
              <input
                value={form.title}
                onChange={(event) =>
                  updateForm("title", event.target.value)
                }
                placeholder="What needs to be done?"
                style={inputStyle}
              />
            </label>

            <label>
              <div style={labelStyle}>System</div>
              <select
                value={form.system}
                onChange={(event) =>
                  updateForm("system", event.target.value)
                }
                style={inputStyle}
              >
                {systems.map((system) => (
                  <option key={system} value={system}>
                    {system}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div style={labelStyle}>Item</div>
              <input
                value={form.item}
                onChange={(event) =>
                  updateForm("item", event.target.value)
                }
                placeholder="O2 Sensor, battery charger, bow cleat..."
                style={inputStyle}
              />
            </label>

            <label>
              <div style={labelStyle}>Category</div>
              <select
                value={form.category}
                onChange={(event) =>
                  updateForm(
                    "category",
                    event.target.value as Category
                  )
                }
                style={inputStyle}
              >
                <option value="Repair">Repair</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Inspection">Inspection</option>
                <option value="Admin">Admin</option>
              </select>
            </label>

            <label>
              <div style={labelStyle}>Due Date</div>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  updateForm("dueDate", event.target.value)
                }
                style={inputStyle}
              />
            </label>

            <label>
              <div style={labelStyle}>Status</div>
              <select
                value={form.status}
                onChange={(event) =>
                  updateForm(
                    "status",
                    event.target.value as Todo["status"]
                  )
                }
                style={inputStyle}
              >
                <option value="Open Issue">Needs Attention</option>
                <option value="Monitor">Monitor</option>
                <option value="Scheduled">Scheduled</option>
              </select>
            </label>

            <label>
              <div style={labelStyle}>Notes</div>
              <textarea
                value={form.notes}
                onChange={(event) =>
                  updateForm("notes", event.target.value)
                }
                placeholder="Details, part numbers, symptoms, instructions..."
                style={{
                  ...inputStyle,
                  minHeight: "100px",
                }}
              />
            </label>

            <button
              type="button"
              onClick={addTodo}
              style={buttonStyle}
            >
              Add To-Do Item
            </button>
          </div>

          <h3>To-Do Items</h3>

          <div style={{ display: "grid", gap: ".75rem" }}>
            {sortedByStatus.length ? (
              sortedByStatus.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    padding: "1rem",
                    background: "#020617",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    {statusDot(item.status)} {item.title}
                  </h3>

                  <p style={{ color: "#cbd5e1" }}>
                    {item.system}
                    {item.item ? ` · ${item.item}` : ""}
                  </p>

                  <p>
                    {item.category}
                    {item.dueDate
                      ? ` · Due ${formatDate(item.dueDate)}`
                      : " · No due date"}
                  </p>

                  <label
                    style={{
                      display: "block",
                      marginBottom: ".75rem",
                      maxWidth: "220px",
                    }}
                  >
                    <div style={labelStyle}>Status</div>

                    <select
                      value={item.status}
                      onChange={(event) =>
                        void updateTodoStatus(
                          item.id,
                          event.target.value as Todo["status"]
                        )
                      }
                      style={{
                        ...inputStyle,
                        width: "100%",
                      }}
                    >
                      <option value="Open Issue">Needs Attention</option>
                      <option value="Monitor">Monitor</option>
                      <option value="Scheduled">Scheduled</option>
                    </select>
                  </label>

                  {item.notes && (
                    <p style={{ color: "#cbd5e1" }}>
                      {item.notes}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => markDone(item.id)}
                    style={buttonStyle}
                  >
                    Mark Done
                  </button>
                </div>
              ))
            ) : (
              <div style={cardStyle}>
                <p style={{ margin: 0 }}>
                  No active To-Do items.
                </p>
              </div>
            )}
          </div>
        </div>

        <aside
          style={{
            border: "1px solid #334155",
            borderRadius: "12px",
            padding: "1rem",
            background: "#020617",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Upcoming</h3>

          {upcoming.length ? (
            <div style={{ display: "grid", gap: ".75rem" }}>
              {upcoming.map((item) => (
                <div key={item.id}>
                  <strong>{formatDate(item.dueDate)}</strong>
                  <div>{item.title}</div>
                  <div
                    style={{
                      color: "#94a3b8",
                      fontSize: ".9rem",
                    }}
                  >
                    {displayTodoStatus(item.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#94a3b8" }}>
              No upcoming due dates.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function MaintenanceLog({
  boatId,
  schematic,
  todos,
  maintenanceRecords,
  addMaintenance,
  deleteMaintenance,
  exportMaintenance,
}: {
  boatId: number;
  schematic: string | null;
  todos: Todo[];
  maintenanceRecords: MaintenanceRecord[];
  addMaintenance: (record: MaintenanceRecord) => Promise<void>;
  deleteMaintenance: (id: number) => Promise<void>;
  exportMaintenance: () => void;
}){
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  const [placingPin, setPlacingPin] = useState(false);
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  const [draftPinId, setDraftPinId] = useState<number | null>(null);
  const [systemFilter, setSystemFilter] = useState("All");

  const [form, setForm] = useState<{
    completedDate: string;
    completedBy: string;
    category: Category;
    system: string;
    title: string;
    item: string;
    notes: string;
    attachments: string[];
  }>({
    completedDate: "",
    completedBy: "",
    category: "Maintenance",
    system: systems[0],
    title: "",
    item: "",
    notes: "",
    attachments: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadPins() {
      const { data, error } = await supabase
        .from("maintenance_pins")
        .select("*")
        .eq("boat_id", boatId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Could not load maintenance pins:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        alert(`Maintenance pins could not be loaded:

${error.message}`);
        return;
      }

      if (!cancelled) {
        setPins(
          (data ?? []).map((pin) => ({
            id: pin.id,
            x: Number(pin.x),
            y: Number(pin.y),
            name: pin.name ?? "",
          }))
        );
      }
    }

    void loadPins();

    return () => {
      cancelled = true;
    };
  }, [boatId]);

  const selectedPin =
    pins.find((pin) => pin.id === selectedPinId) ?? null;

  const selectedHistory = selectedPin
    ? maintenanceRecords.filter(
      (record) => record.pinId === selectedPin.id
    )
    : [];

  const filteredMaintenance =
    systemFilter === "All"
      ? maintenanceRecords
      : maintenanceRecords.filter(
        (record) => record.system === systemFilter
      );

  async function placePin(event: MouseEvent<HTMLDivElement>) {
    if (!placingPin) return;

    const bounds = event.currentTarget.getBoundingClientRect();

    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;

    const { data, error } = await supabase
      .from("maintenance_pins")
      .insert({
        boat_id: boatId,
        x,
        y,
        name: "",
      })
      .select()
      .single();

    if (error) {
      console.error("Could not create maintenance pin:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });

      alert(`The pin could not be saved:\n\n${error.message}`);
      return;
    }

    const savedPin: Pin = {
      id: data.id,
      x: Number(data.x),
      y: Number(data.y),
      name: data.name ?? "",
    };

    setPins((currentPins) => [...currentPins, savedPin]);
    setSelectedPinId(savedPin.id);
    setDraftPinId(savedPin.id);
    setPlacingPin(false);
    setShowAddMaintenance(true);
  }

  async function saveMaintenance() {
    if (!selectedPin) return;

    if (!form.title.trim()) {
      alert("Enter the maintenance task performed.");
      return;
    }

    try {
      await addMaintenance({
        // Supabase will replace this temporary value.
        id: 0,
        boatId,
        pinId: selectedPin.id,

        title:
          form.title.trim() ||
          selectedPin.name ||
          "Maintenance",

        item: form.item.trim(),
        description: undefined,

        system: form.system,
        category: form.category,
        status: "Done",

        dateCreated: new Date().toISOString().slice(0, 10),
        completedDate: form.completedDate || undefined,
        completedBy: form.completedBy.trim() || undefined,

        notes: form.notes.trim(),
        attachments: form.attachments,
      });
    } catch {
      // addMaintenance already displays the Supabase error.
      // Leave the form open so the information is not lost.
      return;
    }

    setForm({
      completedDate: "",
      completedBy: "",
      category: "Maintenance",
      system: systems[0],
      title: "",
      item: "",
      notes: "",
      attachments: [],
    });

    setDraftPinId(null);
    setShowAddMaintenance(false);
  }

  async function cancelMaintenance() {
    const attachmentsToRemove = [...form.attachments];

    if (attachmentsToRemove.length > 0) {
      const { error } = await supabase.storage
        .from(MAINTENANCE_PHOTO_BUCKET)
        .remove(attachmentsToRemove);

      if (error) {
        console.error("Could not remove cancelled maintenance photos:", error);
      }
    }

    if (draftPinId !== null) {
      const pinIdToDelete = draftPinId;

      const { error } = await supabase
        .from("maintenance_pins")
        .delete()
        .eq("id", pinIdToDelete);

      if (error) {
        console.error("Could not delete cancelled pin:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        alert(`The cancelled pin could not be deleted:\n\n${error.message}`);
        return;
      }

      setPins((currentPins) =>
        currentPins.filter((pin) => pin.id !== pinIdToDelete)
      );
      setSelectedPinId(null);
      setDraftPinId(null);
    }

    setForm({
      completedDate: "",
      completedBy: "",
      category: "Maintenance",
      system: systems[0],
      title: "",
      item: "",
      notes: "",
      attachments: [],
    });
    setShowAddMaintenance(false);
  }

  function updateSelectedPinName(name: string) {
    if (!selectedPin) return;

    const pinId = selectedPin.id;

    setPins((currentPins) =>
      currentPins.map((pin) =>
        pin.id === pinId ? { ...pin, name } : pin
      )
    );

    void supabase
      .from("maintenance_pins")
      .update({
        name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pinId)
      .then(({ error }) => {
        if (error) {
          console.error("Could not rename maintenance pin:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
        }
      });
  }

  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  useEffect(() => {
    const paths = new Set(
      maintenanceRecords.flatMap((record) => record.attachments ?? [])
    );

    form.attachments.forEach((path) => paths.add(path));

    setPhotoUrls((current) => {
      const next = { ...current };

      paths.forEach((path) => {
        if (!next[path]) {
          next[path] = maintenancePhotoUrl(path);
        }
      });

      return next;
    });
  }, [maintenanceRecords, form.attachments]);

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) return;

    setUploadingPhotos(true);

    const uploadedPaths: string[] = [];

    try {
      for (const file of files) {
        const cleanName = safeFileName(file.name) || "photo";
        const path = `${boatId}/${crypto.randomUUID()}-${cleanName}`;

        const { error } = await supabase.storage
          .from(MAINTENANCE_PHOTO_BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });

        if (error) {
          throw error;
        }

        uploadedPaths.push(path);
      }

      setForm((currentForm) => ({
        ...currentForm,
        attachments: [...currentForm.attachments, ...uploadedPaths],
      }));

      setPhotoUrls((current) => {
        const next = { ...current };

        uploadedPaths.forEach((path) => {
          next[path] = maintenancePhotoUrl(path);
        });

        return next;
      });
    } catch (error) {
      console.error("Could not upload maintenance photos:", error);

      if (uploadedPaths.length > 0) {
        await supabase.storage
          .from(MAINTENANCE_PHOTO_BUCKET)
          .remove(uploadedPaths);
      }

      alert(
        `One or more photos could not be uploaded.\n\n${error instanceof Error ? error.message : "Unknown upload error"
        }`
      );
    } finally {
      setUploadingPhotos(false);
    }
  }

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ marginBottom: ".35rem" }}>Maintenance Log</h2>
          <div style={{ color: "#94a3b8", marginBottom: ".5rem" }}>
            Select an existing pin or add a new pin.
          </div>
          <button
            style={buttonStyle}
            onClick={() => setPlacingPin(!placingPin)}
          >
            {placingPin ? "Cancel Pin Placement" : "Add Pin"}
          </button>
        </div>

      </div>

      {placingPin && (
        <p style={{ color: "#94a3b8" }}>
          Click anywhere on the schematic to place a pin.
        </p>
      )}

    <div className="responsive-grid">
        <div
          onClick={(event) => void placePin(event)}
          style={{
            position: "relative",
            background: "#f8fafc",
            borderRadius: "12px",
            overflow: "hidden",
            alignSelf: "start",
            cursor: placingPin ? "crosshair" : "default",
          }}
        >
          <img
            src={schematic}
            alt="Schematic"
            style={{
              width: "100%",
              display: "block",
              pointerEvents: "none",
            }}
          />

          {pins.map((pin) => {
            const relatedTodos = todos.filter(
              (todo) => todo.pinId === pin.id
            );

            const pinStatus = getPinStatus(relatedTodos);

            return (
              <button
                key={pin.id}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedPinId(pin.id);
                  setShowAddMaintenance(false);
                }}
                style={pinStyle(
                  pin.x,
                  pin.y,
                  statusColor(pinStatus),
                  pin.id === selectedPinId
                )}
                title={pin.name}
              >
                {pin.id === selectedPinId ? "●" : "•"}
              </button>
            );
          })}
        </div>

        <aside style={cardStyle}>
          {selectedPin ? (
            <>
              <h3
                style={{
                  fontSize: "1.4rem",
                  marginTop: 0,
                  marginBottom: "1rem",
                  borderBottom: "1px solid #334155",
                  paddingBottom: ".75rem",
                }}
              >
                {selectedPin.name ? `📍 ${selectedPin.name}` : "Maintenance Location"}
              </h3>

              <h4
                style={{
                  marginTop: "1.5rem",
                  marginBottom: ".5rem",
                  fontSize: "1rem",
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                🛠 Maintenance History
              </h4>

              {selectedHistory.length ? (
                <div style={{ display: "grid", gap: ".75rem" }}>
                  {selectedHistory.map((record) => (
                    <div
                      key={record.id}
                      style={{
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: ".75rem",
                        background: "#0f172a",
                      }}
                    >
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: ".85rem",
                        }}
                      >
                        {formatDate(record.completedDate ?? "")}
                      </div>

                      <div
                        style={{
                          fontWeight: 700,
                          marginTop: ".25rem",
                        }}
                      >
                        {record.title}
                      </div>

                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: ".9rem",
                          marginTop: ".25rem",
                        }}
                      >
                        {record.system} · {record.category}
                        {record.completedBy ? ` · ${record.completedBy}` : ""}
                      </div>
                      {record.attachments?.length ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
                            gap: ".5rem",
                            marginTop: ".65rem",
                          }}
                        >
                          {record.attachments.map((photo, index) => {
                            const photoUrl = photoUrls[photo];
                            return photoUrl ? (
                              <button
                                key={`${record.id}-${photo}-${index}`}
                                type="button"
                                onClick={() => setSelectedPhotoUrl(photoUrl)}
                                aria-label={`View maintenance photo ${index + 1}`}
                                style={{
                                  padding: 0,
                                  border: "1px solid #334155",
                                  borderRadius: "8px",
                                  overflow: "hidden",
                                  background: "transparent",
                                  cursor: "pointer",
                                }}
                              >
                                <img
                                  src={photoUrl}
                                  alt={`Maintenance photo ${index + 1}`}
                                  style={{
                                    display: "block",
                                    width: "100%",
                                    aspectRatio: "1",
                                    objectFit: "cover",
                                  }}
                                />
                              </button>
                            ) : (
                              <div
                                key={`${record.id}-${photo}-${index}`}
                                style={{
                                  display: "grid",
                                  placeItems: "center",
                                  aspectRatio: "1",
                                  border: "1px solid #334155",
                                  borderRadius: "8px",
                                  color: "#94a3b8",
                                  fontSize: ".75rem",
                                }}
                              >
                                Loading…
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p>No history for this location yet.</p>
              )}

              <button
                style={{ ...buttonStyle, marginTop: "1rem" }}
                onClick={() =>
                  setShowAddMaintenance(!showAddMaintenance)
                }
              >
                Add Maintenance
              </button>

              {showAddMaintenance && (
                <div
                  style={{
                    display: "grid",
                    gap: ".75rem",
                    marginTop: "1rem",
                  }}
                >
                  <label>
                    <div style={labelStyle}>Location Name</div>
                    <input
                      placeholder="e.g. Port outboard, bow light, fuel tank"
                      value={selectedPin.name}
                      onChange={(event) => updateSelectedPinName(event.target.value)}
                      style={inputStyle}
                      autoFocus
                    />
                  </label>

                  <label>
                    <div style={labelStyle}>Completed Date</div>
                    <input
                      type="date"
                      value={form.completedDate}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          completedDate: event.target.value,
                        })
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <div style={labelStyle}>Completed By</div>
                    <input
                      placeholder="Name of person who completed the work"
                      value={form.completedBy}
                      onChange={(event) =>
                        setForm({ ...form, completedBy: event.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <div style={labelStyle}>System</div>
                    <select
                      value={form.system}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          system: event.target.value,
                        })
                      }
                      style={inputStyle}
                    >
                      {systems.map((system) => (
                        <option key={system}>{system}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <div style={labelStyle}>Category</div>
                    <select
                      value={form.category}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          category: event.target.value as Category,
                        })
                      }
                      style={inputStyle}
                    >
                      <option>Repair</option>
                      <option>Maintenance</option>
                      <option>Inspection</option>
                      <option>Admin</option>
                    </select>
                  </label>

                  <input
                    placeholder="Item, e.g. O2 Sensor"
                    value={form.item}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        item: event.target.value,
                      })
                    }
                    style={inputStyle}
                  />

                  <input
                    placeholder="Task performed"
                    value={form.title}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        title: event.target.value,
                      })
                    }
                    style={inputStyle}
                  />

                  <textarea
                    placeholder="Notes"
                    value={form.notes}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        notes: event.target.value,
                      })
                    }
                    style={{
                      ...inputStyle,
                      minHeight: "90px",
                    }}
                  />

                  <label>
                    <div style={labelStyle}>Photos</div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={addPhotos}
                      disabled={uploadingPhotos}
                      style={inputStyle}
                    />
                    {uploadingPhotos && (
                      <div style={{ color: "#94a3b8", marginTop: ".35rem" }}>
                        Uploading photos…
                      </div>
                    )}
                  </label>

                  {form.attachments.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: ".5rem" }}>
                      {form.attachments.map((photo, index) => {
                        const photoUrl = photoUrls[photo];
                        return photoUrl ? (
                          <button
                            key={`${photo}-${index}`}
                            type="button"
                            onClick={() => setSelectedPhotoUrl(photoUrl)}
                            style={{ padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
                          >
                            <img
                              src={photoUrl}
                              alt={`Maintenance attachment ${index + 1}`}
                              style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "8px" }}
                            />
                          </button>
                        ) : (
                          <div key={`${photo}-${index}`} style={{ display: "grid", placeItems: "center", aspectRatio: "1", border: "1px solid #334155", borderRadius: "8px", color: "#94a3b8" }}>
                            Loading…
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: ".75rem" }}>
                    <button
                      type="button"
                      disabled={uploadingPhotos}
                      style={{
                        ...buttonStyle,
                        flex: 1,
                        opacity: uploadingPhotos ? 0.6 : 1,
                        cursor: uploadingPhotos ? "not-allowed" : "pointer",
                      }}
                      onClick={() => void saveMaintenance()}
                    >
                      Save Maintenance
                    </button>
                    <button
                      type="button"
                      disabled={uploadingPhotos}
                      style={{
                        ...buttonStyle,
                        flex: 1,
                        background: "#334155",
                        opacity: uploadingPhotos ? 0.6 : 1,
                        cursor: uploadingPhotos ? "not-allowed" : "pointer",
                      }}
                      onClick={() => void cancelMaintenance()}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "#94a3b8" }}>No location selected.</p>
          )}
        </aside>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "1rem", marginTop: "2rem", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Completed Maintenance</h3>
        <label>
          <div style={labelStyle}>System</div>
          <select
            value={systemFilter}
            onChange={(event) => setSystemFilter(event.target.value)}
            style={{ ...inputStyle, width: "220px" }}
          >
            <option value="All">All Systems</option>
            {systems.map((system) => (
              <option key={system} value={system}>{system}</option>
            ))}
          </select>
        </label>
      </div>

      <button
        style={{ ...buttonStyle, marginTop: "1rem" }}
        onClick={exportMaintenance}
      >
        Export Maintenance Log
      </button>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          marginTop: "1rem",
        }}
      >
        {filteredMaintenance.map((record) => (
          <div key={record.id} style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>{record.title}</h3>

            <p>
              {record.system}
              {record.item ? ` → ${record.item}` : ""}
            </p>

            <p>
              {record.category} · Completed:{" "}
              {record.completedDate
                ? formatDate(record.completedDate)
                : "TBD"}
              {record.completedBy ? ` · By ${record.completedBy}` : ""}
            </p>

            <p style={{ color: "#cbd5e1" }}>
              {record.notes}
            </p>

            {record.attachments?.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: ".75rem", marginBottom: "1rem" }}>
                {record.attachments.map((photo, index) => {
                  const photoUrl = photoUrls[photo];
                  return photoUrl ? (
                    <button
                      key={`${record.id}-${photo}-${index}`}
                      type="button"
                      onClick={() => setSelectedPhotoUrl(photoUrl)}
                      style={{ padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
                    >
                      <img
                        src={photoUrl}
                        alt={`Maintenance photo ${index + 1}`}
                        style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "8px" }}
                      />
                    </button>
                  ) : (
                    <div key={`${record.id}-${photo}-${index}`} style={{ display: "grid", placeItems: "center", aspectRatio: "1", border: "1px solid #334155", borderRadius: "8px", color: "#94a3b8" }}>
                      Loading…
                    </div>
                  );
                })}
              </div>
            ) : null}

            <button
              style={dangerButtonStyle}
              onClick={() => void deleteMaintenance(record.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {selectedPhotoUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Maintenance photo viewer"
          onClick={() => setSelectedPhotoUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "2rem",
            background: "rgba(0, 0, 0, .86)",
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedPhotoUrl(null)}
            style={{
              position: "fixed",
              top: "1rem",
              right: "1rem",
              width: "44px",
              height: "44px",
              border: "1px solid #64748b",
              borderRadius: "999px",
              background: "#0f172a",
              color: "white",
              fontSize: "1.5rem",
              cursor: "pointer",
            }}
            aria-label="Close photo viewer"
          >
            ×
          </button>
          <img
            src={selectedPhotoUrl}
            alt="Full-size maintenance photo"
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: "95vw",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: "10px",
              boxShadow: "0 20px 60px rgba(0,0,0,.5)",
            }}
          />
        </div>
      )}
    </section>
  );
}
function displayTodoStatus(status: Todo["status"]) {
  return status === "Open Issue" ? "Needs Attention" : status;
}

function getPinStatus(todos: Todo[]) {
  if (todos.some((t) => t.status === "Open Issue")) return "Open Issue";
  if (todos.some((t) => t.status === "Monitor")) return "Monitor";
  return "OK";
}

function statusColor(status: string) {
  if (status === "Open Issue") return "#ef4444";
  if (status === "Monitor") return "#facc15";
  return "#22c55e";
}

function statusDot(status: string) {
  if (status === "Open Issue") return "🔴";
  if (status === "Monitor") return "🟡";
  if (status === "Scheduled") return "🔵";
  return "✅";
}

function badgeStyle(bg: string) {
  return {
    background: bg,
    color: "white",
    padding: ".5rem .9rem",
    borderRadius: "8px",
    fontWeight: 700,
  };
}

function pinStyle(x: number, y: number, color: string, selected = false) {
  return {
    position: "absolute" as const,
    left: `${x}%`,
    top: `${y}%`,
    transform: "translate(-50%, -50%)",
    width: selected ? "30px" : "24px",
    height: selected ? "30px" : "24px",
    borderRadius: "999px",
    border: selected ? "3px solid white" : "2px solid white",
    background: color,
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
  };
}


function formatDate(date: string) {
  if (!date) return "No date";

  const [year, month, day] = date.split("-");

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function TimePicker({
  label,
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: {
  label: string;
  hour: string;
  minute: string;
  onHourChange: (value: string) => void;
  onMinuteChange: (value: string) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0")
  );
  const minutes = ["00", "15", "30", "45"];

  return (
    <label>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".5rem" }}>
        <select
          value={hour}
          onChange={(e) => onHourChange(e.target.value)}
          style={inputStyle}
        >
          {hours.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <select
          value={minute}
          onChange={(e) => onMinuteChange(e.target.value)}
          style={inputStyle}
        >
          {minutes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function EngineHoursRow({
  label,
  value,
  onReset,
}: {
  label: string;
  value: number;
  onReset?: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: ".75rem",
        alignItems: "center",
        borderBottom: "1px solid #1e293b",
        padding: ".5rem 0",
      }}
    >
      <div>
        <div style={{ color: "#94a3b8" }}>{label}</div>
        <strong>{value.toFixed(1)} hrs</strong>
      </div>

      {onReset && (
        <button
          onClick={onReset}
          style={{
            ...buttonStyle,
            padding: ".4rem .7rem",
            background: "#334155",
          }}
        >
          Reset
        </button>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: ".35rem 0",
        borderBottom: "1px solid #1e293b",
      }}
    >
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const infoCardStyle = {
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "1rem",
};

const labelStyle = {
  marginBottom: ".25rem",
  fontWeight: 700,
  color: "#cbd5e1",
};

const panelStyle = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "1rem",
};

const cardStyle = {
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "1rem",
};

const inputStyle = {
  width: "100%",
  minWidth: 0,
  minHeight: "46px",
  boxSizing: "border-box" as const,
  padding: ".75rem",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#020617",
  color: "#f8fafc",
};

const buttonStyle = {
  padding: ".75rem 1rem",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButtonStyle = {
  ...buttonStyle,
  background: "#991b1b",
};
