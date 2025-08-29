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
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, text: '', type: 'success' });

  const showToast = (text, type = 'success', timeout = 5000) => {
    setToast({ show: true, text, type });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast((t) => ({ ...t, show: false })), timeout);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

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
        // 1) Сначала регистрируем пользователя в Auth БЕЗ дополнительных данных (чтобы избежать DB errors от триггеров/RLS)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (authError) throw authError

        // 2) Проверяем, активна ли сессия сразу (если подтверждение email отключено)
        const { data: sessionData } = await supabase.auth.getSession()
        const hasSession = !!sessionData?.session

        if (!hasSession) {
          // Нет активной сессии: дальнейшие операции с БД невозможны (RLS). Сообщим пользователю и завершим.
          setMessage(
            'Регистрация успешна! Проверьте email для подтверждения. ' +
              (familyCode
                ? 'После входа мы автоматически попытаемся присоединить вас к семье по указанному коду.'
                : 'После входа мы создадим для вас новую семью (или сможете выбрать в профиле).')
          )
          showToast('Мы отправили вам письмо с подтверждением. Проверьте вашу почту.')
          return
        }

        // 3) Есть сессия: обновляем метаданные пользователя (role, requested_family_code, phone)
        const { error: metaErr } = await supabase.auth.updateUser({
          data: {
            role,
            requested_family_code: familyCode || null,
            phone: phone || null,
          },
        })
        if (metaErr) throw metaErr

        // 4) Создаем/проверяем семью и обновляем метаданные пользователя с family_id
        let familyIdToUse = familyCode || null
        let shouldCreateFamily = !familyCode

        // Если указан код семьи, проверяем его существование
        if (familyCode) {
          const { data: familyData, error: familyError } = await supabase
            .from('families')
            .select('family_id')
            .eq('family_id', familyCode)
            .single()

          if (familyError && familyError.code !== 'PGRST116') {
            throw familyError
          }

          if (!familyData) {
            shouldCreateFamily = true
          }
        }

        // Если нужно создать семью
        if (shouldCreateFamily) {
          const { data: newFamily, error: newFamilyError } = await supabase
            .from('families')
            .insert([{ family_name: `Семья ${email.split('@')[0]}` }])
            .select()
            .single()

          if (newFamilyError) throw newFamilyError
          familyIdToUse = newFamily.family_id
        }

        // Обновляем метаданные пользователя с family_id
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            role,
            family_id: familyIdToUse,
          },
        })

        if (updateError) throw updateError

        setMessage(
          `Регистрация успешна! Ваш код семьи: ${familyIdToUse}. Проверьте email для подтверждения.`
        )
        showToast('Мы отправили вам письмо с подтверждением. Проверьте вашу почту.')
      }
    } catch (error) {
      setMessage(`Ошибка: ${error.message}`);
      showToast(`Ошибка: ${error.message}`, 'error');
      console.error('Ошибка регистрации:', error);
    } finally {
      setLoading(false);
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
            <label htmlFor="email-input" className="block text-sm font-medium mb-1">Email</label>
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              required
              disabled={loading}
            />
          </div>
          
          <div>
            <label htmlFor="password-input" className="block text-sm font-medium mb-1">Пароль</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              required
              disabled={loading}
            />
          </div>
          
          {!isLogin && (
            <>
              <div>
                <label htmlFor="phone-input" className="block text-sm font-medium mb-1">Телефон (опционально)</label>
                <input
                  id="phone-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                  disabled={loading}
                />
              </div>
              
              <div>
                <label htmlFor="role-select" className="block text-sm font-medium mb-1">Роль</label>
                <select
                  id="role-select"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value)
                    setIsParent(e.target.value === 'parent')
                  }}
                  className="w-full p-2 border border-gray-300 rounded"
                  disabled={loading}
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
              
              <div>
                <label htmlFor="family-code-input" className="block text-sm font-medium mb-1">Код семьи (опционально)</label>
                <input
                  id="family-code-input"
                  type="text"
                  value={familyCode}
                  onChange={(e) => setFamilyCode(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="Код семьи или оставьте пустым"
                  disabled={loading}
                />
                <p className="text-sm text-gray-600 mt-1">
                  Если вы первый в семье, оставьте поле пустым. Если кто-то уже зарегистрирован, попросите код семьи.
                </p>
              </div>
            </>
          )}
          
          <button
            type="submit"
            className="w-full bg-minecraft-green text-white py-2 rounded font-pixel hover:bg-green-600 transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
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
            disabled={loading}
          >
            {isLogin ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
          </button>
        </div>
      </MotionDiv>
    </div>
  )
}