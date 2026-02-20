-- ============================================================
-- Calendar & Task — Initial Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ==================== ENUMS ====================

CREATE TYPE task_priority AS ENUM ('red', 'yellow', 'green');
CREATE TYPE recurrence_type AS ENUM ('none', 'daily', 'weekly', 'monthly');
CREATE TYPE notification_type AS ENUM ('task_created', 'task_completed', 'comment', 'reminder');

-- ==================== TABLES ====================

-- 1. User Profiles (extends Supabase auth.users)
CREATE TABLE public.users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  family_id  UUID,  -- will add FK after families table
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Families
CREATE TABLE public.families (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  join_code  TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from users.family_id → families.id
ALTER TABLE public.users
  ADD CONSTRAINT fk_users_family
  FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE SET NULL;

-- 3. Family Members (junction table)
CREATE TABLE public.family_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_id, user_id)
);

-- 4. Tasks
CREATE TABLE public.tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id           UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  created_by          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  note                TEXT,
  task_date           DATE NOT NULL,
  task_time           TIME,
  priority            task_priority NOT NULL DEFAULT 'green',
  is_private          BOOLEAN NOT NULL DEFAULT false,
  is_completed        BOOLEAN NOT NULL DEFAULT false,
  completed_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at        TIMESTAMPTZ,
  recurrence_type     recurrence_type NOT NULL DEFAULT 'none',
  recurrence_end_date DATE,
  parent_task_id      UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  reminder_sent       BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Comments (threaded)
CREATE TABLE public.comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Notifications
CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  task_id    UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== INDEXES ====================

CREATE INDEX idx_tasks_family_date ON public.tasks(family_id, task_date);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_parent ON public.tasks(parent_task_id);
CREATE INDEX idx_comments_task ON public.comments(task_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_family_members_user ON public.family_members(user_id);
CREATE INDEX idx_family_members_family ON public.family_members(family_id);

-- ==================== TRIGGERS ====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================== ROW LEVEL SECURITY ====================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---- USERS ----
-- Users can read any user in their family
CREATE POLICY "users_select_family" ON public.users
  FOR SELECT USING (
    family_id IS NULL
    OR family_id IN (
      SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    )
    OR id = auth.uid()
  );

-- Users can update their own profile
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---- FAMILIES ----
-- Anyone authenticated can create a family
CREATE POLICY "families_insert" ON public.families
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Family members can read their family
CREATE POLICY "families_select" ON public.families
  FOR SELECT USING (
    id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

-- Allow reading family by join_code (for joining)
CREATE POLICY "families_select_by_code" ON public.families
  FOR SELECT USING (true);

-- ---- FAMILY MEMBERS ----
-- Users can join a family (insert themselves)
CREATE POLICY "family_members_insert" ON public.family_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Family members can see other members
CREATE POLICY "family_members_select" ON public.family_members
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM public.family_members fm WHERE fm.user_id = auth.uid())
  );

-- Users can leave a family (delete themselves)
CREATE POLICY "family_members_delete" ON public.family_members
  FOR DELETE USING (auth.uid() = user_id);

-- ---- TASKS ----
-- Family members can create tasks
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
  );

-- Family members can see non-private tasks, creator can see their private tasks
CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    AND (is_private = false OR created_by = auth.uid())
  );

-- Creator can update their tasks, any family member can mark complete
CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    AND (is_private = false OR created_by = auth.uid())
  );

-- Creator can delete their tasks
CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (auth.uid() = created_by);

-- ---- COMMENTS ----
-- Family members can comment on non-private tasks
CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND task_id IN (
      SELECT id FROM public.tasks
      WHERE family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
      AND (is_private = false OR created_by = auth.uid())
    )
  );

-- Family members can read comments on visible tasks
CREATE POLICY "comments_select" ON public.comments
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
      AND (is_private = false OR created_by = auth.uid())
    )
  );

-- Authors can update their own comments
CREATE POLICY "comments_update" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Authors can delete their own comments
CREATE POLICY "comments_delete" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

-- ---- NOTIFICATIONS ----
-- System creates notifications (via service role), users read their own
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can mark their notifications as read
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow inserts from authenticated users (for in-app notification creation)
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ==================== REALTIME ====================

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
