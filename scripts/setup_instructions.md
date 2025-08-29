# Инструкция по настройке базы данных для системы задач

## 🚀 Что было реализовано

✅ **Компонент Tasks.jsx** - полнофункциональная система управления задачами
✅ **Загрузка фото-доказательств** - интеграция с Supabase Storage
✅ **Изменение статусов задач** - полный цикл жизни задачи
✅ **Mobile-first дизайн** - адаптивный интерфейс
✅ **Анимации и переходы** - плавные интерактивные элементы
✅ **Интеграция с системой семей** - полная совместимость с существующей архитектурой

## 📝 Функционал компонента Tasks.jsx

### Основные возможности:
- 📋 Отображение задач, назначенных текущему пользователю
- 🎯 Управление статусами задач (pending → in_progress → completed → confirmed/rejected)
- 📸 Загрузка фото-доказательств выполнения задач
- 🎁 Отображение системы наград (звездочки, деньги, экранное время)
- ⚡ Real-time обновления через подписки Supabase
- 📱 Полностью адаптивный дизайн
- 🎨 Minecraft/Roblox стилизация

### Статусы задач:
- **pending** - Ожидает выполнения
- **in_progress** - В процессе выполнения
- **completed** - Выполнена, ожидает подтверждения родителем
- **confirmed** - Подтверждена родителем, награда начислена
- **rejected** - Отклонена родителем с указанием причины

## 🗄️ Ревизия и настройка Supabase для системы задач

### ⚠️ ВАЖНО: При ошибках с отсутствующими столбцами - проведите ревизию БД

**Если у вас ошибки типа "column does not exist" - используйте план ревизии ниже!**

### 🔍 ПЛАН А: Ревизия существующей БД (при ошибках столбцов)

**Шаг 1: Диагностика текущего состояния**
1. Откройте Supabase Dashboard → **SQL Editor**
2. Выполните скрипт `scripts/database_audit.sql`
3. Изучите результаты - какие таблицы и столбцы уже есть

**Шаг 2: Выберите подходящий скрипт исправления:**

**📊 Если таблица `history` имеет НЕПРАВИЛЬНУЮ структуру** (например: `history_id`, `reward_earned`, `duration_minutes`):
```sql
-- Выполните МИГРАЦИЮ (безопасно сохраняет данные):
-- Скопируйте и выполните: scripts/migrate_history_table.sql
```

**🆕 Если таблицы отсутствуют или имеют правильную структуру:**
```sql
-- Выполните ПОЛНОЕ ИСПРАВЛЕНИЕ:
-- Скопируйте и выполните: scripts/fix_database_schema.sql
```

**Шаг 3: Проверка результата**
```sql
-- Проверьте что все столбцы на месте:
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'history'
ORDER BY column_name;
-- Должны быть: created_at, description, family_id, id, money_change, 
-- reward_id, screen_time_change, stars_change, task_id, transaction_type, user_id
```

### 📋 ПЛАН Б: Чистая установка (для новых проектов)

Следуйте этим шагам **точно в указанном порядке**:

### Шаг 1: Примените SQL-схему базы данных

1. Откройте Supabase Dashboard → **SQL Editor**
2. Создайте новый запрос
3. Скопируйте **ВЕСЬ** контент из файла `scripts/create_tasks_schema.sql`
4. Нажмите **Run** для выполнения

**Что создается:**
- ✅ Таблицы: `tasks`, `rewards`, `history`
- ✅ RLS политики безопасности
- ✅ Индексы для производительности  
- ✅ Триггеры для автоматического начисления наград
- ✅ Представление `user_balances`

**Проверка успешного выполнения:**
```sql
-- Выполните этот запрос для проверки:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tasks', 'rewards', 'history');
-- Должно вернуть 3 строки
```

### Шаг 2: Создайте Storage bucket для фото-доказательств

1. **Перейдите в Storage:**
   - Откройте Supabase Dashboard
   - Нажмите **Storage** в левом меню
   - Перейдите на вкладку **Buckets**

