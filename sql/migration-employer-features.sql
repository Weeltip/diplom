-- Миграция: роль при регистрации, кабинет работодателя, RLS
-- Выполнить один раз в Supabase SQL Editor

-- 1) Триггер регистрации с ролью из user_metadata (seeker | employer)
create or replace function public.handle_new_user()
returns trigger as $$
declare
  r text;
begin
  r := coalesce(new.raw_user_meta_data->>'role', '');
  if r not in ('seeker', 'employer') then
    r := 'seeker';
  end if;
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    r
  );
  return new;
end;
$$ language plpgsql security definer;

-- 2) Убрать старый триггер блокировки роли (если был)
drop trigger if exists profiles_preserve_role_trg on public.profiles;
drop function if exists public.profiles_preserve_role();

-- 3) Колонка автора вакансии
alter table public.vacancies add column if not exists created_by uuid references auth.users(id) on delete set null;

-- 4) Политики vacancies
drop policy if exists "Вставка вакансий для авторизованных" on public.vacancies;
drop policy if exists "Вакансии: вставка работодателем" on public.vacancies;
drop policy if exists "Вакансии: правка своих" on public.vacancies;
drop policy if exists "Вакансии: удаление своих" on public.vacancies;

create policy "Вакансии: вставка работодателем"
  on public.vacancies for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'employer')
  );

create policy "Вакансии: правка своих"
  on public.vacancies for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Вакансии: удаление своих"
  on public.vacancies for delete to authenticated
  using (created_by = auth.uid());

-- 5) Отклики только соискателей
drop policy if exists "Пользователь создаёт отклик" on public.responses;
drop policy if exists "Отклик только соискатель" on public.responses;

create policy "Отклик только соискатель"
  on public.responses for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'seeker')
  );
