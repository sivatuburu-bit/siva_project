import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Mic, CalendarDays, MessagesSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campus Assistant — Your voice-powered college helper" },
      { name: "description", content: "Ask about timetables, exams, attendance, events and facilities by voice or text." },
      { property: "og:title", content: "Campus Assistant — Your voice-powered college helper" },
      { property: "og:description", content: "Ask about timetables, exams, attendance, events and facilities by voice or text." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Mic, title: "Talk naturally", text: "Tap the mic and ask. Answers are read back to you." },
  { icon: CalendarDays, title: "Your schedule", text: "Classes, exam dates and venues in one place." },
  { icon: MessagesSquare, title: "Always on", text: "Chat history saved privately to your account." },
  { icon: ShieldCheck, title: "Private", text: "Only you can see your attendance and conversations." },
];

function Index() {
  return (
    <div className="min-h-screen bg-hero text-primary-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-gradient text-accent-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          Campus Assistant
        </div>
        <Button asChild variant="heroOutline" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-12 md:pt-24">
        <div className="max-w-2xl animate-rise">
          <p className="mb-4 inline-block rounded-full bg-primary-foreground/10 px-3 py-1 text-sm">Built for students</p>
          <h1 className="text-5xl font-bold leading-tight md:text-7xl">
            Just ask your <span className="text-accent">campus.</span>
          </h1>
          <p className="mt-6 text-lg text-primary-foreground/80">
            “When is my next exam?” “Is my attendance okay?” “What's happening this week?” — speak or type, and get answers in seconds.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/auth" search={{ mode: "register" }}>Create student account</Link>
            </Button>
            <Button asChild variant="heroOutline" size="lg">
              <Link to="/auth">I already have one</Link>
            </Button>
          </div>
        </div>
        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div key={f.title} className="animate-rise rounded-2xl bg-primary-foreground/8 p-5 backdrop-blur" style={{ animationDelay: `${i * 80}ms` }}>
              <f.icon className="h-6 w-6 text-accent" />
              <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-primary-foreground/75">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
