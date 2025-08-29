-- Миграция таблицы history для Family Task Manager
-- Безопасное обновление существующей структуры таблицы history
-- 
-- ВАЖНО: Этот скрипт сохраняет существующие данные!

-- ========================================
-- ЭТАП 0: СОЗДАНИЕ НЕДОСТАЮЩИХ ТАБЛИЦ
-- ========================================

-- Создаем таблицу families если её нет
CREATE TABLE IF NOT EXISTS public.families (
  family_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Создаем таблицу users если её нет
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'child' CHECK (role IN ('parent', 'child', 'admin')),
  family_id UUID REFERENCES public.families(family_id),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Создаем таблицу tasks если её нет
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'confirmed', 'rejected')),
  
  -- Связи с пользователями и семьей
  assigned_to_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(family_id) ON DELETE CASCADE,
  
  -- Награды (JSON объект)
  reward JSONB DEFAULT '{"stars": 0, "money": 0, "screen_time": 0}',
  
  -- Временные метки
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  
  -- Доказательства и комментарии
  proof_url TEXT, -- URL фото-доказательства
  rejection_reason TEXT, -- Причина отклонения
  
  -- Проверки
  CONSTRAINT tasks_reward_check CHECK (jsonb_typeof(reward) = 'object')
);

-- Создаем таблицу rewards если её нет
CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(family_id) ON DELETE CASCADE,
  
  -- Информация о награде
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('toy', 'activity', 'privilege', 'treat', 'general')),
  
  -- Стоимость обмена
  cost_stars INTEGER DEFAULT 0,
  cost_money DECIMAL(10,2) DEFAULT 0,
  
  -- Доступность
  is_active BOOLEAN DEFAULT true,
  stock_quantity INTEGER, -- NULL = неограниченно
  
  -- Временные метки
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ========================================
-- ЭТАП 1: РЕЗЕРВНОЕ КОПИРОВАНИЕ
-- ========================================

-- Создаем backup существующих данных
CREATE TABLE IF NOT EXISTS public.history_backup AS 
SELECT * FROM public.history;

SELECT 'BACKUP_CREATED' as status, 
       'Создана резервная копия: history_backup' as message;

-- ========================================
-- ЭТАП 2: ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ СТОЛБЦОВ
-- ========================================

DO $$
BEGIN
  -- Переименовываем history_id в id если нужно
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'history_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'id') THEN
    ALTER TABLE public.history RENAME COLUMN history_id TO id;
  END IF;

  -- Переименовываем timestamp в created_at если нужно
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'timestamp')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'created_at') THEN
    ALTER TABLE public.history RENAME COLUMN timestamp TO created_at;
  END IF;

  -- Добавляем family_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'family_id') THEN
    ALTER TABLE public.history ADD COLUMN family_id UUID;
    -- Заполняем family_id из таблицы users
    UPDATE public.history SET family_id = (
      SELECT u.family_id FROM public.users u WHERE u.id = history.user_id LIMIT 1
    ) WHERE family_id IS NULL;
    -- Добавляем NOT NULL constraint после заполнения данных
    ALTER TABLE public.history ALTER COLUMN family_id SET NOT NULL;
  END IF;

  -- Добавляем transaction_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'transaction_type') THEN
    ALTER TABLE public.history ADD COLUMN transaction_type VARCHAR(50) DEFAULT 'task_reward';
    -- Устанавливаем constraint
    ALTER TABLE public.history ADD CONSTRAINT history_transaction_type_check 
    CHECK (transaction_type IN ('task_reward', 'reward_purchase', 'manual_adjustment', 'bonus'));
  END IF;

  -- Добавляем stars_change (конвертируем из reward_earned)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'stars_change') THEN
    ALTER TABLE public.history ADD COLUMN stars_change INTEGER DEFAULT 0;
    -- Копируем данные из reward_earned если столбец существует
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'reward_earned') THEN
      UPDATE public.history SET stars_change = COALESCE(reward_earned, 0);
    END IF;
  END IF;

  -- Добавляем money_change
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'money_change') THEN
    ALTER TABLE public.history ADD COLUMN money_change DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- Добавляем screen_time_change (конвертируем из duration_minutes)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'screen_time_change') THEN
    ALTER TABLE public.history ADD COLUMN screen_time_change INTEGER DEFAULT 0;
    -- Копируем данные из duration_minutes если столбец существует
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'duration_minutes') THEN
      UPDATE public.history SET screen_time_change = COALESCE(duration_minutes, 0);
    END IF;
  END IF;

  -- Добавляем description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'description') THEN
    ALTER TABLE public.history ADD COLUMN description TEXT NOT NULL DEFAULT 'Конвертированная запись';
  END IF;

  -- Добавляем reward_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'reward_id') THEN
    ALTER TABLE public.history ADD COLUMN reward_id UUID;
  END IF;

