/* Тесты для компонента Login
 * Проверяет функциональность входа и регистрации пользователей
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, createSupabaseMock, mockUser } from '../../test/utils'
import Login from '../Login'

// Mock для supabase перед импортом компонента
vi.mock('../../lib/supabase', () => ({
  supabase: createSupabaseMock()
}))

describe('Компонент Login', () => {
  let user

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
  })

  describe('Рендеринг компонента', () => {
    test('отображает форму входа по умолчанию', () => {
      renderWithProviders(<Login />)
      
      expect(screen.getByRole('heading', { name: /вход/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument()
      expect(screen.getByText(/нет аккаунта\? зарегистрируйтесь/i)).toBeInTheDocument()
    })

    test('переключается на форму регистрации', async () => {
      renderWithProviders(<Login />)
      
      const switchButton = screen.getByText(/нет аккаунта\? зарегистрируйтесь/i)
      await user.click(switchButton)
      
      expect(screen.getByRole('heading', { name: /регистрация/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/телефон/i)).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: /роль/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/код семьи/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /зарегистрироваться/i })).toBeInTheDocument()
    })

    test('отображает правильные опции ролей', async () => {
      renderWithProviders(<Login />)
      
      const switchButton = screen.getByText(/нет аккаунта\? зарегистрируйтесь/i)
      await user.click(switchButton)
      
      const roleSelect = screen.getByRole('combobox', { name: /роль/i })
      expect(roleSelect).toBeInTheDocument()
      
      const options = screen.getAllByRole('option')
      const optionValues = options.map(option => option.value)
      
      expect(optionValues).toContain('parent')
      expect(optionValues).toContain('child')
      expect(optionValues).toContain('opekun')
      expect(optionValues).toContain('dyadya')
      expect(optionValues).toContain('tetya')
      expect(optionValues).toContain('brother')
      expect(optionValues).toContain('sister')
    })
  })

  describe('Валидация формы', () => {
    test('требует заполнения email и пароля для входа', async () => {
      renderWithProviders(<Login />)
      
      const submitButton = screen.getByRole('button', { name: /войти/i })
      await user.click(submitButton)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      
      expect(emailInput).toBeInvalid()
      expect(passwordInput).toBeInvalid()
    })

    test('валидирует email формат', async () => {
      renderWithProviders(<Login />)
      
      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'неправильный-email')
      
      const submitButton = screen.getByRole('button', { name: /войти/i })
      await user.click(submitButton)
      
      expect(emailInput).toBeInvalid()
    })

    test('принимает корректный email', async () => {
      renderWithProviders(<Login />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      
      expect(emailInput).toBeValid()
      expect(passwordInput).toBeValid()
    })
  })

  describe('Функциональность входа', () => {
    test('успешно выполняет вход с правильными данными', async () => {
      const { supabase } = await import('../../lib/supabase')
      supabase.auth.signInWithPassword.mockResolvedValue({ error: null })

      renderWithProviders(<Login />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      const submitButton = screen.getByRole('button', { name: /войти/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password')
      await user.click(submitButton)
      
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password'
      })
      
      await waitFor(() => {
        expect(screen.getByText(/успешный вход!/i)).toBeInTheDocument()
      })
    })

    test('отображает ошибку при неправильных данных входа', async () => {
      const { supabase } = await import('../../lib/supabase')
      supabase.auth.signInWithPassword.mockResolvedValue({ 
        error: { message: 'Invalid email or password' } 
      })

      renderWithProviders(<Login />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      const submitButton = screen.getByRole('button', { name: /войти/i })
      
      await user.type(emailInput, 'wrong@example.com')
      await user.type(passwordInput, 'wrongpassword')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getAllByText(/ошибка: invalid email or password/i)).toHaveLength(2) // toast + message
      })
    })

    test('отключает кнопку во время загрузки', async () => {
      const { supabase } = await import('../../lib/supabase')
      let resolvePromise
      const loadingPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      supabase.auth.signInWithPassword.mockReturnValue(loadingPromise)

      renderWithProviders(<Login />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      const submitButton = screen.getByRole('button', { name: /войти/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password')
      await user.click(submitButton)
      
      expect(submitButton).toBeDisabled()
      expect(screen.getByText(/загрузка\.\.\./i)).toBeInTheDocument()
      
      // Завершаем Promise
      resolvePromise({ error: null })
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled()
      })
    })
  })

  describe('Функциональность регистрации', () => {
    beforeEach(async () => {
      renderWithProviders(<Login />)
      const switchButton = screen.getByText(/нет аккаунта\? зарегистрируйтесь/i)
      await user.click(switchButton)
    })

    test('успешно выполняет регистрацию с активной сессией', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      // Mock успешной регистрации с активной сессией
      supabase.auth.signUp.mockResolvedValue({ 
        data: { user: mockUser() }, 
        error: null 
      })
      supabase.auth.getSession.mockResolvedValue({ 
        data: { session: { user: mockUser() } } 
      })
      supabase.auth.updateUser.mockResolvedValue({ error: null })
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      })

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      const submitButton = screen.getByRole('button', { name: /зарегистрироваться/i })
      
      await user.type(emailInput, 'newuser@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'password123'
      })
    })

    test('обрабатывает регистрацию без активной сессии', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.signUp.mockResolvedValue({ 
        data: { user: mockUser() }, 
        error: null 
      })
      supabase.auth.getSession.mockResolvedValue({ 
        data: { session: null } 
      })

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      const submitButton = screen.getByRole('button', { name: /зарегистрироваться/i })
      
      await user.type(emailInput, 'newuser@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/регистрация успешна! проверьте email/i)).toBeInTheDocument()
      })
    })

    test('заполняет дополнительные поля регистрации', async () => {
      const phoneInput = screen.getByLabelText(/телефон/i)
      const roleSelect = screen.getByRole('combobox', { name: /роль/i })
      const familyCodeInput = screen.getByLabelText(/код семьи/i)
      
      await user.type(phoneInput, '+79001234567')
      await user.selectOptions(roleSelect, 'child')
      await user.type(familyCodeInput, 'family123')
      
      expect(phoneInput).toHaveValue('+79001234567')
      expect(roleSelect).toHaveValue('child')
      expect(familyCodeInput).toHaveValue('family123')
    })

    test('отображает ошибку регистрации', async () => {
      const { supabase } = await import('../../lib/supabase')
      supabase.auth.signUp.mockResolvedValue({ 
        error: { message: 'Email already exists' } 
      })

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      const submitButton = screen.getByRole('button', { name: /зарегистрироваться/i })
      
      await user.type(emailInput, 'existing@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getAllByText(/ошибка: email already exists/i)).toHaveLength(2) // toast + message
      })
    })
  })

  describe('Toast уведомления', () => {
    test('отображает toast при успешных операциях', async () => {
      const { supabase } = await import('../../lib/supabase')
      supabase.auth.signUp.mockResolvedValue({ 
        data: { user: mockUser() }, 
        error: null 
      })
      supabase.auth.getSession.mockResolvedValue({ 
        data: { session: null } 
      })

      renderWithProviders(<Login />)
      
      const switchButton = screen.getByText(/нет аккаунта\? зарегистрируйтесь/i)
      await user.click(switchButton)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      const submitButton = screen.getByRole('button', { name: /зарегистрироваться/i })
      
      await user.type(emailInput, 'newuser@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/мы отправили вам письмо с подтверждением/i)).toBeInTheDocument()
      })
    })

    test('скрывает toast после таймаута', async () => {
      // Тест логики скрытия toast - упрощенный вариант без fake timers
      const { supabase } = await import('../../lib/supabase')
      supabase.auth.signInWithPassword.mockResolvedValue({ 
        data: null,
        error: { message: 'Test error' } 
      })

      renderWithProviders(<Login />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      const submitButton = screen.getByRole('button', { name: /войти/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password')
      await user.click(submitButton)
      
      // Проверяем, что toast появился (должно быть 2 элемента: toast + message)
      await waitFor(() => {
        expect(screen.getAllByText(/ошибка: test error/i)).toHaveLength(2)
      })
      
      // Вместо fake timers используем реальное ожидание
      // Ждем 5.5 секунд чтобы toast исчез (timeout = 5 секунд)
      await new Promise(resolve => setTimeout(resolve, 5500))
      
      // Проверяем, что toast исчез (остался только message)
      await waitFor(() => {
        const toastElements = screen.queryAllByText(/ошибка: test error/i)
        expect(toastElements).toHaveLength(1)
      })
    }, 15000) // Увеличиваем timeout теста до 15 секунд
  })

  describe('Доступность', () => {
    test('правильно связывает labels с inputs', () => {
      renderWithProviders(<Login />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    test('поддерживает навигацию с клавиатуры', async () => {
      renderWithProviders(<Login />)
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      const submitButton = screen.getByRole('button', { name: /войти/i })
      
      // Фокус должен перемещаться по табуляции
      await user.click(emailInput) // Используем click вместо focus для более надежного фокуса
      expect(document.activeElement).toBe(emailInput)
      
      await user.tab()
      expect(document.activeElement).toBe(passwordInput)
      
      await user.tab()
      expect(document.activeElement).toBe(submitButton)
    })
  })
})
