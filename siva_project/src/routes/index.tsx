import { createFileRoute, Link } from "@tanstack/react-router";
import {
  GraduationCap,
  Mic,
  CalendarDays,
  MessagesSquare,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campus Assistant — Your voice-powered college helper" },
      {
        name: "description",
        content:
          "Ask about timetables, exams, attendance, events and facilities by voice or text.",
      },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: Mic,
    title: "Talk naturally",
    text: "Tap the mic and ask. Answers are read back to you.",
  },
  {
    icon: CalendarDays,
    title: "Your schedule",
    text: "Classes, exam dates and venues in one place.",
  },
  {
    icon: MessagesSquare,
    title: "Always on",
    text: "Chat history saved privately to your account.",
  },
  {
    icon: ShieldCheck,
    title: "Private",
    text: "Only you can see your attendance and conversations.",
  },
];

const campusGallery = [
  {
    title: "Beautiful Campus",
    text: "Explore a welcoming college environment.",
    image:
      "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=900&q=85",
  },
  {
    title: "Student Life",
    text: "Learning, friendship and campus memories.",
    image:
      "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=85",
  },
  {
    title: "Classroom Learning",
    text: "Grow your knowledge with every class.",
    image:
      "https://images.unsplash.com/photo-1571260899304-425eee4c7efc?auto=format&fit=crop&w=900&q=85",
  },
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

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pt-16">
        {/* Hero section */}
        <section className="grid items-center gap-10 md:grid-cols-2">
          <div className="animate-rise">
            <p className="mb-4 inline-block rounded-full bg-primary-foreground/10 px-3 py-1 text-sm">
              🎓 Built for students
            </p>

            <h1 className="text-5xl font-bold leading-tight md:text-7xl">
              Just ask your <span className="text-accent">campus.</span>
            </h1>

            <p className="mt-6 text-lg text-primary-foreground/80">
              When is my next exam? Is my attendance okay? What's happening
              this week? Speak or type, and get answers in seconds.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/auth" search={{ mode: "register" }}>
                  Create student account
                </Link>
              </Button>

              <Button asChild variant="heroOutline" size="lg">
                <Link to="/auth">I already have one</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=90"
              alt="Beautiful college campus with academic buildings"
              className="h-[300px] w-full rounded-3xl object-cover shadow-2xl md:h-[440px]"
            />
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-black/60 p-4 backdrop-blur-sm">
              <p className="text-lg font-semibold">Your Campus, Smarter</p>
              <p className="text-sm text-white/80">
                One assistant for your college life.
              </p>
            </div>
          </div>
        </section>

        {/* Features section */}
        <section className="mt-20">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              Everything You Need
            </h2>
            <p className="mt-3 text-primary-foreground/70">
              Your college information, all in one place.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="animate-rise rounded-2xl bg-primary-foreground/8 p-5 backdrop-blur"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <feature.icon className="h-6 w-6 text-accent" />
                <h3 className="mt-3 text-lg font-semibold">
                  {feature.title}
                </h3>
                <p className="mt-1 text-sm text-primary-foreground/75">
                  {feature.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Campus gallery */}
        <section className="mt-24">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">
              Life at College
            </p>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">
              Discover Campus Life
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/70">
              A place to learn, connect, explore and build your future.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {campusGallery.map((item) => (
              <article
                key={item.title}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition duration-300 hover:-translate-y-2 hover:bg-white/10"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  className="h-56 w-full object-cover transition duration-500 hover:scale-105"
                />
                <div className="p-5">
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-primary-foreground/75">
                    {item.text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Call to action */}
        <section className="mt-20 rounded-3xl bg-primary-foreground/10 p-8 text-center backdrop-blur md:p-12">
          <GraduationCap className="mx-auto h-12 w-12 text-accent" />
          <h2 className="mt-4 text-3xl font-bold">
            Ready to Make College Life Easier?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/75">
            Sign in and experience your personal AI campus assistant.
          </p>
          <div className="mt-6">
            <Button asChild variant="hero" size="lg">
              <Link to="/auth" search={{ mode: "register" }}>
                Get Started
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-sm text-primary-foreground/60">
        © {new Date().getFullYear()} Campus Assistant. Built for students.
      </footer>
    </div>
  );
}