-- ============================================
-- 3/3  responses — отклики соискателей
-- Выполнить после sql/vacancies.sql
-- ============================================

CREATE TABLE IF NOT EXISTS public.responses (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vacancy_id        bigint NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'viewed', 'invited', 'hired', 'rejected')),
  status_updated_at timestamptz,
  hired_at          timestamptz,
  message           text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, vacancy_id)
);

ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- --- Функции и триггеры ---

CREATE OR REPLACE FUNCTION public.responses_status_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'UPDATE' AND old.status IS DISTINCT FROM new.status THEN
    new.status_updated_at := now();
    IF new.status = 'hired' THEN
      new.hired_at := coalesce(new.hired_at, now());
    ELSE
      new.hired_at := NULL;
    END IF;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS responses_status_timestamps_trg ON public.responses;
CREATE TRIGGER responses_status_timestamps_trg
  BEFORE UPDATE OF status ON public.responses
  FOR EACH ROW EXECUTE FUNCTION public.responses_status_timestamps();

-- --- RLS ---

DROP POLICY IF EXISTS "Пользователь видит свои отклики" ON public.responses;
CREATE POLICY "Пользователь видит свои отклики"
  ON public.responses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Работодатель видит отклики на свои вакансии" ON public.responses;
CREATE POLICY "Работодатель видит отклики на свои вакансии"
  ON public.responses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vacancies v
      WHERE v.id = responses.vacancy_id
        AND v.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Отклики: админ читает" ON public.responses;
CREATE POLICY "Отклики: админ читает"
  ON public.responses FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Пользователь создаёт отклик" ON public.responses;
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

DROP POLICY IF EXISTS "Пользователь удаляет свой отклик" ON public.responses;
CREATE POLICY "Пользователь удаляет свой отклик"
  ON public.responses FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Работодатель меняет статус отклика" ON public.responses;
CREATE POLICY "Работодатель меняет статус отклика"
  ON public.responses FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vacancies v
      WHERE v.id = responses.vacancy_id
        AND v.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vacancies v
      WHERE v.id = responses.vacancy_id
        AND v.created_by = auth.uid()
    )
  );

-- --- Данные ---
-- Отклики появляются, когда соискатель нажимает «Откликнуться» на странице вакансии.
-- Для демо: зарегистрируйте соискателя и откликнитесь на любую вакансию из каталога.
