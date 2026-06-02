-- ============================================
-- Центр занятости — схема БД для Supabase
--
-- ⚠️ ТОЛЬКО ДЛЯ НОВОГО ПРОЕКТА (пустая база)!
-- Если таблицы уже созданы — НЕ запускайте этот файл.
-- Ошибка «policy ... already exists» — признак, что база уже настроена.
-- Для модерации вакансий выполните: sql/migration-vacancy-moderation.sql
-- Для админки (если ещё нет): sql/migration-admin.sql
-- ============================================

-- 1. Профили пользователей (привязаны к auth.users)
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  role          text not null default 'seeker' check (role in ('seeker', 'employer', 'admin')),
  phone         text default '',
  contact_email text default '',
  created_at    timestamptz default now()
);

alter table profiles enable row level security;

create policy "Профиль виден всем"
  on profiles for select using (true);

create policy "Пользователь редактирует свой профиль"
  on profiles for update using (auth.uid() = id);

create policy "Вставка при регистрации"
  on profiles for insert with check (auth.uid() = id);

-- Регистрация: роль из метаданных (seeker | employer), иначе соискатель
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Вакансии
create table if not exists vacancies (
  id              bigint generated always as identity primary key,
  title           text not null,
  employer        text not null,
  salary          text default '',
  employment_type text default 'Полная занятость',
  location        text default '',
  experience      text default '',
  description     text default '',
  requirements    text default '',
  conditions      text default '',
  is_featured     boolean default false,
  is_published      boolean not null default false,
  rejection_reason  text,
  rejected_at       timestamptz,
  created_at        timestamptz default now(),
  created_by        uuid references auth.users(id) on delete set null
);

alter table vacancies enable row level security;

create policy "Вакансии: опубликованные видны всем"
  on vacancies for select using (is_published = true);

create policy "Вакансии: автор видит свои"
  on vacancies for select to authenticated
  using (created_by = auth.uid());

create policy "Вакансии: вставка работодателем"
  on vacancies for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'employer')
  );

create policy "Вакансии: правка своих"
  on vacancies for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Вакансии: удаление своих"
  on vacancies for delete to authenticated
  using (created_by = auth.uid());

-- 3. Отклики на вакансии
create table if not exists responses (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  vacancy_id  bigint not null references vacancies(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(user_id, vacancy_id)
);

alter table responses enable row level security;

create policy "Пользователь видит свои отклики"
  on responses for select using (auth.uid() = user_id);

create policy "Работодатель видит отклики на свои вакансии"
  on responses for select to authenticated
  using (
    exists (
      select 1 from public.vacancies v
      where v.id = responses.vacancy_id
        and v.created_by = auth.uid()
    )
  );

create policy "Отклик только соискатель"
  on responses for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'seeker')
    and exists (
      select 1 from public.vacancies v
      where v.id = vacancy_id and v.is_published = true
    )
  );

create policy "Пользователь удаляет свой отклик"
  on responses for delete using (auth.uid() = user_id);

-- Админ-панель: функции и политики RLS — см. sql/migration-admin.sql (выполнить после создания таблиц).
-- Модерация вакансий: sql/migration-vacancy-moderation.sql, sql/migration-vacancy-rejection.sql.

-- 4. Тестовые данные — вакансии (сразу опубликованы для демо-каталога)
insert into vacancies (title, employer, salary, employment_type, location, experience, description, requirements, conditions, is_featured, is_published) values
(
  'Инженер по охране труда',
  'ООО «РегионТех»',
  'от 65 000 ₽',
  'Полная занятость',
  'г. Иваново',
  'Опыт от 3 лет',
  'Организация и контроль соблюдения требований охраны труда, промышленной и пожарной безопасности на производственных участках. Ведение журналов, участие в расследовании несчастных случаев, подготовка отчётности для госорганов.',
  'Высшее техническое или специальное образование в области охраны труда;Опыт работы от 3 лет на аналогичной должности;Знание трудового законодательства и правил по охране труда;Пользователь ПК, 1С — преимущество',
  'Оформление по трудовому законодательству, соцпакет;График 5/2, служебный транспорт до объекта при выездах;ДМС после испытательного срока',
  false, true
),
(
  'Водитель автобуса категории D',
  'МУП «Городской транспорт»',
  '55 000 — 72 000 ₽',
  'Сменный график',
  'г. Иваново',
  'Обучение',
  'Перевозка пассажиров по городским маршрутам. Ежедневный осмотр транспортного средства, соблюдение графика движения.',
  'Водительское удостоверение категории D;Стаж вождения от 1 года;Отсутствие серьёзных нарушений ПДД',
  'Форменная одежда;Бесплатное питание в столовой;Стабильная зарплата без задержек',
  false, true
),
(
  'Специалист по работе с клиентами',
  'АНО «Социум»',
  'от 42 000 ₽',
  'Удалённо',
  'Регион',
  'Без опыта',
  'Консультирование клиентов по телефону и в мессенджерах, обработка обращений, ведение базы данных.',
  'Грамотная устная и письменная речь;Уверенный пользователь ПК;Ответственность и стрессоустойчивость',
  'Удалённая работа из дома;Гибкий график;Обучение за счёт компании',
  false, true
),
(
  'Медицинская сестра процедурного кабинета',
  'ФГБУ «Поликлиника №1»',
  '48 000 ₽ + надбавки',
  'Полная занятость',
  'г. Иваново',
  'Госсектор',
  'Выполнение назначений врача: забор крови, постановка инъекций, капельниц. Стерилизация инструментов, ведение документации.',
  'Среднее медицинское образование;Действующий сертификат по специальности «Сестринское дело»;Опыт работы приветствуется',
  'Оформление по трудовому законодательству, полный соцпакет;Надбавки за стаж и квалификацию;Льготный проезд',
  true, true
),
(
  'Продавец-консультант (стройматериалы)',
  'ИП Козлов А.В.',
  'от 38 000 ₽ + %',
  'Сменный график',
  'п. Лежнево',
  'Обучение',
  'Консультирование покупателей по ассортименту строительных и отделочных материалов, выкладка товара, ведение кассовых операций.',
  'Коммуникабельность;Желание работать в торговле;Знание стройматериалов — плюс',
  'Смены 2/2;Обучение на месте;Процент от продаж',
  false, true
),
(
  'Кладовщик / комплектовщик',
  'ООО «Логистик Про»',
  'от 45 000 ₽',
  'Полная занятость',
  'индустриальный парк',
  'Вахта 15/15',
  'Приём, размещение и отгрузка товара на складе. Работа со сканером ТСД, инвентаризация.',
  'Опыт работы на складе от 6 месяцев;Физическая выносливость;Внимательность',
  'Вахта 15/15;Питание и проживание;Спецодежда',
  false, true
);
