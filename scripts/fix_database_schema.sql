-- Исправление схемы базы данных Family Task Manager
-- Версия 3.1 - Исправлены ошибки с внешними ключами к auth.users
-- 
-- Этот скрипт:
-- ✅ Проверяет существующую структуру БД
-- ✅ Добавляет недостающие столбцы безопасно
-- ✅ Исправляет конфликты в представлениях
-- ✅ Создает корректные таблицы и связи
-- ✅ Убраны внешние ключи к auth.users (безопасность через RLS)

-- ========================================
-- ЭТАП 1: ПРОВЕРКА И СОЗДАНИЕ БАЗОВЫХ ТАБЛИЦ
-- ========================================

-- 1.1) Создание таблицы families если её нет
CREATE TABLE IF NOT EXISTS public.families (
  family_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 1.2) Создание таблицы users если её нет
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'child' CHECK (role IN ('parent', 'child', 'admin')),
  family_id UUID REFERENCES public.families(family_id),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ========================================
-- ЭТАП 2: ИСПРАВЛЕНИЕ ТАБЛИЦЫ HISTORY
-- ========================================

-- 2.1) Создание таблицы history с правильной структурой
CREATE TABLE IF NOT EXISTS public.history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  family_id UUID NOT NULL REFERENCES public.families(family_id) ON DELETE CASCADE,
  
  -- Тип транзакции
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('task_reward', 'reward_purchase', 'manual_adjustment', 'bonus')),
  
  -- Описание и метки времени
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2.2) Добавление недостающих столбцов в таблицу history
DO $$
BEGIN
  -- Добавляем stars_change если его нет
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'stars_change'
  ) THEN
    ALTER TABLE public.history ADD COLUMN stars_change INTEGER DEFAULT 0;
  END IF;

  -- Добавляем money_change если его нет
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'money_change'
  ) THEN
    ALTER TABLE public.history ADD COLUMN money_change DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- Добавляем screen_time_change если его нет
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'screen_time_change'
  ) THEN
    ALTER TABLE public.history ADD COLUMN screen_time_change INTEGER DEFAULT 0;
  END IF;

  -- Добавляем task_id если его нет
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'task_id'
  ) THEN
    ALTER TABLE public.history ADD COLUMN task_id UUID;
  END IF;

  -- Добавляем reward_id если его нет
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'reward_id'
  ) THEN
    ALTER TABLE public.history ADD COLUMN reward_id UUID;
  END IF;
END $$;

-- ========================================
-- ЭТАП 3: СОЗДАНИЕ ОСТАЛЬНЫХ ТАБЛИЦ
-- ========================================

-- 3.1) Создание таблицы tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'confirmed', 'rejected')),
  
  -- Связи с пользователями и семьей (без внешних ключей к auth.users)
  assigned_to_id UUID NOT NULL,
  assigned_by_id UUID NOT NULL,
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

-- 3.2) Создание таблицы rewards
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
-- ЭТАП 4: БЕЗОПАСНОЕ СОЗДАНИЕ ВНЕШНИХ КЛЮЧЕЙ
-- ========================================

DO $$
BEGIN
  -- Добавляем внешний ключ для task_id только если все условия выполнены
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'history')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'task_id') THEN
    
    -- Удаляем существующий constraint если есть
    ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_task_id_fkey;
    -- Добавляем новый constraint
    ALTER TABLE public.history 
    ADD CONSTRAINT history_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
  END IF;

  -- Добавляем внешний ключ для reward_id только если все условия выполнены
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rewards')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'history')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rewards' AND column_name = 'id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'reward_id') THEN
    
    -- Удаляем существующий constraint если есть
    ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_reward_id_fkey;
    -- Добавляем новый constraint
    ALTER TABLE public.history 
    ADD CONSTRAINT history_reward_id_fkey 
    FOREIGN KEY (reward_id) REFERENCES public.rewards(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================================
-- ЭТАП 5: ИСПРАВЛЕНИЕ ПРЕДСТАВЛЕНИЙ
-- ========================================

-- 5.1) Пересоздание представления user_balances с проверкой столбцов
DO $$
BEGIN
  -- Удаляем старое представление если существует
  DROP VIEW IF EXISTS public.user_balances;
  
  -- Создаем новое представление только если все столбцы существуют
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'stars_change')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'money_change')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'screen_time_change') THEN
    
    EXECUTE '
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
    GROUP BY u.id, u.email, u.family_id';
  END IF;
END $$;

