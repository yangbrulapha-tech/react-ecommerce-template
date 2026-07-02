import React, { useState, useEffect } from 'react'
import { supabase, getUserProfile } from '../supabaseClient'
import { User, Mail, Shield, Star, Save, Loader2, CheckCircle2, AlertCircle, Hash, Camera } from 'lucide-react'

// Schema จริง: users(student_id PK, full_name, email, role, created_at, avatar_url)
export default function Profile({ session }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    if (session) fetchProfile()
  }, [session])

  const fetchProfile = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const { data, error } = await getUserProfile()
      if (error) throw error
      if (data) {
        setProfile(data)
        setFullName(data.full_name || '')
      }
    } catch (err) {
      setErrorMsg('ไม่สามารถโหลดโปรไฟล์ได้: ' + (err.message || JSON.stringify(err)))
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setSaveLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      // อัปเดตตาราง users — PK คือ student_id
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName.trim() })
        .eq('student_id', profile.student_id)
      if (error) throw error
      setSuccessMsg('บันทึกข้อมูลเรียบร้อยแล้ว!')
      window.dispatchEvent(new Event('profile-updated'))
      fetchProfile()
    } catch (err) {
      setErrorMsg('ไม่สามารถบันทึกได้: ' + (err.message || JSON.stringify(err)))
    } finally {
      setSaveLoading(false)
    }
  }

  // ฟังก์ชันอัปโหลดรูปภาพโปรไฟล์
  const handleUploadAvatar = async (e) => {
    const file = e.target.files[0]
    if (!file || !profile) return
    
    if (file.size > 2 * 1024 * 1024) {
      alert('ขนาดไฟล์ต้องไม่เกิน 2MB')
      return
    }

    setAvatarLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const fileExt = file.name.split('.').pop().toLowerCase()
      const fileName = `avatars/${profile.student_id}/${Date.now()}.${fileExt}`

      // 1. อัปโหลดภาพไปที่ Storage Bucket 'product-images'
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // 2. ดึง Public URL ของรูปภาพโปรไฟล์
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)

      // 3. อัปเดตตาราง users ช่อง avatar_url
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('student_id', profile.student_id)

      if (updateError) throw updateError

      setSuccessMsg('อัปเดตรูปภาพโปรไฟล์เรียบร้อยแล้ว!')
      window.dispatchEvent(new Event('profile-updated'))
      await fetchProfile()
    } catch (err) {
      setErrorMsg('ไม่สามารถอัปเดตรูปภาพได้: ' + err.message)
    } finally {
      setAvatarLoading(false)
    }
  }

  const getRoleLabel = (r) => ({ admin: 'ผู้ดูแลระบบ', teacher: 'อาจารย์', staff: 'เจ้าหน้าที่', student: 'นักเรียน/นักศึกษา' }[r] || 'นักศึกษา')
  const getRoleBadge = (r) => ({ admin: 'bg-red-100 text-red-800 border-red-200', teacher: 'bg-purple-100 text-purple-800 border-purple-200', staff: 'bg-amber-100 text-amber-800 border-amber-200' }[r] || 'bg-sky-100 text-sky-800 border-sky-200')

  if (loading) return (
    <div className="flex flex-col justify-center items-center py-24 space-y-4">
      <Loader2 className="h-10 w-10 text-primary-600 animate-spin" />
      <p className="text-slate-500 dark:text-slate-400 text-sm">กำลังโหลดโปรไฟล์...</p>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-navy-900 dark:text-white tracking-tight">โปรไฟล์ของฉัน</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">จัดการข้อมูลส่วนตัวสำหรับการซื้อขายในระบบ</p>
      </div>

      {successMsg && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center space-x-2 animate-scale-up">
          <CheckCircle2 className="h-5 w-5 shrink-0" /><span className="font-medium">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center space-x-2 animate-scale-up">
          <AlertCircle className="h-5 w-5 shrink-0" /><span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Avatar Card */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 p-6 shadow-sm text-center transition-colors">
            
            {/* กล่องแสดงผลรูปโปรไฟล์พร้อมปุ่มอัปโหลดรูปภาพ */}
            <div className="relative w-24 h-24 mx-auto mb-4 group">
              {profile?.avatar_url ? (
                <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-slate-100 shadow-md">
                  <img src={profile.avatar_url} alt="profile" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-24 w-24 bg-navy-900 text-white rounded-full flex items-center justify-center mx-auto text-3xl font-bold font-outfit border-4 border-slate-100 shadow-md">
                  {(fullName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              {/* ปุ่มอัปโหลดรูปทับการ์ดโปรไฟล์ */}
              <label htmlFor="avatar-file-input" className="absolute bottom-0 right-0 bg-navy-900 hover:bg-navy-800 text-white p-2 rounded-full border border-white cursor-pointer shadow-md transition-colors flex items-center justify-center">
                {avatarLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5 text-primary-400" />}
                <input
                  id="avatar-file-input"
                  type="file"
                  accept="image/*"
                  disabled={avatarLoading}
                  className="hidden"
                  onChange={handleUploadAvatar}
                />
              </label>
            </div>

            <h2 className="text-lg font-bold text-navy-900 dark:text-white">{fullName || 'ผู้ใช้งาน'}</h2>

            <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold border ${getRoleBadge(profile?.role)}`}>
              {getRoleLabel(profile?.role)}
            </span>

            {profile?.student_id && (
              <div className="mt-4 flex items-center justify-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Hash className="h-3.5 w-3.5" />
                <span className="font-mono font-bold">{profile.student_id}</span>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-slate-100">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-bold block mb-1">สมาชิกตั้งแต่</span>
              <span className="text-sm font-bold text-navy-900 dark:text-white">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
                  : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Edit Form */}
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm p-6 sm:p-8 transition-colors">
            <h3 className="text-base font-bold text-navy-900 dark:text-white border-b border-slate-100 pb-3 mb-6">ข้อมูลบัญชีผู้ใช้งาน</h3>

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              {/* Email (Read-only) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">อีเมลสถาบัน (ไม่สามารถเปลี่ยนได้)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500"><Mail className="h-4 w-4" /></span>
                  <input type="text" disabled value={session?.user?.email || ''} className="pl-9 w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-500 dark:text-slate-400 text-sm focus:outline-none" />
                </div>
              </div>

              {/* Role (Read-only) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">บทบาท (ไม่สามารถเปลี่ยนได้)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500"><Shield className="h-4 w-4" /></span>
                  <input type="text" disabled value={getRoleLabel(profile?.role)} className="pl-9 w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-500 dark:text-slate-400 text-sm focus:outline-none" />
                </div>
              </div>

              {/* Editable Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">ชื่อ-นามสกุลจริง</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500"><User className="h-4 w-4" /></span>
                  <input
                    type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="pl-9 w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                    placeholder="ป้อนชื่อและนามสกุล"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button type="submit" disabled={saveLoading}
                  className="flex items-center space-x-2 bg-navy-900 hover:bg-navy-800 text-white font-bold px-6 py-2.5 rounded-lg shadow-sm transition-all disabled:opacity-50 text-sm">
                  {saveLoading ? <><Loader2 className="h-4 w-4 animate-spin" /><span>กำลังบันทึก...</span></> : <><Save className="h-4 w-4 text-primary-400" /><span>บันทึกข้อมูล</span></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
