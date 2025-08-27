// src/components/Login.jsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('parent')
  const [isLogin, setIsLogin] = useState(true)
  const [isParent, setIsParent] = useState(true)
  const [familyCode, setFamilyCode] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')

    try {
      if (isLogin) {
        // Вход
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        setMessage('Успешный вход!')
      } else {
        // Регистрация
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          phone,
        })
        if (error) throw error

        // Сохранение дополнительной информации о пользователе
        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert([
            {
              email,
              phone,
              role,
              verified: role === 'parent', // Родители верифицируются сразу
              family_id: familyCode || null,
            },
          ])
          .select()

        if (userError) throw userError
        setMessage('Регистрация успешна! Проверьте email для подтверждения.')
      }
    } catch (error) {
      setMessage(`Ошибка: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-minecraft.blue to-minecraft.green flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md"
      >
        <h2 className="text-2xl font-pixel text-center mb-6 text-minecraft.green">
          {isLogin ? 'Вход' : 'Регистрация'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              required
            />
          </div>
          
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Телефон (опционально)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Роль</label>
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value)
                    setIsParent(e.target.value === 'parent')
                  }}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value="parent">Родитель</option>
                  <option value="child">Ребенок</option>
                  <option value="opekun">Опекун</option>
                  <option value="dyadya">Дядя</option>
                  <option value="tetya">Тетя</option>
                  <option value="brother">Брат</option>
                  <option value="sister">Сестра</option>
                </select>
              </div>
              
              {!isParent && (
                <div>
                  <label className="block text-sm font-medium mb-1">Код семьи</label>
                  <input
                    type="text"
                    value={familyCode}
                    onChange={(e) => setFamilyCode(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                    placeholder="Введите код вашей семьи"
                  />
                </div>
              )}
            </>
          )}
          
          <button
            type="submit"
            className="w-full bg-minecraft.green text-white py-2 rounded font-pixel hover:bg-green-600 transition"
          >
            {isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
        
        {message && (
          <div className={`mt-4 p-2 rounded text-center ${message.includes('Ошибка') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}
        
        <div className="mt-4 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-minecraft.blue hover:underline"
          >
            {isLogin ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}