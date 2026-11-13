// Link analysis: the communication graph (numbers as nodes, contacts as weighted edges), centrality
// measures (degree, betweenness, closeness) and community detection (Louvain method), plus the
// data for the call-flow (Sankey) chart.
import type { CdrRecord } from "./types";
import { isSms, isVoice } from "./analytics";

export interface GNode { id: string; target: boolean; calls: number; sms: number; dur: number; degree: number; betweenness: number; closeness: number; community: number }
export interface GEdge { source: string; target: string; calls: number; sms: number; dur: number; aToB: number; bToA: number; weight: number }
export interface Graph { nodes: GNode[]; edges: GEdge[]; communities: number }

export function buildGraph(records: CdrRecord[], opts: { minContacts?: number; includeSms?: boolean; maxNodes?: number } = {}): Graph {
  const min = opts.minContacts ?? 1, includeSms = opts.includeSms ?? true;
  const targets = new Set(records.map((r) => r.a));
  const em = new Map<string, GEdge>();
  for (const r of records) {
    if (!r.b || r.a === r.b) continue;
    const voice = isVoice(r.type), sms = isSms(r.type);
    if (!voice && !(sms && includeSms)) continue;
    const [s, t] = r.a < r.b ? [r.a, r.b] : [r.b, r.a];
    const k = s + "|" + t;
    let e = em.get(k);
    if (!e) em.set(k, (e = { source: s, target: t, calls: 0, sms: 0, dur: 0, aToB: 0, bToA: 0, weight: 0 }));
    if (voice) { e.calls++; e.dur += r.dur; } else e.sms++;
    const outgoing = r.type === "MO" || r.type === "SMS-MO";
    const fromS = outgoing ? r.a === s : r.b === s;
    if (fromS) e.aToB++; else e.bToA++;
    e.weight = e.calls + e.sms;
  }
  let edges = [...em.values()].filter((e) => e.weight >= min || (targets.has(e.source) && targets.has(e.target)));
  const nm = new Map<string, GNode>();
  const node = (id: string) => { let n = nm.get(id); if (!n) nm.set(id, (n = { id, target: targets.has(id), calls: 0, sms: 0, dur: 0, degree: 0, betweenness: 0, closeness: 0, community: 0 })); return n; };
  for (const e of edges) for (const id of [e.source, e.target]) { const n = node(id); n.calls += e.calls; n.sms += e.sms; n.dur += e.dur; n.degree++; }
  if (opts.maxNodes && nm.size > opts.maxNodes) {
    const keep = new Set([...nm.values()].sort((a, b) => Number(b.target) - Number(a.target) || b.calls + b.sms - (a.calls + a.sms)).slice(0, opts.maxNodes).map((n) => n.id));
    edges = edges.filter((e) => keep.has(e.source) && keep.has(e.target));
    for (const id of [...nm.keys()]) if (!keep.has(id)) nm.delete(id);
    for (const n of nm.values()) n.degree = 0;
    for (const e of edges) { nm.get(e.source)!.degree++; nm.get(e.target)!.degree++; }
  }
  const g: Graph = { nodes: [...nm.values()], edges, communities: 0 };
  centrality(g);
  g.communities = louvain(g);
  return g;
}

function adjacency(g: Graph) {
  const idx = new Map(g.nodes.map((n, i) => [n.id, i]));
  const adj: number[][] = g.nodes.map(() => []);
  for (const e of g.edges) { const a = idx.get(e.source)!, b = idx.get(e.target)!; adj[a].push(b); adj[b].push(a); }
  return adj;
}

/** Betweenness (Brandes, unweighted, normalised 0..1) and harmonic closeness (0..1). Sampled above 1,500 nodes. */
export function centrality(g: Graph) {
  const n = g.nodes.length;
  if (!n) return;
  const adj = adjacency(g);
  const bc = new Float64Array(n), close = new Float64Array(n);
  let sources = [...Array(n).keys()];
  const sampled = n > 1500;
  if (sampled) { sources = sources.sort((a, b) => adj[b].length - adj[a].length).slice(0, 300); }
  const dist = new Int32Array(n), sigma = new Float64Array(n), delta = new Float64Array(n);
  const stack: number[] = [];
  const pred: number[][] = Array.from({ length: n }, () => []);
  for (const s of sources) {
    dist.fill(-1); sigma.fill(0); delta.fill(0); stack.length = 0;
    for (const p of pred) p.length = 0;
    dist[s] = 0; sigma[s] = 1;
    const q = [s]; let qi = 0; let harm = 0;
    while (qi < q.length) {
      const v = q[qi++]; stack.push(v);
      if (v !== s) harm += 1 / dist[v];
      for (const w of adj[v]) {
        if (dist[w] < 0) { dist[w] = dist[v] + 1; q.push(w); }
        if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v); }
      }
    }
    close[s] = n > 1 ? harm / (n - 1) : 0;
    while (stack.length) { const w = stack.pop()!; for (const v of pred[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]); if (w !== s) bc[w] += delta[w]; }
  }
  const scale = sampled ? n / sources.length : 1;
  const norm = n > 2 ? ((n - 1) * (n - 2)) : 1; // undirected: each pair counted twice
  g.nodes.forEach((node, i) => { node.betweenness = Math.round(((bc[i] * scale) / norm) * 10000) / 10000; node.closeness = Math.round(close[i] * 10000) / 10000; });
}

