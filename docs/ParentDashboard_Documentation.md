# 📚 Документация компонента ParentDashboard.jsx

## 🎯 Назначение

**ParentDashboard** - это комплексная панель управления для родителей в приложении Family Task Manager. Компонент предоставляет родителям полный контроль над системой задач, включая создание заданий, контроль выполнения и управление системой наград.

## 🏗️ Архитектура компонента

### Основная структура
```
ParentDashboard/
├── Проверка доступа (только parent)
├── Навигация по вкладкам
├── Обзор семьи (overview)
├── Создание задач (create)  
├── Проверка задач (pending)
└── Управление наградами (rewards)
```

### Состояние компонента
```javascript
const [activeTab, setActiveTab] = useState('overview')           // Активная вкладка
const [user, setUser] = useState(null)                          // Профиль родителя
const [familyChildren, setFamilyChildren] = useState([])        // Дети семьи
const [pendingTasks, setPendingTasks] = useState([])           // Задачи на проверке
const [loading, setLoading] = useState(true)                   // Индикатор загрузки
const [error, setError] = useState(null)                       // Ошибки
const [newTask, setNewTask] = useState({...})                  // Форма новой задачи
const [processingTasks, setProcessingTasks] = useState({})     // Обработка задач
const [rejectionReasons, setRejectionReasons] = useState({})   // Причины отклонения
```

## 🔐 Система безопасности

### Проверка прав доступа
```javascript
// Только пользователи с ролью 'parent' могут использовать компонент
if (profile.role !== 'parent') {
  setError('Доступ запрещен. Этот раздел доступен только родителям.')
  return
}
```

### RLS политики (Row Level Security)
- **Просмотр детей**: `parents_can_view_family_children`
- **Подтверждение задач**: `parents_can_confirm_reject_tasks`  
- **Создание истории**: `parents_can_create_history`

## 📋 Функциональные возможности

### 1. Обзор семьи (Overview Tab)

**Назначение**: Главная страница с общей статистикой семьи

**Компоненты:**
- Список детей семьи с датами регистрации
- Количество задач, ожидающих проверки
- Быстрые действия (создать задачу, проверить выполнение)

**Запросы к БД:**
```javascript
// Загрузка детей семьи
const { data: children } = await supabase
  .from('users')
  .select('id, email, phone, created_at')
  .eq('family_id', user.family_id)
  .eq('role', 'child')
```

### 2. Создание задач (Create Tab)

**Назначение**: Интерфейс для создания новых задач для детей

**Поля формы:**
- `title` - Название задачи (обязательно)
- `description` - Подробное описание
- `priority` - Приоритет (low/medium/high)
- `assigned_to_id` - Исполнитель из списка детей (обязательно)
- `due_date` - Срок выполнения
- `reward` - Система наград (звездочки/деньги/время)

**Валидация:**
```javascript
if (!newTask.title.trim() || !newTask.assigned_to_id) {
  setError('Заполните обязательные поля: название задачи и исполнитель')
  return
}
```

**Создание задачи:**
```javascript
const taskData = {
  title: newTask.title.trim(),
  description: newTask.description.trim(),
  priority: newTask.priority,
  assigned_to_id: newTask.assigned_to_id,
  assigned_by_id: user.id,
  family_id: user.family_id,
  due_date: newTask.due_date || null,
  reward: newTask.reward,
  status: 'pending'
}
```

### 3. Проверка задач (Pending Tab)

**Назначение**: Просмотр и обработка выполненных задач

**Функционал:**
- Просмотр задач со статусом 'completed'
- Отображение фото-доказательств
- Подтверждение задач (→ 'confirmed')
- Отклонение с указанием причины (→ 'rejected' → 'pending')

**Подтверждение задачи:**
```javascript
const handleConfirmTask = async (taskId) => {
  const { error } = await supabase
    .from('tasks')
    .update({ 
      status: 'confirmed',
      confirmed_at: new Date().toISOString()
    })
    .eq('id', taskId)
  
  // Триггер автоматически начислит награды в таблицу history
}
```

**Отклонение задачи:**
```javascript
const handleRejectTask = async (taskId) => {
  const { error } = await supabase
    .from('tasks')
    .update({ 
      status: 'rejected',
      rejection_reason: reason.trim()
    })
    .eq('id', taskId)
  
  // Триггер автоматически сбросит статус на 'pending'
}
```

### 4. Управление наградами (Rewards Tab)

**Назначение**: Настройка системы наград (в разработке)

**Планируемый функционал:**
- Создание шаблонов наград
- Настройка курсов обмена
- Управление каталогом призов

## 🎨 UI/UX Особенности

### Дизайн-система
```javascript
// Цветовая схема
const COLORS = {
  primary: 'minecraft-green',      // Основной цвет
  secondary: 'minecraft-blue',     // Дополнительный
  error: 'red-500',               // Ошибки
  warning: 'yellow-500',          // Предупреждения
  success: 'green-500'            // Успех
}

// Типографика
font-family: "Press Start 2P", "Courier New", monospace  // Pixel-art шрифт
```

### Приоритеты задач
```javascript
const TASK_PRIORITY = {
  low: { label: 'Низкий', color: 'text-green-600', bg: 'bg-green-100', icon: '🟢' },
  medium: { label: 'Средний', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: '🟡' },
  high: { label: 'Высокий', color: 'text-red-600', bg: 'bg-red-100', icon: '🔴' }
}
```

### Анимации (Framer Motion)
```javascript
// Переход между вкладками
<AnimatePresence mode="wait">
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
  >
```

