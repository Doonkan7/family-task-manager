-- Чистая установка базы данных Family Task Manager
-- Версия 1.0 - Простая и надежная установка
-- 
-- ⚠️ ВНИМАНИЕ: Этот скрипт УДАЛЯЕТ существующие таблицы!
-- Используйте только если нет важных данных или для новой установки

-- ========================================
-- ЭТАП 1: УДАЛЕНИЕ СУЩЕСТВУЮЩИХ ТАБЛИЦ
-- ========================================

-- Удаляем представления
DROP VIEW IF EXISTS public.user_balances CASCADE;
DROP VIEW IF EXISTS public.family_statistics CASCADE;

-- Удаляем таблицы в правильном порядке (учитывая зависимости)
DROP TABLE IF EXISTS public.history CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.rewards CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.families CASCADE;

-- Удаляем функции и триггеры
DROP FUNCTION IF EXISTS public.handle_task_confirmation() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

SELECT 'CLEANUP_COMPLETED' as status, 'Старые таблицы удалены' as message;

-- ========================================
-- ЭТАП 2: СОЗДАНИЕ БАЗОВЫХ ТАБЛИЦ
-- ========================================

-- 2.1) Таблица семей
CREATE TABLE public.families (
  family_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2.2) Таблица пользователей
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'child' CHECK (role IN ('parent', 'child', 'admin')),
  family_id UUID REFERENCES public.families(family_id) ON DELETE SET NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2.3) Таблица задач
CREATE TABLE public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'confirmed', 'rejected')),
  
  -- Связи с пользователями и семьей
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
  proof_url TEXT,
  rejection_reason TEXT,
  
  -- Проверки
  CONSTRAINT tasks_reward_check CHECK (jsonb_typeof(reward) = 'object')
);

-- 2.4) Таблица наград
CREATE TABLE public.rewards (
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
  stock_quantity INTEGER,
  
  -- Временные метки
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2.5) Таблица истории транзакций
CREATE TABLE public.history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  family_id UUID NOT NULL REFERENCES public.families(family_id) ON DELETE CASCADE,
  
  -- Тип транзакции
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('task_reward', 'reward_purchase', 'manual_adjustment', 'bonus')),
  
  -- Изменения баланса
  stars_change INTEGER DEFAULT 0,
  money_change DECIMAL(10,2) DEFAULT 0,
  screen_time_change INTEGER DEFAULT 0,
  
  -- Связи
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL,
  
  -- Описание и метки времени
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

SELECT 'TABLES_CREATED' as status, 'Все основные таблицы созданы' as message;

-- ========================================
-- ЭТАП 3: СОЗДАНИЕ ПРЕДСТАВЛЕНИЙ
-- ========================================

-- 3.1) Представление балансов пользователей
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

-- 3.2) Представление статистики семьи
CREATE VIEW public.family_statistics AS
SELECT 
  f.family_id,
  f.family_name,
  
  -- Статистика детей
  COUNT(DISTINCT CASE WHEN u.role = 'child' THEN u.id END) as children_count,
  
  -- Статистика задач
  COUNT(DISTINCT CASE WHEN t.status = 'pending' THEN t.id END) as pending_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as active_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'confirmed' THEN t.id END) as confirmed_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'rejected' THEN t.id END) as rejected_tasks,
  
  -- Общие награды начисленные
  COALESCE(SUM(CASE WHEN t.status = 'confirmed' THEN (t.reward->>'stars')::INTEGER END), 0) as total_stars_awarded,
  COALESCE(SUM(CASE WHEN t.status = 'confirmed' THEN (t.reward->>'money')::DECIMAL END), 0) as total_money_awarded,
  COALESCE(SUM(CASE WHEN t.status = 'confirmed' THEN (t.reward->>'screen_time')::INTEGER END), 0) as total_screen_time_awarded

FROM public.families f
LEFT JOIN public.users u ON f.family_id = u.family_id
LEFT JOIN public.tasks t ON f.family_id = t.family_id
GROUP BY f.family_id, f.family_name;

SELECT 'VIEWS_CREATED' as status, 'Представления созданы' as message;

-- ========================================
-- ЭТАП 4: СОЗДАНИЕ ИНДЕКСОВ
-- ========================================

