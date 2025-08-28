/* Файл: src/App.jsx */
/* jshint esversion: 9 */
/* jshint ignore: start */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from './lib/supabase'

import Login from './components/Login'
import Profile from './components/Profile'
import Sky from './components/Sky'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState('tasks') // 'tasks', 'profile'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Слушатель изменений аутентификации
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // После аутентификации гарантируем наличие базового профиля
  useEffect(() => {
    const ensureProfile = async () => {
      // Гарантируем наличие аутентифицированного пользователя
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user?.email) return
      try {
        const email = user.email
        const authMeta = user.user_metadata || {}
        const requestedFamily = authMeta.requested_family_code || null

        // 1) Проверяем, существует ли профиль пользователя
        const { data: existing, error: selErr } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .maybeSingle()

        if (selErr) {
          // If RLS denies select, just exit silently
          return
        }

        let profile = existing
        if (!existing) {
          // Вставляем минимальный профиль
          const { data: inserted, error: insErr } = await supabase
            .from('users')
            .insert([
              {
                email,
                phone: null,
                role: authMeta.role || 'parent',
                verified: true,
                family_id: null,
                id: user.id,
              },
            ])
            .select('*')
            .single()
          if (insErr) return
          profile = inserted
        }

        // 2) Если нет семьи — пытаемся присоединить по коду или создаем новую
        if (!profile?.family_id) {
          let targetFamilyId = null

          if (requestedFamily) {
            const { data: fam, error: famErr } = await supabase
              .from('families')
              .select('family_id')
              .eq('family_id', requestedFamily)
              .maybeSingle()
            if (!famErr && fam) {
              targetFamilyId = fam.family_id
            }
          }

          // Если кода нет или он невалиден — создаем новую семью
          if (!targetFamilyId) {
            const { data: newFam, error: newFamErr } = await supabase
              .from('families')
              .insert([{ family_name: `Семья ${email.split('@')[0]}` }])
              .select('*')
              .single()
            if (newFamErr) return
            targetFamilyId = newFam.family_id
          }

          // Обновляем пользователя
          await supabase
            .from('users')
            .update({ family_id: targetFamilyId })
            .eq('id', user.id)
        }
      } catch (e) {
        // Не ломаем UI; логируем ошибку для отладки
        console.warn('ensureProfile error', e)
      }
    }

    ensureProfile()
  }, [session])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <>
        <Sky />
        <div className="min-h-screen flex items-center justify-center relative z-10">
          <motion.h1 
            className="text-4xl font-pixel text-white"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ fontFamily: '"Press Start 2P", "Courier New", monospace' }}
          >
            Загрузка...
          </motion.h1>
        </div>
      </>
    )
  }

  if (!session) {
    return (
      <>
        <Sky />
        <Login />
      </>
    )
  }

  return (
    <>
      <Sky />
      <div className="min-h-screen relative z-10">
        <header className="bg-white shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
            <h1 className="text-2xl font-pixel text-minecraft-green" style={{ fontFamily: '"Press Start 2P", "Courier New", monospace' }}>
              Family Task Manager
            </h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentView('tasks')}
                className={`px-3 py-1 rounded ${currentView === 'tasks' ? 'bg-minecraft-green text-white' : 'bg-gray-200'}`}
              >
                Задачи
              </button>
              <button
                onClick={() => setCurrentView('profile')}
                className={`px-3 py-1 rounded ${currentView === 'profile' ? 'bg-minecraft-green text-white' : 'bg-gray-200'}`}
              >
                Профиль
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Выйти
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6">
          {currentView === 'tasks' ? (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-2xl font-pixel text-minecraft-green mb-6" style={{ fontFamily: '"Press Start 2P", "Courier New", monospace' }}>
                Задачи
              </h2>
              <p>Здесь будет список задач...</p>
            </div>
          ) : (
            <Profile />
          )}
        </main>
      </div>
    </>
  )
}

export default App