/** Louvain community detection on the call-weighted graph. Returns the number of communities. */
export function louvain(g: Graph, maxPasses = 10): number {
  const n = g.nodes.length;
  if (!n) return 0;
  const idx = new Map(g.nodes.map((x, i) => [x.id, i]));
  let nodeComm = [...Array(n).keys()];
  // Current level graph: weighted adjacency list
  let N = n;
  let links: Map<number, number>[] = Array.from({ length: n }, () => new Map());
  for (const e of g.edges) { const a = idx.get(e.source)!, b = idx.get(e.target)!; const w = Math.max(1, e.weight); links[a].set(b, (links[a].get(b) || 0) + w); links[b].set(a, (links[b].get(a) || 0) + w); }
  for (let pass = 0; pass < maxPasses; pass++) {
    const k = links.map((m) => [...m.values()].reduce((s, w) => s + w, 0) + (m.get(-1) || 0));
    const m2 = k.reduce((s, x) => s + x, 0);
    if (!m2) break;
    const comm = [...Array(N).keys()];
    const tot = [...k];
    let moved = true, improved = false, guard = 0;
    while (moved && guard++ < 50) {
      moved = false;
      for (let i = 0; i < N; i++) {
        const ci = comm[i];
        const wTo = new Map<number, number>();
        for (const [j, w] of links[i]) if (j >= 0 && j !== i) wTo.set(comm[j], (wTo.get(comm[j]) || 0) + w);
        tot[ci] -= k[i];
        let best = ci, bestGain = (wTo.get(ci) || 0) - (tot[ci] * k[i]) / m2;
        for (const [c, w] of wTo) { const gain = w - (tot[c] * k[i]) / m2; if (gain > bestGain + 1e-12) { bestGain = gain; best = c; } }
        tot[best] += k[i];
        if (best !== ci) { comm[i] = best; moved = true; improved = true; }
      }
    }
    // Renumber and aggregate
    const remap = new Map<number, number>();
    for (const c of comm) if (!remap.has(c)) remap.set(c, remap.size);
    nodeComm = nodeComm.map((c) => remap.get(comm[c])!);
    if (!improved || remap.size === N) break;
    const next: Map<number, number>[] = Array.from({ length: remap.size }, () => new Map());
    for (let i = 0; i < N; i++) for (const [j, w] of links[i]) {
      const a = remap.get(comm[i])!;
      if (j < 0) { next[a].set(-1, (next[a].get(-1) || 0) + w); continue; }
      const b = remap.get(comm[j])!;
      if (a === b) next[a].set(-1, (next[a].get(-1) || 0) + w); else next[a].set(b, (next[a].get(b) || 0) + w);
    }
    links = next; N = remap.size;
  }
  // Number communities by size (largest = 1)
  const size = new Map<number, number>();
  for (const c of nodeComm) size.set(c, (size.get(c) || 0) + 1);
  const order = [...size.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const rank = new Map(order.map((c, i) => [c, i + 1]));
  g.nodes.forEach((x, i) => (x.community = rank.get(nodeComm[i])!));
  return order.length;
}

/** Ego network around a number, `hops` steps out (for "expand" in the link chart). */
export function egoNetwork(g: Graph, id: string, hops = 1): Graph {
  const keep = new Set([id]);
  let frontier = new Set([id]);
  for (let h = 0; h < hops; h++) {
    const next = new Set<string>();
    for (const e of g.edges) {
      if (frontier.has(e.source) && !keep.has(e.target)) next.add(e.target);
      if (frontier.has(e.target) && !keep.has(e.source)) next.add(e.source);
    }
    for (const x of next) keep.add(x);
    frontier = next;
  }
  return { nodes: g.nodes.filter((n) => keep.has(n.id)), edges: g.edges.filter((e) => keep.has(e.source) && keep.has(e.target)), communities: g.communities };
}

/** Call flow for the Sankey chart: who calls the target (left) and whom the target calls (right). */
export function callFlow(records: CdrRecord[], target: string, topN = 8) {
  const inc = new Map<string, number>(), out = new Map<string, number>();
  for (const r of records) {
    if (r.a !== target || !r.b) continue;
    if (r.type === "MT" || r.type === "SMS-MT" || r.type === "MISSED") inc.set(r.b, (inc.get(r.b) || 0) + 1);
    else if (r.type === "MO" || r.type === "SMS-MO") out.set(r.b, (out.get(r.b) || 0) + 1);
  }
  const fold = (m: Map<string, number>) => {
    const s = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const head = s.slice(0, topN);
    const rest = s.slice(topN).reduce((n, [, v]) => n + v, 0);
    if (rest) head.push([`${s.length - topN} other numbers`, rest]);
    return head;
  };
  return { target, incoming: fold(inc).map(([id, value]) => ({ id, value })), outgoing: fold(out).map(([id, value]) => ({ id, value })) };
}
