/* Вспомогательные функции для E2E тестов
 * Переиспользуемые утилиты для упрощения тестирования
 */

// import { expect } from '@playwright/test' // временно не используется
import path from 'path'

/**
 * Утилиты для авторизации
 */
export class AuthHelpers {
  constructor(page) {
    this.page = page
  }

  /**
   * Выполняет вход в систему
   * @param {string} email - Email пользователя
   * @param {string} password - Пароль пользователя
   */
  async login(email, password) {
    await this.page.goto('/')
    
    // Ждем загрузки формы входа
    await this.page.waitForSelector('input[type="email"]')
    
    // Заполняем форму
    await this.page.fill('input[type="email"]', email)
    await this.page.fill('input[type="password"]', password)
    
    // Нажимаем кнопку входа
    await this.page.click('button:has-text("Войти")')
    
    // Ждем успешного входа
    await this.page.waitForSelector('text="Family Task Manager"', { timeout: 10000 })
  }

  /**
   * Выполняет регистрацию нового пользователя
   * @param {Object} userData - Данные пользователя
   */
  async register(userData) {
    await this.page.goto('/')
    
    // Переключаемся на регистрацию
    await this.page.click('text="Нет аккаунта? Зарегистрируйтесь"')
    
    // Заполняем форму регистрации
    await this.page.fill('input[type="email"]', userData.email)
    await this.page.fill('input[type="password"]', userData.password)
    
    if (userData.phone) {
      await this.page.fill('input[type="tel"]', userData.phone)
    }
    
    if (userData.role) {
      await this.page.selectOption('select', userData.role)
    }
    
    if (userData.familyCode) {
      await this.page.fill('input[placeholder*="код семьи"]', userData.familyCode)
    }
    
    // Нажимаем кнопку регистрации
    await this.page.click('button:has-text("Зарегистрироваться")')
    
    // Ждем результата
    await this.page.waitForSelector('text="Регистрация успешна"', { timeout: 10000 })
  }

  /**
   * Выполняет выход из системы
   */
  async logout() {
    await this.page.click('button:has-text("🚪 Выйти")')
    
    // Ждем возврата на страницу входа
    await this.page.waitForSelector('text="Вход"', { timeout: 5000 })
  }
}

/**
 * Утилиты для работы с задачами
 */
export class TaskHelpers {
  constructor(page) {
    this.page = page
  }

  /**
   * Создает новую задачу (для родителей)
   * @param {Object} taskData - Данные задачи
   */
  async createTask(taskData) {
    // Переходим в панель управления
    await this.page.click('button:has-text("👑 Управление")')
    
    // Переходим на вкладку создания задачи
    await this.page.click('button:has-text("➕ Создать задачу")')
    
    // Заполняем форму
    await this.page.fill('input[placeholder*="название задачи"]', taskData.title)
    
    if (taskData.description) {
      await this.page.fill('textarea[placeholder*="описание"]', taskData.description)
    }
    
    if (taskData.assignedTo) {
      await this.page.selectOption('select', taskData.assignedTo)
    }
    
    if (taskData.priority) {
      await this.page.selectOption('select', taskData.priority)
    }
    
    if (taskData.dueDate) {
      await this.page.fill('input[type="datetime-local"]', taskData.dueDate)
    }
    
    // Заполняем награды
    if (taskData.reward) {
      if (taskData.reward.stars) {
        await this.page.fill('input[type="number"]', taskData.reward.stars.toString())
      }
      if (taskData.reward.money) {
        await this.page.fill('input[step="0.01"]', taskData.reward.money.toString())
      }
      if (taskData.reward.screenTime) {
        await this.page.fill('input[type="number"]:nth-of-type(3)', taskData.reward.screenTime.toString())
      }
    }
    
    // Создаем задачу
    await this.page.click('button:has-text("Создать задачу")')
    
    // Ждем подтверждения
    await this.page.waitForSelector('text="Задача успешно создана"', { timeout: 5000 })
  }

  /**
   * Начинает выполнение задачи (для детей)
   * @param {string} taskTitle - Название задачи
   */
  async startTask(taskTitle) {
    // Находим задачу и нажимаем "Начать"
    const taskCard = this.page.locator(`text="${taskTitle}"`).locator('..').locator('..')
    await taskCard.locator('button:has-text("Начать")').click()
    
    // Ждем изменения статуса
    await this.page.waitForSelector('text="В процессе"', { timeout: 5000 })
  }

  /**
   * Завершает задачу с фото-доказательством
   * @param {string} taskTitle - Название задачи
   * @param {string} imagePath - Путь к изображению (опционально)
   */
  async completeTaskWithPhoto(taskTitle, imagePath = null) {
    const taskCard = this.page.locator(`text="${taskTitle}"`).locator('..').locator('..')
    
    // Нажимаем "Завершить"
    await taskCard.locator('button:has-text("Завершить")').click()
    
    if (imagePath) {
      // Ждем появления формы загрузки
      await this.page.waitForSelector('text="Загрузить фото-доказательство"')
      
      // Загружаем файл
      const fileInput = this.page.locator('input[type="file"]')
      await fileInput.setInputFiles(imagePath)
      
      // Ждем preview
      await this.page.waitForSelector('img[alt="Preview"]')
      
      // Отправляем
      await this.page.click('button:has-text("Отправить")')
    } else {
      // Завершаем без фото
      await taskCard.locator('button:has-text("Без фото")').click()
    }
    
    // Ждем изменения статуса
    await this.page.waitForSelector('text="На проверке"', { timeout: 5000 })
  }

