// Learning player shared by learn.kayaksa.com and Kayak Learn on the internal portal.
import { $, $$, api, esc, html, raw, ico, toast, setBusy } from "/_shared/js/ui.js";

const md = (t) => {
  const h = window.marked ? window.marked.parse(t || "") : esc(t || "");
  return window.DOMPurify ? window.DOMPurify.sanitize(h) : h;
};
const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}` : `${m} min`);

let CAT = null, ME = null;
async function catalog(apiBase) { if (!CAT) CAT = await api(`${apiBase}/catalog`); return CAT; }
async function me(apiBase, fresh) { if (!ME || fresh) ME = await api(`${apiBase}/me`, { authRedirect: false }).catch(() => ({ signedIn: false, lessons: {}, quizzes: {}, certificates: [] })); return ME; }

function courseState(c) {
  const done = new Set(ME.lessons[c.id] || []);
  const lessons = c.lessons.filter((l) => done.has(l.id)).length;
  const q = ME.quizzes[c.id];
  const cert = ME.certificates.find((x) => x.kind === "course" && x.ref_id === c.id);
  const pct = Math.round(((lessons + (q?.passed ? 1 : 0)) / (c.lessons.length + 1)) * 100);
  return { done, lessons, quiz: q, cert, pct };
}
const topicOf = (id) => CAT.topics.find((t) => t.id === id) || { name: id, color: "#17807E" };

/**
 * opts: { base: "#/learn" or "#", apiBase: "/api/learn", signIn: () => void | null, internal: bool }
 * route: array of hash parts after base, e.g. ["course","ethics-101","lesson","l1"]
 */
export async function renderLearn(main, route, opts) {
  await Promise.all([catalog(opts.apiBase), me(opts.apiBase, true)]);
  const [kind, id, sub, subId] = route;
  if (kind === "path") return pathPage(main, id, opts);
  if (kind === "course" && sub === "lesson") return lessonPage(main, id, subId, opts);
  if (kind === "course" && sub === "quiz") return quizPage(main, id, opts);
  if (kind === "course") return coursePage(main, id, opts);
  if (kind === "byte") return bytePage(main, id, opts);
  if (kind === "certificates") return certsPage(main, opts);
  if (kind === "bytes") return bytesPage(main, opts);
  return homePage(main, opts, route[0] === "topic" ? id : null);
}

const L = (opts, ...p) => `${opts.base}/${p.join("/")}`.replace(/\/+/g, "/").replace("#/", "#/");

function courseCard(c, opts) {
  const t = topicOf(c.topic), s = courseState(c);
  return `<a class="course-card" href="${L(opts, "course", c.id)}"><span class="band-top" style="background:${esc(t.color)}"></span><div class="body">
    <span class="eyebrow" style="color:${esc(t.color)}">${esc(t.name)}${c.audience === "internal" ? " · Kayak staff" : ""}</span><h3>${esc(c.title)}</h3><p class="small muted">${esc(c.summary)}</p>
    <div class="row small faint" style="margin-top:auto">${ico("clock")} ${mins(c.minutes)} · ${c.lessons.length} lessons · ${esc(c.level)}</div>
    ${ME.signedIn && s.pct ? `<div class="progress" aria-label="${s.pct}% complete"><i style="width:${s.pct}%"></i></div>` : ""}
    ${s.cert ? `<span class="badge ok">${ico("award")} Certificate earned</span>` : ""}</div></a>`;
}

function homePage(main, opts, topic) {
  const paths = CAT.paths.filter((p) => !topic || p.topic === topic);
  const courses = CAT.courses.filter((c) => !topic || c.topic === topic);
  main.innerHTML = `<div class="page">
    ${opts.hero || ""}
    <div class="chips" role="navigation" aria-label="Topics"><a class="chip${topic ? "" : " on"}" href="${L(opts)}">All topics</a>${CAT.topics.map((t) => `<a class="chip${topic === t.id ? " on" : ""}" href="${L(opts, "topic", t.id)}">${esc(t.name)}</a>`).join("")}</div>
    ${ME.signedIn ? `<div class="row between"><p class="muted">${ME.certificates.length ? `You have earned ${ME.certificates.length} certificate${ME.certificates.length === 1 ? "" : "s"}.` : "Complete every lesson and pass the assessment to earn a certificate of participation."}</p><a class="btn btn-ghost btn-sm" href="${L(opts, "certificates")}">${ico("award")} My certificates</a></div>` : ""}
    <section class="stack"><div class="stack-sm"><span class="eyebrow">Learning paths</span><h2>Build a complete skill</h2></div>
      <div class="grid wide">${paths.map((p) => {
        const cs = p.courses.map((id) => CAT.courses.find((c) => c.id === id)).filter(Boolean);
        const done = cs.filter((c) => courseState(c).cert).length;
        const pc = ME.certificates.find((x) => x.kind === "path" && x.ref_id === p.id);
        return `<a class="course-card" href="${L(opts, "path", p.id)}"><span class="band-top" style="background:${esc(p.color)};height:12px"></span><div class="body"><span class="eyebrow" style="color:${esc(p.color)}">Learning path · ${cs.length} courses</span><h3 style="font-size:1.35rem">${esc(p.title)}</h3><p class="muted">${esc(p.summary)}</p>
          <div class="row small faint" style="margin-top:auto">${ico("clock")} ${mins(cs.reduce((n, c) => n + c.minutes, 0))}${ME.signedIn ? ` · ${done} of ${cs.length} complete` : ""}</div>${pc ? `<span class="badge ok">${ico("award")} Path certificate</span>` : ""}</div></a>`;
      }).join("")}</div></section>
    <section class="stack"><div class="stack-sm"><span class="eyebrow">Courses</span><h2>All courses</h2></div><div class="grid wide">${courses.map((c) => courseCard(c, opts)).join("")}</div></section>
    <section class="stack"><div class="row between"><div class="stack-sm"><span class="eyebrow">Awareness bytes</span><h2>Two minutes, one idea</h2></div><a href="${L(opts, "bytes")}">All bytes ${ico("arrow")}</a></div>
      <div class="grid">${CAT.bytes.filter((b) => !topic || b.topic === topic).slice(0, 6).map((b) => byteCard(b, opts)).join("")}</div></section>
  </div>`;
}

function byteCard(b, opts) {
  const t = topicOf(b.topic);
  return `<a class="card link stack-sm" href="${L(opts, "byte", b.id)}" style="border-left:4px solid ${esc(t.color)}"><span class="eyebrow" style="color:${esc(t.color)}">${esc(t.name)} · ${b.minutes} min</span><h3>${esc(b.title)}</h3></a>`;
}

function bytesPage(main, opts) {
  main.innerHTML = `<div class="page"><a href="${L(opts)}" class="small">${ico("chevron")} All learning</a><div class="stack-sm"><span class="eyebrow">Awareness bytes</span><h1>Two minutes, one idea</h1><p class="lead">Short reads with a single check question, for the moments between meetings.</p></div>
    <div class="grid">${CAT.bytes.map((b) => byteCard(b, opts)).join("")}</div></div>`;
}

function pathPage(main, id, opts) {
  const p = CAT.paths.find((x) => x.id === id);
  if (!p) return (main.innerHTML = `<div class="page"><div class="empty">Learning path not found.</div></div>`);
  const cs = p.courses.map((cid) => CAT.courses.find((c) => c.id === cid)).filter(Boolean);
  const pc = ME.certificates.find((x) => x.kind === "path" && x.ref_id === p.id);
  main.innerHTML = `<div class="page"><a href="${L(opts)}" class="small">${ico("chevron")} All learning</a>
    <section class="hero" style="background:${esc(p.color)}"><div class="stack" style="max-width:720px;position:relative;z-index:1"><span class="eyebrow" style="color:#F5C46D">Learning path</span><h1>${esc(p.title)}</h1><p class="serif" style="font-size:1.1rem">${esc(p.summary)}</p>
      <p class="small" style="color:#E3EEEC">${cs.length} courses · ${mins(cs.reduce((n, c) => n + c.minutes, 0))} · Certificate of participation when every course is complete</p></div></section>
    ${pc ? `<div class="note ok row between"><span>${ico("award")} You completed this path on ${new Date(pc.issued_at).toLocaleDateString("en-IN")}.</span><a class="btn btn-primary btn-sm" href="${opts.apiBase}/certificates/${pc.id}/pdf">${ico("download")} Certificate</a></div>` : ""}
    <ol class="stack" style="list-style:none;padding:0;margin:0">${cs.map((c, i) => `<li class="row" style="align-items:stretch;flex-wrap:nowrap"><span class="tile-ico" style="font:800 1.1rem var(--display)">${i + 1}</span><div style="flex:1;min-width:0">${courseCard(c, opts)}</div></li>`).join("")}</ol></div>`;
}

function coursePage(main, id, opts) {
  const c = CAT.courses.find((x) => x.id === id);
  if (!c) return (main.innerHTML = `<div class="page"><div class="empty">Course not found.</div></div>`);
  const t = topicOf(c.topic), s = courseState(c);
  const nextLesson = c.lessons.find((l) => !s.done.has(l.id)) || c.lessons[0];
  const allDone = s.lessons === c.lessons.length;
  main.innerHTML = `<div class="page"><a href="${L(opts)}" class="small">${ico("chevron")} All learning</a>
    <div class="split"><div class="stack">
      <span class="eyebrow" style="color:${esc(t.color)}">${esc(t.name)} · ${esc(c.level)}</span><h1>${esc(c.title)}</h1><p class="lead">${esc(c.summary)}</p>
      <div class="row small muted">${ico("clock")} ${mins(c.minutes)} · ${c.lessons.length} lessons · assessment (pass mark ${c.quiz.pass}%)</div>
      <div class="card stack-sm"><h3>You will be able to</h3><ul style="margin:0;padding-left:18px">${c.outcomes.map((o) => `<li>${esc(o)}</li>`).join("")}</ul></div>
      ${s.cert ? `<div class="note ok row between"><span>${ico("award")} Certificate earned.</span><a class="btn btn-primary btn-sm" href="${opts.apiBase}/certificates/${s.cert.id}/pdf">${ico("download")} Download certificate</a></div>` : ""}
      <div class="row">${ME.signedIn || !opts.signIn ? `<a class="btn btn-primary" href="${L(opts, "course", c.id, "lesson", nextLesson.id)}">${s.lessons ? "Continue" : "Start the course"} ${ico("arrow")}</a>` : `<button class="btn btn-primary" id="si">Sign in to start</button><a class="btn btn-ghost" href="${L(opts, "course", c.id, "lesson", c.lessons[0].id)}">Preview the first lesson</a>`}
      ${allDone || s.quiz ? `<a class="btn btn-ghost" href="${L(opts, "course", c.id, "quiz")}">${ico("check")} ${s.quiz?.passed ? "Retake the assessment" : "Take the assessment"}</a>` : ""}</div>
    </div>
    <div class="card stack-sm"><h3>Lessons</h3><ol style="list-style:none;margin:0;padding:0">${c.lessons.map((l, i) => `<li style="border-bottom:1px solid var(--line)"><a class="row" style="padding:12px 4px;text-decoration:none;color:var(--fg);flex-wrap:nowrap" href="${L(opts, "course", c.id, "lesson", l.id)}"><span class="badge ${s.done.has(l.id) ? "ok" : ""}">${s.done.has(l.id) ? "Done" : i + 1}</span><span style="flex:1">${esc(l.title)}</span><span class="small faint">${l.minutes} min</span></a></li>`).join("")}
      <li><a class="row" style="padding:12px 4px;text-decoration:none;color:var(--fg)" href="${L(opts, "course", c.id, "quiz")}"><span class="badge ${s.quiz?.passed ? "ok" : "accent"}">${s.quiz?.passed ? "Passed" : "Quiz"}</span><span style="flex:1">Assessment · ${c.quiz.count} questions${s.quiz ? ` · best ${s.quiz.best}%` : ""}</span></a></li></ol></div></div></div>`;
  $("#si")?.addEventListener("click", opts.signIn);
}

async function lessonPage(main, cid, lid, opts) {
  const c = CAT.courses.find((x) => x.id === cid);
  if (!c) return (main.innerHTML = `<div class="page"><div class="empty">Course not found.</div></div>`);
  const i = c.lessons.findIndex((l) => l.id === lid);
  const { lesson } = await api(`${opts.apiBase}/courses/${cid}/lessons/${lid}`);
  const next = c.lessons[i + 1];
  const s = courseState(c);
  main.innerHTML = `<div class="page"><a href="${L(opts, "course", cid)}" class="small">${ico("chevron")} ${esc(c.title)}</a>
    <div class="row small muted">Lesson ${i + 1} of ${c.lessons.length} · ${lesson.minutes} min</div><div class="progress"><i style="width:${Math.round(((i + 1) / c.lessons.length) * 100)}%"></i></div>
    <article class="lesson stack"><h1>${esc(lesson.title)}</h1><div class="md">${md(lesson.body)}</div></article>
    <div class="row between lesson"><span></span><div class="row">
      ${ME.signedIn ? `<button class="btn btn-primary" id="done">${s.done.has(lid) ? "Next" : "Mark complete and continue"} ${ico("arrow")}</button>` : opts.signIn ? `<button class="btn btn-primary" id="si">Sign in to save progress</button>` : ""}</div></div></div>`;
  $("#si")?.addEventListener("click", opts.signIn);
  $("#done")?.addEventListener("click", async (e) => {
    setBusy(e.currentTarget, true, "Saving…");
    try {
      const r = await api(`${opts.apiBase}/progress`, { body: { courseId: cid, lessonId: lid } });
      if (r.issued?.length) { toast(`Certificate earned: ${r.issued.map((x) => x.title).join(", ")}. Find it in My certificates.`, "ok", 8000); ME = null; location.hash = L(opts, "certificates"); return; }
      location.hash = next ? L(opts, "course", cid, "lesson", next.id) : L(opts, "course", cid, "quiz");
    } catch (err) { toast(err.message, "err"); setBusy(e.currentTarget, false); }
  });
}

async function quizPage(main, cid, opts) {
  const c = CAT.courses.find((x) => x.id === cid);
  if (!c) return (main.innerHTML = `<div class="page"><div class="empty">Course not found.</div></div>`);
  if (!ME.signedIn) { main.innerHTML = `<div class="page"><div class="empty stack" style="align-items:center"><p>Sign in to take the assessment and earn your certificate.</p>${opts.signIn ? `<button class="btn btn-primary" id="si">Sign in</button>` : ""}</div></div>`; $("#si")?.addEventListener("click", opts.signIn); return; }
  const quiz = await api(`${opts.apiBase}/courses/${cid}/quiz`);
  main.innerHTML = `<div class="page lesson"><a href="${L(opts, "course", cid)}" class="small">${ico("chevron")} ${esc(c.title)}</a>
    <div class="stack-sm"><span class="eyebrow">Assessment</span><h1>${esc(c.title)}</h1><p class="muted">${quiz.questions.length} questions. Pass mark ${quiz.pass}%. You can retake it.</p></div>
    <form class="stack" id="qf">${quiz.questions.map((q, i) => `<fieldset class="card stack-sm" style="margin:0"><legend class="label" style="font-size:1rem;padding:0 4px">${i + 1}. ${esc(q.q)}</legend>${q.options.map((o, j) => `<label class="qopt" data-q="${i}" data-o="${j}"><input type="radio" name="q${i}" value="${j}" required><span>${esc(o)}</span></label>`).join("")}<p class="small" data-why="${i}" hidden></p></fieldset>`).join("")}
    <div class="row"><button class="btn btn-primary" type="submit">Submit answers</button></div></form><div id="res"></div></div>`;
  $("#qf").onsubmit = async (e) => {
    e.preventDefault();
    const answers = quiz.questions.map((_, i) => Number(new FormData(e.target).get(`q${i}`)));
    const btn = e.submitter; setBusy(btn, true, "Marking…");
    try {
      const r = await api(`${opts.apiBase}/courses/${cid}/quiz`, { body: { answers } });
      r.review.forEach((rv, i) => {
        $$(`[data-q="${i}"]`).forEach((el) => { el.classList.remove("right", "wrong"); if (Number(el.dataset.o) === rv.answer) el.classList.add("right"); else if (Number(el.dataset.o) === answers[i]) el.classList.add("wrong"); });
        const w = $(`[data-why="${i}"]`); w.hidden = false; w.innerHTML = `<b>${rv.correct ? "Correct." : "Not quite."}</b> ${esc(rv.why)}`;
      });
      const cert = r.issued?.find((x) => x.kind === "course");
      const pathCert = r.issued?.find((x) => x.kind === "path");
      $("#res").innerHTML = `<div class="note ${r.passed ? "ok" : "warn"} stack-sm"><h3>${r.passed ? "You passed" : "Not this time"}: ${r.score}% (${r.right} of ${r.total})</h3>
        ${r.passed ? (r.lessonsOutstanding ? `<p>Complete every lesson to receive your certificate.</p>` : r.verifyEmail ? `<p>Confirm your email address to receive your certificate. We have sent you a link; your certificate is issued as soon as you confirm.</p>` : cert ? `<p>Your certificate of participation is ready.</p><a class="btn btn-primary btn-sm" href="${opts.apiBase}/certificates/${cert.id}/pdf">${ico("download")} Download certificate</a>` : `<p>You already hold the certificate for this course.</p>`) : `<p>You need ${quiz.pass}%. Review the explanations above and try again.</p>`}
        ${pathCert ? `<p>${ico("award")} You also completed the learning path <b>${esc(pathCert.title)}</b>. <a href="${opts.apiBase}/certificates/${pathCert.id}/pdf">Download the path certificate</a>.</p>` : ""}</div>`;
      $("#res").scrollIntoView({ behavior: "smooth" });
      me(opts.apiBase, true);
    } catch (err) { toast(err.message, "err"); }
    finally { setBusy(btn, false); }
  };
}

function bytePage(main, id, opts) {
  const b = CAT.bytes.find((x) => x.id === id);
  if (!b) return (main.innerHTML = `<div class="page"><div class="empty">Not found.</div></div>`);
  const t = topicOf(b.topic);
  main.innerHTML = `<div class="page lesson"><a href="${L(opts, "bytes")}" class="small">${ico("chevron")} Awareness bytes</a><span class="eyebrow" style="color:${esc(t.color)}">${esc(t.name)} · ${b.minutes} min</span><h1>${esc(b.title)}</h1>
    <div class="md">${md(b.body)}</div><div class="card stack-sm"><span class="eyebrow">Quick check</span><p><b>${esc(b.check.q)}</b></p>${b.check.options.map((o, j) => `<button class="qopt" data-o="${j}" style="text-align:left;font:inherit;color:inherit">${esc(o)}</button>`).join("")}<p class="small" id="why" hidden></p></div></div>`;
  $$("[data-o]", main).forEach((el) => (el.onclick = async () => {
    const r = await api(`${opts.apiBase}/bytes/${id}/check`, { body: { answer: Number(el.dataset.o) } });
    $$("[data-o]", main).forEach((x) => { x.classList.remove("right", "wrong"); if (Number(x.dataset.o) === r.answer) x.classList.add("right"); });
    if (!r.correct) el.classList.add("wrong");
    const w = $("#why"); w.hidden = false; w.innerHTML = `<b>${r.correct ? "Correct." : "Not quite."}</b> ${esc(r.why)}`;
  }));
}

function certsPage(main, opts) {
  main.innerHTML = `<div class="page"><a href="${L(opts)}" class="small">${ico("chevron")} All learning</a><div class="stack-sm"><span class="eyebrow">Certificates</span><h1>My certificates</h1><p class="lead">Each certificate carries an ID that anyone can verify at learn.kayaksa.com/verify.</p></div>
    ${ME.certificates.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Title</th><th>Type</th><th>Issued</th><th>ID</th><th></th></tr></thead><tbody>${ME.certificates.map((c) => `<tr><td><b>${esc(c.title)}</b></td><td>${c.kind === "path" ? "Learning path" : "Course"}</td><td>${new Date(c.issued_at).toLocaleDateString("en-IN")}</td><td><code>${esc(c.id)}</code></td><td><a class="btn btn-ghost btn-sm" href="${opts.apiBase}/certificates/${c.id}/pdf">${ico("download")} PDF</a></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No certificates yet. Finish a course and pass its assessment to earn one.</div>`}</div>`;
}
