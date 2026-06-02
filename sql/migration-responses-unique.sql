-- Один отклик соискателя на одну вакансию (если ограничение ещё не создано).
-- Выполнить в SQL Editor Supabase один раз.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'responses_user_id_vacancy_id_key'
      AND conrelid = 'public.responses'::regclass
  ) THEN
    ALTER TABLE public.responses
      ADD CONSTRAINT responses_user_id_vacancy_id_key UNIQUE (user_id, vacancy_id);
  END IF;
END $$;
