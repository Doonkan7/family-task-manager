import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Функция для проверки подключения
export const testConnection = async () => {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return { success: false, error: 'Отсутствуют переменные окружения Supabase' }
    }
    
    const { error } = await supabase.auth.getSession()
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message || err }
  }
}