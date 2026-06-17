-- Перейменування послуг у наявних записах:
--   «Аналізи (загальний)»    → «ЗАК»
--   «Аналізи (біохімічний)»  → «БАК»
--   «Стерилізація»           → «ОГЕ»          (тепер вид операції)
--   «Зуби»                   → «УЗ-зубів»
--
-- service зберігає кілька послуг через роздільник «, », тож міняємо підрядки.
-- Код (src/lib/services.ts → SERVICE_ALIASES) також мапить старі назви при
-- читанні, тож ця міграція не обов'язкова, але приводить дані до актуальних назв.

update public.appointments
set service = replace(service, 'Аналізи (загальний)', 'ЗАК')
where service like '%Аналізи (загальний)%';

update public.appointments
set service = replace(service, 'Аналізи (біохімічний)', 'БАК')
where service like '%Аналізи (біохімічний)%';

update public.appointments
set service = replace(service, 'Стерилізація', 'ОГЕ')
where service like '%Стерилізація%';

-- «Зуби» розділено на «УЗ-зубів» і «видалення зубів»; історичні записи не
-- розрізняють підвид, тож зводимо їх до «УЗ-зубів» (узгоджено з SERVICE_ALIASES).
update public.appointments
set service = replace(service, 'Зуби', 'УЗ-зубів')
where service like '%Зуби%';
