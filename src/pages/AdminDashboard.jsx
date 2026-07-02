import React, { useState, useEffect, useCallback } from 'react'
import { supabase, getUserProfile } from '../supabaseClient'
import { ShieldCheck, Trash2, Loader2, Package, Users, ShoppingBag, AlertCircle, CheckCircle2, X, RefreshCw, Search, Truck, RotateCcw, ExternalLink, AlertTriangle } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'

// Schema จริง:
// users: student_id(PK), full_name, email, role, created_at
// products: product_id(PK), seller_id(student_id), title, price, category, status, created_at
// orders: order_id(PK), product_id, buyer_id(student_id), rider_id, status, created_at
// riders: student_id(PK), vehicle_type, license_plate, is_active(boolean), rating(numeric)

// Toast system replaced by sonner

function SkeletonTable() {
  return (
    <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700">
            <tr>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <th key={i} className="px-5 py-4"><div className="h-4 bg-slate-200 dark:bg-navy-700 rounded animate-pulse w-20"></div></th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-700/50">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <td key={j} className="px-5 py-4">
                    <div className="h-4 bg-slate-100 dark:bg-navy-800 rounded animate-pulse w-full max-w-[120px]"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminDashboard({ session }) {
  const [userProfile, setUserProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [riders, setRiders] = useState([])
  const [refunds, setRefunds] = useState([])
  const [reports, setReports] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('products')
  
  // Loading states
  const [deleteLoading, setDeleteLoading] = useState(null)
  const [riderActionLoading, setRiderActionLoading] = useState(null)
  const [refundActionLoading, setRefundActionLoading] = useState(null)
  const [reportActionLoading, setReportActionLoading] = useState(null)

  // Refund note modal
  const [isRefundNoteOpen, setIsRefundNoteOpen] = useState(false)
  const [pendingRefundAction, setPendingRefundAction] = useState(null)
  const [adminNote, setAdminNote] = useState('')

  // Suspend Rider modal
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false)
  const [riderToSuspend, setRiderToSuspend] = useState(null)
  const [suspendReason, setSuspendReason] = useState('')

  // Report modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportAdminReply, setReportAdminReply] = useState('')
  const [reportStatus, setReportStatus] = useState('pending')

  // Delete product modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')

  // Image preview modal
  const [previewImage, setPreviewImage] = useState(null)

  const addToast = useCallback((message, type = 'success') => {
    if (type === 'error') {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [])

  useEffect(() => {
    if (session) {
      checkAdminAndLoad()
    }
  }, [session])

  useEffect(() => {
    if (session && isAdmin) {
      const channel = supabase
        .channel('admin-dashboard-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'refund_requests' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'product_reports' }, () => loadAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => loadAllData())
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [session, isAdmin])

  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem('admin_last_viewed', new Date().toISOString())
    }
  }, [isAdmin, activeTab, refunds])

  const checkAdminAndLoad = async () => {
    setAuthLoading(true)
    try {
      const { data: profile, error } = await getUserProfile()
      if (error) throw error
      setUserProfile(profile)
      if (profile?.role === 'admin') {
        setIsAdmin(true)
        await loadAllData()
      } else {
        setIsAdmin(false)
      }
    } catch (err) {
      addToast('ไม่สามารถตรวจสอบสิทธิ์: ' + (err.message || ''), 'error')
    } finally {
      setAuthLoading(false)
    }
  }

  const loadAllData = async () => {
    setDataLoading(true)
    try {
      const [pRes, uRes, oRes, rRes, rfRes, rpRes] = await Promise.all([
        supabase.from('products').select('product_id, seller_id, title, price, category, status, created_at').order('created_at', { ascending: false }),
        supabase.from('users').select('student_id, full_name, email, role, created_at').order('created_at', { ascending: false }),
        supabase.from('orders').select(`order_id, buyer_id, status, created_at, product:products(title, price)`).order('created_at', { ascending: false }).limit(50),
        supabase.from('riders').select('*').order('is_active', { ascending: true }),
        supabase.from('refund_requests').select(`
          *,
          order:orders(order_id, product:products(title, price, image_url, seller_id)),
          buyer:users!refund_requests_buyer_id_fkey(full_name, student_id, email)
        `).order('created_at', { ascending: false }),
        supabase.from('product_reports').select(`
          *,
          reporter:users!product_reports_reporter_id_fkey(full_name, student_id, email)
        `).order('created_at', { ascending: false })
      ])
      
      if (pRes.error) throw pRes.error
      if (uRes.error) throw uRes.error
      
      const usersData = uRes.data || []
      const rawRiders = rRes.data || []

      // แมปรายชื่อผู้ใช้งานให้กับข้อมูลไรเดอร์ (เพื่อแสดงชื่อ-นามสกุลจริง)
      const mappedRiders = rawRiders.map(rider => {
        const u = usersData.find(usr => usr.student_id === rider.student_id)
        return {
          ...rider,
          full_name: u?.full_name || 'ไม่พบบัญชีผู้ใช้',
          email: u?.email || ''
        }
      })

      setProducts(pRes.data || [])
      setUsers(usersData)
      setOrders(oRes.data || [])
      setRiders(mappedRiders)
      setRefunds(rfRes.data || [])
      setReports(rpRes.data || [])
    } catch (err) {
      addToast('เกิดข้อผิดพลาด: ' + (err.message || ''), 'error')
    } finally {
      setDataLoading(false)
    }
  }

  // Admin delete สินค้า
  const handleDeleteProduct = (p) => {
    setProductToDelete(p)
    setDeleteReason('')
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return
    if (!deleteReason.trim()) {
      addToast('กรุณาระบุเหตุผลในการลบ', 'error')
      return
    }
    
    setDeleteLoading(productToDelete.product_id)
    try {
      // 1. ลบสินค้า
      const { error: deleteError } = await supabase.from('products').delete().eq('product_id', productToDelete.product_id)
      if (deleteError) throw deleteError
      
      // 2. ส่งข้อความแจ้งเตือนผู้ขาย
      if (userProfile && userProfile.student_id) {
        const { error: msgError } = await supabase.from('messages').insert({
          sender_id: userProfile.student_id,
          receiver_id: productToDelete.seller_id,
          product_id: null,
          content: `[ประกาศจากผู้ดูแลระบบ] สินค้า "${productToDelete.title}" ของคุณถูกลบออกจากระบบ เนื่องจาก: ${deleteReason.trim()}\n\n[IMAGE: ${productToDelete.image_url}]`,
          is_read: false
        })
        if (msgError) console.warn('ไม่สามารถส่งข้อความแจ้งเตือนได้:', msgError.message)
      }
      
      setProducts((prev) => prev.filter((p) => p.product_id !== productToDelete.product_id))
      addToast(`ลบ "${productToDelete.title}" และส่งข้อความแจ้งเตือนเรียบร้อย`, 'success')
      setIsDeleteModalOpen(false)
    } catch (err) {
      addToast('ลบไม่ได้: ' + err.message, 'error')
    } finally {
      setDeleteLoading(null)
    }
  }

  // อนุมัติการสมัครเป็น Rider
  const handleApproveRider = async (studentId, fullName) => {
    setRiderActionLoading(studentId)
    try {
      const { error } = await supabase
        .from('riders')
        .update({ is_active: true })
        .eq('student_id', studentId)
      
      if (error) throw error
      
      // ส่งข้อความแจ้งเตือนไรเดอร์
      if (userProfile && userProfile.student_id) {
        const { error: msgError } = await supabase.from('messages').insert({
          sender_id: userProfile.student_id,
          receiver_id: studentId,
          product_id: null,
          content: `[ประกาศจากผู้ดูแลระบบ] ยินดีด้วย! สิทธิ์การเป็น Rider ของคุณได้รับการอนุมัติเรียบร้อยแล้ว คุณสามารถเริ่มรับงานได้ทันที`,
          is_read: false
        })
        if (msgError) console.warn('ไม่สามารถส่งข้อความแจ้งเตือนได้:', msgError.message)
      }

      addToast(`อนุมัติให้คุณ "${fullName}" เป็น Rider เรียบร้อย`, 'success')
      await loadAllData()
    } catch (err) {
      addToast('ไม่สามารถอนุมัติได้: ' + err.message, 'error')
    } finally {
      setRiderActionLoading(null)
    }
  }

  // ระงับสิทธิ์ Rider
  const handleSuspendRider = (studentId, fullName) => {
    setRiderToSuspend({ studentId, fullName })
    setSuspendReason('')
    setIsSuspendModalOpen(true)
  }

  const executeSuspendRider = async () => {
    if (!riderToSuspend) return
    if (!suspendReason.trim()) {
      addToast('กรุณาระบุหมายเหตุการระงับสิทธิ์', 'error')
      return
    }

    const { studentId, fullName } = riderToSuspend
    setRiderActionLoading(studentId)
    setIsSuspendModalOpen(false)
    try {
      const { error } = await supabase
        .from('riders')
        .update({ is_active: false })
        .eq('student_id', studentId)
      
      if (error) throw error

      // ส่งข้อความแจ้งเตือนไรเดอร์
      if (userProfile && userProfile.student_id) {
        const { error: msgError } = await supabase.from('messages').insert({
          sender_id: userProfile.student_id,
          receiver_id: studentId,
          product_id: null,
          content: `[ประกาศจากผู้ดูแลระบบ] สิทธิ์การเป็น Rider ของคุณถูกระงับชั่วคราว เนื่องจาก: ${suspendReason.trim()}`,
          is_read: false
        })
        if (msgError) console.warn('ไม่สามารถส่งข้อความแจ้งเตือนได้:', msgError.message)
      }
      
      addToast(`ระงับสิทธิ์ Rider "${fullName}" เรียบร้อย`, 'success')
      await loadAllData()
    } catch (err) {
      addToast('ไม่สามารถดำเนินการได้: ' + err.message, 'error')
    } finally {
      setRiderActionLoading(null)
      setRiderToSuspend(null)
    }
  }

  // ลบใบสมัคร/ข้อมูล Rider ออกถาวร
  const handleDeleteRider = async (studentId, fullName) => {
    if (!window.confirm(`ลบข้อมูลใบสมัคร Rider ของคุณ "${fullName}" ถาวรใช่หรือไม่? (ผู้ใช้จะสามารถกดสมัครใหม่ได้)`)) return
    setRiderActionLoading(studentId)
    try {
      const { error } = await supabase
        .from('riders')
        .delete()
        .eq('student_id', studentId)
      
      if (error) throw error
      
      addToast(`ลบข้อมูล Rider "${fullName}" สำเร็จ`, 'success')
      await loadAllData()
    } catch (err) {
      addToast('ไม่สามารถลบข้อมูลได้: ' + err.message, 'error')
    } finally {
      setRiderActionLoading(null)
    }
  }

  // เปิด modal ยืนยันการอนุมัติ/ปฏิเสธคืนเงิน
  const openRefundAction = (refund, action) => {
    setPendingRefundAction({ refund, action })
    setAdminNote('')
    setIsRefundNoteOpen(true)
  }

  const handleConfirmRefundAction = async () => {
    if (!pendingRefundAction) return
    const { refund, action } = pendingRefundAction
    setRefundActionLoading(refund.refund_id)
    try {
      const { error } = await supabase
        .from('refund_requests')
        .update({ status: action, admin_note: adminNote || null })
        .eq('refund_id', refund.refund_id)
      if (error) throw error

      // แจ้งเตือนผู้ซื้อผ่านแชท
      if (refund.buyer_id) {
        await supabase.from('messages').insert({
          sender_id: userProfile.student_id,
          receiver_id: refund.buyer_id,
          product_id: refund.order?.product_id,
          content: `[แจ้งเตือนจากระบบ - คำขอคืนเงิน]\n\nคำขอคืนเงินสำหรับออเดอร์ "${refund.order?.product?.title || 'สินค้า'}" ได้รับการ "${action === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}" แล้ว!${adminNote ? '\n\nหมายเหตุจากแอดมิน: ' + adminNote : ''}`,
          is_read: false
        })
      }
      
      // แจ้งเตือนผู้ขายผ่านแชท
      if (refund.order?.product?.seller_id) {
        await supabase.from('messages').insert({
          sender_id: userProfile.student_id,
          receiver_id: refund.order.product.seller_id,
          product_id: refund.order?.product_id,
          content: `[แจ้งเตือนจากระบบ - คำขอคืนเงิน]\n\nคำขอคืนเงินจากผู้ซื้อสำหรับออเดอร์ "${refund.order?.product?.title || 'สินค้า'}" ได้รับการ "${action === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}" โดยแอดมินแล้ว${adminNote ? '\n\nหมายเหตุจากแอดมิน: ' + adminNote : ''}`,
          is_read: false
        })
      }

      addToast(
        action === 'approved'
          ? `อนุมัติคำขอคืนเงินของ ${refund.buyer?.full_name} เรียบร้อย`
          : `ปฏิเสธคำขอคืนเงินของ ${refund.buyer?.full_name} แล้ว`,
        'success'
      )
      setIsRefundNoteOpen(false)
      await loadAllData()
    } catch (err) {
      addToast('ไม่สามารถดำเนินการได้: ' + err.message, 'error')
    } finally {
      setRefundActionLoading(null)
    }
  }

  const filteredProducts = products.filter((p) =>
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.seller_id?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredUsers = users.filter((u) =>
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.student_id?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredRiders = riders.filter((r) =>
    r.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.student_id?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const pendingRefunds = refunds.filter((r) => r.status === 'pending')

  const getRoleBadge = (r) => ({ admin: 'bg-red-100 text-red-700 border-red-200', teacher: 'bg-purple-100 text-purple-700 border-purple-200', staff: 'bg-amber-100 text-amber-700 border-amber-200' }[r] || 'bg-sky-100 text-sky-700 border-sky-200')
  const getRoleLabel = (r) => ({ admin: 'Admin', teacher: 'อาจารย์', staff: 'เจ้าหน้าที่', student: 'นักศึกษา' }[r] || 'นักศึกษา')
  const getVehicleLabel = (val) => ({ walking: 'เดินเท้า', bicycle: 'จักรยาน', motorcycle: 'รถมอเตอร์ไซค์' }[val] || 'เดินเท้า')

  if (!session) return <Navigate to="/login" replace />
  // Report handlers
  const openReportModal = (report) => {
    setSelectedReport(report)
    setReportStatus(report.status)
    setReportAdminReply(report.admin_reply || '')
    setIsReportModalOpen(true)
  }

  const handleUpdateReport = async () => {
    if (!selectedReport) return
    setReportActionLoading(selectedReport.id)
    try {
      const { error } = await supabase
        .from('product_reports')
        .update({
          status: reportStatus,
          admin_reply: reportAdminReply.trim() || null
        })
        .eq('id', selectedReport.id)
        
      if (error) throw error
      
      addToast(`อัปเดตรายงาน #${selectedReport.id} เรียบร้อย`, 'success')
      setIsReportModalOpen(false)
      await loadAllData()
    } catch (err) {
      addToast('อัปเดตไม่ได้: ' + err.message, 'error')
    } finally {
      setReportActionLoading(null)
    }
  }

  if (authLoading) return (
    <div className="flex flex-col justify-center items-center py-24 space-y-4">
      <Loader2 className="h-10 w-10 text-primary-600 animate-spin" />
      <p className="text-slate-500 dark:text-slate-400 text-sm">กำลังตรวจสอบสิทธิ์ Admin...</p>
    </div>
  )
  if (!isAdmin) return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <ShieldCheck className="mx-auto h-16 w-16 text-red-300 mb-4" />
      <h1 className="text-2xl font-extrabold text-navy-900 dark:text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
      <p className="text-slate-500 dark:text-slate-400">หน้านี้สำหรับ Admin เท่านั้น — บทบาทปัจจุบัน: <span className="font-bold">{getRoleLabel(userProfile?.role)}</span></p>
    </div>
  )
  const pendingReports = reports.filter((r) => r.status === 'pending')
  const pendingRiders = riders.filter((r) => !r.is_active)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in pb-24">
      {/* Sonner replaces local Toast component */}

      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-3 py-1 bg-red-100 border border-red-200 rounded-full text-xs font-extrabold text-red-700 uppercase tracking-widest">Admin Panel</span>
          </div>
          <h1 className="text-3xl font-extrabold text-navy-900 dark:text-white tracking-tight">แดชบอร์ดผู้ดูแลระบบ</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">จัดการสินค้า ผู้ใช้งาน ไรเดอร์ และออเดอร์ทั้งหมด</p>
        </div>
        <button onClick={loadAllData} disabled={dataLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800/60 shadow-sm transition-all disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-4 w-4 ${dataLoading ? 'animate-spin' : ''}`} /><span>รีเฟรช</span>
        </button>
      </div>

      {/* Notification Tip Banner */}
      <div className="mb-6 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 p-4 rounded-xl flex items-start space-x-3 shadow-sm">
        <AlertCircle className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-sky-900 dark:text-sky-100">คำแนะนำเรื่องการแจ้งเตือน 🔔</h4>
          <p className="text-xs text-sky-700 dark:text-sky-300 mt-1">
            เพื่อให้ระบบส่งเสียงแจ้งเตือนเวลามีคำขอหรือการรายงานใหม่ <span className="font-semibold">กรุณาเปิดหน้าเว็บนี้ค้างไว้และแตะที่หน้าจออย่างน้อย 1 ครั้ง</span> (หากคุณพับจอหรือไปแอปอื่น ระบบอาจปิดเสียงหรือตัดการเชื่อมต่อโดยอัตโนมัติ)
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'สินค้าทั้งหมด', value: products.length, icon: Package, color: 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-400' },
          { label: 'ผู้ใช้งานทั้งหมด', value: users.length, icon: Users, color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400' },
          { label: 'ออเดอร์ทั้งหมด', value: orders.length, icon: ShoppingBag, color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' },
          { label: 'ไรเดอร์สมัครแล้ว', value: riders.length, icon: Truck, color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' }
        ].map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`p-5 rounded-2xl border ${s.color} flex items-center space-x-3 shadow-sm dark:bg-navy-900 transition-colors`}>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shadow-sm border ${s.color} bg-white dark:bg-navy-800`}>
                <Icon className="h-5 w-5" />
              </div>
              <div><p className="text-2xl font-black">{s.value}</p><p className="text-xs font-bold opacity-70">{s.label}</p></div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 bg-white dark:bg-navy-900 p-1 rounded-2xl border border-slate-200 dark:border-navy-700 mb-6 shadow-sm scrollbar-none snap-x transition-colors">
        {[
          { key: 'products', label: 'สินค้า', icon: Package },
          { key: 'users', label: 'ผู้ใช้งาน', icon: Users },
          { key: 'riders', label: `อนุมัติ Rider${pendingRiders.length > 0 ? ` (${pendingRiders.length})` : ''}`, icon: Truck, badge: pendingRiders.length > 0 },
          { key: 'orders', label: 'ออเดอร์', icon: ShoppingBag },
          { key: 'refunds', label: `คำขอคืนเงิน${pendingRefunds.length > 0 ? ` (${pendingRefunds.length})` : ''}`, icon: RotateCcw, badge: pendingRefunds.length > 0 },
          { key: 'reports', label: `ข้อร้องเรียน${pendingReports.length > 0 ? ` (${pendingReports.length})` : ''}`, icon: AlertCircle, badge: pendingReports.length > 0 },
        ].map(({ key, label, icon: Icon, badge }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`relative flex-shrink-0 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap snap-start ${
              activeTab === key
                ? badge ? 'bg-orange-600 text-white shadow-md' : 'bg-navy-900 text-white shadow-md'
                : badge ? 'text-orange-600 hover:bg-orange-50 border border-orange-200' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800/60'
            }`}>
            <Icon className="h-4 w-4" /><span>{label}</span>
            {badge && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
        <input type="text" placeholder="ค้นหา..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 w-full px-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm transition-colors" />
      </div>

      {dataLoading ? (
        <SkeletonTable />
      ) : (
        <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            {activeTab === 'products' && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700">
                  <tr>
                    {['สินค้า (title)', 'ผู้ขาย (student_id)', 'ราคา', 'หมวดหมู่', 'สถานะ', 'จัดการ'].map((h) => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-700/50">
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">ไม่พบสินค้า</td></tr>
                  ) : filteredProducts.map((p) => (
                    <tr key={p.product_id} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
                      <td className="px-5 py-4"><span className="font-bold text-navy-900 dark:text-white line-clamp-1">{p.title}</span></td>
                      <td className="px-5 py-4"><span className="text-xs font-mono text-slate-600 dark:text-slate-300">{p.seller_id}</span></td>
                      <td className="px-5 py-4"><span className="font-black text-navy-900 dark:text-white font-outfit">฿{Number(p.price).toLocaleString()}</span></td>
                      <td className="px-5 py-4"><span className="px-2.5 py-0.5 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 rounded-full text-xs font-bold">{p.category}</span></td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${p.status === 'available' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300'}`}>{p.status}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => handleDeleteProduct(p)} disabled={deleteLoading === p.product_id}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold disabled:opacity-50">
                          {deleteLoading === p.product_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          <span>ลบ</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'users' && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700">
                  <tr>
                    {['ชื่อ', 'รหัสนักศึกษา (PK)', 'อีเมล', 'บทบาท'].map((h) => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-700/50">
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-12 text-slate-400 dark:text-slate-500">ไม่พบผู้ใช้</td></tr>
                  ) : filteredUsers.map((u) => (
                    <tr key={u.student_id} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 bg-navy-900 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(u.full_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-navy-900 dark:text-white">{u.full_name || 'ไม่ระบุ'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4"><span className="text-xs font-mono text-slate-600 dark:text-slate-300">{u.student_id}</span></td>
                      <td className="px-5 py-4"><span className="text-xs text-slate-600 dark:text-slate-300">{u.email}</span></td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRoleBadge(u.role)}`}>{getRoleLabel(u.role)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'riders' && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700">
                  <tr>
                    {['ชื่อผู้ให้บริการ', 'รหัสนักศึกษา', 'ประเภทรถ', 'ป้ายทะเบียน', 'สถานะ', 'จัดการ'].map((h) => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-700/50">
                  {filteredRiders.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">ไม่พบข้อมูลผู้สมัคร Rider</td></tr>
                  ) : filteredRiders.map((r) => (
                    <tr key={r.student_id} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 bg-emerald-700 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(r.full_name || 'R').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-navy-900 dark:text-white">{r.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4"><span className="text-xs font-mono text-slate-600 dark:text-slate-300">{r.student_id}</span></td>
                      <td className="px-5 py-4"><span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{getVehicleLabel(r.vehicle_type)}</span></td>
                      <td className="px-5 py-4"><span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{r.license_plate || '-'}</span></td>
                      <td className="px-5 py-4">
                        {r.is_active ? (
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">อนุมัติแล้ว</span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold animate-pulse">รออนุมัติ</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {r.is_active ? (
                            <button onClick={() => handleSuspendRider(r.student_id, r.full_name)} disabled={riderActionLoading === r.student_id}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold disabled:opacity-50">
                              ระงับสิทธิ์
                            </button>
                          ) : (
                            <button onClick={() => handleApproveRider(r.student_id, r.full_name)} disabled={riderActionLoading === r.student_id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-extrabold disabled:opacity-50">
                              อนุมัติสิทธิ์
                            </button>
                          )}
                          <button onClick={() => handleDeleteRider(r.student_id, r.full_name)} disabled={riderActionLoading === r.student_id}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg disabled:opacity-50" title="ลบข้อมูล">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'orders' && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700">
                  <tr>
                    {['ออเดอร์', 'สินค้า (title)', 'ผู้ซื้อ (student_id)', 'สถานะ'].map((h) => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-700/50">
                  {orders.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-12 text-slate-400 dark:text-slate-500">ไม่มีออเดอร์</td></tr>
                  ) : orders.map((o) => (
                    <tr key={o.order_id} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
                      <td className="px-5 py-4"><span className="font-mono font-bold text-navy-900 dark:text-white text-xs">#ORD-{o.order_id}</span></td>
                      <td className="px-5 py-4"><span className="font-medium text-slate-700 dark:text-slate-200 line-clamp-1">{o.product?.title || '-'}</span></td>
                      <td className="px-5 py-4"><span className="text-xs font-mono text-slate-600 dark:text-slate-300">{o.buyer_id}</span></td>
                      <td className="px-5 py-4">
                        {o.status === 'completed' && <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">สำเร็จ</span>}
                        {o.status === 'cancelled' && <span className="px-2.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-bold">ยกเลิก</span>}
                        {o.status === 'pending' && <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold animate-pulse">รอดำเนินการ</span>}
                        {o.status === 'shipping' && <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold animate-pulse">กำลังจัดส่ง</span>}
                        {o.status === 'delivered' && <span className="px-2.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-xs font-bold">ได้รับสินค้าแล้ว</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* แท็บคำขอคืนเงิน */}
            {activeTab === 'refunds' && (
              <div className="overflow-x-auto">
                {refunds.length === 0 ? (
                  <div className="text-center py-16">
                    <RotateCcw className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-slate-400 dark:text-slate-500 font-medium">ไม่มีคำขอคืนเงิน</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-800">
                      <tr>
                        {['ผู้ซื้อ', 'สินค้า', 'ราคา', 'เหตุผล', 'หลักฐาน', 'สถานะ', 'จัดการ'].map((h) => (
                          <th key={h} className="text-left px-5 py-3.5 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-700/50">
                      {refunds.map((rf) => (
                        <tr key={rf.refund_id} className="hover:bg-orange-50/40 dark:hover:bg-orange-900/20 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-bold text-navy-900 dark:text-white text-sm">{rf.buyer?.full_name || '-'}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-400 font-mono">{rf.buyer?.student_id}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium text-slate-800 dark:text-slate-100 line-clamp-1 max-w-[140px]">{rf.order?.product?.title || '-'}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">#ORD-{rf.order_id}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-black text-navy-900 dark:text-white font-outfit">฿{Number(rf.order?.product?.price || 0).toLocaleString()}</span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-xs text-slate-700 dark:text-slate-200 max-w-[160px] line-clamp-2">{rf.reason}</p>
                            {rf.admin_note && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">หมายเหตุ Admin: {rf.admin_note}</p>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {rf.evidence_url ? (
                              <button
                                onClick={() => setPreviewImage(rf.evidence_url)}
                                className="group relative inline-block">
                                <img
                                  src={rf.evidence_url}
                                  alt="evidence"
                                  className="h-14 w-20 object-cover rounded-lg border-2 border-slate-200 dark:border-navy-700 group-hover:border-orange-400 transition-all shadow-sm group-hover:scale-105 duration-200"
                                />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg text-white text-[10px] font-bold">
                                  🔍 ขยาย
                                </span>
                              </button>
                            ) : <span className="text-slate-400 dark:text-slate-500 text-xs">-</span>}
                          </td>
                          <td className="px-5 py-4">
                            {rf.status === 'pending' && <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold animate-pulse">รอดำเนินการ</span>}
                            {rf.status === 'approved' && <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">อนุมัติแล้ว</span>}
                            {rf.status === 'rejected' && <span className="px-2.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-bold">ปฏิเสธ</span>}
                          </td>
                          <td className="px-5 py-4">
                            {rf.status === 'pending' && (
                              <div className="flex items-center space-x-2">
                                <button onClick={() => openRefundAction(rf, 'approved')}
                                  disabled={refundActionLoading === rf.refund_id}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-extrabold disabled:opacity-50">
                                  อนุมัติ ✅
                                </button>
                                <button onClick={() => openRefundAction(rf, 'rejected')}
                                  disabled={refundActionLoading === rf.refund_id}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold disabled:opacity-50">
                                  ปฏิเสธ ❌
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* แท็บรายงานปัญหา */}
            {activeTab === 'reports' && (
              <div className="overflow-x-auto">
                {reports.length === 0 ? (
                  <div className="text-center py-16">
                    <AlertCircle className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-slate-400 dark:text-slate-500 font-medium">ไม่มีรายงานปัญหา</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-rose-50 dark:bg-rose-900/20 border-b border-rose-100 dark:border-rose-800">
                      <tr>
                        {['ผู้ร้องเรียน', 'หมวดหมู่', 'รายละเอียด', 'รูปประกอบ', 'สถานะ', 'จัดการ'].map((h) => (
                          <th key={h} className="text-left px-5 py-3.5 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-700/50">
                      {reports.map((rp) => (
                        <tr key={rp.id} className="hover:bg-rose-50/40 dark:hover:bg-rose-900/20 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-bold text-navy-900 dark:text-white text-sm">{rp.reporter?.full_name || '-'}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-400 font-mono">{rp.reporter?.student_id}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 rounded-full text-xs font-bold">{rp.issue_type}</span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-xs text-slate-700 dark:text-slate-200 max-w-[250px] whitespace-normal break-words">{rp.description}</p>
                            {rp.admin_reply && (
                              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 italic font-medium whitespace-normal break-words max-w-[250px]">ตอบกลับ: {rp.admin_reply}</p>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {rp.image_url ? (
                              <button
                                onClick={() => setPreviewImage(rp.image_url)}
                                className="group relative inline-block">
                                <img
                                  src={rp.image_url}
                                  alt="report image"
                                  className="h-14 w-20 object-cover rounded-lg border-2 border-slate-200 dark:border-navy-700 group-hover:border-rose-400 transition-all shadow-sm group-hover:scale-105 duration-200"
                                />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg text-white text-[10px] font-bold">
                                  🔍 ขยาย
                                </span>
                              </button>
                            ) : <span className="text-slate-400 dark:text-slate-500 text-xs">-</span>}
                          </td>
                          <td className="px-5 py-4">
                            {rp.status === 'pending' && <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold animate-pulse">รอตรวจสอบ</span>}
                            {rp.status === 'investigating' && <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">กำลังตรวจสอบ</span>}
                            {rp.status === 'resolved' && <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">ดำเนินการแล้ว</span>}
                            {rp.status === 'dismissed' && <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-700 rounded-full text-xs font-bold">ไม่พบปัญหา</span>}
                          </td>
                          <td className="px-5 py-4">
                            <button onClick={() => openReportModal(rp)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm">
                              จัดการ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin Refund Note Modal */}
      {isRefundNoteOpen && pendingRefundAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-md overflow-hidden animate-scale-up transition-colors">
            <div className={`p-4 flex items-center justify-between ${pendingRefundAction.action === 'approved' ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
              <div>
                <h2 className="text-base font-bold">
                  {pendingRefundAction.action === 'approved' ? '✅ ยืนยันอนุมัติคืนเงิน' : '❌ ยืนยันปฏิเสธคืนเงิน'}
                </h2>
                <p className="text-xs opacity-80 mt-0.5">
                  {pendingRefundAction.refund.buyer?.full_name} · {pendingRefundAction.refund.order?.product?.title}
                </p>
              </div>
              <button onClick={() => setIsRefundNoteOpen(false)}><X className="h-5 w-5 opacity-70 hover:opacity-100" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  หมายเหตุถึงผู้ซื้อ (ไม่บังคับ)
                </label>
                <textarea rows="3"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={pendingRefundAction.action === 'approved'
                    ? 'เช่น กรุณาส่งสินค้าคืนก่อนรับเงิน...'
                    : 'เช่น สินค้าตรงตามที่ระบุ ไม่อยู่ในเงื่อนไขคืนเงิน...'
                  }
                  className="w-full px-3 py-2.5 bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-1">
                <button onClick={() => setIsRefundNoteOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60">
                  ยกเลิก
                </button>
                <button onClick={handleConfirmRefundAction} disabled={refundActionLoading === pendingRefundAction?.refund?.refund_id}
                  className={`flex items-center space-x-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-50 ${pendingRefundAction.action === 'approved' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}>
                  {refundActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <span>{pendingRefundAction.action === 'approved' ? 'ยืนยันอนุมัติ' : 'ยืนยันปฏิเสธ'}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Report Modal */}
      {isReportModalOpen && selectedReport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-md overflow-hidden animate-scale-up transition-colors">
            <div className="bg-navy-900 p-4 flex items-center justify-between text-white">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  จัดการรายงานปัญหา
                </h2>
                <p className="text-xs opacity-80 mt-0.5">
                  REP-{selectedReport.id} · {selectedReport.reporter?.full_name}
                </p>
              </div>
              <button onClick={() => setIsReportModalOpen(false)}><X className="h-5 w-5 opacity-70 hover:opacity-100" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded-xl border border-slate-100 border-l-4 border-l-primary-500">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">รายละเอียดปัญหา</p>
                <p className="text-sm text-slate-800 dark:text-slate-100">{selectedReport.description}</p>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  สถานะ
                </label>
                <select 
                  value={reportStatus}
                  onChange={(e) => setReportStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="pending">รอตรวจสอบ</option>
                  <option value="investigating">กำลังตรวจสอบ</option>
                  <option value="resolved">ดำเนินการแก้ไขแล้ว</option>
                  <option value="dismissed">ไม่พบปัญหา/ยกเลิก</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  ข้อความตอบกลับถึงผู้ร้องเรียน
                </label>
                <textarea rows="3"
                  value={reportAdminReply}
                  onChange={(e) => setReportAdminReply(e.target.value)}
                  placeholder="พิมพ์ข้อความตอบกลับ หรืออธิบายผลการดำเนินการให้ผู้ใช้ทราบ..."
                  className="w-full px-3 py-2.5 bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-1">
                <button onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60">
                  ยกเลิก
                </button>
                <button onClick={handleUpdateReport} disabled={reportActionLoading === selectedReport.id}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-50">
                  {reportActionLoading === selectedReport.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>บันทึกข้อมูล</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Rider Modal */}
      {isSuspendModalOpen && riderToSuspend && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-md overflow-hidden animate-scale-up transition-colors">
            <div className="bg-amber-500 p-4 flex items-center justify-between text-white">
              <h2 className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                ยืนยันการระงับสิทธิ์
              </h2>
              <button onClick={() => setIsSuspendModalOpen(false)}><X className="h-5 w-5 opacity-70 hover:opacity-100" /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                คุณแน่ใจหรือไม่ที่จะระงับสิทธิ์การเป็นไรเดอร์ของ <span className="font-bold text-navy-900 dark:text-white">"{riderToSuspend.fullName}"</span> ?
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  หมายเหตุการระงับสิทธิ์ <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="ระบุเหตุผลที่ระงับสิทธิ์ (ข้อความนี้จะถูกส่งไปยังไรเดอร์)"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors resize-none"
                  rows="3"
                ></textarea>
              </div>
              
              <div className="flex items-center justify-end space-x-3">
                <button onClick={() => setIsSuspendModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-xl transition-colors">
                  ยกเลิก
                </button>
                <button onClick={executeSuspendRider} disabled={riderActionLoading === riderToSuspend.studentId}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-amber-500/30 transition-all disabled:opacity-50">
                  {riderActionLoading === riderToSuspend.studentId ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                  <span>ยืนยันการระงับสิทธิ์</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Delete Product Modal */}
      {isDeleteModalOpen && productToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-md overflow-hidden animate-scale-up transition-colors">
            <div className="bg-red-600 p-4 flex items-center justify-between text-white">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  ลบสินค้า
                </h2>
                <p className="text-xs opacity-90 mt-0.5">
                  ระบุเหตุผลเพื่อแจ้งเตือนไปยังผู้ขาย
                </p>
              </div>
              <button onClick={() => setIsDeleteModalOpen(false)}><X className="h-5 w-5 opacity-70 hover:opacity-100" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">สินค้าที่จะลบ</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2">{productToDelete.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ผู้ขาย: {productToDelete.seller_id}</p>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  ระบุสาเหตุที่ลบ (จำเป็น)
                </label>
                <textarea rows="3"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="เช่น ภาพสินค้าไม่เหมาะสม, ผิดกฎวิทยาลัย..."
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-1">
                <button onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60">
                  ยกเลิก
                </button>
                <button onClick={handleConfirmDeleteProduct} disabled={deleteLoading === productToDelete.product_id || !deleteReason.trim()}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-50">
                  {deleteLoading === productToDelete.product_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>ยืนยันลบและส่งข้อความ</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-4 -right-4 z-10 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 rounded-full p-1.5 shadow-lg hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            {/* Image */}
            <div className="bg-white dark:bg-navy-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-navy-700 transition-colors">
              <div className="bg-orange-50 border-b border-orange-100 px-4 py-2.5 flex items-center space-x-2">
                <span className="text-sm font-bold text-orange-700">🖼️ รูปหลักฐานการขอคืนเงิน</span>
              </div>
              <div className="p-4 flex justify-center bg-slate-50 dark:bg-navy-950">
                <img
                  src={previewImage}
                  alt="evidence-preview"
                  className="max-h-[70vh] max-w-full object-contain rounded-xl shadow"
                />
              </div>
              <div className="px-4 py-3 bg-white dark:bg-navy-900 border-t border-slate-100 flex justify-between items-center transition-colors">
                <p className="text-xs text-slate-400 dark:text-slate-500">คลิกพื้นที่ด้านนอกเพื่อปิด</p>
                <a
                  href={previewImage}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>เปิดในแท็บใหม่</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
