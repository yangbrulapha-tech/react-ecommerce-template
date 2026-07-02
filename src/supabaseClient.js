import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

/**
 * ดึงข้อมูล user จากตาราง users
 * Schema พื้นฐาน: id (PK, uuid), full_name, email, role, created_at
 */
export const getUserProfile = async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { data: null, error: authError || new Error('ไม่พบ session การเข้าสู่ระบบ') }
  }

  // ค้นหาข้อมูล profile ของ user นี้จากตาราง users โดยใช้ user.id หรือ user.email 
  // ขึ้นอยู่กับการออกแบบ Schema ของคุณ (ใน Template นี้ใช้ email อ้างอิง)
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', user.email)
    .single()

  return { data, error }
}
