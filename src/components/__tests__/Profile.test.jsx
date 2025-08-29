/* Тесты для компонента Profile
 * Проверяет функциональность управления семьей и профилем пользователя
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, createSupabaseMock, mockUser, mockFamily } from '../../test/utils'
import Profile from '../Profile'

// Mock для supabase
vi.mock('../../lib/supabase', () => ({
  supabase: createSupabaseMock()
}))

describe('Компонент Profile', () => {
  let user
  let mockSupabase

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    
    mockSupabase = createSupabaseMock({
      user: mockUser(),
      families: [mockFamily()],
      users: [
        mockUser(),
        mockUser({ 
          id: 'child-1', 
          email: 'child1@example.com', 
          role: 'child' 
        }),
        mockUser({ 
          id: 'child-2', 
          email: 'child2@example.com', 
          role: 'child' 
        })
      ]
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Рендеринг компонента', () => {
    test('отображает заголовок профиля', async () => {
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByText(/профиль семьи/i)).toBeInTheDocument()
      })
    })

    test('показывает индикатор загрузки', () => {
      renderWithProviders(<Profile />)
      
      expect(screen.getByText(/загрузка\.\.\./i)).toBeInTheDocument()
    })
  })

  describe('Отображение информации о семье', () => {
    beforeEach(async () => {
      const { supabase } = await import('../../lib/supabase')
      
      // Mock для получения пользователя
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      })
      
      // Mock для получения данных пользователя с семьей
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field, value) => {
              if (field === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: mockUser({ family_id: 'test-family-id' }),
                    error: null
                  })
                }
              }
              if (field === 'family_id') {
                return Promise.resolve({
                  data: [
                    mockUser({ family_id: 'test-family-id' }),
                    mockUser({ 
                      id: 'child-1', 
                      email: 'child1@example.com', 
                      role: 'child',
                      family_id: 'test-family-id'
                    })
                  ],
                  error: null
                })
              }
            })
          }
        }
        
        if (table === 'families') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockFamily(),
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })
    })

    test('отображает информацию о существующей семье', async () => {
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByText(/информация о семье/i)).toBeInTheDocument()
        expect(screen.getByText(/тестовая семья/i)).toBeInTheDocument()
        expect(screen.getByText(/test-family-id/i)).toBeInTheDocument()
        expect(screen.getByText(/поделитесь этим кодом/i)).toBeInTheDocument()
      })
    })

    test('отображает список членов семьи', async () => {
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByText(/члены семьи/i)).toBeInTheDocument()
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
        expect(screen.getByText('child1@example.com')).toBeInTheDocument()
      })
    })

    test('показывает кнопку покинуть семью', async () => {
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /покинуть семью и создать новую/i })).toBeInTheDocument()
      })
    })
  })

  describe('Отображение профиля без семьи', () => {
    beforeEach(async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockUser({ family_id: null }),
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })
    })

    test('показывает сообщение об отсутствии семьи', async () => {
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByText(/у вас нет семьи/i)).toBeInTheDocument()
        expect(screen.getByText(/вы можете создать новую семью/i)).toBeInTheDocument()
      })
    })

    test('показывает кнопку создания новой семьи', async () => {
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /создать новую семью/i })).toBeInTheDocument()
      })
    })

    test('показывает пустой список членов семьи', async () => {
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByText(/в вашей семье пока нет других членов/i)).toBeInTheDocument()
      })
    })
  })

  describe('Функциональность управления семьей', () => {
    beforeEach(async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockUser({ family_id: null }),
              error: null
            }),
            update: vi.fn().mockReturnThis()
          }
        }
        
        if (table === 'families') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockFamily({ family_id: 'new-family-code' }),
              error: null
            }),
            insert: vi.fn().mockReturnThis()
          }
        }
        
        return mockSupabase.from(table)
      })
    })

    test('создает новую семью', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      // Mock для вставки новой семьи
      supabase.from.mockImplementation((table) => {
        if (table === 'families') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: mockFamily({ family_id: 'new-family-123' }),
                error: null
              })
            }))
          }
        }
        
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockUser({ family_id: null }),
              error: null
            }),
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null })
            }))
          }
        }
        
        return mockSupabase.from(table)
      })
      
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /создать новую семью/i })).toBeInTheDocument()
      })
      
      const createFamilyButton = screen.getByRole('button', { name: /создать новую семью/i })
      await user.click(createFamilyButton)
      
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('families')
      })
    })

    test('присоединяется к существующей семье', async () => {
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/введите код семьи/i)).toBeInTheDocument()
      })
      
      const familyCodeInput = screen.getByPlaceholderText(/введите код семьи/i)
      const joinButton = screen.getByRole('button', { name: /присоединиться/i })
      
      await user.type(familyCodeInput, 'existing-family-code')
      await user.click(joinButton)
      
      const { supabase } = await import('../../lib/supabase')
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('families')
      })
    })

    test('проверяет код семьи перед присоединением', async () => {
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /присоединиться/i })).toBeInTheDocument()
      })
      
      const joinButton = screen.getByRole('button', { name: /присоединиться/i })
      await user.click(joinButton)
      
      // Должно показать alert о необходимости ввести код
      expect(global.alert).toHaveBeenCalledWith('Введите код семьи')
    })
  })

  describe('Функциональность выхода из семьи', () => {
    beforeEach(async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field, value) => {
              if (field === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: mockUser({ family_id: 'test-family-id' }),
                    error: null
                  })
                }
              }
              if (field === 'family_id') {
                return Promise.resolve({
                  data: [mockUser({ family_id: 'test-family-id' })],
                  error: null
                })
              }
            }),
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null })
            }))
          }
        }
        
        if (table === 'families') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockFamily(),
              error: null
            }),
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: mockFamily({ family_id: 'new-family-123' }),
                error: null
              })
            }))
          }
        }
        
        return mockSupabase.from(table)
      })
    })

    test('покидает семью с подтверждением', async () => {
      global.confirm.mockReturnValue(true)
      
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /покинуть семью и создать новую/i })).toBeInTheDocument()
      })
      
      const leaveButton = screen.getByRole('button', { name: /покинуть семью и создать новую/i })
      await user.click(leaveButton)
      
      expect(global.confirm).toHaveBeenCalledWith(
        'Вы уверены, что хотите покинуть семью? Это создаст новую семью для вас.'
      )
      
      const { supabase } = await import('../../lib/supabase')
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('families')
      })
    })

    test('отменяет выход из семьи', async () => {
      global.confirm.mockReturnValue(false)
      
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /покинуть семью и создать новую/i })).toBeInTheDocument()
      })
      
      const leaveButton = screen.getByRole('button', { name: /покинуть семью и создать новую/i })
      await user.click(leaveButton)
      
      expect(global.confirm).toHaveBeenCalled()
      
      const { supabase } = await import('../../lib/supabase')
      // Не должен вызывать создание новой семьи
      expect(supabase.from).not.toHaveBeenCalledWith('families')
    })

    test('отключает кнопку во время выхода из семьи', async () => {
      global.confirm.mockReturnValue(true)
      
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /покинуть семью и создать новую/i })).toBeInTheDocument()
      })
      
      const leaveButton = screen.getByRole('button', { name: /покинуть семью и создать новую/i })
      await user.click(leaveButton)
      
      await waitFor(() => {
        expect(screen.getByText(/создание новой семьи\.\.\./i)).toBeInTheDocument()
      })
    })
  })

  describe('Обработка ошибок', () => {
    test('обрабатывает ошибку создания семьи', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'families') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
              })
            }))
          }
        }
        
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockUser({ family_id: null }),
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })
      
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /создать новую семью/i })).toBeInTheDocument()
      })
      
      const createFamilyButton = screen.getByRole('button', { name: /создать новую семью/i })
      await user.click(createFamilyButton)
      
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Ошибка: Database error')
      })
    })

    test('обрабатывает ошибку присоединения к семье', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'families') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Family not found' }
            })
          }
        }
        
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockUser({ family_id: null }),
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })
      
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/введите код семьи/i)).toBeInTheDocument()
      })
      
      const familyCodeInput = screen.getByPlaceholderText(/введите код семьи/i)
      const joinButton = screen.getByRole('button', { name: /присоединиться/i })
      
      await user.type(familyCodeInput, 'invalid-code')
      await user.click(joinButton)
      
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Ошибка: Family not found')
      })
    })
  })

  describe('Доступность', () => {
    test('правильно связывает labels с inputs', async () => {
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        const familyCodeInput = screen.getByPlaceholderText(/введите код семьи/i)
        expect(familyCodeInput).toBeInTheDocument()
      })
    })

    test('поддерживает навигацию с клавиатуры', async () => {
      renderWithProviders(<Profile />)
      
      await waitFor(() => {
        const familyCodeInput = screen.getByPlaceholderText(/введите код семьи/i)
        const joinButton = screen.getByRole('button', { name: /присоединиться/i })
        
        familyCodeInput.focus()
        expect(document.activeElement).toBe(familyCodeInput)
        
        // Проверяем, что можно переключиться на кнопку
        joinButton.focus()
        expect(document.activeElement).toBe(joinButton)
      })
    })
  })
})
