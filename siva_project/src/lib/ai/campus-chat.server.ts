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
  language: z
    .enum(["English", "Telugu", "Hindi", "Tamil", "Kannada"])
    .default("English"),
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

// Get the date and weekday in the college's timezone.
function getIndiaDateInfo() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    day: get("weekday"),
  };
}

// Handles both "Monday" and abbreviated values such as "Mon".
function normalizeDay(value: unknown): string {
  const day = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .slice(0, 3);

  const days: Record<string, string> = {
    mon: "monday",
    tue: "tuesday",
    wed: "wednesday",
    thu: "thursday",
    fri: "friday",
    sat: "saturday",
    sun: "sunday",
  };

  return days[day] ?? "";
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) {
    return "date not provided";
  }

  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

// Calculate a date relative to the current India date.
function getDateOffset(baseDate: string, offsetDays: number): string {
  const date = new Date(`${baseDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

// Get the weekday for any calendar date.
function getWeekdayForDate(dateValue: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateValue}T12:00:00Z`));
}

// Validate calendar dates, including leap years.
function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T12:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// Detect yesterday, day before yesterday, tomorrow,
// today, ISO dates, numeric dates, and written month dates.
function getRequestedDate(
  question: string,
  today: string,
): string | null {
  const text = question.toLowerCase();

  if (/\b(day before yesterday|the day before yesterday)\b/.test(text)) {
    return getDateOffset(today, -2);
  }

  if (/\byesterday\b/.test(text)) {
    return getDateOffset(today, -1);
  }

  if (/\btomorrow\b/.test(text)) {
    return getDateOffset(today, 1);
  }

  if (/\btoday\b/.test(text)) {
    return today;
  }

  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);

  if (isoMatch && isValidCalendarDate(isoMatch[1])) {
    return isoMatch[1];
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const numericMatch = text.match(
    /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/,
  );

  if (numericMatch) {
    const day = numericMatch[1].padStart(2, "0");
    const month = numericMatch[2].padStart(2, "0");
    const value = `${numericMatch[3]}-${month}-${day}`;

    if (isValidCalendarDate(value)) {
      return value;
    }
  }

  const months: Record<string, string> = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
  };

  const monthPattern =
    "(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)";

  // October 20, 2026 or October 20
  const monthFirst = text.match(
    new RegExp(
      `\\b${monthPattern}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`,
    ),
  );

  // 20 October 2026 or 20 October
  const dayFirst = text.match(
    new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${monthPattern}(?:,?\\s+(20\\d{2}))?\\b`,
    ),
  );

  if (monthFirst || dayFirst) {
    const match = monthFirst ?? dayFirst!;
    const monthName = monthFirst ? match[1] : match[2];
    const dayNumber = Number(monthFirst ? match[2] : match[1]);
    const year = match[3] || today.slice(0, 4);

    const value =
      `${year}-${months[monthName]}-${String(dayNumber).padStart(2, "0")}`;

    if (isValidCalendarDate(value)) {
      return value;
    }
  }

  return null;
}

// Match database records against a requested date.
function recordMatchesDate(
  record: Record<string, any>,
  dateFields: string[],
  targetDate: string,
): boolean {
  return dateFields.some((field) => {
    const value = record?.[field];

    return (
      typeof value === "string" &&
      value.slice(0, 10) === targetDate
    );
  });
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

  // 1. Verify the student's Supabase session.
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

  // 2. Validate the student's question and language.
  let parsed;

  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return json(400, "Invalid request.");
  }

  const language = parsed.language;
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

  // 3. Load existing data and optional campus schedules.
  // Existing Supabase client and user token preserve RLS.
  const db = supabase as any;

  const [
    profile,
    announcements,
    timetable,
    exams,
    events,
    facilities,
    attendance,
    collegeHours,
    holidays,
  ] = await Promise.all([
    db
      .from("profiles")
      .select("full_name, student_id, department, year")
      .eq("id", userId)
      .maybeSingle(),

    db
      .from("announcements")
      .select("title, body, category, posted_at")
      .order("posted_at", { ascending: false })
      .limit(10),

    db
      .from("timetable")
      .select("*")
      .order("day_order")
      .order("start_time"),

    db
      .from("exams")
      .select("*")
      .order("exam_date"),

    db
      .from("events")
      .select("*")
      .order("event_date"),

    db
      .from("facilities")
      .select("name, location, hours, description"),

    db
      .from("attendance")
      .select("course, attended, total")
      .eq("user_id", userId),

    db
      .from("college_hours")
      .select("*"),

    db
      .from("holidays")
      .select("*")
      .order("holiday_date"),
  ]);

  // 4. Determine today's date and weekday in India.
  const { date: today, day: todayDay } = getIndiaDateInfo();

  const allTimetable = timetable.data ?? [];

  // Calculate relative dates and detect the date in the question.
  const yesterdayDate = getDateOffset(today, -1);
  const dayBeforeYesterdayDate = getDateOffset(today, -2);
  const tomorrowDate = getDateOffset(today, 1);
  const requestedDate = getRequestedDate(question, today);

  // Get weekly classes for any date.
  const getClassesForDate = (dateValue: string) => {
    const weekday = getWeekdayForDate(dateValue).toLowerCase();

    return allTimetable.filter((item: any) => {
      const normalized = normalizeDay(
        item.day ?? item.day_of_week,
      );

      return normalized === weekday;
    });
  };

  // Today's timetable.
  const todayTimetable = getClassesForDate(today);

  // Timetables for relative dates.
  const yesterdayTimetable = getClassesForDate(yesterdayDate);
  const dayBeforeYesterdayTimetable =
    getClassesForDate(dayBeforeYesterdayDate);
  const tomorrowTimetable = getClassesForDate(tomorrowDate);

  // Gather all available records for the exact requested date.
  const requestedDateOverview = requestedDate
    ? {
        date: requestedDate,
        weekday: getWeekdayForDate(requestedDate),
        classes: getClassesForDate(requestedDate),

        exams: (exams.data ?? []).filter((item: any) =>
          recordMatchesDate(
            item,
            ["exam_date", "date", "start_date"],
            requestedDate,
          ),
        ),

        events: (events.data ?? []).filter((item: any) =>
          recordMatchesDate(
            item,
            ["event_date", "date", "start_date"],
            requestedDate,
          ),
        ),

        holidays: (holidays.data ?? []).filter((item: any) =>
          recordMatchesDate(
            item,
            ["holiday_date", "date"],
            requestedDate,
          ),
        ),

        announcements: (announcements.data ?? []).filter(
          (item: any) =>
            recordMatchesDate(
              item,
              ["posted_at", "created_at", "date"],
              requestedDate,
            ),
        ),
      }
    : null;

  // 5. Find the next upcoming exam.
  const allExams = exams.data ?? [];

  const upcomingExams = allExams
    .filter(
      (exam: Record<string, any>) =>
        typeof exam.exam_date === "string" &&
        exam.exam_date.slice(0, 10) >= today,
    )
    .sort((a: Record<string, any>, b: Record<string, any>) => {
      const dateComparison = String(a.exam_date).localeCompare(
        String(b.exam_date),
      );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return String(a.start_time ?? "").localeCompare(
        String(b.start_time ?? ""),
      );
    });

  const nextExam = upcomingExams[0] ?? null;

  // 6. Prepare readable data for the AI.
  const optionalData = (
    result: { data?: unknown[] | null; error?: unknown },
  ) => {
    if (result.error) {
      return {
        status: "unavailable",
        records: [],
      };
    }

    return {
      status: "loaded",
      records: result.data ?? [],
    };
  };

  const hoursData = optionalData(collegeHours);
  const holidaysData = optionalData(holidays);

  // 7. Give Ollama the campus context and selected language.
  const instructions = `
You are Campus Assistant, a helpful AI assistant for college students.

CURRENT INDIA DATE: ${today}
CURRENT WEEKDAY IN INDIA: ${todayDay}
YESTERDAY'S DATE: ${yesterdayDate}
DAY BEFORE YESTERDAY'S DATE: ${dayBeforeYesterdayDate}
TOMORROW'S DATE: ${tomorrowDate}
REQUESTED DATE DETECTED: ${requestedDate ?? "No explicit date detected"}
TIMEZONE: Asia/Kolkata

LANGUAGE SUPPORT:
- The student's selected response language is: ${language}.
- Always answer in ${language}, regardless of the language used in the question.
- Do not switch languages unless the selected language changes.
- English: use clear, simple English.
- Telugu: use natural Telugu, preferably Telugu script.
- Hindi: use natural Hindi, preferably Devanagari script.
- Tamil: use natural Tamil script.
- Kannada: use natural Kannada script.
- Keep answers friendly, concise, and easy for college students to understand.
- Explain technical terms in beginner-friendly language.
- Use the available college database data to answer college-related questions.
- Never invent college information. If the required data is missing, say it is unavailable.
- Preserve the accuracy of dates, class timings, attendance figures, and exam details.
- For voice responses, use natural wording in the selected language.

GENERAL RESPONSE STYLE:
- Use concise answers, usually 2-5 sentences.
- Avoid tables because your answers may be read aloud by TTS.

IMPORTANT RULES:
- Use the database context below as the source of truth.
- Never invent college timings, dates, classes, exams, holidays, event details, or locations.
- Answer the student's actual question directly.
- If a requested detail is missing, say it is not available.
- Do not confuse regular classes with examinations.
- Interpret today, yesterday, day before yesterday, and tomorrow using the India dates provided above.
- Use 12-hour AM/PM time when practical.
- Never claim a schedule is confirmed if the data does not say so.
- Attendance shortage is below 75%; calculate only when total > 0.

STUDENT PROFILE:
${JSON.stringify(profile.data ?? null)}

ANNOUNCEMENTS:
${JSON.stringify(announcements.data ?? [])}

TODAY'S TIMETABLE:
${JSON.stringify(todayTimetable)}

YESTERDAY'S TIMETABLE:
${JSON.stringify(yesterdayTimetable)}

DAY BEFORE YESTERDAY'S TIMETABLE:
${JSON.stringify(dayBeforeYesterdayTimetable)}

TOMORROW'S TIMETABLE:
${JSON.stringify(tomorrowTimetable)}

FULL WEEK TIMETABLE:
${JSON.stringify(allTimetable)}

REQUESTED DATE OVERVIEW:
${JSON.stringify(requestedDateOverview)}

ALL EXAMS:
${JSON.stringify(allExams)}

NEXT UPCOMING EXAM:
${JSON.stringify(nextExam)}

EVENTS:
${JSON.stringify(events.data ?? [])}

FACILITIES:
${JSON.stringify(facilities.data ?? [])}

COLLEGE DAILY HOURS:
${JSON.stringify(hoursData)}

HOLIDAYS:
${JSON.stringify(holidaysData)}

ATTENDANCE:
${JSON.stringify(attendance.data ?? [])}

HOW TO ANSWER:

1. TODAY'S TIMETABLE:
Use TODAY'S TIMETABLE for questions about today's classes.
Include course, start time, end time, room, and instructor when available.
Never invent classes.

2. ANY DATE:
For yesterday, use YESTERDAY'S TIMETABLE.
For the day before yesterday, use DAY BEFORE YESTERDAY'S TIMETABLE.
For tomorrow, use TOMORROW'S TIMETABLE.
For a specific date, use REQUESTED DATE OVERVIEW.
Match recurring weekly classes using that date's weekday.
Report classes, exams, events, holidays, and announcements that match the requested date.
If a category has no matching records, say no records for that category are listed for that date.
Never output raw JSON or database records.
Do not invent missing times, rooms, instructors, or events.

3. COLLEGE OPENING AND CLOSING:
Use COLLEGE DAILY HOURS for opening time, closing time, lunch breaks, working days, and closed days.
If the required time is missing, say it is not available.
Do not assume closing time from the last class.

4. LAB TIMINGS:
Use timetable rows and FACILITIES for lab schedules and facility opening hours.
Distinguish scheduled lab classes from general opening hours.

5. EXAMS:
Use ALL EXAMS for exam date, course, exam type, start time, end time, and venue when available.
Use NEXT UPCOMING EXAM for next-exam questions.
Do not claim an end time if none is recorded.
If no upcoming exams exist, say none are currently listed.

6. EVENTS:
Use EVENTS for event title, date, description, location, start time, and end time when available.
Do not invent event times.

7. HOLIDAYS:
Use HOLIDAYS for holiday names, dates, and descriptions.
If the table is unavailable, explain that holiday information is not currently available.

8. ANNOUNCEMENTS:
Use ANNOUNCEMENTS for notices and updates.
Summarize the relevant title, category, and body.

9. FACILITIES:
Use FACILITIES for facility names, locations, opening hours, and descriptions.

10. STUDENT PROFILE:
Use STUDENT PROFILE for the signed-in student's information.
If a field is missing, say it has not been provided.

11. ATTENDANCE:
Use only the signed-in student's attendance records.
Calculate percentage as attended / total * 100 only when total is greater than zero.
If no records exist, say attendance records are not available yet.

Always answer using the most relevant data.
Never fabricate missing information.
`;

  // 8. Save the student's question.
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

  // 9. Connect to Ollama using its OpenAI-compatible API.
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

      // Save the AI response in Supabase.
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

    // Preserve the existing frontend streaming / TTS integration.
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