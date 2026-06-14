-- Перейменування послуг у наявних записах:
--   «Аналізи (загальний)»    → «ЗАК»
--   «Аналізи (біохімічний)»  → «БАК»
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
