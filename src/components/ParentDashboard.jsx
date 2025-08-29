/* 
 * Файл: src/components/ParentDashboard.jsx
 * Назначение: Панель управления для родителей - создание задач, подтверждение, статистика
 * 
 * Основные функции:
 * - Создание новых задач для детей семьи
 * - Просмотр и подтверждение выполненных задач
 * - Просмотр фото-доказательств выполнения
 * - Отклонение задач с указанием причины
 * - Просмотр статистики и балансов детей
 * - Управление системой наград
 * 
 * Зависимости:
 * - supabase для работы с БД и Storage
 * - framer-motion для анимаций и переходов
 * - react hooks для управления состоянием
 * 
 * Связанные таблицы БД:
 * - tasks (создание и управление задачами)
 * - users (получение списка детей семьи)
 * - history (логирование операций подтверждения)
 * - user_balances (просмотр статистики детей)
 * - rewards (управление наградами)
 * 
 * Права доступа:
 * - Только пользователи с ролью 'parent'
 * - Доступ только к данным своей семьи
 */

/* jshint esversion: 9 */
/* jshint ignore: start */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

// Константы для статусов задач
const TASK_STATUS = {
  pending: 'pending',
  in_progress: 'in_progress', 
  completed: 'completed',    // Ожидает подтверждения родителем
  confirmed: 'confirmed',
  rejected: 'rejected'
}

// Константы приоритетов задач
const TASK_PRIORITY = {
  low: { label: 'Низкий', color: 'text-green-600', bg: 'bg-green-100', icon: '🟢' },
  medium: { label: 'Средний', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: '🟡' },
  high: { label: 'Высокий', color: 'text-red-600', bg: 'bg-red-100', icon: '🔴' }
}

// Вкладки родительской панели
const PARENT_TABS = {
  overview: { id: 'overview', label: 'Обзор', icon: '📊' },
  create: { id: 'create', label: 'Создать задачу', icon: '➕' },
  pending: { id: 'pending', label: 'На проверке', icon: '⏳' },
  rewards: { id: 'rewards', label: 'Награды', icon: '🎁' }
}