  /**
   * Подтверждает задачу (для родителей)
   * @param {string} taskTitle - Название задачи
   */
  async confirmTask(taskTitle) {
    // Переходим на вкладку "На проверке"
    await this.page.click('button:has-text("⏳ На проверке")')
    
    // Находим задачу и подтверждаем
    const taskCard = this.page.locator(`text="${taskTitle}"`).locator('..').locator('..')
    await taskCard.locator('button:has-text("✅ Подтвердить")').click()
    
    // Ждем обновления списка
    await this.page.waitForTimeout(1000)
  }

  /**
   * Отклоняет задачу с причиной (для родителей)
   * @param {string} taskTitle - Название задачи
   * @param {string} reason - Причина отклонения
   */
  async rejectTask(taskTitle, reason) {
    // Переходим на вкладку "На проверке"
    await this.page.click('button:has-text("⏳ На проверке")')
    
    // Находим задачу
    const taskCard = this.page.locator(`text="${taskTitle}"`).locator('..').locator('..')
    
    // Заполняем причину отклонения
    await taskCard.locator('textarea[placeholder*="причина отклонения"]').fill(reason)
    
    // Отклоняем
    await taskCard.locator('button:has-text("❌ Отклонить")').click()
    
    // Ждем обновления списка
    await this.page.waitForTimeout(1000)
  }
}

/**
 * Утилиты для работы с семьей
 */
export class FamilyHelpers {
  constructor(page) {
    this.page = page
  }

  /**
   * Создает новую семью
   * @returns {string} Код семьи
   */
  async createFamily() {
    // Переходим в профиль
    await this.page.click('button:has-text("👤 Профиль")')
    
    // Создаем семью
    await this.page.click('button:has-text("Создать новую семью")')
    
    // Ждем alert с кодом семьи
    const alertPromise = this.page.waitForEvent('dialog')
    const dialog = await alertPromise
    const message = dialog.message()
    
    // Извлекаем код семьи из сообщения
    const familyCodeMatch = message.match(/код семьи: (.+)$/i)
    const familyCode = familyCodeMatch ? familyCodeMatch[1] : null
    
    await dialog.accept()
    
    return familyCode
  }

  /**
   * Присоединяется к существующей семье
   * @param {string} familyCode - Код семьи
   */
  async joinFamily(familyCode) {
    // Переходим в профиль
    await this.page.click('button:has-text("👤 Профиль")')
    
    // Вводим код семьи
    await this.page.fill('input[placeholder*="код семьи"]', familyCode)
    
    // Присоединяемся
    await this.page.click('button:has-text("Присоединиться")')
    
    // Ждем подтверждения
    await this.page.waitForSelector('text="успешно присоединились"', { timeout: 5000 })
  }

  /**
   * Покидает текущую семью
   */
  async leaveFamily() {
    // Переходим в профиль
    await this.page.click('button:has-text("👤 Профиль")')
    
    // Нажимаем покинуть семью
    const confirmPromise = this.page.waitForEvent('dialog')
    await this.page.click('button:has-text("Покинуть семью")')
    
    // Подтверждаем в диалоге
    const dialog = await confirmPromise
    await dialog.accept()
    
    // Ждем создания новой семьи
    await this.page.waitForSelector('text="создали новую семью"', { timeout: 5000 })
  }
}

/**
 * Утилиты для работы с файлами
 */
export class FileHelpers {
  /**
   * Создает тестовое изображение
   * @param {string} filename - Имя файла
   * @returns {string} Путь к созданному файлу
   */
  static createTestImage(filename = 'test-image.jpg') {
    // В реальных тестах можно создать временный файл
    // Для примера возвращаем путь к существующему файлу
    return path.join(process.cwd(), 'playwright-tests', 'fixtures', filename)
  }

  /**
   * Очищает загруженные файлы
   */
  static async cleanupUploads() {
    // Логика очистки загруженных во время тестов файлов
    console.log('Очистка загруженных файлов...')
  }
}

/**
 * Утилиты для ожиданий и проверок
 */
export class WaitHelpers {
  constructor(page) {
    this.page = page
  }

  /**
   * Ждет появления toast уведомления
   * @param {string} message - Ожидаемое сообщение
   */
  async waitForToast(message) {
    await this.page.waitForSelector(`text="${message}"`, { timeout: 5000 })
  }

  /**
   * Ждет загрузки страницы
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForSelector('body')
  }

  /**
   * Ждет исчезновения индикатора загрузки
   */
  async waitForLoadingToFinish() {
    await this.page.waitForSelector('text="Загрузка"', { state: 'hidden', timeout: 10000 })
  }
}

/**
 * Утилиты для скриншотов и отладки
 */
export class DebugHelpers {
  constructor(page) {
    this.page = page
  }

  /**
   * Делает скриншот страницы
   * @param {string} name - Имя файла скриншота
   */
  async screenshot(name) {
    await this.page.screenshot({ 
      path: `playwright-report/screenshots/${name}.png`,
      fullPage: true 
    })
  }

  /**
   * Выводит HTML содержимое страницы
   */
  async logPageHTML() {
    const html = await this.page.content()
    console.log('Page HTML:', html)
  }

  /**
   * Выводит консольные сообщения
   */
  async logConsole() {
    this.page.on('console', msg => {
      console.log('Browser console:', msg.text())
    })
  }
}
