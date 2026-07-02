import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Store, CreditCard, Lock, User, ArrowRight, ShieldAlert, Eye, EyeOff, BookOpen } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('General')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    if (!validateEmail(email)) {
      setErrorMsg('กรุณากรอกรูปแบบอีเมลให้ถูกต้อง')
      setLoading(false)
      return
    }

    // Trigger Door Closing Animation
    window.dispatchEvent(new CustomEvent('door-anim:close'))

    setTimeout(async () => {
      try {
        if (isSignUp) {
          // --- สมัครสมาชิก ---
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          })
          if (error) throw error

          // บันทึกข้อมูลลงตาราง users
          if (data.user) {
            const { error: userError } = await supabase
              .from('users')
              .upsert(
                {
                  id: data.user.id,
                  email: email.trim(),
                  full_name: fullName.trim(),
                  department: department,
                  role: 'user',
                },
                { onConflict: 'email' }
              )
            if (userError) {
              console.warn('Users upsert warning:', userError.message || JSON.stringify(userError))
            }
          }

          setSuccessMsg(`สมัครสมาชิกสำเร็จ! อีเมล: ${email.trim()} — เข้าสู่ระบบได้ทันที`)
          setIsSignUp(false)
          setEmail('')
          setPassword('')
          setFullName('')
          
          // Open doors back up to show success message
          window.dispatchEvent(new CustomEvent('door-anim:open'))
        } else {
          // --- เข้าสู่ระบบ ---
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          if (error) throw error
          
          // Login success! Navigate, then open doors
          navigate('/')
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('door-anim:open'))
          }, 500)
        }
      } catch (err) {
        // Open doors back up to show error message
        window.dispatchEvent(new CustomEvent('door-anim:open'))
        
        // ดึง error message รองรับหลาย format
        const msg =
          err?.message ||
          err?.error_description ||
          err?.msg ||
          (typeof err === 'string' ? err : '')

        if (!msg || msg === '{}' || msg === '[object Object]') {
          setErrorMsg('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่อ Supabase หรือลองใหม่อีกครั้ง')
        } else if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
          setErrorMsg('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
        } else if (
          msg.includes('User already registered') ||
          msg.includes('already registered') ||
          msg.includes('already taken') ||
          msg.includes('already exists') ||
          msg.includes('email_exists') ||
          msg.includes('duplicate')
        ) {
          setErrorMsg('อีเมลนี้มีในระบบแล้ว → กรุณาไปที่ "เข้าสู่ระบบ" แทน')
        } else if (msg.includes('Password should be at least') || msg.includes('weak_password')) {
          setErrorMsg('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
        } else if (msg.includes('row-level security') || msg.includes('42501')) {
          setErrorMsg('RLS Policy บล็อก INSERT — กรุณารัน SQL Policy ใน Supabase Dashboard')
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
          setErrorMsg('ไม่สามารถเชื่อมต่อ Supabase ได้ กรุณาตรวจสอบ VITE_SUPABASE_URL ใน .env')
        } else {
          setErrorMsg(msg)
        }
      } finally {
        setLoading(false)
      }
    }, 1200)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-100 dark:bg-navy-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-navy-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-navy-700 transition-colors">

        {/* Header */}
        <div>
          <div className="mx-auto h-14 w-14 bg-navy-900 rounded-2xl flex items-center justify-center shadow-lg">
            <Store className="h-7 w-7 text-primary-400" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-navy-900 dark:text-white font-outfit">
            {isSignUp ? 'สร้างบัญชีผู้ใช้งาน' : 'เข้าสู่ระบบ'}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
            ระบบซื้อขายสินค้า React Marketplace
          </p>
          <div className="mt-3 flex items-center justify-center space-x-1.5 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>เข้าสู่ระบบด้วยอีเมลและรหัสผ่านเพื่อเริ่มใช้งาน</span>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm animate-scale-up" role="alert">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm animate-scale-up" role="alert">
            {successMsg}
          </div>
        )}

        {/* Form */}
        <form className="space-y-5" onSubmit={handleAuth}>

          {/* ชื่อ-นามสกุล (เฉพาะสมัคร) */}
          {isSignUp && (
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">ชื่อ-นามสกุล</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 dark:text-slate-500">
                  <User className="h-5 w-5" />
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-11 w-full px-4 py-3 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-slate-50 dark:bg-navy-950 focus:bg-white transition-colors"
                  placeholder="เช่น John Doe"
                />
              </div>
            </div>
          )}

          {/* อีเมล */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              อีเมล
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 dark:text-slate-500">
                <CreditCard className="h-5 w-5" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value.replace(/\s/g, ''))}
                className="pl-11 w-full px-4 py-3 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-slate-50 dark:bg-navy-950 focus:bg-white transition-colors font-outfit"
                placeholder="email@example.com"
              />
            </div>
          </div>

          {/* แผนก (เฉพาะสมัคร) */}
          {isSignUp && (
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">กลุ่มผู้ใช้งาน</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 dark:text-slate-500">
                  <BookOpen className="h-5 w-5" />
                </span>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="pl-11 w-full px-4 py-3 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-slate-50 dark:bg-navy-950 focus:bg-white transition-colors"
                >
                  <option value="General">ทั่วไป (General)</option>
                  <option value="Seller">ผู้ขาย (Seller)</option>
                  <option value="Buyer">ผู้ซื้อ (Buyer)</option>
                  <option value="Admin">ผู้ดูแลระบบ (Admin)</option>
                </select>
              </div>
            </div>
          )}

          {/* รหัสผ่าน */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">รหัสผ่าน</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 dark:text-slate-500">
                <Lock className="h-5 w-5" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-11 pr-11 w-full px-4 py-3 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-slate-50 dark:bg-navy-950 focus:bg-white transition-colors"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-gradient-primary w-full flex justify-center items-center py-3 px-4 rounded-xl text-sm font-bold shadow-md disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                <span>กำลังดำเนินการ...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <span>{isSignUp ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</span>
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </button>
        </form>

        {/* สลับโหมด */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setErrorMsg('')
              setSuccessMsg('')
              setEmail('')
              setPassword('')
              setFullName('')
            }}
            className="text-sm font-bold text-primary-600 hover:text-primary-500 transition-colors"
          >
            {isSignUp ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิก'}
          </button>
        </div>
      </div>
    </div>
  )
}
