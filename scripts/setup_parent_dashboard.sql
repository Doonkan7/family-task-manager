-- Настройка базы данных для компонента ParentDashboard.jsx
-- Скрипт проверяет и дополняет права доступа для родителей
-- 
-- ⚠️ ВАЖНО: Выполните СНАЧАЛА основную схему БД!
-- Если таблица tasks не существует, выполните перед этим скриптом:
-- 1. scripts/migrate_history_table.sql (если есть старые данные)
-- ИЛИ
-- 2. scripts/fix_database_schema.sql (для новой установки)
--
-- Функционал родительской панели:
-- ✅ Создание новых задач для детей семьи
-- ✅ Просмотр всех задач семьи
-- ✅ Подтверждение/отклонение выполненных задач  
-- ✅ Просмотр списка детей семьи
-- ✅ Просмотр фото-доказательств выполнения
-- ✅ Автоматическое начисление наград при подтверждении

-- ========================================
-- ЭТАП 1: ПРОВЕРКА СУЩЕСТВУЮЩИХ ПОЛИТИК
-- ========================================

-- Проверяем какие политики RLS уже настроены
SELECT 'EXISTING_POLICIES' as check_type, 
       tablename, policyname, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('tasks', 'users', 'history', 'rewards')
ORDER BY tablename, policyname;

-- ========================================
-- ЭТАП 2: СОЗДАНИЕ ДОПОЛНИТЕЛЬНЫХ ПОЛИТИК ДЛЯ РОДИТЕЛЕЙ
-- ========================================

-- Политика для родителей: просмотр всех детей семьи
DROP POLICY IF EXISTS "parents_can_view_family_children" ON public.users;
CREATE POLICY "parents_can_view_family_children" ON public.users
  FOR SELECT TO authenticated
  USING (
    -- Родители могут видеть детей из своей семьи
    EXISTS (
      SELECT 1 FROM public.users parent
      WHERE parent.id = auth.uid() 
        AND parent.role = 'parent'
        AND parent.family_id = users.family_id
        AND users.role = 'child'
    )
  );

-- Политика для родителей: обновление статуса задач на confirmed/rejected
DROP POLICY IF EXISTS "parents_can_confirm_reject_tasks" ON public.tasks;
CREATE POLICY "parents_can_confirm_reject_tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    -- Родители могут подтверждать/отклонять задачи в своей семье
    EXISTS (
      SELECT 1 FROM public.users parent
      WHERE parent.id = auth.uid() 
        AND parent.role = 'parent'
        AND parent.family_id = tasks.family_id
    )
  )
  WITH CHECK (
    -- Разрешаем только изменение на confirmed/rejected и причины отклонения
    EXISTS (
      SELECT 1 FROM public.users parent
      WHERE parent.id = auth.uid() 
        AND parent.role = 'parent'
        AND parent.family_id = tasks.family_id
    )
    AND status IN ('confirmed', 'rejected')
  );

-- Политика для родителей: создание записей в истории
DROP POLICY IF EXISTS "parents_can_create_history" ON public.history;
CREATE POLICY "parents_can_create_history" ON public.history
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Родители могут создавать записи в истории для своей семьи
    EXISTS (
      SELECT 1 FROM public.users parent
      WHERE parent.id = auth.uid() 
        AND parent.role = 'parent'
        AND parent.family_id = history.family_id
    )
  );

-- ========================================
-- ЭТАП 3: УЛУЧШЕНИЕ ФУНКЦИИ НАЧИСЛЕНИЯ НАГРАД
-- ========================================

-- Обновляем функцию подтверждения задач для лучшей работы с родительской панелью
CREATE OR REPLACE FUNCTION public.handle_task_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Проверяем, что статус изменился на 'confirmed'
  IF NEW.status = 'confirmed' AND OLD.status = 'completed' THEN
    -- Добавляем запись в историю транзакций только если есть награда
    IF (NEW.reward->>'stars')::INTEGER > 0 
       OR (NEW.reward->>'money')::DECIMAL > 0 
       OR (NEW.reward->>'screen_time')::INTEGER > 0 THEN
      
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
    END IF;
    
    -- Обновляем время подтверждения
    NEW.confirmed_at = NOW();
    
  -- Если статус изменился на 'rejected' - сбрасываем на pending
  ELSIF NEW.status = 'rejected' AND OLD.status = 'completed' THEN
    NEW.status = 'pending';  -- Возвращаем задачу в начальное состояние
    NEW.completed_at = NULL; -- Очищаем время завершения
    NEW.proof_url = NULL;    -- Удаляем старое доказательство
  END IF;
  
  RETURN NEW;
END;
$$;

-- Пересоздаем триггер
DROP TRIGGER IF EXISTS trigger_task_confirmation ON public.tasks;
CREATE TRIGGER trigger_task_confirmation
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_confirmation();

-- ========================================
-- ЭТАП 4: БЕЗОПАСНОЕ СОЗДАНИЕ ПРЕДСТАВЛЕНИЯ ДЛЯ СТАТИСТИКИ СЕМЬИ
-- ========================================

