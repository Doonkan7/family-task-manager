/* Демонстрационные тесты для показа работоспособности системы
 * Простые тесты без сложного мокирования для демонстрации возможностей
 */

import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Простой компонент для тестирования
function SimpleButton({ onClick, children, disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function SimpleForm({ onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" />
      
      <label htmlFor="password">Пароль</label>
      <input id="password" type="password" />
      
      <button type="submit">Отправить</button>
    </form>
  )
}

describe('Демонстрация системы тестирования', () => {
  describe('Базовые возможности Vitest', () => {
    test('простые утверждения работают', () => {
      expect(2 + 2).toBe(4)
      expect('hello').toContain('hell')
      expect([1, 2, 3]).toHaveLength(3)
    })

    test('работа с async/await', async () => {
      const asyncFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'завершено'
      }

      const result = await asyncFunction()
      expect(result).toBe('завершено')
    })

    test('мокирование функций', () => {
      const mockFn = vi.fn()
      mockFn('test argument')
      
      expect(mockFn).toHaveBeenCalledOnce()
      expect(mockFn).toHaveBeenCalledWith('test argument')
    })
  })

  describe('React Testing Library', () => {
    test('рендеринг простого компонента', () => {
      render(<SimpleButton>Кнопка</SimpleButton>)
      
      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.getByText('Кнопка')).toBeInTheDocument()
    })

    test('взаимодействие с кнопкой', async () => {
      const user = userEvent.setup()
      const handleClick = vi.fn()
      
      render(<SimpleButton onClick={handleClick}>Нажми меня</SimpleButton>)
      
      await user.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledOnce()
    })

    test('проверка disabled состояния', () => {
      render(<SimpleButton disabled>Недоступно</SimpleButton>)
      
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('Тестирование форм', () => {
    test('рендеринг формы с полями', () => {
      render(<SimpleForm />)
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /отправить/i })).toBeInTheDocument()
    })

    test('заполнение и отправка формы', async () => {
      const user = userEvent.setup()
      const handleSubmit = vi.fn(e => e.preventDefault())
      
      render(<SimpleForm onSubmit={handleSubmit} />)
      
      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/пароль/i), 'password123')
      await user.click(screen.getByRole('button', { name: /отправить/i }))
      
      expect(handleSubmit).toHaveBeenCalledOnce()
    })

    test('валидация типов полей', () => {
      render(<SimpleForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(passwordInput).toHaveAttribute('type', 'password')
    })
  })

  describe('Доступность (a11y)', () => {
    test('правильная связь label-input', () => {
      render(<SimpleForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toHaveAttribute('id', 'email')
    })

    test('навигация с клавиатуры', async () => {
      const user = userEvent.setup()
      render(<SimpleForm />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      
      emailInput.focus()
      expect(emailInput).toHaveFocus()
      
      await user.tab()
      expect(passwordInput).toHaveFocus()
    })
  })

  describe('Асинхронное тестирование', () => {
    test('ожидание появления элемента', async () => {
      function AsyncComponent() {
        const [loading, setLoading] = React.useState(true)
        
        React.useEffect(() => {
          setTimeout(() => setLoading(false), 100)
        }, [])
        
        return loading ? <div>Загрузка...</div> : <div>Загружено!</div>
      }
      
      render(<AsyncComponent />)
      
      expect(screen.getByText('Загрузка...')).toBeInTheDocument()
      
      await screen.findByText('Загружено!')
      expect(screen.getByText('Загружено!')).toBeInTheDocument()
    })
  })

  describe('Мокирование модулей', () => {
    test('мокирование внешних зависимостей', () => {
      // Пример мокирования localStorage
      const localStorageMock = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        clear: vi.fn()
      }
      
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock
      })
      
      localStorage.setItem('test', 'value')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('test', 'value')
    })
  })

  describe('Тестирование ошибок', () => {
    test('обработка исключений', () => {
      const errorFunction = () => {
        throw new Error('Тестовая ошибка')
      }
      
      expect(errorFunction).toThrow('Тестовая ошибка')
    })

    test('async ошибки', async () => {
      const asyncErrorFunction = async () => {
        throw new Error('Async ошибка')
      }
      
      await expect(asyncErrorFunction()).rejects.toThrow('Async ошибка')
    })
  })
})

// Компонент с React для async теста
import React from 'react'
