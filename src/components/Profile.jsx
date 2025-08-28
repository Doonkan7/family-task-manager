// Компонент: src/components/Profile.jsx — управление семьей
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Profile() {
  const [user, setUser] = useState(null)
  const [family, setFamily] = useState(null)
  const [familyMembers, setFamilyMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [newFamilyCode, setNewFamilyCode] = useState('')
  const [isLeavingFamily, setIsLeavingFamily] = useState(false)

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    setUser(authUser)

    if (authUser) {
      // Получаем информацию о пользователе
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (userData && userData.family_id) {
        // Получаем информацию о семье
        const { data: familyData } = await supabase
          .from('families')
          .select('*')
          .eq('family_id', userData.family_id)
          .single()

        setFamily(familyData)

        // Получаем членов семьи
        const { data: membersData } = await supabase
          .from('users')
          .select('*')
          .eq('family_id', userData.family_id)

        setFamilyMembers(membersData || [])
      }
    }

    setLoading(false)
  }

  const joinFamily = async () => {
    if (!newFamilyCode) {
      alert('Введите код семьи')
      return
    }

    try {
      // Проверяем существование семьи
      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .select('family_id')
        .eq('family_id', newFamilyCode)
        .single()

      if (familyError) throw familyError

      // Обновляем family_id пользователя
      const { error: updateError } = await supabase
        .from('users')
        .update({ family_id: newFamilyCode })
        .eq('id', user.id)

      if (updateError) throw updateError

      alert('Вы успешно присоединились к семье!')
      setNewFamilyCode('')
      fetchUserData() // Обновляем данные
    } catch (error) {
      alert(`Ошибка: ${error.message}`)
    }
  }

  const leaveFamily = async () => {
    if (!window.confirm('Вы уверены, что хотите покинуть семью? Это создаст новую семью для вас.')) {
      return
    }

    try {
      setIsLeavingFamily(true)
      // Создаем новую семью
      const { data: newFamily, error: familyError } = await supabase
        .from('families')
        .insert([{ family_name: `Семья ${user.email.split('@')[0]}` }])
        .select()
        .single()

      if (familyError) throw familyError

      // Обновляем family_id пользователя
      const { error: updateError } = await supabase
        .from('users')
        .update({ family_id: newFamily.family_id })
        .eq('id', user.id)

      if (updateError) throw updateError

      alert('Вы создали новую семью! Ваш новый код семьи: ' + newFamily.family_id)
      fetchUserData() // Обновляем данные
    } catch (error) {
      alert(`Ошибка: ${error.message}`)
    } finally {
      setIsLeavingFamily(false)
    }
  }

  const createNewFamily = async () => {
    try {
      // Создаем новую семью
      const { data: newFamily, error: familyError } = await supabase
        .from('families')
        .insert([{ family_name: `Семья ${user.email.split('@')[0]}` }])
        .select()
        .single()

      if (familyError) throw familyError

      // Обновляем family_id пользователя
      const { error: updateError } = await supabase
        .from('users')
        .update({ family_id: newFamily.family_id })
        .eq('id', user.id)

      if (updateError) throw updateError

      alert('Новая семья создана! Ваш код семьи: ' + newFamily.family_id)
      fetchUserData() // Обновляем данные
    } catch (error) {
      alert(`Ошибка: ${error.message}`)
    }
  }

  if (loading) {
    return <div className="text-center">Загрузка...</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-pixel text-minecraft-green mb-6">Профиль семьи</h2>
      
      {family ? (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h3 className="text-xl font-semibold mb-2">Информация о семье</h3>
          <p><strong>Название:</strong> {family.family_name}</p>
          <p><strong>Код семьи:</strong> <code className="bg-gray-100 p-1 rounded">{family.family_id}</code></p>
          <p className="mt-2 text-sm text-gray-600">
            Поделитесь этим кодом с членами вашей семьи, чтобы они могли присоединиться.
          </p>
          
          <button
            onClick={leaveFamily}
            disabled={isLeavingFamily}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            {isLeavingFamily ? 'Создание новой семьи...' : 'Покинуть семью и создать новую'}
          </button>
        </div>
      ) : (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h3 className="text-xl font-semibold mb-2">У вас нет семьи</h3>
          <p className="mb-4">Вы можете создать новую семью или присоединиться к существующей.</p>
          
          <button
            onClick={createNewFamily}
            className="px-4 py-2 bg-minecraft-green text-white rounded hover:bg-green-600 mr-4"
          >
            Создать новую семью
          </button>
        </div>
      )}
      
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h3 className="text-xl font-semibold mb-2">Присоединиться к другой семье</h3>
        <div className="flex">
          <input
            type="text"
            value={newFamilyCode}
            onChange={(e) => setNewFamilyCode(e.target.value)}
            placeholder="Введите код семьи"
            className="flex-1 p-2 border border-gray-300 rounded-l"
          />
          <button
            onClick={joinFamily}
            className="px-4 py-2 bg-minecraft-blue text-white rounded-r hover:bg-blue-600"
          >
            Присоединиться
          </button>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">Члены семьи</h3>
        {familyMembers.length > 0 ? (
          <ul>
            {familyMembers.map(member => (
              <li key={member.id} className="border-b py-2">
                <p><strong>{member.email}</strong> ({member.role})</p>
                <p className="text-sm text-gray-600">Телефон: {member.phone || 'не указан'}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>В вашей семье пока нет других членов.</p>
        )}
      </div>
    </div>
  )
}
