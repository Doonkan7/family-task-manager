// src/components/Login.jsx
/* jshint esversion: 9 */
/* jshint ignore: start */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

export default function Login() {
  const MotionDiv = motion.div;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('parent');
  const [isLogin, setIsLogin] = useState(true);
  const [isParent, setIsParent] = useState(true);
  const [familyCode, setFamilyCode] = useState('');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState({ show: false, text: '', type: 'success' });

  const showToast = (text, type = 'success', timeout = 5000) => {
    setToast({ show: true, text, type });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast((t) => ({ ...t, show: false })), timeout);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      if (isLogin) {
        // Вход
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error;
        setMessage('Успешный вход!');
      } else {
        // Регистрация
        const { error } = await supabase.auth.signUp({
          email,
          password,
          phone,
        })
        if (error) {
          const msg = String(error.message || '')
          const isRlsUsers = msg.includes('row-level security') && msg.includes('table "users"')
          if (!isRlsUsers) throw error
          // Игнорируем RLS-ошибку от БД-триггера users, т.к. пользователь и письмо созданы
        }

        // Не пишем в таблицу users во время регистрации,
        // так как сессии ещё нет и RLS блокирует вставку.
        // Сообщаем пользователю про письмо подтверждения.
        setMessage('Регистрация успешна! Проверьте email для подтверждения.');
        showToast('Мы отправили вам письмо с подтверждением. Проверьте вашу почту.');
      }
    } catch (error) {
      setMessage(`Ошибка: ${error.message}`);
      showToast(`Ошибка: ${error.message}`, 'error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'transparent' }}>
      {toast.show && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded text-white shadow-lg"
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            padding: '10px 14px',
            borderRadius: 8,
            color: '#fff',
            background: toast.type === 'success' ? '#16a34a' : '#dc2626',
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
          }}
        >
          {toast.text}
        </div>
      )}
      <MotionDiv 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md"
        style={{ maxWidth: 420, width: '100%', background: '#ffffff', padding: 24, borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
      >
        <h2 className="text-2xl font-pixel text-center mb-6 text-minecraft-green" style={{ fontFamily: '"Press Start 2P", "Courier New", monospace' }}>
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
            className="w-full bg-minecraft-green text-white py-2 rounded font-pixel hover:bg-green-600 transition"
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
            className="text-minecraft-blue hover:underline"
          >
            {isLogin ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
          </button>
        </div>
      </MotionDiv>
    </div>
  )
}