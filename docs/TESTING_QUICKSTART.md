# 🚀 Быстрый старт с тестированием

Краткое руководство для быстрого запуска тестов в проекте Family Task Manager.

## ⚡ Установка за 2 минуты

```bash
# 1. Установка зависимостей (если еще не установлены)
npm install

# 2. Установка браузеров для E2E тестов
npm run playwright:install

# 3. Запуск всех тестов
npm run test:all
```

## 🎯 Основные команды

### Unit/Integration тесты (Vitest)

```bash
# Запуск в watch режиме (для разработки)
npm run test:watch

# Однократный запуск всех тестов
npm run test:run

# Запуск с графическим интерфейсом
npm run test:ui

# Запуск с покрытием кода
npm run test:coverage
```

### E2E тесты (Playwright)

```bash
# Запуск всех E2E тестов
npm run test:e2e

# Запуск с графическим интерфейсом
npm run test:e2e:ui

# Запуск в видимом режиме (не headless)
npm run test:e2e:headed

# Отладка тестов
npm run test:e2e:debug
```

### Селективный запуск

```bash
# Только тесты компонентов
npm run test:components

# Только API тесты
npm run test:api

# Только интеграционные тесты
npm run test:integration

# Конкретный файл
npm test Login.test.jsx
```

## 📊 Просмотр результатов

### Покрытие кода
```bash
npm run test:coverage
# Откройте coverage/index.html в браузере
```

### E2E отчеты
```bash
npm run test:e2e:report
# Автоматически откроет отчет в браузере
```

## 🔧 Структура для новых тестов

### Добавление unit теста

1. Создайте файл: `src/components/__tests__/NewComponent.test.jsx`
2. Базовый шаблон:

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

  test('отображает компонент', () => {
    renderWithProviders(<NewComponent />)
    expect(screen.getByText(/заголовок/i)).toBeInTheDocument()
  })

  test('обрабатывает взаимодействие', async () => {
    renderWithProviders(<NewComponent />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText(/результат/i)).toBeInTheDocument()
  })
})
```

### Добавление E2E теста

1. Создайте файл: `playwright-tests/newFeature.e2e.js`
2. Базовый шаблон:

```javascript
import { test, expect } from '@playwright/test'
import { AuthHelpers } from './utils/helpers.js'

test.describe('Новая функциональность', () => {
  test('основной сценарий', async ({ page }) => {
    const auth = new AuthHelpers(page)
    
    await auth.login('test@example.com', 'password')
    await page.click('button:has-text("Новая функция")')
    await expect(page.locator('text="Результат"')).toBeVisible()
  })
})
```

## 🐛 Отладка

### Vitest отладка
```javascript
// Вывод DOM в консоль
screen.debug()

// Логирование
console.log('Debug info:', someVariable)

// Запуск только одного теста
test.only('отладка этого теста', () => {
  // ...
})
```

### Playwright отладка
```bash
# Пошаговая отладка
npm run test:e2e:debug

# Скриншот в тесте
await page.screenshot({ path: 'debug.png' })
```

## ⚠️ Частые ошибки

### 1. Тест падает из-за async операций
```javascript
// ❌ Неправильно
expect(screen.getByText('Результат')).toBeInTheDocument()

// ✅ Правильно
await waitFor(() => {
  expect(screen.getByText('Результат')).toBeInTheDocument()
})
```

### 2. Моки не работают
```javascript
// Очищайте моки между тестами
beforeEach(() => {
  vi.clearAllMocks()
})
```

### 3. E2E тесты нестабильны
```javascript
// ❌ Избегайте фиксированных таймаутов
await page.waitForTimeout(2000)

// ✅ Ждите конкретного состояния
await expect(page.locator('text="Загружено"')).toBeVisible()
```

## 📚 Полезные ссылки

- [Подробная документация](./TESTING.md)
- [Vitest документация](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright](https://playwright.dev/)

## 🆘 Получение помощи

1. **Проверьте [полную документацию](./TESTING.md)**
2. **Посмотрите примеры в существующих тестах**
3. **Создайте issue с подробным описанием проблемы**

---

**Счастливого тестирования! 🎉**