2. **Создайте новый bucket:**
   - Нажмите **New bucket**
   - **Bucket name:** `task-proofs` (точно как указано!)
   - **Public:** ✅ включите (обязательно!)
   - Нажмите **Create bucket**

3. **Настройте автоудаление (опционально):**
   - Перейдите в настройки bucket
   - Установите TTL (время жизни): 30 дней
   - Это поможет не захламлять хранилище

**Проверка создания bucket:**
- В списке buckets должен появиться `task-proofs`
- Статус: **Public**

### Шаг 3: Настройте политики безопасности для Storage

**КРИТИЧЕСКИ ВАЖНО:** Без этих политик загрузка фото НЕ БУДЕТ работать!

1. **Перейдите в SQL Editor**
2. **Выполните эти политики по очереди:**

```sql
-- Удаляем существующие политики если есть
DROP POLICY IF EXISTS "task_proofs_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_delete_policy" ON storage.objects;

-- 1) Политика на загрузку файлов (только аутентифицированные пользователи)
CREATE POLICY "task_proofs_upload_policy" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-proofs'
);

-- 2) Политика на просмотр файлов (только члены семьи)
CREATE POLICY "task_proofs_select_policy" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'task-proofs'
);

-- 3) Политика на обновление файлов (только загрузивший может обновить)
CREATE POLICY "task_proofs_update_policy" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'task-proofs' AND owner = auth.uid()
);

-- 4) Политика на удаление файлов (только загрузивший может удалить)
CREATE POLICY "task_proofs_delete_policy" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'task-proofs' AND owner = auth.uid()
);
```

**Проверка политик:**
```sql
-- Проверьте что политики созданы:
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects' 
AND policyname LIKE '%task_proofs%';
-- Должно вернуть 4 политики
```

### Шаг 4: Проверьте существующие таблицы users и families

**ВАЖНО:** Компонент Tasks.jsx зависит от существующих таблиц!

Выполните проверку:
```sql
-- Проверка таблицы users
SELECT id, email, role, family_id FROM public.users LIMIT 1;

-- Проверка таблицы families  
SELECT family_id, family_name FROM public.families LIMIT 1;
```

**Если таблицы не существуют:**
- Выполните сначала скрипт `scripts/supabase_policies.sql`
- Убедитесь что система аутентификации настроена

### Шаг 5: Создайте тестовые данные (опционально)

Для тестирования компонента создайте тестовую задачу:

```sql
-- Замените USER_ID_РЕБЕНКА, USER_ID_РОДИТЕЛЯ, FAMILY_ID на реальные значения
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
  'Тестовая задача: убрать комнату',
  'Убрать игрушки, застелить кровать, протереть пыль',
  'medium',
  'USER_ID_РЕБЕНКА',    -- заменить на реальный ID ребенка
  'USER_ID_РОДИТЕЛЯ',   -- заменить на реальный ID родителя  
  'FAMILY_ID',          -- заменить на реальный family_id
  '{"stars": 5, "money": 100, "screen_time": 30}',
  NOW() + INTERVAL '7 days'
);
```

**Как найти нужные ID:**
```sql
-- Найти ID пользователей вашей семьи:
SELECT id, email, role, family_id FROM public.users WHERE family_id IS NOT NULL;

-- Найти family_id:
SELECT family_id, family_name FROM public.families;
```

### Шаг 6: Финальная проверка настройки

**Выполните полную проверку:**

```sql
-- 1) Проверка всех таблиц
SELECT 'tables_check' as test, count(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'families', 'tasks', 'rewards', 'history');
-- Ожидаемый результат: 5 таблиц

-- 2) Проверка RLS политик для tasks
SELECT 'tasks_policies' as test, count(*) as count 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'tasks';
-- Ожидаемый результат: минимум 3 политики

-- 3) Проверка Storage bucket
SELECT 'storage_bucket' as test, 
       CASE WHEN id = 'task-proofs' THEN 'OK' ELSE 'ERROR' END as status
FROM storage.buckets WHERE id = 'task-proofs';
-- Ожидаемый результат: status = 'OK'

-- 4) Проверка Storage политик
SELECT 'storage_policies' as test, count(*) as count 
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects' 
AND policyname LIKE '%task_proofs%';
-- Ожидаемый результат: 4 политики
```

