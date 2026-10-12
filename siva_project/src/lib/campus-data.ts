
import { supabase } from "@/integrations/supabase/client";

export async function getSharedCampusData() {
  // Check whether the student is logged in
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please login first");
  }

  // Fetch common college data
  const [
    timetable,
    exams,
    announcements,
    events,
    facilities,
  ] = await Promise.all([
    supabase.from("timetable").select("*"),
    supabase.from("exams").select("*"),
    supabase.from("announcements").select("*"),
    supabase.from("events").select("*"),
    supabase.from("facilities").select("*"),
  ]);

  const results = [
    timetable,
    exams,
    announcements,
    events,
    facilities,
  ];

  const failed = results.find((result) => result.error);

  if (failed?.error) {
    throw failed.error;
  }

  return {
    timetable: timetable.data ?? [],
    exams: exams.data ?? [],
    announcements: announcements.data ?? [],
    events: events.data ?? [],
    facilities: facilities.data ?? [],
  };
}
