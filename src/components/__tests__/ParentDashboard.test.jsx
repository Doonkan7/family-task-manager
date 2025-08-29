/* Тесты для компонента ParentDashboard
 * Проверяет функциональность панели управления для родителей
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, createSupabaseMock, mockUser, mockChild, mockTask } from '../../test/utils'
import ParentDashboard from '../ParentDashboard'

// Mock для supabase
vi.mock('../../lib/supabase', () => ({
  supabase: createSupabaseMock()
}))

describe('Компонент ParentDashboard', () => {
  let user
  let mockSupabase

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    
    mockSupabase = createSupabaseMock({
      user: mockUser({ role: 'parent' }),
      users: [
        mockChild({ id: 'child-1', email: 'child1@example.com' }),
        mockChild({ id: 'child-2', email: 'child2@example.com' })
      ],
      tasks: [
        mockTask({ status: 'completed', assigned_to_id: 'child-1' }),
        mockTask({ status: 'completed', assigned_to_id: 'child-2' })
      ]
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Контроль доступа', () => {
    test('блокирует доступ для не-родителей', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockUser({ role: 'child' }),
              error: null
            })
          }
        }
        return mockSupabase.from(table)
      })
      
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/доступ запрещен/i)).toBeInTheDocument()
        expect(screen.getByText(/этот раздел доступен только родителям/i)).toBeInTheDocument()
      })
    })

    test('разрешает доступ для родителей', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              if (field === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: mockUser({ role: 'parent', family_id: 'test-family-id' }),
                    error: null
                  })
                }
              }
              if (field === 'family_id' && field === 'role') {
                return {
                  order: vi.fn().mockResolvedValue({
                    data: [
                      mockChild({ id: 'child-1' }),
                      mockChild({ id: 'child-2' })
                    ],
                    error: null
                  })
                }
              }
            })
          }
        }
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })
      
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/панель родителя/i)).toBeInTheDocument()
      })
    })
  })

  describe('Рендеринг панели управления', () => {
    beforeEach(async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              if (field === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: mockUser({ role: 'parent', family_id: 'test-family-id' }),
                    error: null
                  })
                }
              }
              if (field === 'family_id') {
                return {
                  eq: vi.fn().mockReturnThis(),
                  order: vi.fn().mockResolvedValue({
                    data: [
                      mockChild({ id: 'child-1', email: 'child1@example.com' }),
                      mockChild({ id: 'child-2', email: 'child2@example.com' })
                    ],
                    error: null
                  })
                }
              }
            })
          }
        }
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                mockTask({ 
                  id: 'task-1',
                  status: 'completed',
                  title: 'Убрать комнату',
                  assigned_user: { email: 'child1@example.com' }
                })
              ],
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })
    })

    test('отображает заголовок и счетчик детей', async () => {
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/панель родителя/i)).toBeInTheDocument()
        expect(screen.getByText(/управление задачами семьи • 2 детей/i)).toBeInTheDocument()
      })
    })

    test('отображает навигационные вкладки', async () => {
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /📊 обзор/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /➕ создать задачу/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /⏳ на проверке/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /🎁 награды/i })).toBeInTheDocument()
      })
    })

    test('показывает счетчик задач на проверке', async () => {
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        const pendingTab = screen.getByRole('button', { name: /⏳ на проверке/i })
        expect(pendingTab).toBeInTheDocument()
        expect(screen.getByText('1')).toBeInTheDocument() // счетчик задач
      })
    })
  })

  describe('Вкладка "Обзор"', () => {
    beforeEach(async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              if (field === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: mockUser({ role: 'parent', family_id: 'test-family-id' }),
                    error: null
                  })
                }
              }
              if (field === 'family_id') {
                return {
                  eq: vi.fn().mockReturnThis(),
                  order: vi.fn().mockResolvedValue({
                    data: [
                      mockChild({ email: 'child1@example.com' }),
                      mockChild({ email: 'child2@example.com' })
                    ],
                    error: null
                  })
                }
              }
            })
          }
        }
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [mockTask({ status: 'completed' })],
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })
    })

    test('отображается по умолчанию', async () => {
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/👨‍👩‍👧‍👦 дети в семье/i)).toBeInTheDocument()
        expect(screen.getByText(/⏳ ожидают проверки/i)).toBeInTheDocument()
        expect(screen.getByText(/⚡ быстрые действия/i)).toBeInTheDocument()
      })
    })

    test('показывает список детей', async () => {
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('child1@example.com')).toBeInTheDocument()
        expect(screen.getByText('child2@example.com')).toBeInTheDocument()
      })
    })

    test('показывает количество задач на проверке', async () => {
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument() // количество задач
        expect(screen.getByText(/задач требуют вашего внимания/i)).toBeInTheDocument()
      })
    })

    test('быстрые действия работают', async () => {
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/➕ создать задачу/i)).toBeInTheDocument()
        expect(screen.getByText(/👀 проверить задачи/i)).toBeInTheDocument()
      })
      
      const createTaskButton = screen.getByText(/➕ создать задачу/i)
      await user.click(createTaskButton)
      
      await waitFor(() => {
        expect(screen.getByText(/➕ создать новую задачу/i)).toBeInTheDocument()
      })
    })
  })

  describe('Вкладка "Создать задачу"', () => {
    beforeEach(async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              if (field === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: mockUser({ role: 'parent', family_id: 'test-family-id' }),
                    error: null
                  })
                }
              }
              if (field === 'family_id') {
                return {
                  eq: vi.fn().mockReturnThis(),
                  order: vi.fn().mockResolvedValue({
                    data: [
                      mockChild({ id: 'child-1', email: 'child1@example.com' }),
                      mockChild({ id: 'child-2', email: 'child2@example.com' })
                    ],
                    error: null
                  })
                }
              }
            })
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
        
        return mockSupabase.from(table)
      })
    })

    test('переключается на вкладку создания', async () => {
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /➕ создать задачу/i })).toBeInTheDocument()
      })
      
      const createTab = screen.getByRole('button', { name: /➕ создать задачу/i })
      await user.click(createTab)
      
      await waitFor(() => {
        expect(screen.getByText(/➕ создать новую задачу/i)).toBeInTheDocument()
      })
    })

    test('отображает форму создания задачи', async () => {
      renderWithProviders(<ParentDashboard />)
      
      const createTab = screen.getByRole('button', { name: /➕ создать задачу/i })
      await user.click(createTab)
      
      await waitFor(() => {
        expect(screen.getByLabelText(/название задачи/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/назначить ребенку/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/приоритет/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/подробное описание/i)).toBeInTheDocument()
      })
    })

    test('отображает поля для наград', async () => {
      renderWithProviders(<ParentDashboard />)
      
      const createTab = screen.getByRole('button', { name: /➕ создать задачу/i })
      await user.click(createTab)
      
      await waitFor(() => {
        expect(screen.getByLabelText(/⭐ звездочки/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/💰 деньги/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/🎮 время/i)).toBeInTheDocument()
      })
    })

    test('создает новую задачу', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      renderWithProviders(<ParentDashboard />)
      
      const createTab = screen.getByRole('button', { name: /➕ создать задачу/i })
      await user.click(createTab)
      
      await waitFor(() => {
        expect(screen.getByLabelText(/название задачи/i)).toBeInTheDocument()
      })
      
      const titleInput = screen.getByLabelText(/название задачи/i)
      const childSelect = screen.getByLabelText(/назначить ребенку/i)
      const submitButton = screen.getByRole('button', { name: /создать задачу/i })
      
      await user.type(titleInput, 'Новая задача')
      await user.selectOptions(childSelect, 'child-1')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('tasks')
      })
    })

    test('валидирует обязательные поля', async () => {
      renderWithProviders(<ParentDashboard />)
      
      const createTab = screen.getByRole('button', { name: /➕ создать задачу/i })
      await user.click(createTab)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /создать задачу/i })).toBeInTheDocument()
      })
      
      const submitButton = screen.getByRole('button', { name: /создать задачу/i })
      await user.click(submitButton)
      
      // Компонент должен показать ошибку валидации
      await waitFor(() => {
        expect(screen.getByText(/заполните обязательные поля/i)).toBeInTheDocument()
      })
    })

    test('очищает форму по кнопке', async () => {
      renderWithProviders(<ParentDashboard />)
      
      const createTab = screen.getByRole('button', { name: /➕ создать задачу/i })
      await user.click(createTab)
      
      await waitFor(() => {
        expect(screen.getByLabelText(/название задачи/i)).toBeInTheDocument()
      })
      
      const titleInput = screen.getByLabelText(/название задачи/i)
      const clearButton = screen.getByRole('button', { name: /очистить/i })
      
      await user.type(titleInput, 'Тестовая задача')
      expect(titleInput).toHaveValue('Тестовая задача')
      
      await user.click(clearButton)
      expect(titleInput).toHaveValue('')
    })
  })

  describe('Вкладка "На проверке"', () => {
    beforeEach(async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              if (field === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: mockUser({ role: 'parent', family_id: 'test-family-id' }),
                    error: null
                  })
                }
              }
              if (field === 'family_id') {
                return {
                  eq: vi.fn().mockReturnThis(),
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                }
              }
            })
          }
        }
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              if (field === 'family_id') {
                return {
                  eq: vi.fn().mockReturnThis(),
                  order: vi.fn().mockResolvedValue({
                    data: [
                      mockTask({ 
                        id: 'task-1',
                        status: 'completed',
                        title: 'Убрать комнату',
                        assigned_user: { email: 'child1@example.com' },
                        proof_url: 'http://test.com/proof.jpg',
                        reward: { stars: 5, money: 100, screen_time: 30 }
                      })
                    ],
                    error: null
                  })
                }
              }
            }),
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null })
            }))
          }
        }
        
        return mockSupabase.from(table)
      })
    })

    test('переключается на вкладку проверки', async () => {
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /⏳ на проверке/i })).toBeInTheDocument()
      })
      
      const pendingTab = screen.getByRole('button', { name: /⏳ на проверке/i })
      await user.click(pendingTab)
      
      await waitFor(() => {
        expect(screen.getByText(/⏳ задачи на проверке/i)).toBeInTheDocument()
      })
    })

    test('отображает задачи ожидающие проверки', async () => {
      renderWithProviders(<ParentDashboard />)
      
      const pendingTab = screen.getByRole('button', { name: /⏳ на проверке/i })
      await user.click(pendingTab)
      
      await waitFor(() => {
        expect(screen.getByText('Убрать комнату')).toBeInTheDocument()
        expect(screen.getByText('child1@example.com')).toBeInTheDocument()
        expect(screen.getByText(/⭐ 5/)).toBeInTheDocument()
        expect(screen.getByText(/💰 100 руб/)).toBeInTheDocument()
      })
    })

    test('отображает фото-доказательство', async () => {
      renderWithProviders(<ParentDashboard />)
      
      const pendingTab = screen.getByRole('button', { name: /⏳ на проверке/i })
      await user.click(pendingTab)
      
      await waitFor(() => {
        expect(screen.getByText(/📸 фото-доказательство/i)).toBeInTheDocument()
        const proofImage = screen.getByAltText(/доказательство выполнения/i)
        expect(proofImage).toHaveAttribute('src', 'http://test.com/proof.jpg')
      })
    })

    test('подтверждает задачу', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      renderWithProviders(<ParentDashboard />)
      
      const pendingTab = screen.getByRole('button', { name: /⏳ на проверке/i })
      await user.click(pendingTab)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /✅ подтвердить/i })).toBeInTheDocument()
      })
      
      const confirmButton = screen.getByRole('button', { name: /✅ подтвердить/i })
      await user.click(confirmButton)
      
      expect(supabase.from).toHaveBeenCalledWith('tasks')
    })

    test('отклоняет задачу с причиной', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      renderWithProviders(<ParentDashboard />)
      
      const pendingTab = screen.getByRole('button', { name: /⏳ на проверке/i })
      await user.click(pendingTab)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/укажите что нужно доделать/i)).toBeInTheDocument()
      })
      
      const reasonTextarea = screen.getByPlaceholderText(/укажите что нужно доделать/i)
      const rejectButton = screen.getByRole('button', { name: /❌ отклонить/i })
      
      await user.type(reasonTextarea, 'Комната убрана не полностью')
      await user.click(rejectButton)
      
      expect(supabase.from).toHaveBeenCalledWith('tasks')
    })

    test('требует причину для отклонения', async () => {
      renderWithProviders(<ParentDashboard />)
      
      const pendingTab = screen.getByRole('button', { name: /⏳ на проверке/i })
      await user.click(pendingTab)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /❌ отклонить/i })).toBeInTheDocument()
      })
      
      const rejectButton = screen.getByRole('button', { name: /❌ отклонить/i })
      await user.click(rejectButton)
      
      // Должно показать ошибку о необходимости указать причину
      await waitFor(() => {
        expect(screen.getByText(/укажите причину отклонения задачи/i)).toBeInTheDocument()
      })
    })

    test('показывает сообщение когда нет задач на проверке', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      // Переопределяем mock для возврата пустого списка задач
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              if (field === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: mockUser({ role: 'parent', family_id: 'test-family-id' }),
                    error: null
                  })
                }
              }
              if (field === 'family_id') {
                return {
                  eq: vi.fn().mockReturnThis(),
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                }
              }
            })
          }
        }
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })
      
      renderWithProviders(<ParentDashboard />)
      
      const pendingTab = screen.getByRole('button', { name: /⏳ на проверке/i })
      await user.click(pendingTab)
      
      await waitFor(() => {
        expect(screen.getByText(/все задачи проверены!/i)).toBeInTheDocument()
        expect(screen.getByText(/нет задач, ожидающих вашего подтверждения/i)).toBeInTheDocument()
      })
    })
  })

  describe('Вкладка "Награды"', () => {
    beforeEach(async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              if (field === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: mockUser({ role: 'parent', family_id: 'test-family-id' }),
                    error: null
                  })
                }
              }
              return {
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              }
            })
          }
        }
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })
    })

    test('переключается на вкладку наград', async () => {
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /🎁 награды/i })).toBeInTheDocument()
      })
      
      const rewardsTab = screen.getByRole('button', { name: /🎁 награды/i })
      await user.click(rewardsTab)
      
      await waitFor(() => {
        expect(screen.getByText(/управление наградами/i)).toBeInTheDocument()
        expect(screen.getByText(/раздел находится в разработке/i)).toBeInTheDocument()
      })
    })
  })

  describe('Обработка ошибок', () => {
    test('обрабатывает ошибку загрузки профиля', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Profile not found' }
            })
          }
        }
        
        return mockSupabase.from(table)
      })
      
      renderWithProviders(<ParentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/ошибка загрузки профиля пользователя/i)).toBeInTheDocument()
      })
    })

    test('обрабатывает ошибку создания задачи', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
      
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => {
              if (field === 'id') {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: mockUser({ role: 'parent', family_id: 'test-family-id' }),
                    error: null
                  })
                }
              }
              return {
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({
                  data: [mockChild({ id: 'child-1' })],
                  error: null
                })
              }
            })
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
              error: { message: 'Database error' }
            })
          }
        }
        
        return mockSupabase.from(table)
      })
      
      renderWithProviders(<ParentDashboard />)
      
      const createTab = screen.getByRole('button', { name: /➕ создать задачу/i })
      await user.click(createTab)
      
      await waitFor(() => {
        expect(screen.getByLabelText(/название задачи/i)).toBeInTheDocument()
      })
      
      const titleInput = screen.getByLabelText(/название задачи/i)
      const childSelect = screen.getByLabelText(/назначить ребенку/i)
      const submitButton = screen.getByRole('button', { name: /создать задачу/i })
      
      await user.type(titleInput, 'Новая задача')
      await user.selectOptions(childSelect, 'child-1')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/ошибка при создании задачи/i)).toBeInTheDocument()
      })
    })
  })
})
