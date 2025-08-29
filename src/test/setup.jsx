/* Файл настройки тестовой среды
 * Выполняется перед каждым тестом для подготовки окружения
 */

import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Расширяем expect дополнительными матчерами от jest-dom
expect.extend(matchers)

// Очистка DOM после каждого теста
afterEach(() => {
  cleanup()
})

// Mock для framer-motion (упрощает тестирование анимаций)
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => {
      const { className, style, onClick } = props
      return <div className={className} style={style} onClick={onClick}>{children}</div>
    },
    form: ({ children, ...props }) => {
      const { className, style, onSubmit } = props
      return <form className={className} style={style} onSubmit={onSubmit}>{children}</form>
    },
    button: ({ children, ...props }) => {
      const { className, style, onClick } = props
      return <button className={className} style={style} onClick={onClick}>{children}</button>
    },
    h1: ({ children, ...props }) => {
      const { className, style } = props
      return <h1 className={className} style={style}>{children}</h1>
    },
    h2: ({ children, ...props }) => {
      const { className, style } = props
      return <h2 className={className} style={style}>{children}</h2>
    },
    h3: ({ children, ...props }) => {
      const { className, style } = props
      return <h3 className={className} style={style}>{children}</h3>
    },
    p: ({ children, ...props }) => {
      const { className, style } = props
      return <p className={className} style={style}>{children}</p>
    },
    img: ({ alt, src, ...props }) => {
      const { className, style } = props
      return <img alt={alt} src={src} className={className} style={style} />
    }
  },
  AnimatePresence: ({ children }) => children
}))

// Mock для Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      }))
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://test.com/image.jpg' } }))
      }))
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn()
    }))
  },
  testConnection: vi.fn(() => Promise.resolve({ success: true }))
}))

// Mock для URL.createObjectURL (используется для превью файлов)
global.URL.createObjectURL = vi.fn(() => 'mocked-object-url')
global.URL.revokeObjectURL = vi.fn()

// Mock для window.alert и window.confirm
global.alert = vi.fn()
global.confirm = vi.fn(() => true)

// Mock для window.location.reload
Object.defineProperty(window, 'location', {
  value: {
    reload: vi.fn()
  },
  writable: true
})

// Mock для console методов в тестах
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn()
}

// Настройка IntersectionObserver для тестов
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn()
}))

// Настройка ResizeObserver для тестов
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn()
}))

// Утилитарные функции для тестов
export const mockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'parent',
  family_id: 'test-family-id',
  phone: '+7900123456',
  verified: true,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const mockChild = (overrides = {}) => ({
  id: 'test-child-id',
  email: 'child@example.com',
  role: 'child',
  family_id: 'test-family-id',
  phone: null,
  verified: true,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const mockTask = (overrides = {}) => ({
  id: 'test-task-id',
  title: 'Тестовая задача',
  description: 'Описание тестовой задачи',
  priority: 'medium',
  status: 'pending',
  assigned_to_id: 'test-child-id',
  assigned_by_id: 'test-user-id',
  family_id: 'test-family-id',
  reward: { stars: 5, money: 100, screen_time: 30 },
  due_date: '2024-12-31T23:59:59Z',
  created_at: '2024-01-01T00:00:00Z',
  proof_url: null,
  rejection_reason: null,
  ...overrides
})

export const mockFamily = (overrides = {}) => ({
  family_id: 'test-family-id',
  family_name: 'Тестовая семья',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides
})
