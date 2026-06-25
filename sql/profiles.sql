-- ============================================
-- 1/3  profiles — пользователи (соискатели, работодатели, админ)
-- Новый проект Supabase: SQL Editor → выполнить по порядку 1 → 2 → 3
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'seeker'
                CHECK (role IN ('seeker', 'employer', 'admin')),
  phone         text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- --- Функции ---

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  r := coalesce(new.raw_user_meta_data->>'role', '');
  IF r NOT IN ('seeker', 'employer') THEN
    r := 'seeker';
  END IF;
  INSERT INTO public.profiles (id, full_name, role, contact_email)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    r,
    coalesce(new.email::text, '')
  );
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_preserve_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  IF tg_op = 'UPDATE' AND old.role IS DISTINCT FROM new.role THEN
    IF public.is_admin() THEN
      RETURN new;
    END IF;
    IF auth.uid() IS NOT NULL AND auth.uid() = old.id
       AND old.role IN ('seeker', 'employer')
       AND new.role IN ('seeker', 'employer') THEN
      RETURN new;
    END IF;
    jwt_role := current_setting('request.jwt.claim.role', true);
    IF jwt_role IS NOT NULL AND jwt_role IS DISTINCT FROM 'service_role' THEN
      new.role := old.role;
    END IF;
  END IF;
  RETURN new;
END;
$$;

-- --- Триггеры ---

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS profiles_preserve_role_trg ON public.profiles;
CREATE TRIGGER profiles_preserve_role_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_preserve_role();

-- --- RLS ---

DROP POLICY IF EXISTS "Профиль виден всем" ON public.profiles;
CREATE POLICY "Профиль виден всем"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Пользователь редактирует свой профиль" ON public.profiles;
CREATE POLICY "Пользователь редактирует свой профиль"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Вставка при регистрации" ON public.profiles;
CREATE POLICY "Вставка при регистрации"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Профили: админ обновляет" ON public.profiles;
CREATE POLICY "Профили: админ обновляет"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- Данные ---
-- Профили создаются при регистрации (Authentication → Sign up).
-- Первого администратора назначьте вручную после регистрации:
--   UPDATE public.profiles SET role = 'admin' WHERE id = 'UUID-из-Authentication-Users';
