import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, GraduationCap, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode | undefined } => ({
    mode: s["mode"] === "register" || s["mode"] === "forgot" ? (s["mode"] as Mode) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Campus Assistant" },
      { name: "description", content: "Sign in or register as a student to use the Campus Assistant." },
      { property: "og:title", content: "Sign in — Campus Assistant" },
      { property: "og:description", content: "Sign in or register as a student to use the Campus Assistant." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email address.").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters.").max(72);

function friendly(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — check your inbox.";
  if (m.includes("already registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("fetch")) return "Can't reach the server. Check your internet connection.";
  return msg;
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const validate = () => {
    const e: Record<string, string> = {};
    const em = emailSchema.safeParse(email);
    if (!em.success) e["email"] = em.error.issues[0]?.message ?? "Invalid email.";
    if (mode !== "forgot") {
      const pw = passwordSchema.safeParse(password);
      if (!pw.success) e["password"] = pw.error.issues[0]?.message ?? "Invalid password.";
    }
    if (mode === "register" && fullName.trim().length < 2) e["fullName"] = "Enter your full name.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setNotice(null);
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName.trim(), student_id: studentId.trim() || null },
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else setNotice("Account created! Check your email to confirm, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("If that email is registered, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(friendly((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (res.error) toast.error(friendly(res.error.message));
    else if (!res.redirected) navigate({ to: "/dashboard" });
  };

  const title = mode === "login" ? "Welcome back" : mode === "register" ? "Create your student account" : "Reset your password";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden bg-hero p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-gradient text-accent-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          Campus Assistant
        </Link>
        <blockquote className="max-w-md font-display text-3xl leading-snug">
          “Hey, what's my first class tomorrow?”
          <span className="mt-4 block font-sans text-base text-primary-foreground/70">Ask anything about campus — out loud.</span>
        </blockquote>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-rise">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "forgot" ? "We'll email you a secure link." : "Use your email and password."}
          </p>

          {notice && <div role="status" className="mt-6 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">{notice}</div>}

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            {mode === "register" && (
              <>
                <Field label="Full name" error={errors["fullName"]}>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                </Field>
                <Field label="Student ID (optional)">
                  <Input id="studentId" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
                </Field>
              </>
            )}
            <Field label="Email" error={errors["email"]}>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            {mode !== "forgot" && (
              <Field label="Password" error={errors["password"]}>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
            )}
            {mode === "login" && (
              <button type="button" onClick={() => setMode("forgot")} className="text-sm font-medium text-primary hover:underline">
                Forgot password?
              </button>
            )}
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"}
            </Button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" className="h-11 w-full" onClick={google}>Continue with Google</Button>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "New student? " : "Already registered? "}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setErrors({}); setNotice(null); }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
