import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const MODEL = process.env["OLLAMA_MODEL"] || "llama3.2";

const OLLAMA_BASE_URL =
  process.env["OLLAMA_BASE_URL"] ||
  "http://127.0.0.1:11434/v1";

const bodySchema = z.object({
  messages: z
    .array(
      z
        .object({
          id: z.string(),
          role: z.enum(["user", "assistant", "system"]),
          parts: z.array(z.any()),
        })
        .passthrough(),
    )
    .min(1)
    .max(60),
});

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textOf(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export async function handleCampusChat(
  request: Request,
): Promise<Response> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!url || !key) {
    return json(
      500,
      "Server is missing database configuration.",
    );
  }

  // 1. Verify the student's Supabase session
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice(7)
    : "";

  if (!token || token.split(".").length !== 3) {
    return json(401, "Please sign in again.");
  }

  const supabase = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storage: undefined,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);

        return fetch(input, {
          ...init,
          headers,
        });
      },
    },
  });

  const { data: claims, error: claimsError } =
    await supabase.auth.getClaims(token);

  const userId = claims?.claims?.sub;

  if (claimsError || !userId) {
    return json(
      401,
      "Your session has expired. Please sign in again.",
    );
  }

  // 2. Validate the user's question
  let parsed;

  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return json(400, "Invalid request.");
  }

  const messages = parsed.messages as unknown as UIMessage[];
  const lastMessage = messages[messages.length - 1];

  const question =
    lastMessage?.role === "user"
      ? textOf(lastMessage)
      : "";

  if (!question) {
    return json(400, "Please type or say a question.");
  }

  if (question.length > 2000) {
    return json(
      400,
      "Question is too long (max 2000 characters).",
    );
  }

  // 3. Load campus information from Supabase
  const [
    profile,
    announcements,
    timetable,
    exams,
    events,
    facilities,
    attendance,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, student_id, department, year")
      .eq("id", userId)
      .maybeSingle(),

    supabase
      .from("announcements")
      .select("title, body, category, posted_at")
      .order("posted_at", { ascending: false })
      .limit(10),

    supabase
      .from("timetable")
      .select(
        "day, day_order, start_time, end_time, course, room, instructor",
      )
      .order("day_order")
      .order("start_time"),

    supabase
      .from("exams")
      .select("course, exam_date, start_time, venue, exam_type")
      .order("exam_date"),

    supabase
      .from("events")
      .select("title, description, event_date, location")
      .order("event_date"),

    supabase
      .from("facilities")
      .select("name, location, hours, description"),

    supabase
      .from("attendance")
      .select("course, attended, total")
      .eq("user_id", userId),
  ]);

  // 4. Calculate today's date and find the next upcoming exam
  const now = new Date();

  const today =
    `${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, "0")}-` +
    `${String(now.getDate()).padStart(2, "0")}`;

  const upcomingExams = (exams.data ?? [])
    .filter(
      (exam) =>
        Boolean(exam.exam_date) &&
        exam.exam_date >= today,
    )
    .sort((a, b) => {
      const dateComparison = a.exam_date.localeCompare(
        b.exam_date,
      );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return (a.start_time ?? "").localeCompare(
        b.start_time ?? "",
      );
    });

  const nextExam = upcomingExams[0] ?? null;

  // 5. Give campus context to the AI
  const instructions = `
You are Campus Assistant, a friendly AI helper for college students.

Today's date is ${today}.

Answer in clear, simple English.
Keep answers concise, usually 2-5 sentences.
Avoid tables because answers may be read aloud.

IMPORTANT RULES:
- Use the campus database information provided below.
- Never invent college information, dates, times, or locations.
- Read the relevant data section before answering.
- If the requested information is present, answer directly.
- Do not say information is unavailable when it is present in the data.
- If information is genuinely missing, explain that clearly.
- Never confuse timetable classes with examinations.
- Attendance below 75% is a shortage. Mention it when relevant.

STUDENT PROFILE:
${JSON.stringify(profile.data ?? null)}

ANNOUNCEMENTS:
${JSON.stringify(announcements.data ?? [])}

TIMETABLE:
${JSON.stringify(timetable.data ?? [])}

ALL EXAMS:
${JSON.stringify(exams.data ?? [])}

NEXT UPCOMING EXAM:
${JSON.stringify(nextExam ?? null)}

EVENTS:
${JSON.stringify(events.data ?? [])}

FACILITIES:
${JSON.stringify(facilities.data ?? [])}

ATTENDANCE:
${JSON.stringify(attendance.data ?? [])}

HOW TO ANSWER:

1. NEXT EXAM:
When the student asks "When is my next exam?",
"What is my next exam?", or a similar question,
use the NEXT UPCOMING EXAM section directly.

Include the course name, exam type, date, time, and venue
when those details are available.

If NEXT UPCOMING EXAM is null, say that no upcoming exam
is currently listed in the database.

2. TIMETABLE:
Use the TIMETABLE section for class schedules.
Include the day, course, start time, end time, room,
and instructor when available.

3. ANNOUNCEMENTS:
Use the ANNOUNCEMENTS section.
Summarize the relevant title, category, and body.

4. EXAMS:
Use the ALL EXAMS section for exam-related questions.
Include the course, exam type, date, time, and venue
when available.

5. EVENTS:
Use the EVENTS section for event titles, dates,
descriptions, and locations.

6. FACILITIES:
Use the FACILITIES section for facility names,
locations, opening hours, and descriptions.

7. STUDENT PROFILE:
Use the STUDENT PROFILE section for the student's name,
student ID, department, and year.
If a field is missing, say it has not been provided.

8. ATTENDANCE:
Use only the signed-in student's attendance records.
Calculate percentage as attended / total * 100
only when total is greater than zero.
If no attendance records exist, say attendance records
are not available yet.

Always answer the student's actual question.
`;

  // 6. Save the student's question
  const { error: userMessageError } = await supabase
    .from("chat_messages")
    .insert({
      user_id: userId,
      role: "user",
      content: question,
    });

  if (userMessageError) {
    console.error(
      "Failed to save user question:",
      userMessageError.message,
    );
  }

  // 7. Connect to Ollama using its OpenAI-compatible API
  const provider = createOpenAI({
    baseURL: OLLAMA_BASE_URL,
    apiKey: "ollama",
  });

  try {
    const result = streamText({
      model: provider.chat(MODEL),
      system: instructions,
      messages: await convertToModelMessages(
        messages.slice(-20),
      ),
      abortSignal: request.signal,

      // 8. Save the AI response in Supabase
      onFinish: async ({ text }) => {
        if (!text.trim()) return;

        const { error } = await supabase
          .from("chat_messages")
          .insert({
            user_id: userId,
            role: "assistant",
            content: text,
          });

        if (error) {
          console.error(
            "Failed to save assistant reply:",
            error.message,
          );
        }
      },
    });

    // 9. Stream the answer to the frontend
    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: (error) => {
        console.error("Ollama AI error:", error);

        return (
          "The AI assistant couldn't answer right now. " +
          "Check that Ollama is running and try again."
        );
      },
    });
  } catch (error) {
    console.error("Failed to start Ollama request:", error);

    return json(
      502,
      "Could not connect to Ollama. Check that Ollama is running and llama3.2 is installed.",
    );
  }
}