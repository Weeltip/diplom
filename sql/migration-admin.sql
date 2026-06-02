-- ============================================
-- Админ-панель: роль admin, RLS, триггер роли
-- Выполнить один раз в Supabase → SQL Editor
-- ============================================

-- 1) Роль admin в profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('seeker', 'employer', 'admin'));

-- 2) Функция проверки админа (обходит RLS при чтении своей строки)
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

-- 3) Вакансии: полные права администратора
DROP POLICY IF EXISTS "Вакансии: админ обновляет" ON public.vacancies;
CREATE POLICY "Вакансии: админ обновляет"
  ON public.vacancies FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Вакансии: админ удаляет" ON public.vacancies;
CREATE POLICY "Вакансии: админ удаляет"
  ON public.vacancies FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Вакансии: админ создаёт" ON public.vacancies;
CREATE POLICY "Вакансии: админ создаёт"
  ON public.vacancies FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- 4) Профили: админ правит любые (смена роли и контактов)
DROP POLICY IF EXISTS "Профили: админ обновляет" ON public.profiles;
CREATE POLICY "Профили: админ обновляет"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5) Отклики: админ видит все
DROP POLICY IF EXISTS "Отклики: админ читает" ON public.responses;
CREATE POLICY "Отклики: админ читает"
  ON public.responses FOR SELECT TO authenticated
  USING (public.is_admin());

-- 6) Триггер: нельзя выставить role=admin с клиента; seeker↔employer — только у себя; админ — любые правки
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

DROP TRIGGER IF EXISTS profiles_preserve_role_trg ON public.profiles;
CREATE TRIGGER profiles_preserve_role_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW execute function public.profiles_preserve_role();

-- 7) Регистрация: по-прежнему только seeker | employer (admin только вручную)
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

-- ============================================
-- Назначить первого администратора (подставьте UUID из Authentication → Users):
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
-- ============================================