function ParentDashboard() {
  // Основное состояние компонента
  const [activeTab, setActiveTab] = useState('overview')
  const [user, setUser] = useState(null)
  const [familyChildren, setFamilyChildren] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Состояние для создания новой задачи
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to_id: '',
    due_date: '',
    reward: {
      stars: 0,
      money: 0,
      screen_time: 0
    }
  })

  // Состояние для обработки задач
  const [processingTasks, setProcessingTasks] = useState({})
  const [rejectionReasons, setRejectionReasons] = useState({})

  /**
   * Получение данных пользователя и проверка прав доступа
   */
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          setError('Пользователь не авторизован')
          return
        }

        // Получаем профиль пользователя
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (profileError) {
          console.error('Ошибка получения профиля:', profileError)
          setError('Ошибка загрузки профиля пользователя')
          return
        }

        // Проверяем права доступа - только родители
        if (profile.role !== 'parent') {
          setError('Доступ запрещен. Этот раздел доступен только родителям.')
          return
        }

        setUser(profile)
      } catch (err) {
        console.error('Ошибка авторизации:', err)
        setError('Ошибка проверки авторизации')
      }
    }

    getCurrentUser()
  }, [])

  /**
   * Загрузка списка детей семьи
   */
  const loadFamilyChildren = async () => {
    if (!user?.family_id) return

    try {
      const { data: children, error: childrenError } = await supabase
        .from('users')
        .select('id, email, phone, created_at')
        .eq('family_id', user.family_id)
        .eq('role', 'child')
        .order('created_at', { ascending: true })

      if (childrenError) {
        console.error('Ошибка загрузки детей:', childrenError)
        setError('Ошибка загрузки списка детей')
        return
      }

      setFamilyChildren(children || [])
    } catch (err) {
      console.error('Ошибка при загрузке детей:', err)
      setError('Ошибка подключения к базе данных')
    }
  }

  /**
   * Загрузка задач ожидающих подтверждения
   */
  const loadPendingTasks = async () => {
    if (!user?.family_id) return

    try {
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_user:assigned_to_id(email),
          created_user:assigned_by_id(email)
        `)
        .eq('family_id', user.family_id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      if (tasksError) {
        console.error('Ошибка загрузки задач:', tasksError)
        setError('Ошибка загрузки задач на проверке')
        return
      }

      setPendingTasks(tasks || [])
    } catch (err) {
      console.error('Ошибка при загрузке задач:', err)
      setError('Ошибка подключения к базе данных')
    }
  }

  /**
   * Загрузка всех данных при изменении пользователя
   */
  useEffect(() => {
    if (user) {
      Promise.all([
        loadFamilyChildren(),
        loadPendingTasks()
      ]).finally(() => {
        setLoading(false)
      })
    }
  }, [user])

  /**
   * Создание новой задачи
   */
  const handleCreateTask = async (e) => {
    e.preventDefault()
    
    if (!newTask.title.trim() || !newTask.assigned_to_id) {
      setError('Заполните обязательные поля: название задачи и исполнитель')
      return
    }

    try {
      const taskData = {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        priority: newTask.priority,
        assigned_to_id: newTask.assigned_to_id,
        assigned_by_id: user.id,
        family_id: user.family_id,
        due_date: newTask.due_date || null,
        reward: newTask.reward,
        status: 'pending'
      }

      const { error: createError } = await supabase
        .from('tasks')
        .insert([taskData])

      if (createError) {
        console.error('Ошибка создания задачи:', createError)
        setError('Ошибка при создании задачи')
        return
      }

      // Сброс формы
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        assigned_to_id: '',
        due_date: '',
        reward: { stars: 0, money: 0, screen_time: 0 }
      })

      setError(null)
      alert('Задача успешно создана!')
      
    } catch (err) {
      console.error('Ошибка создания задачи:', err)
      setError('Ошибка подключения к базе данных')
    }
  }

  /**
   * Подтверждение выполненной задачи
   */
  const handleConfirmTask = async (taskId) => {
    setProcessingTasks(prev => ({ ...prev, [taskId]: 'confirming' }))

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ 
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', taskId)

      if (updateError) {
        console.error('Ошибка подтверждения задачи:', updateError)
        setError('Ошибка при подтверждении задачи')
        return
      }

      // Обновляем список задач
      await loadPendingTasks()
      
    } catch (err) {
      console.error('Ошибка подтверждения:', err)
      setError('Ошибка подключения к базе данных')
    } finally {
      setProcessingTasks(prev => {
        const updated = { ...prev }
        delete updated[taskId]
        return updated
      })
    }
  }

  /**
   * Отклонение выполненной задачи
   */
  const handleRejectTask = async (taskId) => {
    const reason = rejectionReasons[taskId]
    if (!reason?.trim()) {
      setError('Укажите причину отклонения задачи')
      return
    }

    setProcessingTasks(prev => ({ ...prev, [taskId]: 'rejecting' }))

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ 
          status: 'rejected',
          rejection_reason: reason.trim()
        })
        .eq('id', taskId)

      if (updateError) {
        console.error('Ошибка отклонения задачи:', updateError)
        setError('Ошибка при отклонении задачи')
        return
      }

      // Очищаем причину отклонения
      setRejectionReasons(prev => {
        const updated = { ...prev }
        delete updated[taskId]
        return updated
      })

      // Обновляем список задач
      await loadPendingTasks()
      
    } catch (err) {
      console.error('Ошибка отклонения:', err)
      setError('Ошибка подключения к базе данных')
    } finally {
      setProcessingTasks(prev => {
        const updated = { ...prev }
        delete updated[taskId]
        return updated
      })
    }
  }

  // Если нет доступа - показываем ошибку
  if (error && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-pixel text-red-600 mb-4">
            Доступ запрещен
          </h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  // Индикатор загрузки
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">⚙️</div>
          <p className="text-gray-600">Загрузка панели управления...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Заголовок */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-pixel text-minecraft-green mb-2">
            👑 Панель родителя
          </h1>
          <p className="text-gray-600">
            Управление задачами семьи • {familyChildren.length} детей
          </p>
        </div>
      </div>

      {/* Навигация по вкладкам */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-1">
            {Object.values(PARENT_TABS).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-minecraft-green text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab.icon} {tab.label}
                {tab.id === 'pending' && pendingTasks.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {pendingTasks.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Контент вкладок */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Вкладка: Обзор семьи */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Карточка: Дети в семье */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-pixel text-minecraft-green mb-4">
                    👨‍👩‍👧‍👦 Дети в семье
                  </h3>
                  {familyChildren.length > 0 ? (
                    <div className="space-y-2">
                      {familyChildren.map(child => (
                        <div key={child.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{child.email}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(child.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Детей пока нет</p>
                  )}
                </div>

                {/* Карточка: Задачи на проверке */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-pixel text-minecraft-green mb-4">
                    ⏳ Ожидают проверки
                  </h3>
                  <div className="text-3xl font-bold text-yellow-600">
                    {pendingTasks.length}
                  </div>
                  <p className="text-sm text-gray-500">
                    задач требуют вашего внимания
                  </p>
                </div>

                {/* Карточка: Быстрые действия */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-pixel text-minecraft-green mb-4">
                    ⚡ Быстрые действия
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setActiveTab('create')}
                      className="w-full text-left px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                    >
                      ➕ Создать задачу
                    </button>
                    <button
                      onClick={() => setActiveTab('pending')}
                      className="w-full text-left px-3 py-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                    >
                      👀 Проверить задачи
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Вкладка: Создание задачи */}
          {activeTab === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-2xl font-pixel text-minecraft-green mb-6">
                  ➕ Создать новую задачу
                </h2>

                <form onSubmit={handleCreateTask} className="space-y-6">
                  {/* Основная информация о задаче */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Название задачи *
                      </label>
                      <input
                        type="text"
                        value={newTask.title}
                        onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Например: Убрать комнату"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-minecraft-green"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Назначить ребенку *
                      </label>
                      <select
                        value={newTask.assigned_to_id}
                        onChange={(e) => setNewTask(prev => ({ ...prev, assigned_to_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-minecraft-green"
                        required
                      >
                        <option value="">Выберите ребенка</option>
                        {familyChildren.map(child => (
                          <option key={child.id} value={child.id}>
                            {child.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Приоритет
                      </label>
                      <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-minecraft-green"
                      >
                        {Object.entries(TASK_PRIORITY).map(([key, priority]) => (
                          <option key={key} value={key}>
                            {priority.icon} {priority.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Срок выполнения
                      </label>
                      <input
                        type="datetime-local"
                        value={newTask.due_date}
                        onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-minecraft-green"
                      />
                    </div>
                  </div>

                  {/* Описание задачи */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Подробное описание
                    </label>
                    <textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Опишите что нужно сделать подробно..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-minecraft-green resize-none"
                    />
                  </div>

                  {/* Система наград */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-700 mb-4">🎁 Награда за выполнение</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          ⭐ Звездочки
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={newTask.reward.stars}
                          onChange={(e) => setNewTask(prev => ({
                            ...prev,
                            reward: { ...prev.reward, stars: parseInt(e.target.value) || 0 }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-minecraft-green"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          💰 Деньги (руб)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newTask.reward.money}
                          onChange={(e) => setNewTask(prev => ({
                            ...prev,
                            reward: { ...prev.reward, money: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-minecraft-green"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          🎮 Время (мин)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={newTask.reward.screen_time}
                          onChange={(e) => setNewTask(prev => ({
                            ...prev,
                            reward: { ...prev.reward, screen_time: parseInt(e.target.value) || 0 }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-minecraft-green"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Кнопки управления */}
                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        setNewTask({
                          title: '',
                          description: '',
                          priority: 'medium',
                          assigned_to_id: '',
                          due_date: '',
                          reward: { stars: 0, money: 0, screen_time: 0 }
                        })
                      }}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Очистить
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-minecraft-green text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      Создать задачу
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {/* Вкладка: Задачи на проверке */}
          {activeTab === 'pending' && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h2 className="text-2xl font-pixel text-minecraft-green mb-6">
                ⏳ Задачи на проверке ({pendingTasks.length})
              </h2>

              {pendingTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-xl font-pixel text-minecraft-green mb-2">
                    Все задачи проверены!
                  </h3>
                  <p className="text-gray-600">
                    Нет задач, ожидающих вашего подтверждения.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {pendingTasks.map(task => (
                    <div key={task.id} className="bg-white p-6 rounded-lg shadow">
                      {/* Заголовок задачи */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {task.title}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Выполнил: {task.assigned_user?.email}</span>
                            <span>•</span>
                            <span>Завершено: {new Date(task.completed_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${TASK_PRIORITY[task.priority].bg} ${TASK_PRIORITY[task.priority].color}`}>
                          {TASK_PRIORITY[task.priority].icon} {TASK_PRIORITY[task.priority].label}
                        </div>
                      </div>

                      {/* Описание задачи */}
                      {task.description && (
                        <div className="mb-4">
                          <p className="text-gray-700">{task.description}</p>
                        </div>
                      )}

                      {/* Награда */}
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">🎁 Награда за выполнение:</p>
                        <div className="flex space-x-4 text-sm">
                          {task.reward?.stars > 0 && (
                            <span className="flex items-center">
                              ⭐ {task.reward.stars}
                            </span>
                          )}
                          {task.reward?.money > 0 && (
                            <span className="flex items-center">
                              💰 {task.reward.money} руб
                            </span>
                          )}
                          {task.reward?.screen_time > 0 && (
                            <span className="flex items-center">
                              🎮 {task.reward.screen_time} мин
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Фото-доказательство */}
                      {task.proof_url && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 mb-2">📸 Фото-доказательство:</p>
                          <img
                            src={task.proof_url}
                            alt="Доказательство выполнения"
                            className="max-w-md h-auto rounded border"
                          />
                        </div>
                      )}

                      {/* Поле для причины отклонения */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Причина отклонения (если отклоняете):
                        </label>
                        <textarea
                          value={rejectionReasons[task.id] || ''}
                          onChange={(e) => setRejectionReasons(prev => ({
                            ...prev,
                            [task.id]: e.target.value
                          }))}
                          placeholder="Укажите что нужно доделать или исправить..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-minecraft-green resize-none"
                        />
                      </div>

                      {/* Кнопки действий */}
                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => handleRejectTask(task.id)}
                          disabled={processingTasks[task.id]}
                          className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {processingTasks[task.id] === 'rejecting' ? 'Отклоняем...' : '❌ Отклонить'}
                        </button>
                        <button
                          onClick={() => handleConfirmTask(task.id)}
                          disabled={processingTasks[task.id]}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {processingTasks[task.id] === 'confirming' ? 'Подтверждаем...' : '✅ Подтвердить'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Вкладка: Управление наградами */}
          {activeTab === 'rewards' && (
            <motion.div
              key="rewards"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎁</div>
                <h3 className="text-xl font-pixel text-minecraft-green mb-2">
                  Управление наградами
                </h3>
                <p className="text-gray-600">
                  Раздел находится в разработке.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default ParentDashboard
/* jshint ignore: end */
