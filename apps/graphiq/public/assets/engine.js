// Main-thread client for the analysis worker.
let worker, seq = 0;
const waiting = new Map();
function w() {
  if (!worker) {
    worker = new Worker("/assets/engine-worker.js", { type: "module" });
    worker.onmessage = (ev) => { const p = waiting.get(ev.data.id); if (!p) return; waiting.delete(ev.data.id); ev.data.ok ? p.resolve(ev.data.result) : p.reject(new Error(ev.data.error)); };
    worker.onerror = (e) => { for (const p of waiting.values()) p.reject(new Error(e.message || "The analysis worker stopped.")); waiting.clear(); worker = null; };
  }
  return worker;
}
export function run(op, args, transfer) {
  return new Promise((resolve, reject) => { const id = ++seq; waiting.set(id, { resolve, reject }); w().postMessage({ id, op, args }, transfer || []); });
}