**Если все проверки прошли успешно - настройка завершена! ✅**

### 📋 Краткий чек-лист настройки Supabase

- [ ] **Шаг 1:** SQL-схема применена (`create_tasks_schema.sql`)
- [ ] **Шаг 2:** Storage bucket `task-proofs` создан и публичный
- [ ] **Шаг 3:** 4 политики Storage настроены
- [ ] **Шаг 4:** Таблицы `users` и `families` существуют
- [ ] **Шаг 5:** Тестовые данные созданы (опционально)
- [ ] **Шаг 6:** Все проверки пройдены

## 🔧 Переменные окружения

Убедитесь, что у вас настроены переменные в `.env`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Где найти эти значения:**
1. Откройте Supabase Dashboard
2. Перейдите в **Settings** → **API**
3. Скопируйте:
   - **URL** → `VITE_SUPABASE_URL`
   - **anon key** → `VITE_SUPABASE_ANON_KEY`

## ⚠️ Важные примечания по настройке

### Зависимости от других компонентов:
- **Обязательно:** Система аутентификации должна быть настроена
- **Обязательно:** Таблицы `users` и `families` должны существовать
- **Рекомендуется:** Компонент `Profile.jsx` для управления семьей

### Порядок настройки проекта:
1. Система аутентификации (`scripts/supabase_policies.sql`)
2. **→ Система задач (текущие инструкции)**
3. Компонент ParentConfirm.jsx (следующий этап)
4. Компонент Balance.jsx (этап 7)

## 🎯 Следующие шаги

После настройки компонента Tasks.jsx готов к использованию! Следующие компоненты для реализации согласно ТЗ:

1. **ParentConfirm.jsx** - компонент для родителей по подтверждению задач
2. **Balance.jsx** - система баланса и наград
3. **Analytics.jsx** - аналитика и отчетность

## 📚 Требования к ведению документации

### ОБЯЗАТЕЛЬНО: Подробная документация каждого этапа разработки

При работе с проектом Family Task Manager требуется ведение полной и подробной документации по всем аспектам разработки.

#### 📝 Документирование кода

**1. Комментарии в коде:**
- Все комментарии ОБЯЗАТЕЛЬНО должны быть на русском языке
- Каждая функция должна иметь описание назначения
- Сложная логика требует построчных комментариев
- Используйте JSDoc формат для функций:

```javascript
/**
 * Функция загрузки фото-доказательства задачи в Supabase Storage
 * @param {string} taskId - ID задачи
 * @param {File} file - Файл для загрузки
 * @returns {Object} Объект с путем и публичной ссылкой на файл
 */
const uploadProofPhoto = async (taskId, file) => {
  // Генерируем уникальное имя файла
  const fileExt = file.name.split('.').pop()
  // ... остальной код
}
```

**2. Комментарии к компонентам:**
```javascript
/* Файл: src/components/Tasks.jsx */
/* Компонент для отображения и управления задачами пользователя */
/* Основной функционал:
   - Загрузка задач из базы данных
   - Изменение статусов задач
   - Загрузка фото-доказательств
   - Real-time обновления через Supabase
*/
```

#### 🏗️ Архитектурная документация

**1. Файл ARCHITECTURE.md (создать в корне проекта):**
- Общая архитектура приложения
- Схема взаимодействия компонентов
- Диаграммы потоков данных
- Описание паттернов проектирования

**2. Схема базы данных:**
- ER-диаграмма всех таблиц
- Описание связей между таблицами
- Документация RLS политик
- Примеры типичных запросов

#### 📋 API и интеграции

**1. Документация Supabase API:**
- Все используемые функции Supabase
- Примеры запросов с параметрами
- Обработка ошибок для каждого запроса
- Политики безопасности (RLS)