CREATE INDEX idx_users_family_role ON public.users(family_id, role);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to_id);
CREATE INDEX idx_tasks_family_status ON public.tasks(family_id, status);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_history_user ON public.history(user_id);
CREATE INDEX idx_history_family ON public.history(family_id);
CREATE INDEX idx_rewards_family ON public.rewards(family_id);

SELECT 'INDEXES_CREATED' as status, 'Индексы созданы' as message;

-- ========================================
-- ЭТАП 5: НАСТРОЙКА RLS ПОЛИТИК
-- ========================================

-- 5.1) RLS для таблицы users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_or_family" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR 
    (family_id IS NOT NULL AND family_id IN (
      SELECT family_id FROM public.users WHERE id = auth.uid()
    ))
  );

CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 5.2) RLS для таблицы tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_family" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "tasks_insert_parents" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'parent' AND family_id = tasks.family_id
    )
  );

CREATE POLICY "tasks_update_participants" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    assigned_to_id = auth.uid() OR assigned_by_id = auth.uid()
  );

-- 5.3) RLS для таблицы history
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history_select_family" ON public.history
  FOR SELECT TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "history_insert_system" ON public.history
  FOR INSERT TO authenticated
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM public.users WHERE id = auth.uid()
    )
  );

-- 5.4) RLS для таблицы rewards
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rewards_select_family" ON public.rewards
  FOR SELECT TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "rewards_manage_parents" ON public.rewards
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'parent' AND family_id = rewards.family_id
    )
  );

-- 5.5) RLS для таблицы families
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "families_select_members" ON public.families
  FOR SELECT TO authenticated
  USING (
    family_id IN (
      SELECT family_id FROM public.users WHERE id = auth.uid()
    )
  );

SELECT 'RLS_POLICIES_CREATED' as status, 'RLS политики настроены' as message;

-- ========================================
-- ЭТАП 6: СОЗДАНИЕ ФУНКЦИЙ И ТРИГГЕРОВ
-- ========================================

-- 6.1) Функция для автоматического начисления наград
CREATE FUNCTION public.handle_task_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Проверяем, что статус изменился на 'confirmed'
  IF NEW.status = 'confirmed' AND OLD.status = 'completed' THEN
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

-- 6.2) Триггер для автоматического начисления наград
CREATE TRIGGER trigger_task_confirmation
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_confirmation();

-- 6.3) Функция для обновления updated_at
CREATE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 6.4) Триггер для обновления updated_at в rewards
CREATE TRIGGER trigger_rewards_updated_at
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

SELECT 'TRIGGERS_CREATED' as status, 'Функции и триггеры созданы' as message;

-- ========================================
-- ЭТАП 7: ФИНАЛЬНАЯ ПРОВЕРКА
-- ========================================

-- Проверяем созданные таблицы
SELECT 'TABLES_CHECK' as check_type, table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('families', 'users', 'tasks', 'rewards', 'history')
ORDER BY table_name;

-- Проверяем представления
SELECT 'VIEWS_CHECK' as check_type, table_name
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name IN ('user_balances', 'family_statistics')
ORDER BY table_name;

-- Проверяем функции
SELECT 'FUNCTIONS_CHECK' as check_type, routine_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('handle_task_confirmation', 'update_updated_at_column')
ORDER BY routine_name;

-- Финальное сообщение
SELECT 'CLEAN_INSTALL_COMPLETED' as status, 
       'Чистая установка БД завершена успешно! 🎉' as message;

-- ========================================
-- СЛЕДУЮЩИЕ ШАГИ
-- ========================================

/*
ВАЖНО: После выполнения этого скрипта:

1. 📦 Создайте Storage Bucket:
   - Storage → Buckets → New bucket
   - Name: task-proofs
   - Public: ✅ включить

2. 🔐 Настройте Storage политики:
   - Upload: auth.role() = 'authenticated'
   - Select: bucket_id = 'task-proofs'

3. 👤 Создайте тестовых пользователей:
   - Зарегистрируйтесь как родитель
   - Зарегистрируйтесь как ребенок
   - Назначьте им одинаковый family_id

4. 🚀 Готово к использованию:
   - Tasks.jsx будет работать
   - ParentDashboard.jsx будет работать
   - Все функции доступны

База данных готова! 🎉
*/
