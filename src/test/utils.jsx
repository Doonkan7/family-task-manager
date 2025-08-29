/* Утилиты для тестирования React компонентов
 * Предоставляет вспомогательные функции для настройки тестовой среды
 */

import React from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

/**
 * Кастомная функция рендеринга с провайдерами
 * @param {React.ReactElement} ui - Компонент для рендеринга
 * @param {Object} options - Опции рендеринга
 * @returns {Object} Результат рендеринга с дополнительными утилитами
 */
export function renderWithProviders(ui, {
  // initialEntries = ['/'], // временно не используется
  ...renderOptions
} = {}) {
  const Wrapper = ({ children }) => {
    return (
      <div data-testid="test-wrapper">
        {children}
      </div>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  }
}

/**
 * Создает mock для Supabase с настраиваемыми данными
 * @param {Object} mockData - Данные для мокирования
 * @returns {Object} Mock объект для Supabase
 */
export function createSupabaseMock(mockData = {}) {
  const defaultMockData = {
    user: null,
    session: null,
    tasks: [],
    users: [],
    families: []
  }

  const data = { ...defaultMockData, ...mockData }

  return {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ 
        data: { user: data.user }, 
        error: null 
      })),
      getSession: vi.fn(() => Promise.resolve({ 
        data: { session: data.session }, 
        error: null 
      })),
      signInWithPassword: vi.fn((credentials) => {
        if (credentials.email === 'test@example.com' && credentials.password === 'password') {
          return Promise.resolve({ data: { user: data.user }, error: null })
        }
        return Promise.resolve({ data: null, error: { message: 'Invalid credentials' } })
      }),
      signUp: vi.fn(() => Promise.resolve({ 
        data: { user: data.user }, 
        error: null 
      })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      updateUser: vi.fn(() => Promise.resolve({ data: { user: data.user }, error: null })),
      onAuthStateChange: vi.fn((callback) => {
        // Имитируем вызов колбэка с сессией
        setTimeout(() => callback('SIGNED_IN', data.session), 0)
        return {
          data: { 
            subscription: { 
              unsubscribe: vi.fn() 
            } 
          }
        }
      })
    },
    from: vi.fn((table) => {
      const tableData = data[table] || []
      
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn((newData) => {
          tableData.push(...newData)
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn(() => Promise.resolve({ data: newData[0], error: null }))
          }
        }),
        update: vi.fn((updateData) => {
          return {
            eq: vi.fn(() => Promise.resolve({ data: updateData, error: null }))
          }
        }),
        delete: vi.fn(() => ({ 
          eq: vi.fn(() => Promise.resolve({ error: null }))
        })),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(() => Promise.resolve({ 
          data: tableData[0] || null, 
          error: null 
        })),
        order: vi.fn(() => Promise.resolve({ 
          data: tableData, 
          error: null 
        })),
        maybeSingle: vi.fn(() => Promise.resolve({ 
          data: tableData[0] || null, 
          error: null 
        })),
        limit: vi.fn(() => Promise.resolve({ 
          data: tableData.slice(0, 10), 
          error: null 
        }))
      }
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: vi.fn(() => ({ 
          data: { publicUrl: 'http://test.com/image.jpg' } 
        })),
        remove: vi.fn(() => Promise.resolve({ error: null }))
      }))
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn()
    }))
  }
}

/**
 * Ожидает завершения всех асинхронных операций
 * @param {number} timeout - Таймаут в миллисекундах
 */
export function waitForAsync(timeout = 0) {
  return new Promise(resolve => setTimeout(resolve, timeout))
}

/**
 * Генерирует mock данные пользователя
 * @param {Object} overrides - Переопределения данных
 * @returns {Object} Mock пользователь
 */
export function mockUser(overrides = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'parent',
    family_id: 'test-family-id',
    phone: '+1234567890',
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Генерирует mock данные ребенка
 * @param {Object} overrides - Переопределения данных
 * @returns {Object} Mock ребенок
 */
export function mockChild(overrides = {}) {
  return {
    id: 'test-child-id',
    email: 'child@example.com',
    role: 'child',
    family_id: 'test-family-id',
    name: 'Тестовый Ребенок',
    age: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Генерирует mock данные задачи
 * @param {Object} overrides - Переопределения данных
 * @returns {Object} Mock задача
 */
export function mockTask(overrides = {}) {
  return {
    id: 'test-task-id',
    family_id: 'test-family-id',
    assigned_to: 'test-child-id',
    created_by: 'test-user-id',
    title: 'Тестовая задача',
    description: 'Описание тестовой задачи',
    status: 'pending',
    priority: 'medium',
    reward_points: 10,
    difficulty: 'easy',
    due_date: new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completion_note: null,
    proof_required: false,
    proof_images: [],
    ...overrides
  }
}

/**
 * Генерирует mock данные семьи
 * @param {Object} overrides - Переопределения данных
 * @returns {Object} Mock семья
 */
export function mockFamily(overrides = {}) {
  return {
    family_id: 'test-family-id',
    family_name: 'Тестовая семья',
    created_by: 'test-user-id',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    settings: {
      currency: 'RUB',
      timezone: 'Europe/Moscow'
    },
    ...overrides
  }
}

/**
 * Создает событие для загрузки файла
 * @param {Object} fileData - Данные файла
 * @returns {Object} Mock File объект
 */
export function createMockFile(fileData = {}) {
  const defaultFile = {
    name: 'test-image.jpg',
    size: 1024,
    type: 'image/jpeg',
    lastModified: Date.now()
  }

  return new File(['test'], fileData.name || defaultFile.name, {
    type: fileData.type || defaultFile.type,
    lastModified: fileData.lastModified || defaultFile.lastModified
  })
}

/**
 * Имитирует пользовательский ввод в поле
 * @param {HTMLElement} element - Элемент для ввода
 * @param {string} value - Значение для ввода
 */
export function simulateInput(element, value) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Имитирует выбор файла
 * @param {HTMLElement} fileInput - Input элемент типа file
 * @param {File} file - Файл для выбора
 */
export function simulateFileSelect(fileInput, file) {
  Object.defineProperty(fileInput, 'files', {
    value: [file],
    writable: false
  })
  fileInput.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Проверяет наличие текста в документе
 * @param {string} text - Текст для поиска
 * @returns {boolean} True если текст найден
 */
export function hasTextInDocument(text) {
  return document.body.textContent.includes(text)
}

/**
 * Ожидает появления элемента в DOM
 * @param {Function} getElement - Функция для получения элемента
 * @param {number} timeout - Таймаут ожидания
 * @returns {Promise<HTMLElement>} Найденный элемент
 */
export function waitForElement(getElement, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const interval = 100
    let elapsed = 0

    const check = () => {
      const element = getElement()
      if (element) {
        resolve(element)
        return
      }

      elapsed += interval
      if (elapsed >= timeout) {
        reject(new Error(`Element not found within ${timeout}ms`))
        return
      }

      setTimeout(check, interval)
    }

    check()
  })
}

/**
 * Создает mock для localStorage
 * @returns {Object} Mock объект localStorage
 */
export function createLocalStorageMock() {
  const store = {}
  
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value)
    }),
    removeItem: vi.fn((key) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
    key: vi.fn((index) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length
    }
  }
}

// Экспорт всех утилит для удобства
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
