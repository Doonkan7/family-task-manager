/* Конфигурация Vitest для тестирования React приложения
 * Интегрируется с Vite для обеспечения совместимости настроек
 */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Окружение для тестирования React компонентов
    environment: 'jsdom',
    
    // Файлы для глобальной настройки тестов
    setupFiles: ['./src/test/setup.jsx'],
    
    // Глобальные переменные для тестов
    globals: true,
    
    // Покрытие кода
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.js',
        '**/*.config.ts',
        'scripts/',
        'public/',
        'dist/'
      ],
      threshold: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    
    // Паттерны для поиска тестовых файлов
    include: [
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'tests/**/*.{test,spec}.{js,jsx,ts,tsx}'
    ],
    
    // Исключения
    exclude: [
      'node_modules',
      'dist',
      '.git',
      '.cache',
      'playwright-tests'
    ],
    
    // Таймауты
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Настройки для параллельного выполнения
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false
      }
    },
    
    // Настройки для mock'ов
    clearMocks: true,
    restoreMocks: true,
    
    // Переменные окружения для тестов
    env: {
      NODE_ENV: 'test',
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-key'
    }
  },
  
  // Алиасы для импортов в тестах
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@test': resolve(__dirname, './src/test')
    }
  }
})
