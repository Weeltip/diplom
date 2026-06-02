-- Выполнить в Supabase SQL Editor (если проект уже создан раньше)
-- 1) Всем новым пользователям явно роль соискателя
-- 2) С клиента нельзя сменить роль на работодателя — только через SQL / Table Editor

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'seeker'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Не даём менять role через API (anon / authenticated); через SQL Editor JWT часто пустой — смена разрешена
create or replace function public.profiles_preserve_role()
returns trigger as $$
declare
  jwt_role text;
begin
  if tg_op = 'update' and old.role is distinct from new.role then
    jwt_role := current_setting('request.jwt.claim.role', true);
    if jwt_role is not null and jwt_role is distinct from 'service_role' then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer
set search_path = public;

drop trigger if exists profiles_preserve_role_trg on public.profiles;
create trigger profiles_preserve_role_trg
  before update on public.profiles
  for each row
  execute function public.profiles_preserve_role();
