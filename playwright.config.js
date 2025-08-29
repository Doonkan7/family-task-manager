/* Конфигурация Playwright для E2E тестирования
 * Настройки для полного end-to-end тестирования приложения
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  // Директория с тестами
  testDir: './playwright-tests',
  
  // Паттерн для поиска тестовых файлов
  testMatch: '**/*.e2e.js',
  
  // Запуск тестов в полной изоляции
  fullyParallel: true,
  
  // Остановка при первом падении в CI
  forbidOnly: !!process.env.CI,
  
  // Количество попыток при падении теста
  retries: process.env.CI ? 2 : 0,
  
  // Количество воркеров
  workers: process.env.CI ? 1 : undefined,
  
  // Общие настройки для всех тестов
  use: {
    // Базовый URL приложения
    baseURL: 'http://localhost:5173',
    
    // Запись видео при падении тестов
    video: 'retain-on-failure',
    
    // Скриншоты при падении
    screenshot: 'only-on-failure',
    
    // Трейс для отладки
    trace: 'retain-on-failure',
    
    // Таймауты
    actionTimeout: 10000,
    navigationTimeout: 30000,
    
    // Ожидание загрузки всех ресурсов
    waitUntil: 'networkidle',
    
    // Игнорировать HTTPS ошибки в тестовой среде
    ignoreHTTPSErrors: true,
    
    // Настройки локали
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow'
  },

  // Настройки для разных браузеров
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    }
  ],

  // Веб-сервер для тестирования
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },

  // Настройки отчетов
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }],
    ['junit', { outputFile: 'playwright-results.xml' }]
  ],

  // Глобальные настройки
  globalSetup: './playwright-tests/global-setup.js',
  globalTeardown: './playwright-tests/global-teardown.js',
  
  // Общий таймаут для теста
  timeout: 60000,
  
  // Ожидание перед каждым действием
  expect: {
    timeout: 10000
  },

  // Настройки для CI/CD
  ...(process.env.CI && {
    workers: 1,
    retries: 3,
    use: {
      video: 'retain-on-failure',
      screenshot: 'only-on-failure'
    }
  })
})
