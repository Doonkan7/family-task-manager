# Руководство по тестированию Family Task Manager

Это подробное руководство по системе автотестирования проекта семейного планировщика задач.

## 📋 Содержание

- [Обзор системы тестирования](#обзор-системы-тестирования)
- [Установка и настройка](#установка-и-настройка)
- [Типы тестов](#типы-тестов)
- [Запуск тестов](#запуск-тестов)
- [Структура тестов](#структура-тестов)
- [Написание новых тестов](#написание-новых-тестов)
- [Лучшие практики](#лучшие-практики)
- [Отладка тестов](#отладка-тестов)
- [CI/CD интеграция](#cicd-интеграция)
- [Troubleshooting](#troubleshooting)

## 🔍 Обзор системы тестирования

Проект использует многоуровневую систему тестирования для обеспечения высокого качества кода:

### Инструменты тестирования

- **Vitest** - Основной test runner для unit и integration тестов
- **React Testing Library** - Тестирование React компонентов
- **Playwright** - End-to-end тестирование
- **Jest DOM** - Дополнительные матчеры для DOM
- **User Event** - Симуляция пользовательских действий

### Архитектура тестов

```
tests/
├── Unit Tests (Vitest + RTL)
│   ├── Компоненты
│   ├── Утилиты
│   └── Хуки
├── Integration Tests (Vitest + RTL)
│   ├── Пользовательские потоки
│   └── Взаимодействие компонентов
├── API Tests (Vitest)
│   ├── Supabase интеграция
│   └── Бизнес-логика
└── E2E Tests (Playwright)
    ├── Полные пользовательские сценарии
    └── Кроссбраузерное тестирование
```

## ⚙️ Установка и настройка

### Первоначальная настройка

```bash
# Установка зависимостей для тестирования уже включена в package.json
npm install

# Установка браузеров для Playwright (выполняется один раз)
npm run playwright:install
npm run playwright:install-deps
```

### Переменные окружения для тестов

Создайте файл `.env.test` в корне проекта:

```env
NODE_ENV=test
VITE_SUPABASE_URL=https://test.supabase.co
VITE_SUPABASE_ANON_KEY=test-key
```

### Настройка IDE

#### VS Code
Рекомендуемые расширения:
- Vitest
- Playwright Test for VSCode
- Jest Runner

#### WebStorm
- Включите поддержку Vitest в настройках
- Настройте Test Runner для Playwright

## 📝 Типы тестов

### 1. Unit тесты (Компонентные тесты)

**Расположение:** `src/components/__tests__/`

**Что тестируем:**
- Рендеринг компонентов
- Пропсы и состояние
- Пользовательские взаимодействия
- Условный рендеринг

**Пример:**
```javascript
// src/components/__tests__/Login.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from '../Login'

test('отображает форму входа', () => {
  render(<Login />)
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument()
})
```

### 2. Integration тесты (Интеграционные тесты)

**Расположение:** `src/test/integration/`

**Что тестируем:**
- Взаимодействие между компонентами
- Полные пользовательские потоки
- Состояние приложения

**Пример:**
```javascript
// src/test/integration/userFlow.test.jsx
test('полный поток регистрации родителя', async () => {
  render(<App />)
  
  // Регистрация
  await user.click(screen.getByText(/регистрация/i))
  await user.type(screen.getByLabelText(/email/i), 'parent@test.com')
  // ... остальная логика теста
})
```

### 3. API тесты

**Расположение:** `src/test/api/`

**Что тестируем:**
- Интеграция с Supabase
- CRUD операции
- Обработка ошибок
- Валидация данных

**Пример:**
```javascript
// src/test/api/supabase.test.js
test('создает новую задачу', async () => {
  const taskData = mockTask()
  const { error } = await supabase.from('tasks').insert([taskData])
  expect(error).toBeNull()
})
```

### 4. E2E тесты

**Расположение:** `playwright-tests/`

**Что тестируем:**
- Полные пользовательские сценарии
- Реальные браузерные взаимодействия
- Кроссбраузерную совместимость

**Пример:**
```javascript
// playwright-tests/auth.e2e.js
test('пользователь может войти в систему', async ({ page }) => {
  await page.goto('/')
  await page.fill('[type="email"]', 'test@example.com')
  await page.fill('[type="password"]', 'password')
  await page.click('button:has-text("Войти")')
  await expect(page.locator('text="Family Task Manager"')).toBeVisible()
})
```

## 🚀 Запуск тестов

### Основные команды

```bash
# Запуск всех unit/integration тестов
npm test

# Запуск тестов в режиме наблюдения
npm run test:watch

# Запуск тестов с UI интерфейсом
npm run test:ui

# Запуск тестов один раз (для CI)
npm run test:run

# Запуск тестов с покрытием кода
npm run test:coverage
```

### Селективный запуск тестов

```bash
# Только компонентные тесты
npm run test:components

# Только интеграционные тесты
npm run test:integration

# Только API тесты
npm run test:api

# Конкретный файл теста
npm test Login.test.jsx

# Тесты по паттерну
npm test -- --grep "авторизация"
```

### E2E тесты

```bash
# Запуск всех E2E тестов
npm run test:e2e

# Запуск с графическим интерфейсом
npm run test:e2e:ui

# Запуск в видимом режиме (не headless)
npm run test:e2e:headed

# Отладка конкретного теста
npm run test:e2e:debug

# Просмотр отчета
npm run test:e2e:report
```

### Комплексный запуск

```bash
# Все тесты подряд
npm run test:all

# Тесты для CI/CD (с покрытием)
npm run test:ci
```

## 📁 Структура тестов

### Структура файлов

```
family-task-manager/
├── src/
│   ├── components/
│   │   ├── __tests__/              # Unit тесты компонентов
│   │   │   ├── Login.test.jsx
│   │   │   ├── Tasks.test.jsx
│   │   │   ├── Profile.test.jsx
│   │   │   └── ParentDashboard.test.jsx
│   │   ├── Login.jsx
│   │   └── ...
│   ├── test/
│   │   ├── setup.js                # Настройка тестовой среды
│   │   ├── utils.jsx               # Утилиты для тестов
│   │   ├── integration/            # Интеграционные тесты
│   │   │   └── userFlow.test.jsx
│   │   └── api/                    # API тесты
│   │       └── supabase.test.js
├── playwright-tests/               # E2E тесты
│   ├── auth.e2e.js
│   ├── tasks.e2e.js
│   ├── utils/
│   │   └── helpers.js
│   ├── fixtures/
│   │   └── test-image.jpg
│   ├── global-setup.js
│   └── global-teardown.js
├── vitest.config.js                # Конфигурация Vitest
├── playwright.config.js            # Конфигурация Playwright
└── docs/
    └── TESTING.md                  # Этот документ
```

### Соглашения по именованию

- **Unit тесты:** `ComponentName.test.jsx`
- **Integration тесты:** `featureName.test.jsx`
- **API тесты:** `serviceName.test.js`
- **E2E тесты:** `feature.e2e.js`

## ✍️ Написание новых тестов

### Создание unit теста для компонента

1. **Создайте файл теста:**
```bash
touch src/components/__tests__/NewComponent.test.jsx
```

2. **Базовая структура:**
```javascript
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/utils'
import NewComponent from '../NewComponent'

describe('NewComponent', () => {
  let user

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
  })

  describe('Рендеринг', () => {
    test('отображает основные элементы', () => {
      renderWithProviders(<NewComponent />)
      expect(screen.getByText(/заголовок/i)).toBeInTheDocument()
    })
  })

  describe('Взаимодействие', () => {
    test('обрабатывает клик по кнопке', async () => {
      const mockHandler = vi.fn()
      renderWithProviders(<NewComponent onClick={mockHandler} />)
      
      await user.click(screen.getByRole('button'))
      expect(mockHandler).toHaveBeenCalledOnce()
    })
  })
})
```

### Создание E2E теста

1. **Создайте файл теста:**
```bash
touch playwright-tests/newFeature.e2e.js
```

2. **Базовая структура:**
```javascript
import { test, expect } from '@playwright/test'
import { AuthHelpers } from './utils/helpers.js'

test.describe('Новая функциональность', () => {
  let authHelpers

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page)
  })

  test('выполняет основной сценарий', async ({ page }) => {
    await authHelpers.login('user@test.com', 'password')
    
    // Ваша логика теста
    await page.click('button:has-text("Новая функция")')
    await expect(page.locator('text="Результат"')).toBeVisible()
  })
})
```

### Использование тестовых утилит

#### Мокирование Supabase
```javascript
import { createSupabaseMock } from '../test/utils'

const mockSupabase = createSupabaseMock({
  user: mockUser(),
  tasks: [mockTask()],
  families: [mockFamily()]
})
```

#### Создание тестовых данных
```javascript
import { mockUser, mockChild, mockTask, mockFamily } from '../test/utils'

const testUser = mockUser({
  email: 'test@example.com',
  role: 'parent',
  family_id: 'test-family'
})
```

#### Загрузка файлов в тестах
```javascript
import { createMockFile } from '../test/utils'

const testFile = createMockFile({
  name: 'test-image.jpg',
  type: 'image/jpeg'
})

await user.upload(fileInput, testFile)
```

## 🎯 Лучшие практики

### Общие принципы

1. **Тестируйте поведение, а не реализацию**
   ```javascript
   // ✅ Хорошо - тестируем результат
   expect(screen.getByText('Задача создана')).toBeInTheDocument()
   
   // ❌ Плохо - тестируем внутреннее состояние
   expect(component.state.isCreated).toBe(true)
   ```

2. **Пишите понятные названия тестов**
   ```javascript
   // ✅ Хорошо
   test('отображает ошибку при неверном пароле')
   
   // ❌ Плохо
   test('test login error')
   ```

3. **Используйте паттерн AAA (Arrange, Act, Assert)**
   ```javascript
   test('создает новую задачу', async () => {
     // Arrange - подготовка
     const taskData = mockTask()
     renderWithProviders(<TaskForm />)
     
     // Act - действие
     await user.type(screen.getByLabelText(/название/i), taskData.title)
     await user.click(screen.getByRole('button', { name: /создать/i }))
     
     // Assert - проверка
     expect(screen.getByText('Задача создана')).toBeInTheDocument()
   })
   ```

### Специфичные практики

#### React компоненты

1. **Используйте semantic queries**
   ```javascript
   // ✅ Предпочтительно
   screen.getByRole('button', { name: /войти/i })
   screen.getByLabelText(/email/i)
   
   // ❌ Избегайте
   screen.getByTestId('login-button')
   screen.getByClassName('email-input')
   ```

2. **Тестируйте доступность**
   ```javascript
   test('поддерживает навигацию с клавиатуры', async () => {
     render(<LoginForm />)
     
     await user.tab()
     expect(screen.getByLabelText(/email/i)).toHaveFocus()
     
     await user.tab()
     expect(screen.getByLabelText(/пароль/i)).toHaveFocus()
   })
   ```

#### E2E тесты

1. **Используйте Page Object паттерн**
   ```javascript
   // Создайте helper классы для переиспользования логики
   class TasksPage {
     constructor(page) {
       this.page = page
     }
     
     async createTask(taskData) {
       await this.page.click('button:has-text("Создать задачу")')
       await this.page.fill('input[name="title"]', taskData.title)
       // ...
     }
   }
   ```

2. **Ждите состояния, а не таймауты**
   ```javascript
   // ✅ Хорошо
   await expect(page.locator('text="Задача создана"')).toBeVisible()
   
   // ❌ Плохо
   await page.waitForTimeout(2000)
   ```

#### Мокирование

1. **Мокируйте на правильном уровне**
   ```javascript
   // ✅ Мокируйте внешние зависимости
   vi.mock('../../lib/supabase', () => ({
     supabase: mockSupabase
   }))
   
   // ❌ Не мокируйте то, что тестируете
   vi.mock('../MyComponent') // если тестируете MyComponent
   ```

2. **Очищайте моки между тестами**
   ```javascript
   beforeEach(() => {
     vi.clearAllMocks()
   })
   
   afterEach(() => {
     vi.resetAllMocks()
   })
   ```

## 🐛 Отладка тестов

### Vitest отладка

1. **Вывод отладочной информации**
   ```javascript
   // Вывод элементов в консоль
   screen.debug()
   
   // Вывод конкретного элемента
   screen.debug(screen.getByRole('button'))
   
   // Логирование состояния
   console.log('Current state:', component.state)
   ```

2. **Пошаговая отладка**
   ```bash
   # Запуск с отладчиком
   npm test -- --inspect-brk
   
   # В Chrome откройте chrome://inspect
   ```

3. **Изоляция проблемного теста**
   ```javascript
   // Запуск только одного теста
   test.only('проблемный тест', () => {
     // ...
   })
   
   // Пропуск теста
   test.skip('временно отключен', () => {
     // ...
   })
   ```

### Playwright отладка

1. **Визуальная отладка**
   ```bash
   # Запуск с визуальным интерфейсом
   npm run test:e2e:ui
   
   # Запуск в видимом режиме
   npm run test:e2e:headed
   
   # Пошаговая отладка
   npm run test:e2e:debug
   ```

2. **Скриншоты и видео**
   ```javascript
   // Скриншот на месте
   await page.screenshot({ path: 'debug.png' })
   
   // Автоматические скриншоты при падении
   // (уже настроено в playwright.config.js)
   ```

3. **Логирование**
   ```javascript
   // Логирование действий браузера
   page.on('console', msg => console.log(msg.text()))
   
   // Логирование сетевых запросов
   page.on('request', request => console.log(request.url()))
   ```

## 🔧 CI/CD интеграция

### GitHub Actions

Создайте файл `.github/workflows/tests.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:coverage
    
    - name: Install Playwright browsers
      run: npm run playwright:install
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: test-results
        path: |
          playwright-report/
          coverage/
```

### Локальная pre-commit проверка

В файле `.husky/pre-commit`:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run test:run
npm run lint
```

## ❗ Troubleshooting

### Частые проблемы и решения

#### 1. Тесты падают из-за async операций

**Проблема:** Тест завершается до выполнения асинхронных операций

**Решение:**
```javascript
// ✅ Правильно - ждем завершения
await waitFor(() => {
  expect(screen.getByText('Результат')).toBeInTheDocument()
})

// ❌ Неправильно - не ждем
expect(screen.getByText('Результат')).toBeInTheDocument()
```

#### 2. Моки не работают

**Проблема:** Мок не применяется или сбрасывается

**Решение:**
```javascript
// Убедитесь, что мок объявлен до импорта компонента
vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase
}))

// И очищается между тестами
beforeEach(() => {
  vi.clearAllMocks()
})
```

#### 3. E2E тесты нестабильны

**Проблема:** Тесты иногда падают из-за race conditions

**Решение:**
```javascript
// ✅ Ждите определенного состояния
await expect(page.locator('text="Loading"')).toBeHidden()
await expect(page.locator('text="Content"')).toBeVisible()

// ❌ Не используйте фиксированные таймауты
await page.waitForTimeout(2000)
```

#### 4. Проблемы с импортами в тестах

**Проблема:** ESM/CommonJS конфликты

**Решение:**
```javascript
// В vitest.config.js убедитесь в правильности настроек
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js']
  }
})
```

### Диагностика производительности

1. **Медленные тесты**
   ```bash
   # Запуск с отчетом по времени
   npm test -- --reporter=verbose
   
   # Профилирование конкретного теста
   npm test -- --reporter=verbose LoginForm.test.jsx
   ```

2. **Большое потребление памяти**
   ```bash
   # Мониторинг памяти
   npm test -- --max-workers=1
   
   # Изоляция тестов
   npm test -- --no-coverage --run
   ```

### Получение помощи

1. **Логи и отчеты**
   - Vitest отчеты: `coverage/index.html`
   - Playwright отчеты: `playwright-report/index.html`
   - CI логи в GitHub Actions

2. **Полезные ресурсы**
   - [Vitest документация](https://vitest.dev/)
   - [Testing Library гайды](https://testing-library.com/)
   - [Playwright документация](https://playwright.dev/)

3. **Команда разработки**
   - Создавайте issue в проекте с подробным описанием
   - Прикладывайте логи и скриншоты
   - Указывайте версии инструментов

---

## 📈 Метрики покрытия

Целевые метрики покрытия кода:
- **Общее покрытие:** ≥ 70%
- **Функции:** ≥ 70%
- **Ветвления:** ≥ 70%
- **Строки:** ≥ 70%

Просмотр покрытия:
```bash
npm run test:coverage
open coverage/index.html
```

## 🔄 Обновление тестов

При изменении функциональности обязательно обновляйте соответствующие тесты:

1. **Изменились компоненты** → обновите unit тесты
2. **Изменилась бизнес-логика** → обновите integration тесты
3. **Изменился пользовательский интерфейс** → обновите E2E тесты
4. **Изменился API** → обновите API тесты

---

*Этот документ поддерживается в актуальном состоянии. При внесении изменений в систему тестирования, пожалуйста, обновляйте соответствующие разделы.*
