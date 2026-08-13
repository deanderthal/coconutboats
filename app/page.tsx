"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DUE_SOON_DAYS, summarizeDueDates, type DueSummary } from "@/lib/due";
import { isEngineServiceDue } from "@/lib/engine-service";

import { fetchBoats, type Boat } from "@/app/data/boats";

export default function FleetPage() {
  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dueSummaries, setDueSummaries] = useState<
    Record<string, DueSummary>
  >({});
  const [engineServiceDue, setEngineServiceDue] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadFleet() {
      const [boatsResult, maintenanceResult, enginesResult] = await Promise.allSettled([
        fetchBoats(supabase),
        supabase.from("maintenance_records").select("boat_id, due_date, status").neq("status", "Done"),
        supabase.from("engines").select("boat_id, service_hours, service_interval_hours").not("boat_id", "is", null),
      ]);

      if (boatsResult.status === "rejected") {
        console.error("Could not load boats:", boatsResult.reason);
        setLoadError("The fleet could not be loaded.");
        setLoading(false);
        return;
      }

      setBoats(boatsResult.value);

      if (maintenanceResult.status === "rejected" || maintenanceResult.value.error) {
        console.error(
          "Could not load due-date summaries:",
          maintenanceResult.status === "rejected"
            ? maintenanceResult.reason
            : maintenanceResult.value.error
        );
        setLoading(false);
        return;
      }

      const data = maintenanceResult.value.data;

      const grouped: Record<string, Array<{ due_date: string | null }>> = {};

      for (const record of data ?? []) {
        const boatId = String(record.boat_id);
        grouped[boatId] ??= [];
        grouped[boatId].push({ due_date: record.due_date });
      }

      const summaries: Record<string, DueSummary> = {};
      for (const [boatId, items] of Object.entries(grouped)) {
        summaries[boatId] = summarizeDueDates(items);
      }

      setDueSummaries(summaries);

      if (enginesResult.status === "rejected" || enginesResult.value.error) {
        console.error(
          "Could not load engine service summaries:",
          enginesResult.status === "rejected" ? enginesResult.reason : enginesResult.value.error
        );
      } else {
        const serviceCounts: Record<string, number> = {};
        for (const engine of enginesResult.value.data ?? []) {
          if (engine.boat_id == null || !isEngineServiceDue(engine)) continue;
          const boatId = String(engine.boat_id);
          serviceCounts[boatId] = (serviceCounts[boatId] ?? 0) + 1;
        }
        setEngineServiceDue(serviceCounts);
      }

      setLoading(false);
    }

    void loadFleet();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #020617 0%, #071426 55%, #020617 100%)",
        color: "#f8fafc",
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: "min(1400px, 100%)",
          margin: "0 auto",
        }}
      >
        <header style={{ marginBottom: "2rem" }}>
          <div
            style={{
              color: "#38bdf8",
              fontSize: ".8rem",
              fontWeight: 700,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              marginBottom: ".5rem",
            }}
          >
            Hawaiian Institute of Marine Biology
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              lineHeight: 1,
            }}
          >
            Fleet Overview
          </h1>

          <p
            style={{
              marginTop: ".75rem",
              marginBottom: 0,
              color: "#94a3b8",
              fontSize: "1.05rem",
            }}
          >
            Select a vessel to view maintenance and upcoming work.
          </p>
        </header>

        {loading && <p style={{ color: "#94a3b8" }}>Loading fleet…</p>}
        {loadError && <p style={{ color: "#fca5a5" }}>{loadError}</p>}
        {!loading && !loadError && boats.length === 0 && (
          <p style={{ color: "#94a3b8" }}>No boats have been added yet.</p>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "1.25rem",
          }}
        >
          {boats.map((boat) => {
            const due = dueSummaries[boat.id] ?? { overdue: 0, dueSoon: 0 };
            const servicesDue = engineServiceDue[boat.id] ?? 0;

            return (
              <Link
                key={boat.id}
                href={`/boats/${boat.id}`}
                style={{
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <article
                  className="boat-card"
                  style={{
                    height: "100%",
                    overflow: "hidden",
                    borderRadius: "18px",
                    background: "#0f172a",
                    border: "1px solid #334155",
                    boxShadow: "0 12px 30px rgba(0, 0, 0, .28)",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: "1 / 1",
                      overflow: "hidden",
                      background:
                        "linear-gradient(135deg, #172554, #0f766e)",
                    }}
                  >
                    {boat.photo ? (
                      <Image
                        src={boat.photo}
                        alt={`${boat.name} ${boat.nickname ?? ""}`}
                        fill
                        sizes="(max-width: 700px) 100vw, 33vw"
                        style={{
                          objectFit: "cover",
                          transition: "transform .25s ease",
                        }}
                        className="boat-image"
                      />
                    ) : (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "grid",
                          placeItems: "center",
                          padding: "1rem",
                          textAlign: "center",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "3rem",
                              marginBottom: ".5rem",
                            }}
                          >
                            ⚓
                          </div>

                          <strong
                            style={{
                              fontSize: "1.5rem",
                              letterSpacing: ".04em",
                            }}
                          >
                            {boat.name}
                          </strong>

                          <div
                            style={{
                              color: "#cbd5e1",
                              marginTop: ".35rem",
                            }}
                          >
                            Image coming soon
                          </div>
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        position: "absolute",
                        top: ".85rem",
                        right: ".85rem",
                        padding: ".35rem .65rem",
                        borderRadius: "999px",
                        background: "rgba(2, 6, 23, .82)",
                        border: "1px solid rgba(148, 163, 184, .45)",
                        backdropFilter: "blur(8px)",
                        fontSize: ".82rem",
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ color: "#22c55e" }}>●</span>{" "}
                      {boat.status}
                    </div>
                  </div>

                  <div style={{ padding: "1rem 1.1rem 1.15rem" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <h2
                          style={{
                            margin: 0,
                            fontSize: "1.5rem",
                          }}
                        >
                          {boat.name}
                        </h2>

                        <div
                          style={{
                            minHeight: "1.4rem",
                            marginTop: ".2rem",
                            color: boat.nickname ?? "" ? "#38bdf8" : "#64748b",
                            fontWeight: 600,
                          }}
                        >
                          {boat.nickname ?? ""}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: "1.4rem",
                          color: "#64748b",
                        }}
                      >
                        →
                      </div>
                    </div>

                    {servicesDue > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: ".75rem",
                          marginTop: "1rem",
                          padding: ".65rem .75rem",
                          borderRadius: "10px",
                          background: "#450a0a",
                          border: "1px solid #991b1b",
                          color: "#fecaca",
                        }}
                      >
                        <strong style={{ fontSize: ".88rem" }}>ENGINE SERVICE DUE</strong>
                        <strong
                          style={{
                            minWidth: "2rem",
                            padding: ".2rem .55rem",
                            borderRadius: "999px",
                            textAlign: "center",
                            background: "#7f1d1d",
                            color: "#fecaca",
                          }}
                        >
                          {servicesDue}
                        </strong>
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: servicesDue > 0 ? ".7rem" : "1rem",
                        paddingTop: ".9rem",
                        borderTop: "1px solid #334155",
                      }}
                    >
                      <span style={{ color: "#94a3b8" }}>
                        {due.overdue > 0
                          ? "Overdue"
                          : due.dueSoon > 0
                            ? `Due within ${DUE_SOON_DAYS} days`
                            : "Schedule"}
                      </span>

                      <strong
                        style={{
                          minWidth: "2rem",
                          padding: ".2rem .55rem",
                          borderRadius: "999px",
                          textAlign: "center",
                          background:
                            due.overdue > 0
                              ? "#7f1d1d"
                              : due.dueSoon > 0
                                ? "#78350f"
                                : "#153229",
                          color:
                            due.overdue > 0
                              ? "#fecaca"
                              : due.dueSoon > 0
                                ? "#fde68a"
                                : "#86efac",
                        }}
                      >
                        {due.overdue > 0
                          ? due.overdue
                          : due.dueSoon > 0
                            ? due.dueSoon
                            : "Clear"}
                      </strong>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}