-- Проверяем существование таблицы tasks перед созданием представления
DO $$
BEGIN
  -- Удаляем старое представление если существует
  DROP VIEW IF EXISTS public.family_statistics;
  
  -- Создаем представление только если таблица tasks существует и имеет нужные столбцы
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'status')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'family_id') THEN
    
    -- Создаем полное представление со статистикой задач
    EXECUTE '
    CREATE VIEW public.family_statistics AS
    SELECT 
      f.family_id,
      f.family_name,
      
      -- Статистика детей
      COUNT(DISTINCT CASE WHEN u.role = ''child'' THEN u.id END) as children_count,
      
      -- Статистика задач
      COUNT(DISTINCT CASE WHEN t.status = ''pending'' THEN t.id END) as pending_tasks,
      COUNT(DISTINCT CASE WHEN t.status = ''in_progress'' THEN t.id END) as active_tasks,
      COUNT(DISTINCT CASE WHEN t.status = ''completed'' THEN t.id END) as completed_tasks,
      COUNT(DISTINCT CASE WHEN t.status = ''confirmed'' THEN t.id END) as confirmed_tasks,
      COUNT(DISTINCT CASE WHEN t.status = ''rejected'' THEN t.id END) as rejected_tasks,
      
      -- Общие награды начисленные
      COALESCE(SUM(CASE WHEN t.status = ''confirmed'' THEN (t.reward->>''stars'')::INTEGER END), 0) as total_stars_awarded,
      COALESCE(SUM(CASE WHEN t.status = ''confirmed'' THEN (t.reward->>''money'')::DECIMAL END), 0) as total_money_awarded,
      COALESCE(SUM(CASE WHEN t.status = ''confirmed'' THEN (t.reward->>''screen_time'')::INTEGER END), 0) as total_screen_time_awarded

    FROM public.families f
    LEFT JOIN public.users u ON f.family_id = u.family_id
    LEFT JOIN public.tasks t ON f.family_id = t.family_id
    GROUP BY f.family_id, f.family_name';
    
  ELSE
    -- Создаем упрощенное представление без статистики задач
    EXECUTE '
    CREATE VIEW public.family_statistics AS
    SELECT 
      f.family_id,
      f.family_name,
      
      -- Статистика детей
      COUNT(DISTINCT CASE WHEN u.role = ''child'' THEN u.id END) as children_count,
      
      -- Заглушки для статистики задач
      0 as pending_tasks,
      0 as active_tasks,
      0 as completed_tasks,
      0 as confirmed_tasks,
      0 as rejected_tasks,
      
      -- Заглушки для наград
      0 as total_stars_awarded,
      0 as total_money_awarded,
      0 as total_screen_time_awarded

    FROM public.families f
    LEFT JOIN public.users u ON f.family_id = u.family_id
    GROUP BY f.family_id, f.family_name';
    
  END IF;
  
  -- Настраиваем RLS для представления
  ALTER VIEW public.family_statistics SET (security_barrier = true);
  GRANT SELECT ON public.family_statistics TO authenticated;
  
END $$;

-- ========================================
-- ЭТАП 5: СОЗДАНИЕ ИНДЕКСОВ ДЛЯ ОПТИМИЗАЦИИ
-- ========================================

-- Индексы для быстрого поиска задач родителями
CREATE INDEX IF NOT EXISTS idx_tasks_family_status ON public.tasks(family_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.tasks(assigned_by_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON public.tasks(completed_at) WHERE status = 'completed';

-- Индексы для просмотра детей семьи
CREATE INDEX IF NOT EXISTS idx_users_family_role ON public.users(family_id, role);

-- ========================================
-- ЭТАП 6: ПРОВЕРКА STORAGE BUCKET ДЛЯ ФОТО
-- ========================================

-- Проверяем существование bucket для фото-доказательств
SELECT 'STORAGE_BUCKET_CHECK' as check_type, 
       CASE 
         WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'task-proofs') 
         THEN 'task-proofs bucket существует ✅'
         ELSE 'task-proofs bucket ОТСУТСТВУЕТ ❌ - нужно создать вручную'
       END as status;

-- ========================================
-- ЭТАП 7: ФИНАЛЬНАЯ ПРОВЕРКА ДОСТУПОВ
-- ========================================

-- Проверяем все политики после обновления
SELECT 'UPDATED_POLICIES' as check_type,
       tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('tasks', 'users', 'history')
  AND (policyname LIKE '%parent%' OR policyname LIKE '%confirm%')
ORDER BY tablename, policyname;

-- Проверяем права на представления
SELECT 'VIEWS_CHECK' as check_type, table_name
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name IN ('user_balances', 'family_statistics')
ORDER BY table_name;

-- Финальное сообщение
SELECT 'PARENT_SETUP_COMPLETED' as status, 
       'Настройка родительского функционала завершена!' as message;

-- ========================================
-- ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ
-- ========================================

/*
ВАЖНО: После выполнения этого скрипта убедитесь что:

1. 📦 Storage Bucket создан:
   - Перейдите в Storage → Buckets
   - Создайте bucket 'task-proofs' если его нет
   - Включите Public Access

2. 🔐 Политики Storage настроены:
   - Разрешите upload для authenticated пользователей
   - Разрешите read для всех (для просмотра фото)

3. 👤 Тестовые данные (опционально):
   - Создайте тестового родителя с role = 'parent'
   - Создайте тестового ребенка с role = 'child'
   - Назначьте им одинаковый family_id

4. 📊 Проверка функционала:
   - Войдите как родитель
   - Создайте задачу для ребенка
   - Войдите как ребенок, выполните задачу
   - Войдите как родитель, подтвердите задачу
   - Проверьте начисление наград в таблице history

Компонент ParentDashboard.jsx готов к работе! 🎉
*/
