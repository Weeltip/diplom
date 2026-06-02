-- ============================================
-- Модерация вакансий: публикация только после одобрения админом
--
-- ✅ Запускайте ЭТОТ файл, если база УЖЕ работает (не schema.sql!).
-- Порядок для нового проекта: schema.sql → migration-admin.sql → этот файл.
-- Для существующей базы достаточно только этого файла (и migration-admin.sql, если админки ещё нет).
-- ============================================

-- 0) Функция is_admin — нужна триггеру и политикам (безопасно пересоздать)
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

-- 1) Флаг публикации
ALTER TABLE public.vacancies
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

-- Существующие вакансии (в т.ч. тестовые) — считаем уже опубликованными
UPDATE public.vacancies SET is_published = true WHERE is_published = false;

-- 2) Триггер: работодатель не может сам опубликовать вакансию
CREATE OR REPLACE FUNCTION public.vacancies_moderation_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.is_published := false;
    IF tg_op = 'UPDATE' THEN
      NEW.rejection_reason := NULL;
      NEW.rejected_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vacancies_moderation_guard_trg ON public.vacancies;
CREATE TRIGGER vacancies_moderation_guard_trg
  BEFORE INSERT OR UPDATE ON public.vacancies
  FOR EACH ROW EXECUTE FUNCTION public.vacancies_moderation_guard();

-- 3) SELECT: в каталоге только опубликованные; автор и админ видят все свои / все
DROP POLICY IF EXISTS "Вакансии видны всем" ON public.vacancies;
DROP POLICY IF EXISTS "Вакансии: опубликованные видны всем" ON public.vacancies;
DROP POLICY IF EXISTS "Вакансии: автор видит свои" ON public.vacancies;
DROP POLICY IF EXISTS "Вакансии: админ видит все" ON public.vacancies;

CREATE POLICY "Вакансии: опубликованные видны всем"
  ON public.vacancies FOR SELECT
  USING (is_published = true);

CREATE POLICY "Вакансии: автор видит свои"
  ON public.vacancies FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Вакансии: админ видит все"
  ON public.vacancies FOR SELECT TO authenticated
  USING (public.is_admin());

-- 4) Отклик только на опубликованную вакансию
DROP POLICY IF EXISTS "Отклик только соискатель" ON public.responses;
CREATE POLICY "Отклик только соискатель"
  ON public.responses FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'seeker'
    )
    AND EXISTS (
      SELECT 1 FROM public.vacancies v
      WHERE v.id = vacancy_id AND v.is_published = true
    )
  );
