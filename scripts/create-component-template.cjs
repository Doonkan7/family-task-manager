#!/usr/bin/env node

/**
 * Скрипт для создания нового компонента с автотестами
 * Использование: node scripts/create-component-template.cjs ComponentName
 */

const fs = require('fs');
const path = require('path');

const componentName = process.argv[2];

if (!componentName) {
  console.error('❌ Ошибка: Необходимо указать имя компонента');
  console.log('Использование: node scripts/create-component-template.cjs ComponentName');
  process.exit(1);
}

// Шаблон компонента
const componentTemplate = `import React from 'react'
import { motion } from 'framer-motion'

/**
 * ${componentName} компонент
 * @param {Object} props - Свойства компонента
 */
export default function ${componentName}(props) {
  const MotionDiv = motion.div

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4"
    >
      <h2 className="text-xl font-bold">${componentName}</h2>
      {/* TODO: Добавить функциональность компонента */}
    </MotionDiv>
  )
}
`;

// Шаблон тестов
const testTemplate = `import React from 'react'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, createSupabaseMock } from '../../test/utils'
import ${componentName} from '../${componentName}'

describe('${componentName}', () => {
  let user

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
  })

  describe('Рендеринг компонента', () => {
    test('отображается без ошибок', () => {
      renderWithProviders(<${componentName} />)
      
      expect(screen.getByText('${componentName}')).toBeInTheDocument()
    })

    test('применяет правильные стили', () => {
      renderWithProviders(<${componentName} />)
      
      const container = screen.getByText('${componentName}').closest('div')
      expect(container).toHaveClass('p-4')
    })
  })

  describe('Функциональность', () => {
    test('обрабатывает пользовательские действия', async () => {
      renderWithProviders(<${componentName} />)
      
      // TODO: Добавить тесты для пользовательских действий
      expect(true).toBe(true) // placeholder
    })

    test('корректно обновляет состояние', async () => {
      renderWithProviders(<${componentName} />)
      
      // TODO: Добавить тесты для состояния
      expect(true).toBe(true) // placeholder
    })
  })

  describe('Интеграция с API', () => {
    test('успешно загружает данные', async () => {
      const mockSupabase = createSupabaseMock()
      
      renderWithProviders(<${componentName} />)
      
      // TODO: Добавить тесты для API взаимодействий
      expect(true).toBe(true) // placeholder
    })

    test('обрабатывает ошибки API', async () => {
      const mockSupabase = createSupabaseMock()
      
      renderWithProviders(<${componentName} />)
      
      // TODO: Добавить тесты для ошибок
      expect(true).toBe(true) // placeholder
    })
  })

  describe('Доступность', () => {
    test('поддерживает keyboard navigation', async () => {
      renderWithProviders(<${componentName} />)
      
      // TODO: Добавить тесты для accessibility
      expect(true).toBe(true) // placeholder
    })

    test('имеет правильные ARIA атрибуты', () => {
      renderWithProviders(<${componentName} />)
      
      // TODO: Добавить тесты для ARIA
      expect(true).toBe(true) // placeholder
    })
  })
})
`;

// E2E тест шаблон
const e2eTemplate = `import { test, expect } from '@playwright/test'

test.describe('${componentName} E2E', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Настроить начальное состояние
    await page.goto('/')
  })

  test('пользователь может взаимодействовать с ${componentName}', async ({ page }) => {
    // TODO: Добавить E2E тесты для пользовательских сценариев
    
    // Пример:
    // await page.click('[data-testid="${componentName.toLowerCase()}"]')
    // await expect(page.locator('text=${componentName}')).toBeVisible()
  })

  test('${componentName} корректно работает на мобильных устройствах', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    
    // TODO: Добавить мобильные тесты
  })
})
`;

// Создание файлов
const componentDir = path.join('src', 'components');
const testDir = path.join('src', 'components', '__tests__');
const e2eDir = 'playwright-tests';

// Создаем директории если не существуют
[componentDir, testDir, e2eDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Создаем файлы
const componentPath = path.join(componentDir, `${componentName}.jsx`);
const testPath = path.join(testDir, `${componentName}.test.jsx`);
const e2ePath = path.join(e2eDir, `${componentName.toLowerCase()}.e2e.js`);

try {
  fs.writeFileSync(componentPath, componentTemplate);
  fs.writeFileSync(testPath, testTemplate);
  fs.writeFileSync(e2ePath, e2eTemplate);

  console.log('✅ Компонент успешно создан:');
  console.log(`📁 Компонент: ${componentPath}`);
  console.log(`🧪 Unit тесты: ${testPath}`);
  console.log(`🎭 E2E тесты: ${e2ePath}`);
  console.log('');
  console.log('🚀 Следующие шаги:');
  console.log('1. Реализовать функциональность компонента');
  console.log('2. Написать соответствующие тесты');
  console.log('3. Запустить тесты: npm run test:component ' + componentName);
  console.log('4. Проверить coverage: npm run test:coverage');

} catch (error) {
  console.error('❌ Ошибка при создании файлов:', error.message);
  process.exit(1);
}
