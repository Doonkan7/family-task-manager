/* Тесты для компонента Tasks
 * Проверяет функциональность просмотра, выполнения и управления задачами
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, createSupabaseMock, mockUser, mockTask, createMockFile } from '../../test/utils'
import Tasks from '../Tasks'

// Mock для supabase
vi.mock('../../lib/supabase', () => ({
  supabase: createSupabaseMock()
}))

describe('Компонент Tasks', () => {
  let user
  let mockSupabase

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    
    // Получаем mock supabase
    mockSupabase = createSupabaseMock({
      user: mockUser({ role: 'child' }),
      tasks: [
        mockTask({ 
          id: 'task-1',
          title: 'Убрать комнату',
          status: 'pending',
          priority: 'high'
        }),
        mockTask({ 
          id: 'task-2',
          title: 'Помыть посуду',
          status: 'in_progress',
          priority: 'medium'
        }),
        mockTask({ 
          id: 'task-3',
          title: 'Выучить уроки',
          status: 'completed',
          priority: 'low',
          proof_url: 'http://test.com/proof.jpg'
        })
      ]
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Рендеринг компонента', () => {
    test('отображает заголовок страницы', async () => {
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText(/мои задачи/i)).toBeInTheDocument()
      })
    })

    test('показывает индикатор загрузки', () => {
      renderWithProviders(<Tasks />)
      
      expect(screen.getByText(/загружаем задачи/i)).toBeInTheDocument()
    })

    test('отображает сообщение когда нет задач', async () => {
      const { supabase } = await import('../../lib/supabase')
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUser({ role: 'child' }), error: null })
      })

      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText(/задач пока нет/i)).toBeInTheDocument()
        expect(screen.getByText(/родители еще не назначили вам задания/i)).toBeInTheDocument()
      })
    })
  })

  describe('Отображение задач', () => {
    beforeEach(async () => {
      const { supabase } = await import('../../lib/supabase')
      
      // Mock для получения пользователя
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
      
      // Mock для получения профиля
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
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                mockTask({ 
                  id: 'task-1',
                  title: 'Убрать комнату',
                  status: 'pending',
                  priority: 'high',
                  reward: { stars: 5, money: 100, screen_time: 30 }
                }),
                mockTask({ 
                  id: 'task-2',
                  title: 'Помыть посуду',
                  status: 'in_progress',
                  priority: 'medium'
                })
              ],
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })
    })

    test('отображает список задач', async () => {
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText('Убрать комнату')).toBeInTheDocument()
        expect(screen.getByText('Помыть посуду')).toBeInTheDocument()
      })
    })

    test('отображает приоритеты задач', async () => {
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText('Высокий')).toBeInTheDocument()
        expect(screen.getByText('Средний')).toBeInTheDocument()
      })
    })

    test('отображает статусы задач', async () => {
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText('Ожидает')).toBeInTheDocument()
        expect(screen.getByText('В процессе')).toBeInTheDocument()
      })
    })

    test('отображает информацию о наградах', async () => {
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText(/⭐ 5/)).toBeInTheDocument()
        expect(screen.getByText(/💰 100₽/)).toBeInTheDocument()
        expect(screen.getByText(/🎮 30мин/)).toBeInTheDocument()
      })
    })
  })

  describe('Взаимодействие с задачами', () => {
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
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ 
              data: mockUser({ role: 'child' }), 
              error: null 
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
                  title: 'Убрать комнату',
                  status: 'pending'
                }),
                mockTask({ 
                  id: 'task-2',
                  title: 'Помыть посуду',
                  status: 'in_progress'
                })
              ],
              error: null
            }),
            update: vi.fn().mockReturnThis()
          }
        }
        
        return mockSupabase.from(table)
      })
    })

    test('начинает выполнение задачи', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText('Убрать комнату')).toBeInTheDocument()
      })
      
      const startButton = screen.getByRole('button', { name: /начать/i })
      await user.click(startButton)
      
      expect(supabase.from).toHaveBeenCalledWith('tasks')
    })

    test('завершает задачу без фото', async () => {
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText('Помыть посуду')).toBeInTheDocument()
      })
      
      const completeButton = screen.getByRole('button', { name: /без фото/i })
      await user.click(completeButton)
      
      const { supabase } = await import('../../lib/supabase')
      expect(supabase.from).toHaveBeenCalledWith('tasks')
    })

    test('открывает форму загрузки фото', async () => {
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText('Помыть посуду')).toBeInTheDocument()
      })
      
      const completeWithPhotoButton = screen.getByRole('button', { name: /завершить/i })
      await user.click(completeWithPhotoButton)
      
      await waitFor(() => {
        expect(screen.getByText(/загрузить фото-доказательство/i)).toBeInTheDocument()
        expect(screen.getByText(/выбран файл/i)).toBeInTheDocument()
      })
    })
  })

  describe('Загрузка фото-доказательств', () => {
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
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ 
              data: mockUser({ role: 'child' }), 
              error: null 
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
                  title: 'Убрать комнату',
                  status: 'in_progress'
                })
              ],
              error: null
            }),
            update: vi.fn().mockReturnThis()
          }
        }
        
        return mockSupabase.from(table)
      })
    })

    test('выбирает файл для загрузки', async () => {
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText('Убрать комнату')).toBeInTheDocument()
      })
      
      const completeButton = screen.getByRole('button', { name: /завершить/i })
      await user.click(completeButton)
      
      await waitFor(() => {
        expect(screen.getByText(/загрузить фото-доказательство/i)).toBeInTheDocument()
      })
      
      const fileInput = screen.getByRole('button', { name: /выбрать файл/i })
      const file = createMockFile({ name: 'proof.jpg', type: 'image/jpeg' })
      
      // Имитируем выбор файла
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/выбран файл: proof\.jpg/i)).toBeInTheDocument()
      })
    })

    test('отправляет задачу с фото', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText('Убрать комнату')).toBeInTheDocument()
      })
      
      const completeButton = screen.getByRole('button', { name: /завершить/i })
      await user.click(completeButton)
      
      await waitFor(() => {
        expect(screen.getByText(/загрузить фото-доказательство/i)).toBeInTheDocument()
      })
      
      const fileInput = screen.getByRole('button', { name: /выбрать файл/i })
      const file = createMockFile({ name: 'proof.jpg', type: 'image/jpeg' })
      
      await user.upload(fileInput, file)
      
      const sendButton = screen.getByRole('button', { name: /отправить/i })
      await user.click(sendButton)
      
      expect(supabase.storage.from).toHaveBeenCalledWith('task-proofs')
    })

    test('отменяет загрузку фото', async () => {
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText('Убрать комнату')).toBeInTheDocument()
      })
      
      const completeButton = screen.getByRole('button', { name: /завершить/i })
      await user.click(completeButton)
      
      await waitFor(() => {
        expect(screen.getByText(/загрузить фото-доказательство/i)).toBeInTheDocument()
      })
      
      const cancelButton = screen.getByRole('button', { name: /отмена/i })
      await user.click(cancelButton)
      
      await waitFor(() => {
        expect(screen.queryByText(/загрузить фото-доказательство/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Отображение статусов задач', () => {
    test('отображает задачу с отклонением и причиной', async () => {
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
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                mockTask({ 
                  id: 'task-1',
                  title: 'Убрать комнату',
                  status: 'rejected',
                  rejection_reason: 'Комната убрана не полностью'
                })
              ],
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })
      
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText('Убрать комнату')).toBeInTheDocument()
        expect(screen.getByText('Отклонена')).toBeInTheDocument()
        expect(screen.getByText(/причина отклонения/i)).toBeInTheDocument()
        expect(screen.getByText('Комната убрана не полностью')).toBeInTheDocument()
      })
    })

    test('отображает подтвержденную задачу', async () => {
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
        
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                mockTask({ 
                  id: 'task-1',
                  title: 'Убрать комнату',
                  status: 'confirmed'
                })
              ],
              error: null
            })
          }
        }
        
        return mockSupabase.from(table)
      })
      
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText('Убрать комнату')).toBeInTheDocument()
        expect(screen.getByText('Подтверждена')).toBeInTheDocument()
      })
    })
  })

  describe('Обработка ошибок', () => {
    test('отображает ошибку при загрузке профиля', async () => {
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
              error: { message: 'User profile not found' }
            })
          }
        }
        return mockSupabase.from(table)
      })
      
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText(/ошибка/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /перезагрузить/i })).toBeInTheDocument()
      })
    })

    test('обрабатывает ошибку авторизации', async () => {
      const { supabase } = await import('../../lib/supabase')
      
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })
      
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(screen.getByText(/ошибка/i)).toBeInTheDocument()
      })
    })
  })

  describe('Real-time обновления', () => {
    test('подписывается на изменения задач', async () => {
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
      
      renderWithProviders(<Tasks />)
      
      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledWith('tasks_changes')
      })
    })
  })
})
