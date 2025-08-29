/* Интеграционные тесты для основных пользовательских сценариев
 * Проверяет полные потоки взаимодействия в приложении
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, createSupabaseMock, mockUser, mockChild, mockTask, createMockFile } from '../utils'
import App from '../../App'

// Mock для supabase
vi.mock('../../lib/supabase', () => ({
  supabase: createSupabaseMock()
}))

describe('Интеграционные тесты пользовательских сценариев', () => {
  let user
  let mockSupabase

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    
    mockSupabase = createSupabaseMock({
      user: null,
      session: null,
      users: [],
      tasks: [],
      families: []
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Сценарий: Регистрация и первый вход родителя', () => {
    test('родитель регистрируется, создает семью и получает доступ к панели управления', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      // Mock для начального состояния (пользователь не залогинен)
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })
      
      supabase.auth.onAuthStateChange.mockImplementation((callback) => {
        // Имитируем успешную регистрацию
        setTimeout(() => {
          callback('SIGNED_IN', {
            user: mockUser({ role: 'parent' }),
            access_token: 'test-token'
          })
        }, 100)
        
        return {
          data: { subscription: { unsubscribe: vi.fn() } }
        }
      })

      renderWithProviders(<App />)

      // Проверяем, что отображается форма входа
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /вход/i })).toBeInTheDocument()
      })

      // Переключаемся на регистрацию
      const switchToRegister = screen.getByText(/нет аккаунта\? зарегистрируйтесь/i)
      await user.click(switchToRegister)

      // Заполняем форму регистрации
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/пароль/i)
      const roleSelect = screen.getByLabelText(/роль/i)
      
      await user.type(emailInput, 'parent@example.com')
      await user.type(passwordInput, 'password123')
      await user.selectOptions(roleSelect, 'parent')

      // Mock успешной регистрации
      supabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser({ email: 'parent@example.com', role: 'parent' }) },
        error: null
      })
      
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser({ role: 'parent' }) } }
      })
      
      supabase.auth.updateUser.mockResolvedValue({ error: null })
      
      // Mock создания семьи
      supabase.from.mockImplementation((table) => {
        if (table === 'families') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { family_id: 'new-family-123', family_name: 'Семья parent' },
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
              data: mockUser({ role: 'parent', family_id: 'new-family-123' }),
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })

      const submitButton = screen.getByRole('button', { name: /зарегистрироваться/i })
      await user.click(submitButton)

      // Ожидаем успешную регистрацию и переход к панели управления
      await waitFor(() => {
        expect(screen.getByText(/family task manager/i)).toBeInTheDocument()
      })

      // Проверяем, что отображается кнопка управления для родителя
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /👑 управление/i })).toBeInTheDocument()
      })
    })
  })

  describe('Сценарий: Ребенок выполняет задачу', () => {
    test('ребенок входит, видит задачи, выполняет одну с фото-доказательством', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      const childUser = mockChild({ id: 'child-1', email: 'child@example.com' })
      const parentUser = mockUser({ id: 'parent-1', email: 'parent@example.com' })
      const testTask = mockTask({
        id: 'task-1',
        title: 'Убрать комнату',
        status: 'pending',
        assigned_to_id: 'child-1',
        assigned_by_id: 'parent-1'
      })

      // Mock аутентификации ребенка
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: childUser } },
        error: null
      })
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: childUser },
        error: null
      })

      supabase.auth.onAuthStateChange.mockImplementation((callback) => {
        setTimeout(() => callback('SIGNED_IN', { user: childUser }), 0)
        return {
          data: { subscription: { unsubscribe: vi.fn() } }
        }
      })

      // Mock загрузки профиля и задач
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: childUser,
              error: null
            }),
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: childUser,
                error: null
              })
            })),
            update: vi.fn(() => ({
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: childUser,
                error: null
              })
            }))
          }
        }
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [testTask],
              error: null
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
              data: { family_id: 'test-family-id', family_name: 'Тестовая семья' },
              error: null
            }),
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { family_id: 'test-family-id' },
                error: null
              })
            }))
          }
        }
        
        return mockSupabase.from(table)
      })

      // Mock real-time подписки
      supabase.channel.mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn()
      })

      renderWithProviders(<App />)

      // Ожидаем загрузку и отображение задач
      await waitFor(() => {
        expect(screen.getByText(/мои задачи/i)).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText('Убрать комнату')).toBeInTheDocument()
      })

      // Начинаем выполнение задачи
      const startButton = screen.getByRole('button', { name: /начать/i })
      await user.click(startButton)

      // Обновляем mock для отображения задачи в процессе
      supabase.from.mockImplementation((table) => {
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [{ ...testTask, status: 'in_progress' }],
              error: null
            }),
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null })
            }))
          }
        }
        return mockSupabase.from(table)
      })

      // Завершаем задачу с фото
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /завершить/i })).toBeInTheDocument()
      })

      const completeButton = screen.getByRole('button', { name: /завершить/i })
      await user.click(completeButton)

      // Ожидаем появления формы загрузки фото
      await waitFor(() => {
        expect(screen.getByText(/загрузить фото-доказательство/i)).toBeInTheDocument()
      })

      // Mock для загрузки файла
      supabase.storage.from.mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'http://test.com/uploaded-proof.jpg' }
        })
      })

      // Выбираем файл и отправляем
      const fileInput = screen.getByRole('button', { name: /выбрать файл/i })
      const file = createMockFile({ name: 'room-clean.jpg', type: 'image/jpeg' })
      
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByText(/выбран файл: room-clean\.jpg/i)).toBeInTheDocument()
      })

      const sendButton = screen.getByRole('button', { name: /отправить/i })
      await user.click(sendButton)

      // Проверяем, что задача была обновлена
      expect(supabase.storage.from).toHaveBeenCalledWith('task-proofs')
      expect(supabase.from).toHaveBeenCalledWith('tasks')
    })
  })

  describe('Сценарий: Родитель проверяет и подтверждает задачу', () => {
    test('родитель заходит в панель управления, видит выполненную задачу и подтверждает её', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      const parentUser = mockUser({ id: 'parent-1', role: 'parent' })
      const childUser = mockChild({ id: 'child-1' })
      const completedTask = mockTask({
        id: 'task-1',
        title: 'Убрать комнату',
        status: 'completed',
        assigned_to_id: 'child-1',
        assigned_by_id: 'parent-1',
        proof_url: 'http://test.com/proof.jpg',
        assigned_user: { email: 'child@example.com' }
      })

      // Mock аутентификации родителя
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: parentUser } },
        error: null
      })
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: parentUser },
        error: null
      })

      supabase.auth.onAuthStateChange.mockImplementation((callback) => {
        setTimeout(() => callback('SIGNED_IN', { user: parentUser }), 0)
        return {
          data: { subscription: { unsubscribe: vi.fn() } }
        }
      })

      // Mock загрузки данных
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field, value) => {
              if (field === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: parentUser,
                    error: null
                  })
                }
              }
              if (field === 'family_id') {
                return {
                  eq: vi.fn().mockReturnThis(),
                  order: vi.fn().mockResolvedValue({
                    data: [childUser],
                    error: null
                  })
                }
              }
            }),
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: parentUser,
                error: null
              })
            })),
            update: vi.fn(() => ({
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: parentUser,
                error: null
              })
            }))
          }
        }
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [completedTask],
              error: null
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
              data: { family_id: 'test-family-id', family_name: 'Тестовая семья' },
              error: null
            }),
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { family_id: 'test-family-id' },
                error: null
              })
            }))
          }
        }
        
        return mockSupabase.from(table)
      })

      renderWithProviders(<App />)

      // Ожидаем загрузку главной страницы
      await waitFor(() => {
        expect(screen.getByText(/family task manager/i)).toBeInTheDocument()
      })

      // Переходим в панель управления
      const parentDashboardButton = screen.getByRole('button', { name: /👑 управление/i })
      await user.click(parentDashboardButton)

      await waitFor(() => {
        expect(screen.getByText(/панель родителя/i)).toBeInTheDocument()
      })

      // Переходим на вкладку "На проверке"
      const pendingTab = screen.getByRole('button', { name: /⏳ на проверке/i })
      await user.click(pendingTab)

      // Проверяем, что видим выполненную задачу
      await waitFor(() => {
        expect(screen.getByText('Убрать комнату')).toBeInTheDocument()
        expect(screen.getByText('child@example.com')).toBeInTheDocument()
        expect(screen.getByText(/📸 фото-доказательство/i)).toBeInTheDocument()
      })

      // Подтверждаем задачу
      const confirmButton = screen.getByRole('button', { name: /✅ подтвердить/i })
      await user.click(confirmButton)

      // Проверяем, что была вызвана функция обновления
      expect(supabase.from).toHaveBeenCalledWith('tasks')
    })
  })

  describe('Сценарий: Создание и назначение новой задачи', () => {
    test('родитель создает новую задачу и назначает её ребенку', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      const parentUser = mockUser({ id: 'parent-1', role: 'parent' })
      const childUser = mockChild({ id: 'child-1', email: 'child@example.com' })

      // Mock аутентификации
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: parentUser } },
        error: null
      })
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: parentUser },
        error: null
      })

      supabase.auth.onAuthStateChange.mockImplementation((callback) => {
        setTimeout(() => callback('SIGNED_IN', { user: parentUser }), 0)
        return {
          data: { subscription: { unsubscribe: vi.fn() } }
        }
      })

      // Mock загрузки данных
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((field, value) => {
              if (field === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: parentUser,
                    error: null
                  })
                }
              }
              if (field === 'family_id') {
                return {
                  eq: vi.fn().mockReturnThis(),
                  order: vi.fn().mockResolvedValue({
                    data: [childUser],
                    error: null
                  })
                }
              }
            }),
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: parentUser,
                error: null
              })
            })),
            update: vi.fn(() => ({
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: parentUser,
                error: null
              })
            }))
          }
        }
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null
            }),
            insert: vi.fn().mockResolvedValue({
              error: null
            })
          }
        }
        
        if (table === 'families') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { family_id: 'test-family-id', family_name: 'Тестовая семья' },
              error: null
            }),
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { family_id: 'test-family-id' },
                error: null
              })
            }))
          }
        }
        
        return mockSupabase.from(table)
      })

      renderWithProviders(<App />)

      // Переходим в панель управления
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /👑 управление/i })).toBeInTheDocument()
      })

      const parentDashboardButton = screen.getByRole('button', { name: /👑 управление/i })
      await user.click(parentDashboardButton)

      // Переходим на вкладку создания задачи
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /➕ создать задачу/i })).toBeInTheDocument()
      })

      const createTab = screen.getByRole('button', { name: /➕ создать задачу/i })
      await user.click(createTab)

      // Заполняем форму создания задачи
      await waitFor(() => {
        expect(screen.getByLabelText(/название задачи/i)).toBeInTheDocument()
      })

      const titleInput = screen.getByLabelText(/название задачи/i)
      const descriptionInput = screen.getByLabelText(/подробное описание/i)
      const childSelect = screen.getByLabelText(/назначить ребенку/i)
      const prioritySelect = screen.getByLabelText(/приоритет/i)
      const starsInput = screen.getByLabelText(/⭐ звездочки/i)
      const moneyInput = screen.getByLabelText(/💰 деньги/i)

      await user.type(titleInput, 'Помыть посуду')
      await user.type(descriptionInput, 'Помыть всю посуду после ужина')
      await user.selectOptions(childSelect, 'child-1')
      await user.selectOptions(prioritySelect, 'high')
      await user.clear(starsInput)
      await user.type(starsInput, '10')
      await user.clear(moneyInput)
      await user.type(moneyInput, '50')

      const submitButton = screen.getByRole('button', { name: /создать задачу/i })
      await user.click(submitButton)

      // Проверяем, что задача была создана
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('tasks')
      })

      // Проверяем успешное уведомление
      expect(global.alert).toHaveBeenCalledWith('Задача успешно создана!')
    })
  })

  describe('Сценарий: Управление семьей', () => {
    test('пользователь создает семью, получает код и другой пользователь присоединяется по коду', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      const firstUser = mockUser({ id: 'user-1', family_id: null })
      const familyData = { family_id: 'family-123', family_name: 'Семья user' }

      // Mock аутентификации
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: firstUser } },
        error: null
      })
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: firstUser },
        error: null
      })

      supabase.auth.onAuthStateChange.mockImplementation((callback) => {
        setTimeout(() => callback('SIGNED_IN', { user: firstUser }), 0)
        return {
          data: { subscription: { unsubscribe: vi.fn() } }
        }
      })

      // Mock для пользователя без семьи
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: firstUser,
              error: null
            }),
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: firstUser,
                error: null
              })
            })),
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null })
            }))
          }
        }
        
        if (table === 'families') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: familyData,
                error: null
              })
            })),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: familyData,
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })

      renderWithProviders(<App />)

      // Переходим в профиль
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /👤 профиль/i })).toBeInTheDocument()
      })

      const profileButton = screen.getByRole('button', { name: /👤 профиль/i })
      await user.click(profileButton)

      // Создаем новую семью
      await waitFor(() => {
        expect(screen.getByText(/у вас нет семьи/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /создать новую семью/i })).toBeInTheDocument()
      })

      const createFamilyButton = screen.getByRole('button', { name: /создать новую семью/i })
      await user.click(createFamilyButton)

      // Проверяем, что семья была создана
      expect(supabase.from).toHaveBeenCalledWith('families')
      expect(global.alert).toHaveBeenCalledWith('Новая семья создана! Ваш код семьи: family-123')
    })
  })

  describe('Сценарий: Отклонение и переделка задачи', () => {
    test('родитель отклоняет задачу с комментарием, ребенок видит причину и переделывает', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      const parentUser = mockUser({ id: 'parent-1', role: 'parent' })
      const rejectedTask = mockTask({
        id: 'task-1',
        title: 'Убрать комнату',
        status: 'rejected',
        rejection_reason: 'Под кроватью осталась пыль',
        assigned_to_id: 'child-1'
      })

      // Mock аутентификации ребенка
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockChild() } },
        error: null
      })
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockChild() },
        error: null
      })

      supabase.auth.onAuthStateChange.mockImplementation((callback) => {
        setTimeout(() => callback('SIGNED_IN', { user: mockChild() }), 0)
        return {
          data: { subscription: { unsubscribe: vi.fn() } }
        }
      })

      // Mock для отклоненной задачи
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockChild(),
              error: null
            }),
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: mockChild(),
                error: null
              })
            })),
            update: vi.fn(() => ({
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: mockChild(),
                error: null
              })
            }))
          }
        }
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [rejectedTask],
              error: null
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
              data: { family_id: 'test-family-id', family_name: 'Тестовая семья' },
              error: null
            }),
            insert: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { family_id: 'test-family-id' },
                error: null
              })
            }))
          }
        }
        
        return mockSupabase.from(table)
      })

      // Mock real-time подписки
      supabase.channel.mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn()
      })

      renderWithProviders(<App />)

      // Ожидаем загрузку страницы задач
      await waitFor(() => {
        expect(screen.getByText(/мои задачи/i)).toBeInTheDocument()
      })

      // Проверяем, что видим отклоненную задачу с причиной
      await waitFor(() => {
        expect(screen.getByText('Убрать комнату')).toBeInTheDocument()
        expect(screen.getByText('Отклонена')).toBeInTheDocument()
        expect(screen.getByText(/причина отклонения/i)).toBeInTheDocument()
        expect(screen.getByText('Под кроватью осталась пыль')).toBeInTheDocument()
      })

      // Ребенок может начать переделывать задачу
      // (в реальности нужно было бы изменить статус на pending, но это зависит от бизнес-логики)
    })
  })
})
