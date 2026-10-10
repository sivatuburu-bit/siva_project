import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { GraduationCap, Loader2, Mic, MicOff, Send, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useVoice } from "./use-voice";

const suggestions = ["When is my next exam?", "What classes do I have on Monday?", "Is my attendance okay?", "What events are coming up?"];

function textOf(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function readError(err: Error) {
  try {
    const j = JSON.parse(err.message);
    if (j?.error) return String(j.error);
  } catch { /* not JSON */ }
  if (/fetch|network/i.test(err.message)) return "Can't reach the server. Check your connection and try again.";
  return err.message || "Something went wrong. Please try again.";
}

export function AssistantChat({ userId, initial, initialTimes }: { userId: string; initial: UIMessage[]; initialTimes: Record<string, string> }) {
  const times = useRef<Record<string, string>>({ ...initialTimes });
  const fromVoice = useRef(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, error, setMessages, clearError } = useChat({
    messages: initial,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: async (): Promise<Record<string, string>> => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    onError: (e) => toast.error(readError(e)),
  });

  const busy = status === "submitted" || status === "streaming";

  const submit = (text: string, voice = false) => {
    const t = text.trim();
    if (!t || busy) return;
    if (t.length > 2000) { toast.error("Please keep questions under 2000 characters."); return; }
    clearError();
    fromVoice.current = voice;
    sendMessage({ text: t });
    setInput("");
  };

  const voice = useVoice((t) => submit(t, true));

  // Stamp new messages with a time
  for (const m of messages) if (!times.current[m.id]) times.current[m.id] = new Date().toISOString();

  // Speak the answer once streaming completes (voice questions only)
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === "streaming" && status === "ready" && fromVoice.current) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") voice.speak(textOf(last));
    }
    prevStatus.current = status;
  }, [status, messages, voice]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const clearHistory = async () => {
    const { error } = await supabase.from("chat_messages").delete().eq("user_id", userId);
    if (error) { toast.error("Couldn't clear history. Please try again."); return; }
    setMessages([]);
    toast.success("Chat history cleared.");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(input);
  };

  return (
    <div className="flex h-[640px] flex-col overflow-hidden rounded-2xl bg-card shadow-card">
      {/* Voice control bar */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-hero px-5 py-4 text-primary-foreground">
        <button
          type="button"
          onClick={voice.listening ? voice.stop : voice.start}
          disabled={busy}
          aria-label={voice.listening ? "Stop listening" : "Start voice input"}
          className={cn(
            "grid h-14 w-14 place-items-center rounded-full transition disabled:opacity-50",
            voice.listening ? "animate-listen bg-coral text-primary-foreground" : "bg-accent-gradient text-accent-foreground hover:scale-105",
          )}
        >
          {voice.listening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">Voice assistant</p>
          <p className="truncate text-sm text-primary-foreground/75">
            {voice.listening ? voice.interim || "Listening… ask your question" : voice.speaking ? "Speaking…" : "Tap the mic and ask anything"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="heroOutline" onClick={voice.stop} disabled={!voice.listening && !voice.speaking} aria-label="Stop voice">
            <Square /> Stop
          </Button>
          <Button size="sm" variant="heroOutline" onClick={voice.toggleMute} aria-pressed={voice.muted} aria-label={voice.muted ? "Unmute replies" : "Mute replies"}>
            {voice.muted ? <VolumeX /> : <Volume2 />} {voice.muted ? "Muted" : "Sound on"}
          </Button>
        </div>
      </div>
      {voice.voiceError && (
        <div role="alert" className="flex items-start justify-between gap-3 bg-warning/15 px-5 py-2 text-sm">
          <span>{voice.voiceError}</span>
          <button className="font-medium underline" onClick={() => voice.setVoiceError(null)}>Dismiss</button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><GraduationCap className="h-7 w-7" /></span>
            <p className="mt-3 font-display text-xl font-semibold">How can I help today?</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => submit(s)} className="rounded-full border bg-background px-3 py-1.5 text-sm hover:border-accent hover:bg-secondary">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => {
          const text = textOf(m);
          if (m.role === "assistant" && !text) return null;
          const stamp = times.current[m.id]; const time = stamp ? new Date(stamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
          return m.role === "user" ? (
            <div key={m.id} className="flex flex-col items-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">{text}</div>
              <span className="mt-1 text-xs text-muted-foreground">{time}</span>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-gradient text-accent-foreground"><GraduationCap className="h-4 w-4" /></span>
              <div className="min-w-0 max-w-[85%]">
                <div className="prose prose-sm max-w-none text-foreground [&_li]:my-0.5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
                  <ReactMarkdown>{text}</ReactMarkdown>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{time}</span>
                  {voice.supported.synthesis && (
                    <button onClick={() => voice.speak(text)} className="hover:text-foreground" aria-label="Read aloud"><Volume2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {busy && (messages[messages.length - 1]?.role === "user" || !textOf(messages[messages.length - 1]!)) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        )}
        {error && !busy && <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{readError(error)}</div>}
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); }
          }}
          placeholder="Ask about classes, exams, events…"
          rows={1}
          maxLength={2000}
          className="max-h-32 min-h-11 resize-none"
          aria-label="Your question"
        />
        {busy ? (
          <Button type="button" size="icon" variant="outline" className="h-11 w-11" onClick={() => stop()} aria-label="Stop answer"><Square /></Button>
        ) : (
          <Button type="submit" size="icon" className="h-11 w-11" disabled={!input.trim()} aria-label="Send"><Send /></Button>
        )}
        <Button type="button" size="icon" variant="ghost" className="h-11 w-11" onClick={clearHistory} disabled={busy || messages.length === 0} aria-label="Clear chat history"><Trash2 /></Button>
      </form>
    </div>
  );
}
