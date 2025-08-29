/* Файл: src/components/Tasks.jsx */
/* Компонент для отображения и управления задачами пользователя */
/* jshint esversion: 9 */
/* jshint ignore: start */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

// Константы для статусов задач
const TASK_STATUS = {
  pending: 'pending',        // Ожидает выполнения
  in_progress: 'in_progress', // В процессе
  completed: 'completed',    // Выполнена (ожидает подтверждения)
  confirmed: 'confirmed',    // Подтверждена родителем
  rejected: 'rejected'       // Отклонена родителем
}

// Константы приоритетов
const TASK_PRIORITY = {
  low: { label: 'Низкий', color: 'text-green-600', bg: 'bg-green-100' },
  medium: { label: 'Средний', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  high: { label: 'Высокий', color: 'text-red-600', bg: 'bg-red-100' }
}

function Tasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [uploadingFiles, setUploadingFiles] = useState({}) // для отслеживания загрузки файлов

  // Получение текущего пользователя
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return

        // Получаем профиль пользователя из таблицы users
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (profileError) {
          setError('Ошибка загрузки профиля: ' + profileError.message)
          return
        }

        setUser(profile)
      } catch (err) {
        setError('Ошибка аутентификации: ' + err.message)
      }
    }

    getCurrentUser()
  }, [])

  // Загрузка задач пользователя
  useEffect(() => {
    if (!user?.id) return

    const fetchTasks = async () => {
      try {
        setLoading(true)
        
        // Получаем задачи, назначенные текущему пользователю
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select(`
            *,
            assigned_by:assigned_by_id(id, email, role),
            family:family_id(family_name)
          `)
          .eq('assigned_to_id', user.id)
          .order('created_at', { ascending: false })

        if (tasksError) {
          setError('Ошибка загрузки задач: ' + tasksError.message)
          return
        }

        setTasks(tasksData || [])
      } catch (err) {
        setError('Неожиданная ошибка: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()

    // Подписка на изменения в таблице tasks
    const tasksSubscription = supabase
      .channel('tasks_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'tasks',
          filter: `assigned_to_id=eq.${user.id}`
        }, 
        (payload) => {
          console.log('Изменения в задачах:', payload)
          fetchTasks() // Перезагружаем задачи при изменениях
        }
      )
      .subscribe()

    return () => {
      tasksSubscription.unsubscribe()
    }
  }, [user])

  // Функция загрузки фото-доказательства
  const uploadProofPhoto = async (taskId, file) => {
    try {
      setUploadingFiles(prev => ({ ...prev, [taskId]: true }))

      // Генерируем уникальное имя файла
      const fileExt = file.name.split('.').pop()
      const fileName = `${taskId}_${Date.now()}.${fileExt}`
      const filePath = `task-proofs/${fileName}`

      // Загружаем файл в Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('task-proofs')
        .upload(filePath, file)

      if (uploadError) {
        throw new Error('Ошибка загрузки файла: ' + uploadError.message)
      }

      // Получаем публичную ссылку на файл
      const { data: { publicUrl } } = supabase.storage
        .from('task-proofs')
        .getPublicUrl(filePath)

      return { filePath, publicUrl }
    } catch (err) {
      console.error('Ошибка загрузки файла:', err)
      throw err
    } finally {
      setUploadingFiles(prev => ({ ...prev, [taskId]: false }))
    }
  }

  // Функция завершения задачи
  const completeTask = async (taskId, proofFile = null) => {
    try {
      let proofUrl = null

      // Если есть фото-доказательство, загружаем его
      if (proofFile) {
        const uploadResult = await uploadProofPhoto(taskId, proofFile)
        proofUrl = uploadResult.publicUrl
      }

      // Обновляем статус задачи
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          status: TASK_STATUS.completed,
          proof_url: proofUrl,
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId)

      if (updateError) {
        throw new Error('Ошибка обновления задачи: ' + updateError.message)
      }

      // Обновляем локальное состояние
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: TASK_STATUS.completed, proof_url: proofUrl, completed_at: new Date().toISOString() }
          : task
      ))

    } catch (err) {
      setError(err.message)
    }
  }

  // Функция начала выполнения задачи
  const startTask = async (taskId) => {
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          status: TASK_STATUS.in_progress,
          started_at: new Date().toISOString()
        })
        .eq('id', taskId)

      if (updateError) {
        throw new Error('Ошибка обновления задачи: ' + updateError.message)
      }

      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: TASK_STATUS.in_progress, started_at: new Date().toISOString() }
          : task
      ))

    } catch (err) {
      setError(err.message)
    }
  }

  // Компонент карточки задачи
  const TaskCard = ({ task }) => {
    const [showPhotoUpload, setShowPhotoUpload] = useState(false)
    const [selectedFile, setSelectedFile] = useState(null)

    const priority = TASK_PRIORITY[task.priority] || TASK_PRIORITY.medium
    const isUploading = uploadingFiles[task.id]

    const handleFileSelect = (event) => {
      const file = event.target.files[0]
      if (file) {
        setSelectedFile(file)
      }
    }

    const handleCompleteWithPhoto = async () => {
      if (selectedFile) {
        await completeTask(task.id, selectedFile)
        setSelectedFile(null)
        setShowPhotoUpload(false)
      }
    }

    const formatReward = (reward) => {
      if (!reward) return 'Без награды'
      
      const parts = []
      if (reward.stars > 0) parts.push(`⭐ ${reward.stars}`)
      if (reward.money > 0) parts.push(`💰 ${reward.money}₽`)
      if (reward.screen_time > 0) parts.push(`🎮 ${reward.screen_time}мин`)
      
      return parts.length > 0 ? parts.join(', ') : 'Без награды'
    }

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white rounded-lg shadow-md border-2 border-minecraft-green/20 p-6 mb-4"
      >
        {/* Заголовок и приоритет */}
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-pixel text-minecraft-green" style={{ fontFamily: '"Press Start 2P", "Courier New", monospace' }}>
            {task.title}
          </h3>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${priority.color} ${priority.bg}`}>
            {priority.label}
          </span>
        </div>

        {/* Описание */}
        {task.description && (
          <p className="text-gray-700 mb-4">{task.description}</p>
        )}

        {/* Информация о награде */}
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
          <span className="text-sm font-semibold text-yellow-800">
            Награда: {formatReward(task.reward)}
          </span>
        </div>

        {/* Дедлайн */}
        {task.due_date && (
          <div className="text-sm text-gray-600 mb-4">
            📅 Срок: {new Date(task.due_date).toLocaleDateString('ru-RU')}
          </div>
        )}

        {/* Статус и действия */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold">Статус:</span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              task.status === TASK_STATUS.pending ? 'bg-gray-100 text-gray-800' :
              task.status === TASK_STATUS.in_progress ? 'bg-blue-100 text-blue-800' :
              task.status === TASK_STATUS.completed ? 'bg-yellow-100 text-yellow-800' :
              task.status === TASK_STATUS.confirmed ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>
              {task.status === TASK_STATUS.pending ? 'Ожидает' :
               task.status === TASK_STATUS.in_progress ? 'В процессе' :
               task.status === TASK_STATUS.completed ? 'На проверке' :
               task.status === TASK_STATUS.confirmed ? 'Подтверждена' :
               'Отклонена'}
            </span>
          </div>

          {/* Кнопки действий */}
          <div className="flex space-x-2">
            {task.status === TASK_STATUS.pending && (
              <button
                onClick={() => startTask(task.id)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
              >
                Начать
              </button>
            )}

            {task.status === TASK_STATUS.in_progress && (
              <>
                <button
                  onClick={() => setShowPhotoUpload(!showPhotoUpload)}
                  className="px-4 py-2 bg-minecraft-green text-white rounded hover:bg-green-600 transition-colors text-sm"
                >
                  Завершить
                </button>
                <button
                  onClick={() => completeTask(task.id)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  Без фото
                </button>
              </>
            )}
          </div>
        </div>

        {/* Интерфейс загрузки фото */}
        <AnimatePresence>
          {showPhotoUpload && task.status === TASK_STATUS.in_progress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 bg-gray-50 rounded-lg border-dashed border-2 border-gray-300"
            >
              <h4 className="text-sm font-semibold mb-3">Загрузить фото-доказательство:</h4>
              
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="mb-3 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-minecraft-green file:text-white hover:file:bg-minecraft-green/80"
              />

              {selectedFile && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600">Выбран файл: {selectedFile.name}</p>
                  <img 
                    src={URL.createObjectURL(selectedFile)} 
                    alt="Preview" 
                    className="mt-2 max-w-xs max-h-32 object-cover rounded"
                  />
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  onClick={handleCompleteWithPhoto}
                  disabled={!selectedFile || isUploading}
                  className="px-4 py-2 bg-minecraft-green text-white rounded hover:bg-green-600 disabled:bg-gray-400 transition-colors text-sm"
                >
                  {isUploading ? 'Загрузка...' : 'Отправить'}
                </button>
                <button
                  onClick={() => {
                    setShowPhotoUpload(false)
                    setSelectedFile(null)
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  Отмена
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Отображение загруженного фото */}
        {task.proof_url && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Фото-доказательство:</h4>
            <img 
              src={task.proof_url} 
              alt="Доказательство выполнения" 
              className="max-w-xs max-h-32 object-cover rounded border"
            />
          </div>
        )}

        {/* Комментарий при отклонении */}
        {task.status === TASK_STATUS.rejected && task.rejection_reason && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <h4 className="text-sm font-semibold text-red-800 mb-1">Причина отклонения:</h4>
            <p className="text-sm text-red-700">{task.rejection_reason}</p>
          </div>
        )}
      </motion.div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-minecraft-green border-t-transparent rounded-full"
        />
        <span className="ml-3 text-minecraft-green font-pixel" style={{ fontFamily: '"Press Start 2P", "Courier New", monospace' }}>
          Загружаем задачи...
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-pixel mb-2" style={{ fontFamily: '"Press Start 2P", "Courier New", monospace' }}>
          Ошибка
        </h3>
        <p className="text-red-700">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Перезагрузить
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-pixel text-minecraft-green mb-6" style={{ fontFamily: '"Press Start 2P", "Courier New", monospace' }}>
        Мои задачи
      </h2>

      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-pixel text-minecraft-green mb-2" style={{ fontFamily: '"Press Start 2P", "Courier New", monospace' }}>
            Задач пока нет
          </h3>
          <p className="text-gray-600">
            Родители еще не назначили вам задания. Проверьте позже!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export default Tasks
/* jshint ignore: end */
