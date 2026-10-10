import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const bodySchema = z.object({
  messages: z
    .array(z.object({ id: z.string(), role: z.enum(["user", "assistant", "system"]), parts: z.array(z.any()) }).passthrough())
    .min(1)
    .max(60),
});

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textOf(m: UIMessage) {
  return m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

export async function handleCampusChat(request: Request): Promise<Response> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!url || !key) return json(500, "Server is missing database configuration.");
  if (!apiKey) return json(500, "AI service is not configured on the server.");

  // 1. Verify the student's session token
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.split(".").length !== 3) return json(401, "Please sign in again.");

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) return json(401, "Your session has expired. Please sign in again.");

  // 2. Validate input
  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return json(400, "Invalid request.");
  }
  const messages = parsed.messages as unknown as UIMessage[];
  const last = messages[messages.length - 1];
  const question = last?.role === "user" ? textOf(last) : "";
  if (!question) return json(400, "Please type or say a question.");
  if (question.length > 2000) return json(400, "Question is too long (max 2000 characters).");

  // 3. Load campus context the student is allowed to see (RLS applies)
  const [profile, ann, tt, exams, events, fac, att] = await Promise.all([
    supabase.from("profiles").select("full_name, student_id, department, year").eq("id", userId).maybeSingle(),
    supabase.from("announcements").select("title, body, category, posted_at").order("posted_at", { ascending: false }).limit(10),
    supabase.from("timetable").select("day, day_order, start_time, end_time, course, room, instructor").order("day_order").order("start_time"),
    supabase.from("exams").select("course, exam_date, start_time, venue, exam_type").order("exam_date"),
    supabase.from("events").select("title, description, event_date, location").order("event_date"),
    supabase.from("facilities").select("name, location, hours, description"),
    supabase.from("attendance").select("course, attended, total"),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const instructions = `You are "Campus Assistant", a friendly AI helper for students at this college.
Today's date is ${today}. Answer concisely (2-5 sentences or a short list) in clear, simple English. Your replies may be read aloud, so avoid tables.
Use ONLY the campus data below for college-specific facts. If the answer isn't in the data, say you don't have that information and suggest contacting the relevant office.
Attendance below 75% is a shortage; mention it when relevant.

STUDENT PROFILE: ${JSON.stringify(profile.data)}
ANNOUNCEMENTS: ${JSON.stringify(ann.data)}
TIMETABLE: ${JSON.stringify(tt.data)}
EXAMS: ${JSON.stringify(exams.data)}
EVENTS: ${JSON.stringify(events.data)}
FACILITIES: ${JSON.stringify(fac.data)}
ATTENDANCE: ${JSON.stringify(att.data)}`;

  // 4. Save the user's question
  await supabase.from("chat_messages").insert({ user_id: userId, role: "user", content: question });

  // 5. Stream the answer
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages: await convertToModelMessages(messages.slice(-20)),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
    onFinish: async ({ text }) => {
      if (text.trim()) {
        const { error } = await supabase.from("chat_messages").insert({ user_id: userId, role: "assistant", content: text });
        if (error) console.error("Failed to save assistant reply", error.message);
      }
    },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: (err) => {
        const msg = String((err as { message?: string })?.message ?? err);
        console.error("AI error", msg);
        if (msg.includes("402")) return "AI credits are used up. Please ask the app owner to add credits.";
        if (msg.includes("429")) return "Too many requests right now. Please wait a moment and try again.";
        return "The AI assistant couldn't answer right now. Please try again.";
      },
    }),
    runIdFetch,
  );
}
