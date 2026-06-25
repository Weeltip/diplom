-- ============================================
-- 2/3  vacancies — вакансии (+ демо-данные в конце файла)
-- Выполнить после sql/profiles.sql
-- ============================================

CREATE TABLE IF NOT EXISTS public.vacancies (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title           text NOT NULL,
  employer        text NOT NULL,
  salary          text NOT NULL DEFAULT '',
  employment_type text NOT NULL DEFAULT 'Полная занятость',
  location        text NOT NULL DEFAULT '',
  specialization  text NOT NULL DEFAULT '',
  industry        text NOT NULL DEFAULT '',
  experience      text NOT NULL DEFAULT '',
  description     text NOT NULL DEFAULT '',
  requirements    text NOT NULL DEFAULT '',
  conditions      text NOT NULL DEFAULT '',
  is_featured     boolean NOT NULL DEFAULT false,
  is_published    boolean NOT NULL DEFAULT false,
  rejection_reason text,
  rejected_at     timestamptz,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;

-- --- Функции и триггеры ---

CREATE OR REPLACE FUNCTION public.vacancies_moderation_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
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

-- --- RLS ---

DROP POLICY IF EXISTS "Вакансии видны всем" ON public.vacancies;
DROP POLICY IF EXISTS "Вакансии: опубликованные видны всем" ON public.vacancies;
CREATE POLICY "Вакансии: опубликованные видны всем"
  ON public.vacancies FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "Вакансии: автор видит свои" ON public.vacancies;
CREATE POLICY "Вакансии: автор видит свои"
  ON public.vacancies FOR SELECT TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Вакансии: админ видит все" ON public.vacancies;
CREATE POLICY "Вакансии: админ видит все"
  ON public.vacancies FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Вставка вакансий для авторизованных" ON public.vacancies;
DROP POLICY IF EXISTS "Вакансии: вставка работодателем" ON public.vacancies;
CREATE POLICY "Вакансии: вставка работодателем"
  ON public.vacancies FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'employer'
    )
  );

DROP POLICY IF EXISTS "Вакансии: правка своих" ON public.vacancies;
CREATE POLICY "Вакансии: правка своих"
  ON public.vacancies FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Вакансии: удаление своих" ON public.vacancies;
CREATE POLICY "Вакансии: удаление своих"
  ON public.vacancies FOR DELETE TO authenticated
  USING (created_by = auth.uid());

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

-- ============================================
-- Демо-вакансии (ПМР, опубликованы для каталога)
-- Только для нового проекта! При повторном запуске будут дубликаты.
-- ============================================

