// Learning API shared by learn.kayaksa.com and internal.kayaksa.com (Kayak Learn).
// Both databases carry learn_progress, quiz_attempts and certificates tables.
import { Hono } from "hono";
import { publicCatalog, lessonOf, quizFor, grade, course, path as getPath, getCatalog, checkByte } from "./catalog";
import { certificatePdf, certificateId } from "./certificate";

export interface Learner { id: string; name: string }

export interface LearnOptions {
  internal: boolean;
  learner: (c: any) => Promise<Learner | null>;
  verifyBase: (c: any) => string; // e.g. https://learn.kayaksa.com/verify/
  onIssued?: (c: any, learner: Learner, cert: { id: string; title: string; kind: string }) => Promise<void>;
}

export function learnApi(o: LearnOptions) {
  const app = new Hono<any>();
  const visible = (audience: string) => o.internal || audience === "public";

  async function need(c: any): Promise<Learner> {
    const l = await o.learner(c);
    if (!l) throw Object.assign(new Error("Sign in to save your progress."), { status: 401 });
    return l;
  }
  app.onError((e: any, c) => c.json({ error: e.message || "Something went wrong." }, e.status || 500));

  app.get("/catalog", (c) => c.json(publicCatalog(o.internal)));

  app.get("/courses/:id/lessons/:lesson", (c) => {
    const crs = course(c.req.param("id"));
    if (!crs || !visible(crs.audience)) return c.json({ error: "Course not found." }, 404);
    const l = lessonOf(crs.id, c.req.param("lesson"));
    if (!l) return c.json({ error: "Lesson not found." }, 404);
    return c.json({ lesson: l });
  });

  app.get("/courses/:id/quiz", (c) => {
    const crs = course(c.req.param("id"));
    if (!crs || !visible(crs.audience)) return c.json({ error: "Course not found." }, 404);
    return c.json(quizFor(crs.id));
  });

  app.get("/me", async (c) => {
    const l = await o.learner(c);
    if (!l) return c.json({ signedIn: false, lessons: {}, quizzes: {}, certificates: [] });
    const db = c.env.DB as D1Database;
    const [lp, qa, ce] = await Promise.all([
      db.prepare("SELECT course_id, lesson_id FROM learn_progress WHERE user_id = ?").bind(l.id).all<any>(),
      db.prepare("SELECT course_id, MAX(score) best, MAX(passed) passed FROM quiz_attempts WHERE user_id = ? GROUP BY course_id").bind(l.id).all<any>(),
      db.prepare("SELECT id, kind, ref_id, title, issued_at FROM certificates WHERE user_id = ? ORDER BY issued_at DESC").bind(l.id).all<any>(),
    ]);
    const lessons: Record<string, string[]> = {};
    for (const r of lp.results) (lessons[r.course_id] ||= []).push(r.lesson_id);
    const quizzes: Record<string, { best: number; passed: boolean }> = {};
    for (const r of qa.results) quizzes[r.course_id] = { best: r.best, passed: !!r.passed };
    return c.json({ signedIn: true, name: l.name, lessons, quizzes, certificates: ce.results });
  });

  app.post("/progress", async (c) => {
    const l = await need(c);
    const b = await c.req.json().catch(() => ({}));
    const crs = course(String(b.courseId || ""));
    if (!crs || !visible(crs.audience) || !lessonOf(crs.id, String(b.lessonId || ""))) return c.json({ error: "Lesson not found." }, 404);
    await c.env.DB.prepare("INSERT OR IGNORE INTO learn_progress (user_id, course_id, lesson_id, done_at) VALUES (?,?,?,?)").bind(l.id, crs.id, b.lessonId, new Date().toISOString()).run();
    return c.json({ ok: true });
  });

  async function issue(c: any, l: Learner, kind: "course" | "path", ref: string, title: string) {
    const db = c.env.DB as D1Database;
    const have = await db.prepare("SELECT id FROM certificates WHERE user_id = ? AND kind = ? AND ref_id = ?").bind(l.id, kind, ref).first<any>();
    if (have) return null;
    const id = certificateId();
    await db.prepare("INSERT INTO certificates (id, user_id, kind, ref_id, holder, title, issued_at) VALUES (?,?,?,?,?,?,?)").bind(id, l.id, kind, ref, l.name, title, new Date().toISOString()).run();
    await o.onIssued?.(c, l, { id, title, kind });
    return { id, kind, title };
  }

  app.post("/courses/:id/quiz", async (c) => {
    const l = await need(c);
    const crs = course(c.req.param("id"));
    if (!crs || !visible(crs.audience)) return c.json({ error: "Course not found." }, 404);
    const b = await c.req.json().catch(() => ({}));
    const answers = Array.isArray(b.answers) ? b.answers.map((x: unknown) => (Number.isInteger(x) ? Number(x) : -1)).slice(0, 50) : [];
    const db = c.env.DB as D1Database;
    const recent = await db.prepare("SELECT COUNT(*) n FROM quiz_attempts WHERE user_id = ? AND course_id = ? AND at > ?").bind(l.id, crs.id, new Date(Date.now() - 3_600_000).toISOString()).first<any>();
    if ((recent?.n ?? 0) >= 10) return c.json({ error: "You have tried this assessment 10 times in the last hour. Take a break and review the lessons." }, 429);
    const g = grade(crs.id, answers)!;
    await db.prepare("INSERT INTO quiz_attempts (user_id, course_id, score, passed, at) VALUES (?,?,?,?,?)").bind(l.id, crs.id, g.score, g.passed ? 1 : 0, new Date().toISOString()).run();
    const issued: any[] = [];
    if (g.passed) {
      const done = await db.prepare("SELECT lesson_id FROM learn_progress WHERE user_id = ? AND course_id = ?").bind(l.id, crs.id).all<any>();
      const doneSet = new Set(done.results.map((r: any) => r.lesson_id));
      const allLessons = crs.lessons.every((x) => doneSet.has(x.id));
      if (allLessons) {
        const cc = await issue(c, l, "course", crs.id, crs.title);
        if (cc) issued.push(cc);
        // Any learning path now complete?
        const passed = await db.prepare("SELECT DISTINCT course_id FROM quiz_attempts WHERE user_id = ? AND passed = 1").bind(l.id).all<any>();
        const certs = await db.prepare("SELECT ref_id FROM certificates WHERE user_id = ? AND kind = 'course'").bind(l.id).all<any>();
        const doneCourses = new Set([...passed.results.map((r: any) => r.course_id)].filter((id) => certs.results.some((x: any) => x.ref_id === id)));
        for (const p of getCatalog().paths.filter((p) => visible(p.audience) && p.courses.includes(crs.id))) {
          if (p.courses.every((id) => doneCourses.has(id))) {
            const pc = await issue(c, l, "path", p.id, p.title);
            if (pc) issued.push(pc);
          }
        }
      }
      return c.json({ ...g, issued, lessonsOutstanding: !allLessons });
    }
    return c.json({ ...g, issued });
  });

  app.post("/bytes/:id/check", async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const r = checkByte(c.req.param("id"), Number(b.answer));
    return r ? c.json(r) : c.json({ error: "Not found." }, 404);
  });

  app.get("/certificates/:id/pdf", async (c) => {
    const l = await need(c);
    const row = await (c.env.DB as D1Database).prepare("SELECT * FROM certificates WHERE id = ? AND user_id = ?").bind(c.req.param("id"), l.id).first<any>();
    if (!row) return c.json({ error: "Certificate not found." }, 404);
    const minutes = row.kind === "course" ? course(row.ref_id)?.minutes : getPath(row.ref_id)?.courses.reduce((n, id) => n + (course(id)?.minutes || 0), 0);
    const bytes = await certificatePdf({ id: row.id, holder: row.holder, title: row.title, kind: row.kind, issued: new Date(row.issued_at), minutes, verifyUrl: o.verifyBase(c) + row.id });
    return new Response(bytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Kayak-Certificate-${row.id}.pdf"`, "Cache-Control": "private, no-store" },
    });
  });

  app.get("/verify/:id", async (c) => {
    const id = String(c.req.param("id")).toUpperCase().slice(0, 20);
    const row = await (c.env.DB as D1Database).prepare("SELECT id, kind, holder, title, issued_at FROM certificates WHERE id = ?").bind(id).first<any>();
    if (!row) return c.json({ valid: false }, 404);
    return c.json({ valid: true, ...row });
  });

  return app;
}