**2. Компонентное API:**
- Props каждого компонента
- События и коллбэки
- Примеры использования

#### 🔄 Процессы и workflow

**1. Жизненный цикл задач:**
```
pending → in_progress → completed → confirmed/rejected
     ↓         ↓           ↓            ↓
  Создана   Начата    Выполнена   Проверена родителем
```

**2. Система наград:**
- Алгоритм начисления баллов
- Правила обмена на награды
- Валидация достаточности средств

#### 📖 Создание документации при разработке

**Для каждого нового компонента создавайте:**

1. **Заголовочный комментарий:**
```javascript
/* 
 * Компонент: ParentConfirm.jsx
 * Назначение: Интерфейс для родителей по подтверждению выполненных задач детьми
 * Автор: [ИМЯ]
 * Дата создания: [ДАТА]
 * 
 * Основные функции:
 * - Просмотр списка выполненных задач
 * - Просмотр фото-доказательств
 * - Подтверждение/отклонение задач
 * - Начисление наград при подтверждении
 * 
 * Зависимости:
 * - supabase для работы с БД
 * - framer-motion для анимаций
 * - react-hooks для состояния
 * 
 * Связанные таблицы БД:
 * - tasks (основная работа)
 * - history (логирование операций)
 * - users (информация о семье)
 */
```

2. **README для каждого компонента** (в папке компонента):
```markdown
# ParentConfirm Component

## Описание
Компонент для родителей по управлению и подтверждению задач детей.

## Props
- `familyId` (string) - ID семьи для фильтрации задач
- `onTaskUpdate` (function) - Коллбэк при обновлении статуса задачи

## Состояние
- `pendingTasks` - Список задач ожидающих подтверждения
- `loading` - Индикатор загрузки
- `error` - Сообщение об ошибке

## Методы
### confirmTask(taskId, rewardAmount)
Подтверждает выполнение задачи и начисляет награду
```

#### 🧪 Документация тестирования

**1. Тестовые сценарии:**
- Описание всех тестовых случаев
- Шаги воспроизведения
- Ожидаемые результаты
- Граничные условия

**2. Примеры данных для тестирования:**
```sql
-- Создание семьи для тестирования
INSERT INTO families (family_name) VALUES ('Тестовая семья');

-- Создание родителя
INSERT INTO users (email, role, family_id) VALUES 
('parent@test.com', 'parent', 'FAMILY_ID');

-- Создание ребенка  
INSERT INTO users (email, role, family_id) VALUES 
('child@test.com', 'child', 'FAMILY_ID');
```

#### 📊 Отчеты о прогрессе

**1. Еженедельные отчеты:**
- Что было реализовано
- Встретившиеся сложности
- Планы на следующую неделю
- Изменения в архитектуре

**2. Технический долг:**
- Список известных проблем
- Планы по рефакторингу
- Оптимизации производительности

#### 🔍 Обязательная проверка документации

**Перед каждым коммитом проверяйте:**
- [ ] Все новые функции прокомментированы на русском
- [ ] Обновлен TODO.md с текущим прогрессом
- [ ] Добавлены примеры использования
- [ ] Обновлена схема БД (если были изменения)
- [ ] Добавлены инструкции по тестированию

#### 📁 Структура документации

```
/docs
  ├── ARCHITECTURE.md     # Общая архитектура
  ├── DATABASE.md         # Схема и политики БД  
  ├── COMPONENTS.md       # Документация компонентов
  ├── API.md              # Описание API Supabase
  ├── TESTING.md          # Инструкции по тестированию
  ├── DEPLOYMENT.md       # Процедуры развертывания
  └── TROUBLESHOOTING.md  # Решение типичных проблем
```

### 🎯 Цель подробной документации

1. **Ускорение разработки** - новые разработчики быстро включаются в проект
2. **Поддержка качества** - документированный код легче тестировать и отлаживать  
3. **Масштабируемость** - четкая архитектура позволяет добавлять новые функции
4. **Безопасность** - все политики и ограничения явно задокументированы

