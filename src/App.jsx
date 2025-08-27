// src/App.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from './lib/supabase'
import Login from './components/Login'

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: '#f3f4f6' }}>
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
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: '#f3f4f6' }}>
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
  )
}

export default App