-- ========================================
-- ЭТАП 6: ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ
-- ========================================

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tasks_family ON public.tasks(family_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_history_user ON public.history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_family ON public.history(family_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON public.history(created_at);

CREATE INDEX IF NOT EXISTS idx_rewards_family ON public.rewards(family_id);
CREATE INDEX IF NOT EXISTS idx_rewards_active ON public.rewards(is_active);

-- ========================================
-- ЭТАП 7: RLS ПОЛИТИКИ
-- ========================================

-- 7.1) RLS политики для таблицы tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Удаляем существующие политики
DROP POLICY IF EXISTS "tasks_select_family_members" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_parents" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_assignee_or_creator" ON public.tasks;

-- Создаем новые политики
CREATE POLICY "tasks_select_family_members" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = public.tasks.family_id
    )
  );

CREATE POLICY "tasks_insert_parents" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = public.tasks.family_id AND u.role = 'parent'
    )
  );

CREATE POLICY "tasks_update_assignee_or_creator" ON public.tasks
  FOR UPDATE TO authenticated
  USING (auth.uid() = assigned_to_id OR auth.uid() = assigned_by_id)
  WITH CHECK (auth.uid() = assigned_to_id OR auth.uid() = assigned_by_id);

-- 7.2) RLS политики для таблицы history
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "history_select_family_members" ON public.history;
DROP POLICY IF EXISTS "history_insert_system" ON public.history;

CREATE POLICY "history_select_family_members" ON public.history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = public.history.family_id
    )
  );

CREATE POLICY "history_insert_system" ON public.history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = public.history.family_id
    )
  );

-- 7.3) RLS политики для таблицы rewards
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rewards_select_family_members" ON public.rewards;
DROP POLICY IF EXISTS "rewards_manage_parents" ON public.rewards;

CREATE POLICY "rewards_select_family_members" ON public.rewards
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = public.rewards.family_id
    )
  );

CREATE POLICY "rewards_manage_parents" ON public.rewards
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = public.rewards.family_id AND u.role = 'parent'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = public.rewards.family_id AND u.role = 'parent'
    )
  );

-- ========================================
-- ЭТАП 8: ТРИГГЕРЫ И ФУНКЦИИ
-- ========================================

-- 8.1) Функция для автоматического начисления наград
CREATE OR REPLACE FUNCTION public.handle_task_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Проверяем, что статус изменился на 'confirmed'
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    -- Добавляем запись в историю транзакций
    INSERT INTO public.history (
      user_id,
      family_id,
      transaction_type,
      stars_change,
      money_change,
      screen_time_change,
      task_id,
      description
    ) VALUES (
      NEW.assigned_to_id,
      NEW.family_id,
      'task_reward',
      COALESCE((NEW.reward->>'stars')::INTEGER, 0),
      COALESCE((NEW.reward->>'money')::DECIMAL, 0),
      COALESCE((NEW.reward->>'screen_time')::INTEGER, 0),
      NEW.id,
      'Награда за выполнение задачи: ' || NEW.title
    );
    
    -- Обновляем время подтверждения
    NEW.confirmed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- 8.2) Триггер для автоматического начисления наград
DROP TRIGGER IF EXISTS trigger_task_confirmation ON public.tasks;
CREATE TRIGGER trigger_task_confirmation
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_confirmation();

-- 8.3) Функция для обновления updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 8.4) Триггер для обновления updated_at в rewards
DROP TRIGGER IF EXISTS trigger_rewards_updated_at ON public.rewards;
CREATE TRIGGER trigger_rewards_updated_at
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- ЭТАП 9: ФИНАЛЬНАЯ ДИАГНОСТИКА И ПРОВЕРКА
-- ========================================

SELECT 'SCHEMA_FIX_COMPLETED' as status, 
       'Схема базы данных исправлена!' as message;

-- Проверка созданных таблиц
SELECT 'TABLES_CHECK' as check_type, table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('families', 'users', 'tasks', 'rewards', 'history')
ORDER BY table_name;

-- Проверка столбцов в таблице history
SELECT 'HISTORY_COLUMNS' as check_type, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'history'
ORDER BY column_name;

-- Проверка столбцов в таблице tasks  
SELECT 'TASKS_COLUMNS' as check_type, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'tasks'
ORDER BY column_name;

-- Проверка внешних ключей
SELECT 'FOREIGN_KEYS_STATUS' as check_type,
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema='public'
  AND tc.table_name IN ('history', 'tasks', 'rewards')
ORDER BY tc.table_name, kcu.column_name;

-- Проверка представления user_balances
SELECT 'VIEW_CHECK' as check_type, table_name
FROM information_schema.views 
WHERE table_schema = 'public' AND table_name = 'user_balances';
