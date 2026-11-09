"use client";

// @ts-expect-error d3-force-3d ships no types; we only use forceX/forceY.
import { forceX, forceY } from "d3-force-3d";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphResponse } from "@sidecar/shared";
import { Logo } from "./Logo";
import { roomLabel } from "./format";

// The force graph uses canvas and window, so it's loaded in the browser only
// (by hand, not next/dynamic, so our ref reaches the graph and we can tune forces).
type FG = typeof import("react-force-graph-2d").default;

type Node = { id: string; label: string; demo: boolean; asked: boolean; me?: boolean; cluster: string; bornAt: number; x?: number; y?: number };

/** One colour per problem cluster, so the room's "groups" are visible at a glance. */
const CLUSTER_COLORS: Record<string, string> = {
  "Tracing cost & sampling": "#c6f432",
  "Collector memory": "#7cd4ff",
  "LLM latency & GPUs": "#ff8fc7",
  "Platform adoption": "#ffd23f",
  "GitOps & rollbacks": "#b9a6ff",
  "Security & eBPF": "#5eead4",
  "Just exploring": "#d6d3d1",
};
type Link = { source: string | Node; target: string | Node; kind: "same_problem" | "same_interests"; score: number; bornAt: number };

const POLL_MS = 3000;
const INK = "#17131f";
const PAPER = "#fff6e6";
const COLORS = { asked: "#c6f432", schedule: "#7cd4ff", demo: "#b9a6ff", problem: "#ff6b35", interests: "rgba(255,246,230,0.35)" };