INSERT INTO public.vacancies (
  title, employer, salary, employment_type, location,
  specialization, industry, experience,
  description, requirements, conditions,
  is_featured, is_published, created_at
) VALUES
(
  'Бухгалтер (первичная документация)', 'ООО «БизнесСервис»', 'от 5 500 руб.', 'Полная занятость', 'г. Тирасполь, р-н Центральный',
  'Бухгалтер', 'Финансы, страхование', 'От 1 года до 3 лет',
  'Ведение первичной документации, сверка с контрагентами, архив.', 'Знание 1С;Внимательность;Опыт от 1 года', 'Оформление по ТК;График 5/2',
  false, true, now() - interval '0 days'
),
(
  'Менеджер по продажам', 'ООО «АгроПродукт»', 'от 6 200 руб. + бонус', 'Полная занятость', 'г. Бендеры, р-н Промышленный',
  'Менеджер по продажам', 'Торговля, розница', 'От 1 года до 3 лет',
  'Продажа продукции агропредприятия, работа с торговыми точками.', 'Коммуникабельность;Опыт продаж;Водительские права', 'Оклад + бонус;Обучение',
  false, true, now() - interval '1 days'
),
(
  'Монтажник металлоконструкций', 'ООО «СтройМастер»', 'от 7 200 руб.', 'Полная занятость', 'г. Рыбница, р-н Промышленный',
  'Строитель', 'Строительство', 'От 3 до 6 лет',
  'Монтаж металлоконструкций на строительных объектах.', 'Опыт монтажа;Удостоверение по высоте;Физическая выносливость', 'Спецодежда;Своевременная оплата',
  false, true, now() - interval '2 days'
),
(
  'Медицинская сестра процедурного кабинета', 'ФГБУ «Поликлиника №1»', '6 800 руб. + надбавки', 'Полная занятость', 'г. Тирасполь, р-н Северный',
  'Медицинский работник', 'Медицина, фармацевтика', 'От 1 года до 3 лет',
  'Выполнение назначений врача, забор анализов, инъекции.', 'Среднее медицинское образование;Действующий сертификат', 'Соцпакет;Надбавки за стаж',
  true, true, now() - interval '3 days'
),
(
  'Кладовщик / комплектовщик', 'ООО «Логистик Про»', 'от 5 600 руб.', 'Полная занятость', 'г. Тирасполь, р-н Кировский',
  'Кладовщик, комплектовщик', 'Транспорт, логистика', 'Нет опыта',
  'Приём, размещение и отгрузка товара, инвентаризация.', 'Внимательность;Готовность к обучению', 'График 5/2;Спецодежда',
  false, true, now() - interval '4 days'
),
(
  'Инженер по охране труда', 'ООО «РегионТех»', 'от 8 500 руб.', 'Полная занятость', 'г. Бендеры, р-н Центральный',
  'Инженер', 'Производство', 'От 3 до 6 лет',
  'Контроль соблюдения требований охраны труда на производстве.', 'Образование по ОТ;Опыт от 3 лет', 'Служебный транспорт;Соцпакет',
  false, true, now() - interval '5 days'
),
(
  'Продавец-консультант (стройматериалы)', 'ИП Козлов А.В.', 'от 4 800 руб. + %', 'Сменный график', 'г. Дубоссары, р-н Центральный',
  'Продавец, кассир', 'Строительные материалы', 'Нет опыта',
  'Консультирование покупателей, выкладка товара, касса.', 'Коммуникабельность;Желание работать в торговле', 'Смены 2/2;Процент от продаж',
  false, true, now() - interval '6 days'
),
(
  'Специалист по работе с клиентами', 'АНО «Социум»', 'от 5 200 руб.', 'Удалённо', 'г. Тирасполь',
  'Менеджер по работе с клиентами', 'Услуги населению', 'Нет опыта',
  'Консультирование по телефону и в мессенджерах.', 'Грамотная речь;Пользователь ПК', 'Удалённая работа;Гибкий график',
  false, true, now() - interval '7 days'
),
(
  'Водитель автобуса категории D', 'МУП «Городской транспорт»', '6 500 — 9 200 руб.', 'Сменный график', 'г. Тирасполь, р-н Черновка',
  'Водитель', 'Транспорт, логистика', 'От 1 года до 3 лет',
  'Перевозка пассажиров по городским маршрутам.', 'Права категории D;Стаж от 1 года', 'Форменная одежда;Стабильная зарплата',
  false, true, now() - interval '8 days'
),
(
  'Электрик промышленный', 'ООО «ТехноПром»', 'от 6 900 руб.', 'Полная занятость', 'г. Днестровск, р-н Заводской',
  'Слесарь, электрик', 'Производство', 'От 3 до 6 лет',
  'Обслуживание электрооборудования цеха.', 'Допуск по электробезопасности;Опыт на производстве', 'График 5/2;Соцпакет',
  false, true, now() - interval '9 days'
),
(
  'Программист 1С', 'ООО «ИнфоТех»', 'от 9 500 руб.', 'Полная занятость', 'г. Тирасполь, р-н Ботанический',
  'Программист, разработчик', 'IT, телекоммуникации', 'От 1 года до 3 лет',
  'Доработка и сопровождение конфигураций 1С.', 'Опыт 1С;Знание SQL', 'Офис в центре;Обучение',
  false, true, now() - interval '10 days'
),
(
  'Повар горячего цеха', 'ООО «Пищепром»', 'от 5 400 руб.', 'Сменный график', 'г. Слободзея, р-н Портовый',
  'Повар, работник общепита', 'Пищевая промышленность', 'От 1 года до 3 лет',
  'Приготовление блюд по технологическим картам.', 'Опыт работы поваром;Санитарная книжка', 'Питание за счёт компании',
  false, true, now() - interval '11 days'
),
(
  'Охранник объекта', 'ООО «Безопасность Плюс»', 'от 5 000 руб.', 'Сменный график', 'г. Бендеры, р-н Привокзальный',
  'Охранник', 'Безопасность', 'Нет опыта',
  'Охрана складского комплекса, обход территории.', 'Без вредных привычек;Готовность к сменному графику', 'Смены 1/3;Униформа',
  false, true, now() - interval '12 days'
),
(
  'Сварщик полуавтомат', 'ООО «МолдТекстиль»', 'от 7 800 руб.', 'Полная занятость', 'г. Рыбница, р-н Заречный',
  'Рабочий, оператор станков', 'Производство', 'От 3 до 6 лет',
  'Сварка металлоконструкций полуавтоматом.', 'Удостоверение сварщика;Опыт от 3 лет', 'Спецодежда;Премии',
  false, true, now() - interval '13 days'
),
(
  'Учитель начальных классов', 'ГУО «Школа №5»', 'от 6 000 руб.', 'Полная занятость', 'г. Каменка, р-н Центральный',
  'Учитель, преподаватель', 'Образование', 'Более 6 лет',
  'Преподавание в начальной школе по программе МОН.', 'Педагогическое образование;Опыт работы', 'Льготы работника образования',
  false, true, now() - interval '14 days'
),
(
  'Оператор call-центра', 'ООО «СвязьПлюс»', 'от 4 900 руб.', 'Полная занятость', 'г. Тирасполь, р-н Южный',
  'Менеджер по работе с клиентами', 'Связь, почта', 'Нет опыта',
  'Приём входящих звонков, консультация абонентов.', 'Грамотная речь;Стрессоустойчивость', 'Обучение;График 2/2',
  false, true, now() - interval '15 days'
),
(
  'Фармацевт', 'ООО «ФармЛига»', 'от 6 400 руб.', 'Полная занятость', 'г. Парканы, р-н Центральный',
  'Медицинский работник', 'Медицина, фармацевтика', 'От 1 года до 3 лет',
  'Отпуск лекарственных препаратов, консультация покупателей.', 'Фармацевтическое образование;Действующий сертификат', 'Скидки на продукцию аптеки',
  false, true, now() - interval '16 days'
),
(
  'Токарь станочник', 'ООО «ДнестрТорг»', 'от 6 700 руб.', 'Полная занятость', 'г. Григориополь, р-н Промышленный',
  'Рабочий, оператор станков', 'Производство', 'От 3 до 6 лет',
  'Токарная обработка деталей на станках ЧПУ.', 'Разряд не ниже 4;Опыт на станках', 'График 5/2;Соцпакет',
  false, true, now() - interval '17 days'
),
(
  'Системный администратор', 'ООО «ИнфоТех»', 'от 8 200 руб.', 'Полная занятость', 'г. Тирасполь',
  'Системный администратор', 'IT, телекоммуникации', 'От 3 до 6 лет',
  'Поддержка серверов и рабочих мест, сетевой инфраструктуры.', 'Windows/Linux;Опыт администрирования', 'Гибкий старт дня',
  false, true, now() - interval '18 days'
),
(
  'Стажёр бухгалтерии', 'ООО «БизнесСервис»', 'от 4 200 руб.', 'Стажировка', 'г. Тирасполь, р-н Центральный',
  'Бухгалтер', 'Финансы, страхование', 'Нет опыта',
  'Стажировка в отделе бухгалтерии под руководством наставника.', 'Студент или выпускник экономического;ПК', 'Стажировка 3 месяца;Возможность трудоустройства',
  false, true, now() - interval '19 days'
);
