# ⚡ Быстрая настройка Supabase для компонента Tasks.jsx

## 🚨 Если есть ошибки "column does not exist" - используйте ПЛАН РЕВИЗИИ!

### 🔧 ПЛАН РЕВИЗИИ БД (при ошибках)
1. **Диагностика:** `scripts/database_audit.sql` 
2. **Выберите скрипт исправления:**
   - **МИГРАЦИЯ** (если таблица history с неправильной структурой): `scripts/migrate_history_table.sql`
   - **ПОЛНОЕ ИСПРАВЛЕНИЕ** (если таблицы отсутствуют): `scripts/fix_database_schema.sql`
3. **Проверка:** Все столбцы должны появиться

## 🚀 Чистая установка (5 минут)

### Шаг 1: SQL схема (2 мин)
1. Откройте Supabase Dashboard → **SQL Editor**
2. Скопируйте весь `scripts/create_tasks_schema.sql` (версия 2.1)
3. Нажмите **Run**
4. ✅ Готово! Создано: таблицы, политики, триггеры, зависимости

### Шаг 2: Storage bucket (1 мин)
1. **Storage** → **Buckets** → **New bucket**
2. Name: `task-proofs` 
3. Public: ✅ **включить**
4. **Create bucket**

### Шаг 3: Storage политики (1 мин)
Выполните в SQL Editor:
```sql
-- Удаляем существующие политики если есть
DROP POLICY IF EXISTS "task_proofs_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_delete_policy" ON storage.objects;

-- Создаем новые политики
CREATE POLICY "task_proofs_upload_policy" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-proofs');

CREATE POLICY "task_proofs_select_policy" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'task-proofs');

CREATE POLICY "task_proofs_update_policy" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'task-proofs' AND owner = auth.uid());

CREATE POLICY "task_proofs_delete_policy" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'task-proofs' AND owner = auth.uid());
```

### Шаг 4: Проверка (1 мин)
```sql
-- Должно вернуть 5 таблиц
SELECT count(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'families', 'tasks', 'rewards', 'history');

-- Должен существовать bucket
SELECT id FROM storage.buckets WHERE id = 'task-proofs';
```

## ✅ Готово!
Компонент Tasks.jsx готов к работе!

## 🚨 Если возникли ошибки:

**ERROR: column "stars_change" does not exist** или любые "column does not exist"
```sql
-- ПЛАН РЕВИЗИИ - выполните по порядку:
-- 1. Диагностика
\i scripts/database_audit.sql

-- 2a. Если таблица history имеет неправильную структуру (МИГРАЦИЯ):
\i scripts/migrate_history_table.sql

-- 2b. Если таблицы отсутствуют (ПОЛНОЕ ИСПРАВЛЕНИЕ):
\i scripts/fix_database_schema.sql

-- 3. Проверка
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'history';
```

**ERROR: syntax error at or near "NOT"**  
- Обновите скрипт - исправлены политики RLS

**✅ Результат ревизии:** Все столбцы, связи и представления будут исправлены автоматически!

**Другие проблемы:** См. подробные инструкции в `scripts/setup_instructions.md`
