// Learning catalogue shared by learn.kayaksa.com and the internal Kayak Learn module.
import catalog from "../content/catalog.json";

export interface Question { q: string; options: string[]; answer: number; why: string }
export interface Lesson { id: string; title: string; minutes: number; body: string }
export interface Course {
  id: string; title: string; summary: string; topic: string; level: string; minutes: number;
  audience: "public" | "internal"; outcomes: string[]; lessons: Lesson[]; quiz: { pass: number; questions: Question[] };
}
export interface Path { id: string; title: string; summary: string; topic: string; color: string; courses: string[]; audience: "public" | "internal" }
export interface Byte { id: string; title: string; topic: string; minutes: number; body: string; check: Question }
export interface Catalog { topics: { id: string; name: string; color: string; blurb: string }[]; paths: Path[]; courses: Course[]; bytes: Byte[] }

const C = catalog as unknown as Catalog;

export const getCatalog = (): Catalog => C;
export const course = (id: string) => C.courses.find((x) => x.id === id) || null;
export const path = (id: string) => C.paths.find((x) => x.id === id) || null;
export const byte = (id: string) => C.bytes.find((x) => x.id === id) || null;

/** Catalogue for the browser, without quiz answers. `internal` adds staff-only courses. */
export function publicCatalog(internal = false) {
  const keep = (a: string) => internal || a === "public";
  const courses = C.courses.filter((x) => keep(x.audience)).map((x) => ({
    ...x,
    quiz: { pass: x.quiz.pass, count: x.quiz.questions.length },
    lessons: x.lessons.map((l) => ({ id: l.id, title: l.title, minutes: l.minutes })),
  }));
  const ids = new Set(courses.map((x) => x.id));
  return {
    topics: C.topics,
    paths: C.paths.filter((p) => keep(p.audience)).map((p) => ({ ...p, courses: p.courses.filter((id) => ids.has(id)) })),
    courses,
    bytes: C.bytes.map((b) => ({ ...b, check: { q: b.check.q, options: b.check.options } })),
  };
}

export function lessonOf(courseId: string, lessonId: string) {
  return course(courseId)?.lessons.find((l) => l.id === lessonId) || null;
}

/** The quiz as shown to a learner: questions and options only. */
export function quizFor(courseId: string) {
  const c = course(courseId);
  return c ? { pass: c.quiz.pass, questions: c.quiz.questions.map((q) => ({ q: q.q, options: q.options })) } : null;
}

export function grade(courseId: string, answers: number[]) {
  const c = course(courseId);
  if (!c) return null;
  const qs = c.quiz.questions;
  const review = qs.map((q, i) => ({ correct: answers[i] === q.answer, answer: q.answer, why: q.why }));
  const right = review.filter((r) => r.correct).length;
  const score = Math.round((right / qs.length) * 100);
  return { score, passed: score >= c.quiz.pass, right, total: qs.length, review };
}

export function checkByte(id: string, answer: number) {
  const b = byte(id);
  return b ? { correct: answer === b.check.answer, answer: b.check.answer, why: b.check.why } : null;
}