### Адаптивная сетка
```css
/* Responsive layout */
grid-cols-1 md:grid-cols-2 lg:grid-cols-3  /* 1/2/3 колонки */
max-w-6xl mx-auto px-4                     /* Центрирование */
space-y-4                                  /* Вертикальные отступы */
```

## 🔄 Жизненный цикл задач

### Схема статусов
```
pending → in_progress → completed → confirmed/rejected
   ↑                                        ↓
   └────────────── rejected ←───────────────┘
```

### Автоматические триггеры
1. **При подтверждении** (`confirmed`):
   - Начисление наград в `history`
   - Установка `confirmed_at`

2. **При отклонении** (`rejected`):
   - Сброс статуса на `pending`
   - Очистка `completed_at` и `proof_url`
   - Сохранение `rejection_reason`

## 📊 Интеграция с базой данных

### Основные запросы

**Загрузка детей семьи:**
```sql
SELECT id, email, phone, created_at
FROM public.users 
WHERE family_id = $1 AND role = 'child'
ORDER BY created_at ASC
```

**Загрузка задач на проверке:**
```sql
SELECT t.*, 
       u1.email as assigned_user_email,
       u2.email as created_user_email
FROM public.tasks t
JOIN public.users u1 ON t.assigned_to_id = u1.id
JOIN public.users u2 ON t.assigned_by_id = u2.id
WHERE t.family_id = $1 AND t.status = 'completed'
ORDER BY t.completed_at DESC
```

**Создание задачи:**
```sql
INSERT INTO public.tasks (
  title, description, priority, assigned_to_id, 
  assigned_by_id, family_id, due_date, reward, status
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
```

### Связанные таблицы
- **`tasks`** - основная таблица задач
- **`users`** - профили родителей и детей  
- **`families`** - информация о семьях
- **`history`** - история начисления наград
- **`storage.objects`** - фото-доказательства

## 🧪 Тестирование

### Unit тесты (рекомендуемые)
```javascript
// Тест проверки прав доступа
test('should deny access for non-parent users', () => {
  const childUser = { role: 'child' }
  expect(checkParentAccess(childUser)).toBe(false)
})

// Тест валидации формы
test('should validate required fields', () => {
  const emptyTask = { title: '', assigned_to_id: '' }
  expect(validateTaskForm(emptyTask)).toContain('Заполните обязательные поля')
})
```

### E2E тесты (рекомендуемые)
```javascript
// Полный цикл создания и подтверждения задачи
test('parent can create and confirm task', async () => {
  await loginAsParent()
  await createTask({ title: 'Test Task', assigned_to: childId })
  await loginAsChild()
  await completeTask(taskId)
  await loginAsParent()
  await confirmTask(taskId)
  expect(await getTaskStatus(taskId)).toBe('confirmed')
})
```

## 🔧 Кастомизация и расширение

### Добавление новых вкладок
```javascript
// 1. Обновить константы
const PARENT_TABS = {
  // ... existing tabs
  analytics: { id: 'analytics', label: 'Аналитика', icon: '📈' }
}

// 2. Добавить состояние
const [analyticsData, setAnalyticsData] = useState([])

// 3. Добавить рендеринг
{activeTab === 'analytics' && (
  <AnalyticsTab data={analyticsData} />
)}
```

### Кастомизация системы наград
```javascript
// Расширение типов наград
const REWARD_TYPES = {
  stars: { label: 'Звездочки', icon: '⭐', unit: 'шт' },
  money: { label: 'Деньги', icon: '💰', unit: 'руб' },
  screen_time: { label: 'Экранное время', icon: '🎮', unit: 'мин' },
  points: { label: 'Очки опыта', icon: '🏆', unit: 'XP' }  // новый тип
}
```

## 📈 Производительность

### Оптимизации
1. **Мемоизация компонентов** с `React.memo()`
2. **Debounce** для поиска и фильтрации
3. **Виртуализация** для больших списков задач
4. **Lazy loading** изображений-доказательств

### Кэширование запросов
```javascript
// Использование React Query для кэширования
const { data: children, isLoading } = useQuery(
  ['family-children', user.family_id],
  () => loadFamilyChildren(user.family_id),
  { staleTime: 5 * 60 * 1000 } // 5 минут
)
```

## 🚀 Развертывание

### Переменные окружения
```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Проверка готовности
```javascript
// Чек-лист перед продакшеном
const DEPLOYMENT_CHECKLIST = [
  'RLS политики настроены',
  'Storage bucket создан',
  'Триггеры функционируют',
  'Индексы созданы',
  'Тестовые данные работают'
]
```

## 🆘 Поддержка и обслуживание

### Логирование ошибок
```javascript
// Централизованное логирование
const logError = (error, context) => {
  console.error(`[ParentDashboard] ${context}:`, error)
  // Отправка в систему мониторинга
}
```

### Мониторинг производительности
- Время загрузки компонента
- Частота ошибок API  
- Конверсия создания задач
- Время отклика подтверждения

---

## ✅ Заключение

Компонент **ParentDashboard.jsx** представляет собой полнофункциональную панель управления для родителей, обеспечивающую эффективное управление семейными задачами и мотивацией детей через игровую систему наград.

**Ключевые преимущества:**
- 🔐 Безопасный контроль доступа
- 🎮 Геймифицированный интерфейс  
- 📱 Адаптивный дизайн
- ⚡ Высокая производительность
- 🛠️ Легкая расширяемость
