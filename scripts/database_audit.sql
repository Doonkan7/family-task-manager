-- Диагностика текущего состояния базы данных Family Task Manager
-- Этот скрипт поможет понять что уже есть в БД и что нужно исправить

-- 1) Проверка существующих таблиц
SELECT 'EXISTING_TABLES' as check_type, table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2) Структура таблицы users (если существует)
SELECT 'USERS_STRUCTURE' as check_type, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 3) Структура таблицы families (если существует)
SELECT 'FAMILIES_STRUCTURE' as check_type, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'families'
ORDER BY ordinal_position;

-- 4) Структура таблицы history (если существует)
SELECT 'HISTORY_STRUCTURE' as check_type, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'history'
ORDER BY ordinal_position;

-- 5) Структура таблицы tasks (если существует)
SELECT 'TASKS_STRUCTURE' as check_type, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'tasks'
ORDER BY ordinal_position;

-- 6) Структура таблицы rewards (если существует)
SELECT 'REWARDS_STRUCTURE' as check_type, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'rewards'
ORDER BY ordinal_position;

-- 7) Существующие внешние ключи
SELECT 'FOREIGN_KEYS' as check_type,
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema='public'
ORDER BY tc.table_name, kcu.column_name;

-- 8) Существующие RLS политики
SELECT 'RLS_POLICIES' as check_type,
    schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 9) Существующие представления (views)
SELECT 'VIEWS' as check_type, table_name
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 10) Storage buckets (если доступны)
SELECT 'STORAGE_BUCKETS' as check_type, id, name, public
FROM storage.buckets
ORDER BY name;
