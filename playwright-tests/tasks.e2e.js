/* E2E тесты управления задачами
 * Проверяет полные сценарии создания, выполнения и проверки задач
 */

import { test, expect } from '@playwright/test'
import { AuthHelpers, TaskHelpers, WaitHelpers, FileHelpers } from './utils/helpers.js'

test.describe('Управление задачами', () => {
  let authHelpers
  let _taskHelpers
  let waitHelpers

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page)
    _taskHelpers = new TaskHelpers(page)
    waitHelpers = new WaitHelpers(page)
  })

  test.describe('Просмотр задач (ребенок)', () => {
    test.beforeEach(async ({ page }) => {
      // Мокируем авторизацию ребенка
      await page.route('**/auth/v1/user*', async route => {
        const json = {
          user: {
            id: 'child-1',
            email: 'child@example.com',
            role: 'child'
          }
        }
        await route.fulfill({ json })
      })

      // Мокируем получение задач
      await page.route('**/rest/v1/tasks*', async route => {
        const json = [
          {
            id: 'task-1',
            title: 'Убрать комнату',
            description: 'Убрать игрушки и пропылесосить',
            status: 'pending',
            priority: 'high',
            reward: { stars: 5, money: 100, screen_time: 30 },
            due_date: '2024-12-31T23:59:59Z'
          },
          {
            id: 'task-2',
            title: 'Помыть посуду',
            description: 'Помыть все тарелки и чашки',
            status: 'in_progress',
            priority: 'medium',
            reward: { stars: 3, money: 50, screen_time: 15 }
          }
        ]
        await route.fulfill({ json })
      })
    })

    test('отображает список задач ребенка', async ({ page }) => {
      await authHelpers.login('child@example.com', 'password123')
      
      // Ждем загрузки задач
      await waitHelpers.waitForLoadingToFinish()
      
      // Проверяем заголовок
      await expect(page.locator('h2:has-text("Мои задачи")')).toBeVisible()
      
      // Проверяем задачи
      await expect(page.locator('text="Убрать комнату"')).toBeVisible()
      await expect(page.locator('text="Помыть посуду"')).toBeVisible()
      
      // Проверяем детали первой задачи
      const firstTask = page.locator('text="Убрать комнату"').locator('..').locator('..')
      await expect(firstTask.locator('text="Высокий"')).toBeVisible() // Приоритет
      await expect(firstTask.locator('text="⭐ 5"')).toBeVisible() // Награда
      await expect(firstTask.locator('text="💰 100₽"')).toBeVisible()
      await expect(firstTask.locator('text="🎮 30мин"')).toBeVisible()
    })

    test('показывает правильные статусы задач', async ({ page }) => {
      await authHelpers.login('child@example.com', 'password123')
      await waitHelpers.waitForLoadingToFinish()
      
      // Проверяем статус первой задачи
      const pendingTask = page.locator('text="Убрать комнату"').locator('..').locator('..')
      await expect(pendingTask.locator('text="Ожидает"')).toBeVisible()
      await expect(pendingTask.locator('button:has-text("Начать")')).toBeVisible()
      
      // Проверяем статус второй задачи
      const inProgressTask = page.locator('text="Помыть посуду"').locator('..').locator('..')
      await expect(inProgressTask.locator('text="В процессе"')).toBeVisible()
      await expect(inProgressTask.locator('button:has-text("Завершить")')).toBeVisible()
      await expect(inProgressTask.locator('button:has-text("Без фото")')).toBeVisible()
    })

    test('отображает сообщение когда нет задач', async ({ page }) => {
      // Мокируем пустой список задач
      await page.route('**/rest/v1/tasks*', async route => {
        await route.fulfill({ json: [] })
      })

      await authHelpers.login('child@example.com', 'password123')
      await waitHelpers.waitForLoadingToFinish()
      
      await expect(page.locator('text="Задач пока нет"')).toBeVisible()
      await expect(page.locator('text="Родители еще не назначили вам задания"')).toBeVisible()
    })
  })

  test.describe('Выполнение задач (ребенок)', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/auth/v1/user*', async route => {
        const json = {
          user: { id: 'child-1', email: 'child@example.com', role: 'child' }
        }
        await route.fulfill({ json })
      })

      await page.route('**/rest/v1/tasks*', async route => {
        if (route.request().method() === 'GET') {
          const json = [
            {
              id: 'task-1',
              title: 'Убрать комнату',
              status: 'pending',
              priority: 'high',
              reward: { stars: 5, money: 100, screen_time: 30 }
            }
          ]
          await route.fulfill({ json })
        } else {
          // PATCH запрос для обновления задачи
          await route.fulfill({ json: {} })
        }
      })
    })

    test('начинает выполнение задачи', async ({ page }) => {
      await authHelpers.login('child@example.com', 'password123')
      await waitHelpers.waitForLoadingToFinish()
      
      // Начинаем задачу
      await page.click('button:has-text("Начать")')
      
      // Проверяем изменение статуса
      await waitHelpers.waitForToast('Задача начата')
    })

    test('завершает задачу без фото', async ({ page }) => {
      // Обновляем мок для задачи в процессе
      await page.route('**/rest/v1/tasks*', async route => {
        if (route.request().method() === 'GET') {
          const json = [
            {
              id: 'task-1',
              title: 'Убрать комнату',
              status: 'in_progress',
              priority: 'high'
            }
          ]
          await route.fulfill({ json })
        } else {
          await route.fulfill({ json: {} })
        }
      })

      await authHelpers.login('child@example.com', 'password123')
      await waitHelpers.waitForLoadingToFinish()
      
      // Завершаем без фото
      await page.click('button:has-text("Без фото")')
      
      // Проверяем завершение
      await waitHelpers.waitForToast('Задача завершена')
    })

    test('завершает задачу с фото-доказательством', async ({ page }) => {
      // Мок для Storage API
      await page.route('**/storage/v1/object/task-proofs/**', async route => {
        await route.fulfill({ 
          status: 200,
          json: { message: 'File uploaded' }
        })
      })

      await page.route('**/rest/v1/tasks*', async route => {
        if (route.request().method() === 'GET') {
          const json = [
            {
              id: 'task-1',
              title: 'Убрать комнату',
              status: 'in_progress',
              priority: 'high'
            }
          ]
          await route.fulfill({ json })
        } else {
          await route.fulfill({ json: {} })
        }
      })

      await authHelpers.login('child@example.com', 'password123')
      await waitHelpers.waitForLoadingToFinish()
      
      // Нажимаем "Завершить"
      await page.click('button:has-text("Завершить")')
      
      // Ждем появления формы загрузки
      await expect(page.locator('text="Загрузить фото-доказательство"')).toBeVisible()
      
      // Создаем тестовое изображение
      const testImagePath = FileHelpers.createTestImage()
      
      // Загружаем файл
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(testImagePath)
      
      // Ждем preview
      await expect(page.locator('img[alt="Preview"]')).toBeVisible()
      
      // Отправляем
      await page.click('button:has-text("Отправить")')
      
      // Проверяем завершение
      await waitHelpers.waitForToast('Задача завершена с фото')
    })

    test('отменяет загрузку фото', async ({ page }) => {
      await page.route('**/rest/v1/tasks*', async route => {
        if (route.request().method() === 'GET') {
          const json = [
            {
              id: 'task-1',
              title: 'Убрать комнату',
              status: 'in_progress',
              priority: 'high'
            }
          ]
          await route.fulfill({ json })
        }
      })

      await authHelpers.login('child@example.com', 'password123')
      await waitHelpers.waitForLoadingToFinish()
      
      // Открываем форму загрузки
      await page.click('button:has-text("Завершить")')
      await expect(page.locator('text="Загрузить фото-доказательство"')).toBeVisible()
      
      // Отменяем
      await page.click('button:has-text("Отмена")')
      
      // Проверяем, что форма скрылась
      await expect(page.locator('text="Загрузить фото-доказательство"')).toBeHidden()
    })
  })

  test.describe('Создание задач (родитель)', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/auth/v1/user*', async route => {
        const json = {
          user: { id: 'parent-1', email: 'parent@example.com', role: 'parent' }
        }
        await route.fulfill({ json })
      })

      // Мок для получения детей семьи
      await page.route('**/rest/v1/users*', async route => {
        const json = [
          {
            id: 'child-1',
            email: 'child1@example.com',
            role: 'child'
          },
          {
            id: 'child-2',
            email: 'child2@example.com',
            role: 'child'
          }
        ]
        await route.fulfill({ json })
      })

      // Мок для создания задач
      await page.route('**/rest/v1/tasks*', async route => {
        if (route.request().method() === 'POST') {
          await route.fulfill({ json: { id: 'new-task-id' } })
        } else {
          await route.fulfill({ json: [] })
        }
      })
    })

    test('создает простую задачу', async ({ page }) => {
      await authHelpers.login('parent@example.com', 'password123')
      
      // Переходим в панель управления
      await page.click('button:has-text("👑 Управление")')
      
      // Переходим на вкладку создания
      await page.click('button:has-text("➕ Создать задачу")')
      
      // Заполняем форму
      await page.fill('input[placeholder*="название задачи"]', 'Новая задача')
      await page.fill('textarea[placeholder*="описание"]', 'Описание новой задачи')
      await page.selectOption('select:nth-of-type(1)', 'child-1') // Назначаем ребенку
      await page.selectOption('select:nth-of-type(2)', 'high') // Приоритет
      
      // Создаем задачу
      await page.click('button:has-text("Создать задачу")')
      
      // Проверяем успех
      await waitHelpers.waitForToast('Задача успешно создана!')
    })

    test('создает задачу с наградами', async ({ page }) => {
      await authHelpers.login('parent@example.com', 'password123')
      
      await page.click('button:has-text("👑 Управление")')
      await page.click('button:has-text("➕ Создать задачу")')
      
      // Заполняем основные поля
      await page.fill('input[placeholder*="название задачи"]', 'Задача с наградой')
      await page.selectOption('select:nth-of-type(1)', 'child-1')
      
      // Заполняем награды
      await page.fill('input[type="number"]:nth-of-type(1)', '10') // Звездочки
      await page.fill('input[step="0.01"]', '150') // Деньги
      await page.fill('input[type="number"]:nth-of-type(3)', '45') // Время экрана
      
      await page.click('button:has-text("Создать задачу")')
      
      await waitHelpers.waitForToast('Задача успешно создана!')
    })

    test('создает задачу с дедлайном', async ({ page }) => {
      await authHelpers.login('parent@example.com', 'password123')
      
      await page.click('button:has-text("👑 Управление")')
      await page.click('button:has-text("➕ Создать задачу")')
      
      await page.fill('input[placeholder*="название задачи"]', 'Срочная задача')
      await page.selectOption('select:nth-of-type(1)', 'child-1')
      
      // Устанавливаем дедлайн
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateTimeString = tomorrow.toISOString().slice(0, 16)
      await page.fill('input[type="datetime-local"]', dateTimeString)
      
      await page.click('button:has-text("Создать задачу")')
      
      await waitHelpers.waitForToast('Задача успешно создана!')
    })

    test('валидирует обязательные поля', async ({ page }) => {
      await authHelpers.login('parent@example.com', 'password123')
      
      await page.click('button:has-text("👑 Управление")')
      await page.click('button:has-text("➕ Создать задачу")')
      
      // Пытаемся создать без заполнения обязательных полей
      await page.click('button:has-text("Создать задачу")')
      
      // Проверяем сообщение об ошибке
      await expect(page.locator('text*="Заполните обязательные поля"')).toBeVisible()
    })

    test('очищает форму по кнопке', async ({ page }) => {
      await authHelpers.login('parent@example.com', 'password123')
      
      await page.click('button:has-text("👑 Управление")')
      await page.click('button:has-text("➕ Создать задачу")')
      
      // Заполняем поля
      await page.fill('input[placeholder*="название задачи"]', 'Тестовая задача')
      await page.fill('textarea[placeholder*="описание"]', 'Описание')
      
      // Очищаем форму
      await page.click('button:has-text("Очистить")')
      
      // Проверяем, что поля очистились
      await expect(page.locator('input[placeholder*="название задачи"]')).toHaveValue('')
      await expect(page.locator('textarea[placeholder*="описание"]')).toHaveValue('')
    })
  })

  test.describe('Проверка задач (родитель)', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/auth/v1/user*', async route => {
        const json = {
          user: { id: 'parent-1', email: 'parent@example.com', role: 'parent' }
        }
        await route.fulfill({ json })
      })

      // Мок для задач на проверке
      await page.route('**/rest/v1/tasks*', async route => {
        if (route.request().method() === 'GET') {
          const json = [
            {
              id: 'task-1',
              title: 'Убрать комнату',
              status: 'completed',
              priority: 'high',
              proof_url: 'http://test.com/proof.jpg',
              assigned_user: { email: 'child@example.com' },
              reward: { stars: 5, money: 100, screen_time: 30 },
              completed_at: '2024-01-01T12:00:00Z'
            }
          ]
          await route.fulfill({ json })
        } else {
          // PATCH запрос для обновления
          await route.fulfill({ json: {} })
        }
      })
    })

    test('отображает задачи на проверке', async ({ page }) => {
      await authHelpers.login('parent@example.com', 'password123')
      
      await page.click('button:has-text("👑 Управление")')
      await page.click('button:has-text("⏳ На проверке")')
      
      // Проверяем отображение задачи
      await expect(page.locator('text="Убрать комнату"')).toBeVisible()
      await expect(page.locator('text="child@example.com"')).toBeVisible()
      await expect(page.locator('text="📸 Фото-доказательство"')).toBeVisible()
      
      // Проверяем информацию о награде
      await expect(page.locator('text="⭐ 5"')).toBeVisible()
      await expect(page.locator('text="💰 100 руб"')).toBeVisible()
      await expect(page.locator('text="🎮 30 мин"')).toBeVisible()
    })

    test('подтверждает выполненную задачу', async ({ page }) => {
      await authHelpers.login('parent@example.com', 'password123')
      
      await page.click('button:has-text("👑 Управление")')
      await page.click('button:has-text("⏳ На проверке")')
      
      // Подтверждаем задачу
      await page.click('button:has-text("✅ Подтвердить")')
      
      // Проверяем, что задача была обновлена
      await waitHelpers.waitForToast('Задача подтверждена')
    })

    test('отклоняет задачу с причиной', async ({ page }) => {
      await authHelpers.login('parent@example.com', 'password123')
      
      await page.click('button:has-text("👑 Управление")')
      await page.click('button:has-text("⏳ На проверке")')
      
      // Заполняем причину отклонения
      await page.fill('textarea[placeholder*="причина отклонения"]', 'Комната убрана не полностью')
      
      // Отклоняем задачу
      await page.click('button:has-text("❌ Отклонить")')
      
      // Проверяем результат
      await waitHelpers.waitForToast('Задача отклонена')
    })

    test('требует причину для отклонения', async ({ page }) => {
      await authHelpers.login('parent@example.com', 'password123')
      
      await page.click('button:has-text("👑 Управление")')
      await page.click('button:has-text("⏳ На проверке")')
      
      // Пытаемся отклонить без причины
      await page.click('button:has-text("❌ Отклонить")')
      
      // Проверяем сообщение об ошибке
      await expect(page.locator('text*="Укажите причину отклонения"')).toBeVisible()
    })

    test('показывает сообщение когда нет задач на проверке', async ({ page }) => {
      // Мокируем пустой список
      await page.route('**/rest/v1/tasks*', async route => {
        await route.fulfill({ json: [] })
      })

      await authHelpers.login('parent@example.com', 'password123')
      
      await page.click('button:has-text("👑 Управление")')
      await page.click('button:has-text("⏳ На проверке")')
      
      await expect(page.locator('text="Все задачи проверены!"')).toBeVisible()
      await expect(page.locator('text="Нет задач, ожидающих вашего подтверждения"')).toBeVisible()
    })
  })

  test.describe('Real-time обновления', () => {
    test('обновляет список задач в реальном времени', async ({ page }) => {
      await page.route('**/auth/v1/user*', async route => {
        const json = {
          user: { id: 'child-1', email: 'child@example.com', role: 'child' }
        }
        await route.fulfill({ json })
      })

      let taskList = [
        {
          id: 'task-1',
          title: 'Убрать комнату',
          status: 'pending',
          priority: 'high'
        }
      ]

      await page.route('**/rest/v1/tasks*', async route => {
        await route.fulfill({ json: taskList })
      })

      await authHelpers.login('child@example.com', 'password123')
      await waitHelpers.waitForLoadingToFinish()
      
      // Проверяем начальное состояние
      await expect(page.locator('text="Убрать комнату"')).toBeVisible()
      await expect(page.locator('text="Ожидает"')).toBeVisible()
      
      // Эмулируем обновление задачи через WebSocket
      taskList[0].status = 'in_progress'
      
      // Эмулируем получение real-time обновления
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('supabase-realtime-update', {
          detail: { table: 'tasks', eventType: 'UPDATE' }
        }))
      })
      
      // Проверяем обновление
      await expect(page.locator('text="В процессе"')).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Отображение отклоненных задач', () => {
    test('показывает причину отклонения ребенку', async ({ page }) => {
      await page.route('**/auth/v1/user*', async route => {
        const json = {
          user: { id: 'child-1', email: 'child@example.com', role: 'child' }
        }
        await route.fulfill({ json })
      })

      await page.route('**/rest/v1/tasks*', async route => {
        const json = [
          {
            id: 'task-1',
            title: 'Убрать комнату',
            status: 'rejected',
            priority: 'high',
            rejection_reason: 'Под кроватью осталась пыль'
          }
        ]
        await route.fulfill({ json })
      })

      await authHelpers.login('child@example.com', 'password123')
      await waitHelpers.waitForLoadingToFinish()
      
      // Проверяем отображение отклоненной задачи
      await expect(page.locator('text="Убрать комнату"')).toBeVisible()
      await expect(page.locator('text="Отклонена"')).toBeVisible()
      await expect(page.locator('text="Причина отклонения"')).toBeVisible()
      await expect(page.locator('text="Под кроватью осталась пыль"')).toBeVisible()
    })
  })
})