/** Full-screen projector view, or `embedded` as a card (e.g. on /connect, with you highlighted). */
export function PeopleGraph({ talk, embedded = false }: { talk: { id: string; title: string; room_id: string }; embedded?: boolean }) {
  const [data, setData] = useState<{ nodes: Node[]; links: Link[] }>({ nodes: [], links: [] });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [newEdges, setNewEdges] = useState(0);
  const [showNew, setShowNew] = useState(false);
  // react-force-graph's imperative handle (d3 forces, zoomToFit).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fg = useRef<any>(null);
  const [ForceGraph2D, setForceGraph2D] = useState<FG | null>(null);
  useEffect(() => {
    import("react-force-graph-2d").then((m) => setForceGraph2D(() => m.default));
  }, []);
  const box = useRef<HTMLDivElement>(null);
  const known = useRef<{ nodes: Map<string, Node>; links: Map<string, Link> }>({ nodes: new Map(), links: new Map() });

  // Fit the canvas to its box.
  useEffect(() => {
    const fit = () => box.current && setSize({ w: box.current.clientWidth, h: box.current.clientHeight });
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Poll the graph; keep existing node objects so the layout doesn't jump.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/talks/${talk.id}/graph`, { cache: "no-store" });
        if (res.ok) {
          const g = (await res.json()) as GraphResponse;
          const now = Date.now();
          const nodes = g.nodes.map((n) => {
            const prev = known.current.nodes.get(n.id);
            const node: Node = prev ? Object.assign(prev, n) : { ...n, bornAt: now };
            known.current.nodes.set(n.id, node);
            return node;
          });
          let fresh = 0;
          const links = g.edges.map((e) => {
            const key = [e.source, e.target].sort().join("__");
            const prev = known.current.links.get(key);
            if (!prev && known.current.links.size > 0) fresh++;
            const link: Link = prev ? Object.assign(prev, { kind: e.kind, score: e.score }) : { ...e, bornAt: now };
            known.current.links.set(key, link);
            return link;
          });
          if (fresh) {
            setNewEdges((c) => c + fresh);
            setShowNew(true);
          }
          setData({ nodes, links });
        }
      } catch {
        /* keep the last graph on screen */
      }
      if (!stop) setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [talk.id]);

  // Hide the "new connection" banner after a few seconds.
  useEffect(() => {
    if (!showNew) return;
    const t = setTimeout(() => setShowNew(false), 3500);
    return () => clearTimeout(t);
  }, [showNew, newEdges]);

  // Spread people out so labels stay readable on a projector.
  // The graph library loads asynchronously, so wait for it before setting forces.
  useEffect(() => {
    let tries = 0;
    const t = setInterval(() => {
      const g = fg.current;
      if (!g?.d3Force || tries++ > 50) return clearInterval(t);
      g.d3Force("charge")?.strength(embedded ? -260 : -420);
      g.d3Force("link")?.distance(embedded ? 90 : 150);
      // Gentle pull to the middle, so people without links don't drift off-screen
      // (and zoom-to-fit doesn't shrink everyone else to fit them).
      g.d3Force("x", forceX(0).strength(0.07));
      g.d3Force("y", forceY(0).strength(0.07));
      g.d3ReheatSimulation?.();
      clearInterval(t);
    }, 150);
    return () => clearInterval(t);
  }, [data.nodes.length, embedded, ForceGraph2D]);

  const stats = useMemo(() => {
    const problems = data.links.filter((l) => l.kind === "same_problem").length;
    const clusters = new Map<string, number>();
    data.nodes.forEach((n) => clusters.set(n.cluster, (clusters.get(n.cluster) ?? 0) + 1));
    return { people: data.nodes.length, problems, interests: data.links.length - problems, clusters: [...clusters.entries()].sort((a, b) => b[1] - a[1]) };
  }, [data]);

  const clusterLegend = (
    <div className="flex flex-wrap gap-1.5">
      {stats.clusters.map(([name, n]) => (
        <span key={name} className="chip border-paper text-ink" style={{ background: CLUSTER_COLORS[name] ?? "#d6d3d1" }}>
          {name} · {n}
        </span>
      ))}
    </div>
  );

  if (embedded) {
    return (
      <div className="overflow-hidden rounded-2xl border-2 border-ink bg-ink text-paper">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-xs">
          <span className="chip border-paper bg-paper text-ink">{stats.people} people</span>
          <span className="chip border-paper bg-tangerine text-white">{stats.problems} same problem</span>
          <span className="chip border-paper bg-sky text-ink">{stats.interests} same interests</span>
          <span className="ml-auto font-mono text-paper/60">You = orange ring · bold = same problem</span>
        </div>
        <div className="px-4 pt-2">{clusterLegend}</div>
        <div className="h-[380px]">
      <div ref={box} className="relative h-full" aria-label="People graph">
        {data.nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-paper/60">
            <span className="animate-wiggle text-5xl" aria-hidden="true">🕸️</span>
            <p className="font-display text-2xl">Ask a question to join the graph</p>
          </div>
        )}
        {ForceGraph2D && <ForceGraph2D
          ref={fg}
          onEngineStop={() => fg.current?.zoomToFit(500, 80)}
          width={size.w}
          height={size.h}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={120}
          autoPauseRedraw={false}
          d3VelocityDecay={0.3}
          linkWidth={(l) => ((l as Link).kind === "same_problem" ? 2 + (l as Link).score * 4 : 1)}
          linkColor={(l) => ((l as Link).kind === "same_problem" ? COLORS.problem : COLORS.interests)}
          linkLineDash={(l) => ((l as Link).kind === "same_problem" ? null : [4, 4])}
          linkDirectionalParticles={(l) => ((l as Link).kind === "same_problem" ? 2 : 0)}
          linkDirectionalParticleWidth={3}
          linkDirectionalParticleColor={() => "#ffd23f"}
          nodeRelSize={7}
          nodeCanvasObject={(n, ctx, scale) => {
            const node = n as Node;
            const age = Math.min(1, (Date.now() - node.bornAt) / 600);
            const r = (node.me ? 16 : 12) * (0.4 + 0.6 * age);
            const fill = CLUSTER_COLORS[node.cluster] ?? COLORS.schedule;
            // You: a thick orange ring. Someone who just joined: a pulsing halo for a few seconds.
            const fresh = Date.now() - node.bornAt < 6000 && known.current.nodes.size > 1;
            if (node.me || fresh) {
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, r + (node.me ? 6 : 4 + 3 * Math.abs(Math.sin(Date.now() / 250))), 0, 2 * Math.PI);
              ctx.fillStyle = node.me ? "rgba(255,107,53,0.45)" : "rgba(255,210,63,0.5)";
              ctx.fill();
            }
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.lineWidth = 2.5 / scale;
            ctx.strokeStyle = INK;
            ctx.stroke();
            const fontSize = Math.max(13 / scale, 3);
            ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = PAPER;
            ctx.fillText(node.label, node.x ?? 0, (node.y ?? 0) + r + 3 / scale);
          }}
          nodePointerAreaPaint={(n, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc((n as Node).x ?? 0, (n as Node).y ?? 0, 12, 0, 2 * Math.PI);
            ctx.fill();
          }}
        />}
        {showNew && (
          <div key={newEdges} className="sticker absolute left-6 top-6 animate-pop border-paper bg-tangerine px-4 py-2 font-display font-bold text-white">
            ✨ New connection just formed
          </div>
        )}
      </div>

        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-ink text-paper [background-image:radial-gradient(rgba(255,246,230,0.06)_1px,transparent_1px)] [background-size:22px_22px]">
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-ink-2 px-6 py-4">
        <Logo dark />
        <div className="ml-2 min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-widest text-paper/50">The hallway track · {roomLabel(talk.room_id)}</p>
          <h1 className="truncate font-display text-2xl font-extrabold">{talk.title}</h1>
        </div>
        <div className="flex gap-2">
          <Stat value={stats.people} label="people" color="bg-paper text-ink" />
          <Stat value={stats.problems} label="same problem" color="bg-tangerine text-white" />
          <Stat value={stats.interests} label="same interests" color="bg-sky text-ink" />
        </div>
      </header>

      <div ref={box} className="relative min-h-0 flex-1" aria-label="People graph">
        {data.nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-paper/60">
            <span className="animate-wiggle text-5xl" aria-hidden="true">🕸️</span>
            <p className="font-display text-2xl">Ask a question to join the graph</p>
          </div>
        )}
        {ForceGraph2D && <ForceGraph2D
          ref={fg}
          onEngineStop={() => fg.current?.zoomToFit(500, 80)}
          width={size.w}
          height={size.h}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={120}
          autoPauseRedraw={false}
          d3VelocityDecay={0.3}
          linkWidth={(l) => ((l as Link).kind === "same_problem" ? 2 + (l as Link).score * 4 : 1)}
          linkColor={(l) => ((l as Link).kind === "same_problem" ? COLORS.problem : COLORS.interests)}
          linkLineDash={(l) => ((l as Link).kind === "same_problem" ? null : [4, 4])}
          linkDirectionalParticles={(l) => ((l as Link).kind === "same_problem" ? 2 : 0)}
          linkDirectionalParticleWidth={3}
          linkDirectionalParticleColor={() => "#ffd23f"}
          nodeRelSize={7}
          nodeCanvasObject={(n, ctx, scale) => {
            const node = n as Node;
            const age = Math.min(1, (Date.now() - node.bornAt) / 600);
            const r = (node.me ? 16 : 12) * (0.4 + 0.6 * age);
            const fill = node.me ? COLORS.problem : node.asked ? COLORS.asked : node.demo ? COLORS.demo : COLORS.schedule;
            if (node.me) {
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, r + 5, 0, 2 * Math.PI);
              ctx.fillStyle = "rgba(255,107,53,0.25)";
              ctx.fill();
            }
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.lineWidth = 2.5 / scale;
            ctx.strokeStyle = INK;
            ctx.stroke();
            const fontSize = Math.max(13 / scale, 3);
            ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = PAPER;
            ctx.fillText(node.label, node.x ?? 0, (node.y ?? 0) + r + 3 / scale);
          }}
          nodePointerAreaPaint={(n, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc((n as Node).x ?? 0, (n as Node).y ?? 0, 12, 0, 2 * Math.PI);
            ctx.fill();
          }}
        />}
        {showNew && (
          <div key={newEdges} className="sticker absolute left-6 top-6 animate-pop border-paper bg-tangerine px-4 py-2 font-display font-bold text-white">
            ✨ New connection just formed
          </div>
        )}
      </div>

      <div className="border-t-2 border-ink-2 px-6 pt-3">
        <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-paper/50">What people here are stuck on</p>
        {clusterLegend}
      </div>
      <footer className="flex flex-wrap items-center gap-5 px-6 py-3 text-sm text-paper/70">
        <Legend swatch={<span className="inline-block h-1 w-8 rounded bg-tangerine" />} text="Same problem (from questions asked)" />
        <Legend swatch={<span className="inline-block w-8 border-t-2 border-dashed border-paper/40" />} text="Same interests (rare talks in common)" />
        <span className="ml-auto font-mono text-xs">Names stay hidden until both people say yes.</span>
      </footer>
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <span className={`chip border-paper ${color} px-3 py-1 text-sm`}>
      <b className="font-display text-base">{value}</b> {label}
    </span>
  );
}

function Legend({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-2">
      {swatch}
      {text}
    </span>
  );
}
