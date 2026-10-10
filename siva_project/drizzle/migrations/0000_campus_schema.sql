CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  student_id text,
  department text DEFAULT 'Computer Science',
  year int DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, student_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.raw_user_meta_data->>'student_id');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.announcements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, body text NOT NULL, category text NOT NULL DEFAULT 'General', posted_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.timetable (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), day text NOT NULL, day_order int NOT NULL, start_time text NOT NULL, end_time text NOT NULL, course text NOT NULL, room text NOT NULL, instructor text NOT NULL);
CREATE TABLE public.exams (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course text NOT NULL, exam_date date NOT NULL, start_time text NOT NULL, venue text NOT NULL, exam_type text NOT NULL DEFAULT 'Mid-term');
CREATE TABLE public.events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text NOT NULL, event_date date NOT NULL, location text NOT NULL);
CREATE TABLE public.facilities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, location text NOT NULL, hours text NOT NULL, description text NOT NULL);

GRANT SELECT ON public.announcements, public.timetable, public.exams, public.events, public.facilities TO authenticated;
GRANT ALL ON public.announcements, public.timetable, public.exams, public.events, public.facilities TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students read" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "students read" ON public.timetable FOR SELECT TO authenticated USING (true);
CREATE POLICY "students read" ON public.exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "students read" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "students read" ON public.facilities FOR SELECT TO authenticated USING (true);

CREATE TABLE public.attendance (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, course text NOT NULL, attended int NOT NULL DEFAULT 0, total int NOT NULL DEFAULT 0, UNIQUE (user_id, course));
GRANT SELECT ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attendance" ON public.attendance FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.chat_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role text NOT NULL CHECK (role IN ('user','assistant')), content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON public.chat_messages (user_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat read" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own chat insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own chat delete" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- demo attendance seeded per new student
CREATE OR REPLACE FUNCTION public.seed_attendance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.attendance (user_id, course, attended, total) VALUES
    (NEW.id,'Data Structures',26,30),(NEW.id,'Database Systems',22,28),(NEW.id,'Operating Systems',18,26),
    (NEW.id,'Discrete Mathematics',24,25),(NEW.id,'Technical Writing',12,18);
  RETURN NEW;
END $$;
CREATE TRIGGER on_profile_created AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.seed_attendance();

INSERT INTO public.announcements (title, body, category, posted_at) VALUES
('Mid-term exam schedule released','The mid-term timetable is now available. Check the Exams panel for your dates and venues.','Academics', now() - interval '1 day'),
('Library extended hours','The Central Library is open until midnight during exam weeks, Monday to Saturday.','Campus', now() - interval '2 days'),
('Scholarship applications open','Merit scholarship applications are open until the 30th. Apply at the Student Affairs office.','Finance', now() - interval '4 days'),
('Wi-Fi maintenance on Sunday','Campus Wi-Fi will be unavailable from 6 AM to 10 AM this Sunday for upgrades.','IT', now() - interval '5 days');

INSERT INTO public.timetable (day, day_order, start_time, end_time, course, room, instructor) VALUES
('Monday',1,'09:00','10:00','Data Structures','LH-101','Dr. Anita Rao'),
('Monday',1,'11:00','12:00','Database Systems','Lab-3','Prof. Rahul Mehta'),
('Tuesday',2,'09:00','10:00','Operating Systems','LH-204','Dr. Kiran Shah'),
('Tuesday',2,'14:00','15:00','Discrete Mathematics','LH-105','Dr. Priya Nair'),
('Wednesday',3,'10:00','11:00','Data Structures','LH-101','Dr. Anita Rao'),
('Wednesday',3,'13:00','15:00','Database Systems Lab','Lab-3','Prof. Rahul Mehta'),
('Thursday',4,'09:00','10:00','Operating Systems','LH-204','Dr. Kiran Shah'),
('Thursday',4,'11:00','12:00','Technical Writing','LH-302','Ms. Sara Thomas'),
('Friday',5,'10:00','11:00','Discrete Mathematics','LH-105','Dr. Priya Nair'),
('Friday',5,'14:00','16:00','Operating Systems Lab','Lab-1','Dr. Kiran Shah');

INSERT INTO public.exams (course, exam_date, start_time, venue, exam_type) VALUES
('Data Structures', current_date + 12, '10:00', 'Exam Hall A', 'Mid-term'),
('Database Systems', current_date + 14, '10:00', 'Exam Hall B', 'Mid-term'),
('Operating Systems', current_date + 16, '14:00', 'Exam Hall A', 'Mid-term'),
('Discrete Mathematics', current_date + 18, '10:00', 'Exam Hall C', 'Mid-term');

INSERT INTO public.events (title, description, event_date, location) VALUES
('TechFest 2026','Annual technology festival with hackathons, robotics and talks.', current_date + 7, 'Main Auditorium'),
('Career Fair','Meet 40+ recruiters. Bring printed resumes.', current_date + 10, 'Sports Complex'),
('Cultural Night','Music, dance and drama by student clubs.', current_date + 20, 'Open Air Theatre'),
('AI Workshop','Hands-on intro to machine learning. Laptops required.', current_date + 5, 'Lab-3');

INSERT INTO public.facilities (name, location, hours, description) VALUES
('Central Library','Block A, Ground Floor','8 AM – 10 PM (midnight in exam weeks)','Books, journals, quiet study rooms and e-resources.'),
('Cafeteria','Student Center','7:30 AM – 9 PM','Meals, snacks and beverages.'),
('Health Center','Block D','24 hours','Doctor on call, first aid and pharmacy.'),
('Sports Complex','East Campus','6 AM – 9 PM','Gym, indoor courts, swimming pool.'),
('Computer Labs','Block C','8 AM – 8 PM','High-speed internet and licensed software.');