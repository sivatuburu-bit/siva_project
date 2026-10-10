import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import {
  Bell, BookOpen, CalendarDays, ClipboardCheck, GraduationCap, LayoutDashboard, LogOut, Menu, MessagesSquare, PartyPopper, User, X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AssistantChat } from "@/components/campus/AssistantChat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Campus Assistant" },
      { name: "description", content: "Your classes, exams, attendance, events and AI assistant." },
      { property: "og:title", content: "Dashboard — Campus Assistant" },
      { property: "og:description", content: "Your classes, exams, attendance, events and AI assistant." },
    ],
  }),
  component: Dashboard,
});

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "assistant", label: "AI Assistant", icon: MessagesSquare },
  { id: "announcements", label: "Announcements", icon: Bell },
  { id: "timetable", label: "Timetable & Exams", icon: CalendarDays },
  { id: "attendance", label: "Attendance", icon: ClipboardCheck },
  { id: "events", label: "Events", icon: PartyPopper },
  { id: "profile", label: "Profile", icon: User },
];

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const profile = useQuery({ queryKey: ["profile", user.id], queryFn: async () => { const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(); if (error) throw new Error(error.message); return data; } });
  const announcements = useQuery({ queryKey: ["announcements"], queryFn: () => must(supabase.from("announcements").select("*").order("posted_at", { ascending: false })) });
  const timetable = useQuery({ queryKey: ["timetable"], queryFn: () => must(supabase.from("timetable").select("*").order("day_order").order("start_time")) });
  const exams = useQuery({ queryKey: ["exams"], queryFn: () => must(supabase.from("exams").select("*").order("exam_date")) });
  const attendance = useQuery({ queryKey: ["attendance", user.id], queryFn: () => must(supabase.from("attendance").select("*").order("course")) });
  const events = useQuery({ queryKey: ["events"], queryFn: () => must(supabase.from("events").select("*").order("event_date")) });
  const history = useQuery({
    queryKey: ["chat", user.id],
    queryFn: () => must(supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(100)),
    staleTime: Infinity,
  });

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const name = profile.data?.full_name || user.email?.split("@")[0] || "Student";
  const overall = attendance.data?.length
    ? Math.round((attendance.data.reduce((a, r) => a + r.attended, 0) / Math.max(1, attendance.data.reduce((a, r) => a + r.total, 0))) * 100)
    : null;
  const nextExam = exams.data?.find((e) => e.exam_date >= new Date().toISOString().slice(0, 10));
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const initial: UIMessage[] = (history.data ?? []).map((m) => ({ id: m.id, role: m.role as "user" | "assistant", parts: [{ type: "text", text: m.content }] }));
  const initialTimes = Object.fromEntries((history.data ?? []).map((m) => [m.id, m.created_at]));

  const Sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-6 flex items-center gap-2 px-2 font-display text-lg font-bold">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><GraduationCap className="h-5 w-5" /></span>
        Campus Assistant
      </div>
      {nav.map((n) => (
        <a key={n.id} href={`#${n.id}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/85 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <n.icon className="h-4 w-4" /> {n.label}
        </a>
      ))}
      <button onClick={logout} className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent">
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-sidebar text-sidebar-foreground lg:block">{Sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar text-sidebar-foreground animate-in slide-in-from-left">
            <button className="absolute right-3 top-4 p-1" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {Sidebar}
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
        <span className="font-display font-bold">Campus Assistant</span>
        <Button size="sm" variant="ghost" onClick={logout} aria-label="Log out"><LogOut /></Button>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
        <section id="overview" className="animate-rise scroll-mt-20">
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">{greet}, {name.split(" ")[0]} 👋</h1>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat color="bg-teal" icon={<ClipboardCheck />} label="Overall attendance" value={overall === null ? "—" : `${overall}%`} />
            <Stat color="bg-coral" icon={<BookOpen />} label="Next exam" value={nextExam ? `${nextExam.course}` : "None"} sub={nextExam ? fmtDate(nextExam.exam_date) : undefined} />
            <Stat color="bg-accent" icon={<PartyPopper />} label="Upcoming events" value={String(events.data?.length ?? "—")} />
          </div>
        </section>

        <section id="assistant" className="scroll-mt-20">
          <SectionTitle icon={<MessagesSquare />} title="AI Assistant" />
          {history.isLoading ? <Skeleton className="h-[640px] rounded-2xl" /> : history.isError ? (
            <ErrorBox msg="Couldn't load your chat history." />
          ) : (
            <AssistantChat userId={user.id} initial={initial} initialTimes={initialTimes} />
          )}
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section id="announcements" className="scroll-mt-20">
            <SectionTitle icon={<Bell />} title="Announcements" />
            <Card q={announcements}>
              {(rows) => rows.map((a) => (
                <div key={a.id} className="border-b py-3 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-sans font-semibold">{a.title}</h3>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{a.category}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                </div>
              ))}
            </Card>
          </section>

          <section id="events" className="scroll-mt-20">
            <SectionTitle icon={<PartyPopper />} title="Campus events" />
            <Card q={events}>
              {(rows) => rows.map((e) => (
                <div key={e.id} className="flex gap-4 border-b py-3 last:border-0">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-accent-gradient text-center text-accent-foreground">
                    <div className="leading-tight"><div className="text-xs uppercase">{new Date(e.event_date).toLocaleString(undefined, { month: "short" })}</div><div className="text-lg font-bold">{new Date(e.event_date).getDate()}</div></div>
                  </div>
                  <div><h3 className="font-sans font-semibold">{e.title}</h3><p className="text-sm text-muted-foreground">{e.description}</p><p className="mt-1 text-xs">📍 {e.location}</p></div>
                </div>
              ))}
            </Card>
          </section>
        </div>

        <section id="timetable" className="scroll-mt-20">
          <SectionTitle icon={<CalendarDays />} title="Timetable & examinations" />
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card q={timetable}>
                {(rows) => (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-muted-foreground"><th className="py-2">Day</th><th>Time</th><th>Course</th><th>Room</th><th className="hidden md:table-cell">Instructor</th></tr></thead>
                      <tbody>{rows.map((r) => (
                        <tr key={r.id} className="border-t"><td className="py-2.5 font-medium">{r.day.slice(0, 3)}</td><td>{r.start_time}–{r.end_time}</td><td>{r.course}</td><td>{r.room}</td><td className="hidden md:table-cell text-muted-foreground">{r.instructor}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
            <Card q={exams}>
              {(rows) => rows.map((e) => (
                <div key={e.id} className="border-b py-3 last:border-0">
                  <div className="flex justify-between"><h3 className="font-sans font-semibold">{e.course}</h3><span className="text-xs text-coral">{e.exam_type}</span></div>
                  <p className="text-sm text-muted-foreground">{fmtDate(e.exam_date)} · {e.start_time} · {e.venue}</p>
                </div>
              ))}
            </Card>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section id="attendance" className="scroll-mt-20">
            <SectionTitle icon={<ClipboardCheck />} title="Attendance" />
            <Card q={attendance}>
              {(rows) => rows.map((a) => {
                const pct = Math.round((a.attended / Math.max(1, a.total)) * 100);
                const low = pct < 75;
                return (
                  <div key={a.id} className="py-2.5">
                    <div className="flex justify-between text-sm"><span className="font-medium">{a.course}</span><span className={cn(low ? "text-destructive" : "text-success", "font-semibold")}>{pct}% <span className="font-normal text-muted-foreground">({a.attended}/{a.total})</span></span></div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", low ? "bg-destructive" : "bg-success")} style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </Card>
          </section>

          <section id="profile" className="scroll-mt-20">
            <SectionTitle icon={<User />} title="Student profile" />
            <div className="rounded-2xl bg-card p-6 shadow-card">
              {profile.isLoading ? <Skeleton className="h-32" /> : (
                <div className="flex items-start gap-4">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-hero font-display text-2xl text-primary-foreground">{name[0]?.toUpperCase()}</div>
                  <dl className="grid flex-1 grid-cols-2 gap-3 text-sm">
                    <Info k="Name" v={name} /><Info k="Email" v={user.email ?? ""} />
                    <Info k="Student ID" v={profile.data?.student_id || "—"} /><Info k="Department" v={profile.data?.department || "—"} />
                    <Info k="Year" v={profile.data?.year ? `Year ${profile.data.year}` : "—"} />
                  </dl>
                </div>
              )}
              <Button variant="outline" className="mt-6 w-full" onClick={logout}><LogOut /> Log out</Button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function Stat({ icon, label, value, sub, color }: { icon: ReactNode; label: string; value: string; sub?: string | undefined; color: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-card p-5 shadow-card transition hover:-translate-y-0.5">
      <span className={cn("grid h-12 w-12 place-items-center rounded-xl text-primary-foreground [&_svg]:h-5 [&_svg]:w-5", color)}>{icon}</span>
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-lg font-bold">{value}</p>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold [&_svg]:h-5 [&_svg]:w-5 [&_svg]:text-accent">{icon}{title}</h2>;
}

function Info({ k, v }: { k: string; v: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate font-medium">{v}</dd></div>;
}

function ErrorBox({ msg }: { msg: string }) {
  return <div role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">{msg} Please refresh the page.</div>;
}

function Card<T>({ q, children }: { q: { data?: T[] | null | undefined; isLoading: boolean; isError: boolean }; children: (rows: T[]) => ReactNode }) {
  return (
    <div className="rounded-2xl bg-card px-5 py-2 shadow-card">
      {q.isLoading ? <div className="space-y-3 py-3"><Skeleton className="h-5" /><Skeleton className="h-5" /><Skeleton className="h-5" /></div>
        : q.isError ? <p className="py-4 text-sm text-destructive">Couldn't load this section. Please refresh.</p>
        : !q.data?.length ? <p className="py-4 text-sm text-muted-foreground">Nothing here yet.</p>
        : children(q.data)}
    </div>
  );
}
