/* Файл: src/App.jsx */
/* jshint esversion: 9 */
/* jshint ignore: start */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from './lib/supabase'

import Login from './components/Login'
import Sky from './components/Sky'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    // Проверка активной сессии
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
        // Проверяем, существует ли профиль пользователя
        const { data: existing, error: selErr } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        if (selErr) {
          // If RLS denies select, just exit silently
          return
        }

        if (!existing) {
          // Вставляем минимальный профиль; при необходимости можно изменить значения по умолчанию
          await supabase.from('users').insert([
            {
              email,
              phone: null,
              role: 'parent',
              verified: true,
              family_id: null,
            },
          ])
        }
      } catch (e) {
        // Не ломаем UI; логируем ошибку для отладки
        console.warn('ensureProfile error', e)
      }
    }

    ensureProfile()
  }, [session])

  if (loading) {
    return (
      <>
        <Sky />
        <div className="min-h-screen flex items-center justify-center p-8 relative z-10">
          <div className="rounded-2xl shadow-2xl p-12 max-w-2xl w-full mx-auto" style={{
            background: 'linear-gradient(to bottom, #3498DB, #4CAF50)'
          }}>
            <motion.h1 
              className="text-2xl sm:text-3xl lg:text-4xl text-white text-center"
              style={{
                fontFamily: '"Press Start 2P", "Courier New", monospace',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                lineHeight: '1.5'
              }}
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Загрузка...
            </motion.h1>
          </div>
        </div>
      </>
    )
  }

  if (!session) {
    return (
      <>
        <Sky />
        <div className="min-h-screen flex items-center justify-center p-8 relative z-10">
          <div className="w-full">
            <Login />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Sky />
      <div className="min-h-screen flex items-center justify-center p-8 relative z-10">
        <div className="rounded-2xl shadow-2xl p-12 max-w-4xl w-full mx-auto" style={{
          background: 'linear-gradient(to bottom, #3498DB, #4CAF50)'
        }}>
          <motion.h1 
            className="text-xl sm:text-2xl lg:text-3xl text-white text-center"
            style={{
              fontFamily: '"Press Start 2P", "Courier New", monospace',
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
              lineHeight: '1.6'
            }}
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Добро пожаловать в Family Task Manager!
          </motion.h1>
        </div>
      </div>
    </>
  )
}

export default App