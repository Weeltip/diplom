-- ============================================
-- Отклонение вакансий с комментарием + обновление триггера
-- Выполнить после migration-vacancy-moderation.sql
-- ============================================

ALTER TABLE public.vacancies
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- 2) Триггер: работодатель не публикует сам; при правке сбрасывает отклонение
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
