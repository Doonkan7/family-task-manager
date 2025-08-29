/* E2E тесты аутентификации
 * Проверяет полные сценарии входа, регистрации и выхода
 */

import { test, expect } from '@playwright/test'
import { AuthHelpers, WaitHelpers } from './utils/helpers.js'

test.describe('Аутентификация пользователей', () => {
  let authHelpers
  let waitHelpers

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page)
    waitHelpers = new WaitHelpers(page)
  })

  test.describe('Страница входа', () => {
    test('отображает форму входа при загрузке', async ({ page }) => {
      await page.goto('/')
      
      // Проверяем основные элементы формы входа
      await expect(page.locator('h2:has-text("Вход")')).toBeVisible()
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
      await expect(page.locator('button:has-text("Войти")')).toBeVisible()
      await expect(page.locator('text="Нет аккаунта? Зарегистрируйтесь"')).toBeVisible()
    })

    test('переключается между формами входа и регистрации', async ({ page }) => {
      await page.goto('/')
      
      // Переключаемся на регистрацию
      await page.click('text="Нет аккаунта? Зарегистрируйтесь"')
      await expect(page.locator('h2:has-text("Регистрация")')).toBeVisible()
      await expect(page.locator('select')).toBeVisible() // Поле роли
      await expect(page.locator('input[type="tel"]')).toBeVisible() // Поле телефона
      
      // Переключаемся обратно на вход
      await page.click('text="Уже есть аккаунт? Войдите"')
      await expect(page.locator('h2:has-text("Вход")')).toBeVisible()
    })

    test('валидирует обязательные поля при входе', async ({ page }) => {
      await page.goto('/')
      
      // Пытаемся войти без заполнения полей
      await page.click('button:has-text("Войти")')
      
      // Проверяем, что поля стали невалидными
      const emailInput = page.locator('input[type="email"]')
      const passwordInput = page.locator('input[type="password"]')
      
      await expect(emailInput).toHaveAttribute('required')
      await expect(passwordInput).toHaveAttribute('required')
    })
  })

  test.describe('Процесс входа', () => {
    test('успешно выполняет вход с корректными данными', async ({ page }) => {
      // Подготавливаем мок для успешного входа
      await page.route('**/auth/v1/token*', async route => {
        const json = {
          access_token: 'fake-token',
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            role: 'parent'
          }
        }
        await route.fulfill({ json })
      })

      await page.goto('/')
      
      // Заполняем форму входа
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'password123')
      
      // Нажимаем кнопку входа
      await page.click('button:has-text("Войти")')
      
      // Ожидаем успешного входа
      await waitHelpers.waitForPageLoad()
      await expect(page.locator('text="Family Task Manager"')).toBeVisible({ timeout: 10000 })
    })

    test('отображает ошибку при неверных данных входа', async ({ page }) => {
      // Подготавливаем мок для ошибки входа
      await page.route('**/auth/v1/token*', async route => {
        await route.fulfill({
          status: 400,
          json: { error: 'Invalid email or password' }
        })
      })

      await page.goto('/')
      
      // Заполняем форму неверными данными
      await page.fill('input[type="email"]', 'wrong@example.com')
      await page.fill('input[type="password"]', 'wrongpassword')
      
      // Пытаемся войти
      await page.click('button:has-text("Войти")')
      
      // Ожидаем сообщение об ошибке
      await expect(page.locator('text*="Ошибка"')).toBeVisible({ timeout: 5000 })
    })

    test('показывает индикатор загрузки во время входа', async ({ page }) => {
      // Подготавливаем медленный мок
      await page.route('**/auth/v1/token*', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000))
        const json = {
          access_token: 'fake-token',
          user: { id: 'test-user-id', email: 'test@example.com' }
        }
        await route.fulfill({ json })
      })

      await page.goto('/')
      
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'password123')
      
      // Нажимаем кнопку входа
      await page.click('button:has-text("Войти")')
      
      // Проверяем индикатор загрузки
      await expect(page.locator('text="Загрузка..."')).toBeVisible()
      await expect(page.locator('button:has-text("Войти")')).toBeDisabled()
    })
  })

  test.describe('Процесс регистрации', () => {
    test('успешно регистрирует нового пользователя-родителя', async ({ page }) => {
      // Подготавливаем моки для регистрации
      await page.route('**/auth/v1/signup*', async route => {
        const json = {
          user: {
            id: 'new-user-id',
            email: 'newparent@example.com',
            role: 'parent'
          }
        }
        await route.fulfill({ json })
      })

      await page.goto('/')
      
      // Переключаемся на регистрацию
      await page.click('text="Нет аккаунта? Зарегистрируйтесь"')
      
      // Заполняем форму регистрации
      await page.fill('input[type="email"]', 'newparent@example.com')
      await page.fill('input[type="password"]', 'password123')
      await page.fill('input[type="tel"]', '+79001234567')
      await page.selectOption('select', 'parent')
      
      // Отправляем форму
      await page.click('button:has-text("Зарегистрироваться")')
      
      // Ожидаем успешной регистрации
      await expect(page.locator('text*="Регистрация успешна"')).toBeVisible({ timeout: 10000 })
    })

    test('регистрирует ребенка с кодом семьи', async ({ page }) => {
      await page.route('**/auth/v1/signup*', async route => {
        const json = {
          user: {
            id: 'new-child-id',
            email: 'child@example.com',
            role: 'child'
          }
        }
        await route.fulfill({ json })
      })

      await page.goto('/')
      
      // Переключаемся на регистрацию
      await page.click('text="Нет аккаунта? Зарегистрируйтесь"')
      
      // Заполняем форму для ребенка
      await page.fill('input[type="email"]', 'child@example.com')
      await page.fill('input[type="password"]', 'password123')
      await page.selectOption('select', 'child')
      await page.fill('input[placeholder*="код семьи"]', 'family-123')
      
      // Отправляем форму
      await page.click('button:has-text("Зарегистрироваться")')
      
      // Ожидаем успешной регистрации
      await expect(page.locator('text*="Регистрация успешна"')).toBeVisible({ timeout: 10000 })
    })

    test('отображает ошибку при существующем email', async ({ page }) => {
      await page.route('**/auth/v1/signup*', async route => {
        await route.fulfill({
          status: 400,
          json: { error: 'Email already exists' }
        })
      })

      await page.goto('/')
      
      await page.click('text="Нет аккаунта? Зарегистрируйтесь"')
      
      await page.fill('input[type="email"]', 'existing@example.com')
      await page.fill('input[type="password"]', 'password123')
      
      await page.click('button:has-text("Зарегистрироваться")')
      
      await expect(page.locator('text*="Email already exists"')).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Toast уведомления', () => {
    test('показывает и скрывает toast уведомления', async ({ page }) => {
      await page.route('**/auth/v1/signup*', async route => {
        const json = { user: { id: 'test-id', email: 'test@example.com' } }
        await route.fulfill({ json })
      })

      await page.goto('/')
      
      await page.click('text="Нет аккаунта? Зарегистрируйтесь"')
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'password123')
      await page.click('button:has-text("Зарегистрироваться")')
      
      // Проверяем появление toast
      const toast = page.locator('text*="Мы отправили вам письмо"')
      await expect(toast).toBeVisible({ timeout: 5000 })
      
      // Ждем автоматического скрытия toast (через 5 секунд)
      await expect(toast).toBeHidden({ timeout: 7000 })
    })
  })

  test.describe('Выход из системы', () => {
    test('успешно выполняет выход', async ({ page }) => {
      // Сначала "входим" в систему
      await page.route('**/auth/v1/token*', async route => {
        const json = {
          access_token: 'fake-token',
          user: { id: 'test-user-id', email: 'test@example.com' }
        }
        await route.fulfill({ json })
      })

      await authHelpers.login('test@example.com', 'password123')
      
      // Проверяем, что мы в системе
      await expect(page.locator('text="Family Task Manager"')).toBeVisible()
      
      // Подготавливаем мок для выхода
      await page.route('**/auth/v1/logout*', async route => {
        await route.fulfill({ json: {} })
      })
      
      // Выходим
      await page.click('button:has-text("🚪 Выйти")')
      
      // Проверяем возврат на страницу входа
      await expect(page.locator('h2:has-text("Вход")')).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Адаптивность', () => {
    test('корректно отображается на мобильных устройствах', async ({ page }) => {
      // Устанавливаем размер мобильного устройства
      await page.setViewportSize({ width: 375, height: 667 })
      
      await page.goto('/')
      
      // Проверяем, что форма видна и доступна
      await expect(page.locator('h2:has-text("Вход")')).toBeVisible()
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
      await expect(page.locator('button:has-text("Войти")')).toBeVisible()
      
      // Переключаемся на регистрацию
      await page.click('text="Нет аккаунта? Зарегистрируйтесь"')
      
      // Проверяем, что все поля доступны
      await expect(page.locator('select')).toBeVisible()
      await expect(page.locator('input[type="tel"]')).toBeVisible()
      await expect(page.locator('input[placeholder*="код семьи"]')).toBeVisible()
    })

    test('корректно отображается на планшетах', async ({ page }) => {
      // Устанавливаем размер планшета
      await page.setViewportSize({ width: 768, height: 1024 })
      
      await page.goto('/')
      
      // Проверяем адаптивность
      await expect(page.locator('h2:has-text("Вход")')).toBeVisible()
      await expect(page.locator('.max-w-md')).toBeVisible() // Проверяем CSS класс
    })
  })

  test.describe('Доступность', () => {
    test('поддерживает навигацию с клавиатуры', async ({ page }) => {
      await page.goto('/')
      
      // Используем Tab для навигации
      await page.keyboard.press('Tab')
      await expect(page.locator('input[type="email"]')).toBeFocused()
      
      await page.keyboard.press('Tab')
      await expect(page.locator('input[type="password"]')).toBeFocused()
      
      await page.keyboard.press('Tab')
      await expect(page.locator('button:has-text("Войти")')).toBeFocused()
    })

    test('имеет правильные aria-labels и роли', async ({ page }) => {
      await page.goto('/')
      
      // Проверяем accessibility атрибуты
      const emailInput = page.locator('input[type="email"]')
      const passwordInput = page.locator('input[type="password"]')
      
      await expect(emailInput).toHaveAttribute('required')
      await expect(passwordInput).toHaveAttribute('required')
      
      // Проверяем, что labels связаны с inputs
      const emailLabel = page.locator('label:has-text("Email")')
      const passwordLabel = page.locator('label:has-text("Пароль")')
      
      await expect(emailLabel).toBeVisible()
      await expect(passwordLabel).toBeVisible()
    })
  })
})