> **ВАЖНО:** Документация должна обновляться ОДНОВРЕМЕННО с кодом, а не постфактум!

## 🐛 Возможные проблемы и решения

### Ошибка "table does not exist"
- Убедитесь, что выполнили SQL-скрипт `create_tasks_schema.sql`
- Проверьте права доступа к базе данных

### Ошибка "column does not exist" (stars_change, money_change, reward_id и др.)
**Проблема:** Ошибки с отсутствующими столбцами в таблицах history, tasks, rewards

**🎯 РЕКОМЕНДУЕМОЕ РЕШЕНИЕ - ПЛАН РЕВИЗИИ БД:**
1. **Выполните диагностику:** `scripts/database_audit.sql`
2. **Исправьте конфликты:** `scripts/fix_database_schema.sql` 
3. **Проверьте результат:** Все столбцы будут добавлены автоматически

**Альтернативные решения:**

**Решение 1 (рекомендуемое):**
- Используйте обновленный `create_tasks_schema.sql` версии 2.1
- Скрипт теперь:
  - ✅ Автоматически создает зависимые таблицы `families` и `users` если их нет
  - ✅ Добавляет столбец reward_id если его нет
  - ✅ Проверяет существование всех необходимых столбцов перед созданием внешних ключей
  - ✅ Безопасно проверяет существование таблиц, столбцов и constraints

**Решение 2 (ручное добавление столбца):**
Выполните команды по частям в SQL Editor:
```sql
-- 1. Добавьте столбец reward_id если его нет
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS reward_id UUID;

-- 2. Затем добавьте constraint
ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_reward_id_fkey;
ALTER TABLE public.history 
ADD CONSTRAINT history_reward_id_fkey 
FOREIGN KEY (reward_id) REFERENCES public.rewards(id) ON DELETE SET NULL;
```

**Решение 3 (диагностика проблемы):**
Проверьте состояние таблиц и столбцов:
```sql
-- 1. Проверка существующих таблиц
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tasks', 'history', 'rewards', 'users', 'families')
ORDER BY table_name;

-- 2. Проверка структуры таблицы history
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'history'
ORDER BY ordinal_position;

-- 3. Проверка структуры таблицы rewards
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'rewards'
ORDER BY ordinal_position;

-- 4. Проверка существующих внешних ключей
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema='public'
  AND tc.table_name IN ('history', 'tasks', 'rewards');
```

**Решение 4 (если проблема с зависимостями):**
Если ошибка `column "id" referenced in foreign key constraint does not exist` указывает на таблицу `rewards`:
```sql
-- 1. Создайте зависимые таблицы вручную
CREATE TABLE IF NOT EXISTS public.families (
  family_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  role VARCHAR(20) DEFAULT 'child',
  family_id UUID REFERENCES public.families(family_id)
);

-- 2. Затем выполните весь скрипт create_tasks_schema.sql
```

**Решение 5 (крайний случай - полное пересоздание):**
```sql
-- Удалите таблицы и пересоздайте заново
DROP TABLE IF EXISTS public.history CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;  
DROP TABLE IF EXISTS public.rewards CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.families CASCADE;
-- Затем выполните весь скрипт заново
```

### Ошибка загрузки файлов
- Проверьте, что bucket `task-proofs` создан и настроен как публичный
- Убедитесь, что политики Storage применены корректно

### Задачи не отображаются
- Проверьте, что пользователь состоит в семье (family_id не NULL)
- Убедитесь, что RLS политики настроены корректно

## 📱 Тестирование функционала

1. Войдите в приложение как пользователь с ролью 'child'
2. Перейдите в раздел "Задачи"
3. Создайте тестовую задачу через SQL или попросите родителя
4. Протестируйте изменение статусов и загрузку фото

## 🎉 Готово!

Компонент Tasks.jsx полностью готов к работе и интегрирован в систему Family Task Manager!

