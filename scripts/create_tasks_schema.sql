-- Схема базы данных для системы задач Family Task Manager
-- Версия 2.1 - Исправлены проблемы с внешними ключами и зависимостями
-- Создание таблиц: tasks, rewards, history и настройка Supabase Storage
--
-- Исправления в версии 2.1:
-- ✅ Убран IF NOT EXISTS для политик RLS
-- ✅ Добавлена проверка и создание столбца reward_id
-- ✅ Безопасное создание constraints с проверками
-- ✅ Автоматическое создание зависимых таблиц families и users
-- ✅ Проверка существования всех необходимых столбцов

-- 0) Проверяем и создаем зависимые таблицы если их нет
-- Таблица families должна существовать для корректной работы
CREATE TABLE IF NOT EXISTS public.families (
  family_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Таблица users должна существовать для корректной работы  
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'child' CHECK (role IN ('parent', 'child', 'admin')),
  family_id UUID REFERENCES public.families(family_id),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 1) Создание таблицы для задач (tasks)
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
  
  -- Индексы
  CONSTRAINT tasks_reward_check CHECK (jsonb_typeof(reward) = 'object')
);

-- 2) Создание таблицы для истории транзакций (history)
CREATE TABLE IF NOT EXISTS public.history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(family_id) ON DELETE CASCADE,
  
  -- Тип транзакции
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('task_reward', 'reward_purchase', 'manual_adjustment', 'bonus')),
  
  -- Изменения баланса
  stars_change INTEGER DEFAULT 0,
  money_change DECIMAL(10,2) DEFAULT 0,
  screen_time_change INTEGER DEFAULT 0, -- в минутах
  
  -- Связи
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  reward_id UUID, -- будет ссылка на таблицу rewards
  
  -- Описание и метки времени
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3) Создание таблицы для доступных наград (rewards)
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

-- 4) Добавляем столбец reward_id и внешний ключ в таблицу history
-- Проверяем что таблицы существуют и добавляем столбец и constraint
DO $$
BEGIN
  -- Проверяем что обе таблицы существуют и имеют нужные столбцы
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'history')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rewards')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rewards' AND column_name = 'id') THEN
    
    -- Добавляем столбец reward_id в таблицу history если его нет
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'history' 
        AND column_name = 'reward_id'
    ) THEN
      ALTER TABLE public.history ADD COLUMN reward_id UUID;
    END IF;
    
    -- Удаляем constraint если уже существует
    ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_reward_id_fkey;
    
    -- Добавляем новый constraint только если у нас есть все нужные столбцы
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'history' AND column_name = 'reward_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rewards' AND column_name = 'id') THEN
      
      ALTER TABLE public.history 
      ADD CONSTRAINT history_reward_id_fkey 
      FOREIGN KEY (reward_id) REFERENCES public.rewards(id) ON DELETE SET NULL;
    END IF;
    
  END IF;
END $$;

-- 5) Создание представления для баланса пользователей
CREATE OR REPLACE VIEW public.user_balances AS
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

-- 6) Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tasks_family ON public.tasks(family_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_history_user ON public.history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_family ON public.history(family_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON public.history(created_at);

CREATE INDEX IF NOT EXISTS idx_rewards_family ON public.rewards(family_id);
CREATE INDEX IF NOT EXISTS idx_rewards_active ON public.rewards(is_active);

-- 7) RLS политики для таблицы tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Удаляем существующие политики если есть
DROP POLICY IF EXISTS "tasks_select_family_members" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_parents" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_assignee_or_creator" ON public.tasks;

-- Политика для чтения задач: пользователи могут видеть задачи из своей семьи
CREATE POLICY "tasks_select_family_members" ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
        AND u.family_id = public.tasks.family_id
    )
  );

-- Политика для создания задач: только родители могут создавать задачи
CREATE POLICY "tasks_insert_parents" ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
        AND u.family_id = public.tasks.family_id
        AND u.role = 'parent'
    )
  );

-- Политика для обновления задач: создатель или исполнитель могут обновлять
CREATE POLICY "tasks_update_assignee_or_creator" ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = assigned_to_id OR auth.uid() = assigned_by_id
  )
  WITH CHECK (
    auth.uid() = assigned_to_id OR auth.uid() = assigned_by_id
  );

-- 8) RLS политики для таблицы history
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

-- Удаляем существующие политики если есть
DROP POLICY IF EXISTS "history_select_family_members" ON public.history;
DROP POLICY IF EXISTS "history_insert_system" ON public.history;

CREATE POLICY "history_select_family_members" ON public.history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
        AND u.family_id = public.history.family_id
    )
  );

CREATE POLICY "history_insert_system" ON public.history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
        AND u.family_id = public.history.family_id
    )
  );

-- 9) RLS политики для таблицы rewards
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Удаляем существующие политики если есть
DROP POLICY IF EXISTS "rewards_select_family_members" ON public.rewards;
DROP POLICY IF EXISTS "rewards_manage_parents" ON public.rewards;

CREATE POLICY "rewards_select_family_members" ON public.rewards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
        AND u.family_id = public.rewards.family_id
    )
  );

CREATE POLICY "rewards_manage_parents" ON public.rewards
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
        AND u.family_id = public.rewards.family_id
        AND u.role = 'parent'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
        AND u.family_id = public.rewards.family_id
        AND u.role = 'parent'
    )
  );

-- 10) Функция для автоматического начисления наград при подтверждении задачи
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

-- Создаем триггер для автоматического начисления наград
DROP TRIGGER IF EXISTS trigger_task_confirmation ON public.tasks;
CREATE TRIGGER trigger_task_confirmation
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_confirmation();

-- 11) Функция для обновления updated_at в таблице rewards
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_rewards_updated_at
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 12) Настройка Supabase Storage bucket для фото-доказательств
-- ВАЖНО: Создайте bucket вручную через Supabase Dashboard:
-- 1. Storage → Buckets → New bucket
-- 2. Name: task-proofs
-- 3. Public: ✅ enabled
-- 4. Затем примените политики Storage из setup_instructions.md

-- 13) Создание демонстрационных данных (опционально)
-- Раскомментировать для создания тестовых данных

/*
-- Пример создания награды
INSERT INTO public.rewards (family_id, title, description, category, cost_stars, cost_money)
VALUES (
  (SELECT family_id FROM public.families LIMIT 1),
  'Дополнительный час за компьютером',
  'Можно играть на компьютере на 1 час дольше обычного',
  'privilege',
  10,
  0
);

-- Пример создания задачи
INSERT INTO public.tasks (
  title, 
  description, 
  priority, 
  assigned_to_id, 
  assigned_by_id, 
  family_id, 
  reward,
  due_date
) VALUES (
  'Убрать комнату',
  'Убрать игрушки, застелить кровать, пропылесосить',
  'medium',
  (SELECT id FROM public.users WHERE role = 'child' LIMIT 1),
  (SELECT id FROM public.users WHERE role = 'parent' LIMIT 1),
  (SELECT family_id FROM public.families LIMIT 1),
  '{"stars": 5, "money": 50, "screen_time": 30}',
  NOW() + INTERVAL '7 days'
);
*/

-- Завершение
SELECT 'Схема для системы задач успешно создана!' as result;
