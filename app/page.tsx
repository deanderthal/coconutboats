"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const boats = [
  {
    id: "1",
    name: "MD1",
    nickname: "Pineapple Express",
    status: "Active",
    image: "/boats/md1.png",
  },
  {
    id: "2",
    name: "MD2",
    nickname: "Tequila Sunrise",
    status: "Active",
    image: "/boats/md2.png",
  },
  {
    id: "3",
    name: "MD3",
    nickname: "Rudolph",
    status: "Active",
    image: "/boats/md3.png",
  },
  {
    id: "4",
    name: "MD4",
    nickname: "Squirtle",
    status: "Active",
    image: "/boats/md4.png",
  },
  {
    id: "5",
    name: "MD5",
    nickname: "",
    status: "Active",
    image: null,
  },
  {
    id: "6",
    name: "Extracto",
    nickname: "",
    status: "Active",
    image: null,
  },
];

export default function FleetPage() {
  const [openIssueCounts, setOpenIssueCounts] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    async function loadOpenIssueCounts() {
      const { data, error } = await supabase
        .from("todos")
        .select("boat_id")
        .eq("status", "Open Issue");

      if (error) {
        console.error("Could not load open-issue counts:", error);
        return;
      }

      const counts: Record<string, number> = {};

      for (const todo of data ?? []) {
        const boatId = String(todo.boat_id);

        counts[boatId] = (counts[boatId] ?? 0) + 1;
      }

      setOpenIssueCounts(counts);
    }

    void loadOpenIssueCounts();
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
            Papahānaumokuākea Marine Debris Project
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
            Select a vessel to view its operation, maintenance, and To-Do
            records.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "1.25rem",
          }}
        >
          {boats.map((boat) => {
            const openIssues = openIssueCounts[boat.id] ?? 0;

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
                    {boat.image ? (
                      <Image
                        src={boat.image}
                        alt={`${boat.name} ${boat.nickname}`}
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
                            color: boat.nickname ? "#38bdf8" : "#64748b",
                            fontWeight: 600,
                          }}
                        >
                          {boat.nickname || "PMDP Vessel"}
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

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "1rem",
                        paddingTop: ".9rem",
                        borderTop: "1px solid #334155",
                      }}
                    >
                      <span style={{ color: "#94a3b8" }}>Open issues</span>

                      <strong
                        style={{
                          minWidth: "2rem",
                          padding: ".2rem .55rem",
                          borderRadius: "999px",
                          textAlign: "center",
                          background:
                            openIssues > 0 ? "#7f1d1d" : "#153229",
                          color:
                            openIssues > 0 ? "#fecaca" : "#86efac",
                        }}
                      >
                        {openIssues}
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