END $$;

-- ========================================
-- ЭТАП 3: БЕЗОПАСНОЕ ДОБАВЛЕНИЕ ВНЕШНИХ КЛЮЧЕЙ
-- ========================================

DO $$
BEGIN
  -- Добавляем внешний ключ для family_id только если все условия выполнены
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'families')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'family_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'family_id') THEN
    
    ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_family_id_fkey;
    ALTER TABLE public.history 
    ADD CONSTRAINT history_family_id_fkey 
    FOREIGN KEY (family_id) REFERENCES public.families(family_id) ON DELETE CASCADE;
  END IF;

  -- Добавляем внешний ключ для task_id только если все условия выполнены
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'task_id') THEN
    
    ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_task_id_fkey;
    ALTER TABLE public.history 
    ADD CONSTRAINT history_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
  END IF;

  -- Добавляем внешний ключ для reward_id только если все условия выполнены
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rewards')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rewards' AND column_name = 'id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'reward_id') THEN
    
    ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_reward_id_fkey;
    ALTER TABLE public.history 
    ADD CONSTRAINT history_reward_id_fkey 
    FOREIGN KEY (reward_id) REFERENCES public.rewards(id) ON DELETE SET NULL;
  END IF;

  -- Добавляем внешний ключ для user_id (auth.users) - всегда должен существовать
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'user_id') THEN
    ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_user_id_fkey;
    ALTER TABLE public.history 
    ADD CONSTRAINT history_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

END $$;

-- ========================================
-- ЭТАП 4: СОЗДАНИЕ ПРЕДСТАВЛЕНИЯ user_balances
-- ========================================

-- Удаляем старое представление
DROP VIEW IF EXISTS public.user_balances;

-- Создаем новое представление
CREATE VIEW public.user_balances AS
SELECT 
  u.id as user_id,
  u.email,
  u.family_id,
  COALESCE(SUM(h.stars_change), 0) as total_stars,
  COALESCE(SUM(h.money_change), 0) as total_money,
  COALESCE(SUM(h.screen_time_change), 0) as total_screen_time
FROM public.users u
LEFT JOIN public.history h ON u.id = h.user_id
GROUP BY u.id, u.email, u.family_id;

-- ========================================
-- ЭТАП 5: УДАЛЕНИЕ СТАРЫХ СТОЛБЦОВ (ОПЦИОНАЛЬНО)
-- ========================================

-- Раскомментируйте если хотите удалить старые столбцы:
/*
DO $$
BEGIN
  -- Удаляем reward_earned (данные скопированы в stars_change)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'reward_earned') THEN
    ALTER TABLE public.history DROP COLUMN reward_earned;
  END IF;

  -- Удаляем duration_minutes (данные скопированы в screen_time_change)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'duration_minutes') THEN
    ALTER TABLE public.history DROP COLUMN duration_minutes;
  END IF;
END $$;
*/

-- ========================================
-- ЭТАП 6: ФИНАЛЬНАЯ ПРОВЕРКА
-- ========================================

SELECT 'MIGRATION_COMPLETED' as status, 
       'Миграция таблицы history завершена!' as message;

-- Проверка новой структуры
SELECT 'NEW_HISTORY_STRUCTURE' as check_type, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'history'
ORDER BY column_name;

-- Проверка количества записей
SELECT 'DATA_COUNT' as check_type, 
       COUNT(*) as original_count 
FROM public.history_backup;

SELECT 'DATA_COUNT' as check_type, 
       COUNT(*) as migrated_count 
FROM public.history;

-- Проверка представления
SELECT 'VIEW_TEST' as check_type, COUNT(*) as users_with_balances
FROM public.user_balances;

SELECT 'SUCCESS' as final_status, 
       'Таблица history успешно мигрирована! Теперь компонент Tasks.jsx будет работать.' as message;
