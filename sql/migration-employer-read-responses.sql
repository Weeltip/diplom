-- Работодатель видит отклики только на свои вакансии (vacancies.created_by = auth.uid())

drop policy if exists "Работодатель видит отклики на свои вакансии" on public.responses;

create policy "Работодатель видит отклики на свои вакансии"
  on public.responses for select to authenticated
  using (
    exists (
      select 1 from public.vacancies v
      where v.id = responses.vacancy_id
        and v.created_by = auth.uid()
    )
  );

-- Контакты соискателя для работодателя: e-mail копируется при регистрации
alter table public.profiles add column if not exists contact_email text default '';

create or replace function public.handle_new_user()
returns trigger as $$
declare
  r text;
begin
  r := coalesce(new.raw_user_meta_data->>'role', '');
  if r not in ('seeker', 'employer') then
    r := 'seeker';
  end if;
  insert into public.profiles (id, full_name, role, contact_email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    r,
    coalesce(new.email::text, '')
  );
  return new;
end;
$$ language plpgsql security definer;
