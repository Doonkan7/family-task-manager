/* Глобальная настройка для Playwright тестов
 * Выполняется один раз перед всеми тестами
 */

import { chromium } from '@playwright/test'

async function globalSetup() {
  console.log('🚀 Запуск глобальной настройки E2E тестов...')
  
  // Создаем браузер для предварительной настройки
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Проверяем, что приложение запущено
    console.log('⏳ Проверка доступности приложения...')
    await page.goto('http://localhost:5173', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    // Ждем загрузки основных компонентов
    await page.waitForSelector('body', { timeout: 10000 })
    
    console.log('✅ Приложение доступно и готово к тестированию')
    
    // Можно добавить создание тестовых данных в базе данных
    // если среда NODE_ENV === 'test', то запускаем настройку БД {
    //   await setupTestDatabase() настройка БД
    // окончание блока }
    
  } catch (error) {
    console.error('❌ Ошибка при инициализации тестов:', error)
    throw error
  } finally {
    await browser.close()
  }
}

// Функция для настройки тестовой базы данных (если нужно)
async function _setupTestDatabase() {
  console.log('📁 Настройка тестовой базы данных...')
  
  // Здесь можно добавить логику создания тестовых данных
  // Например, создание тестовых пользователей, семей, задач
  
  console.log('✅ Тестовая база данных готова')
}

export default globalSetup
