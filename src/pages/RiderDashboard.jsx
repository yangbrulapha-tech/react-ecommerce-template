import React, { useState, useEffect } from 'react'
import { supabase, getUserProfile } from '../supabaseClient'
import { Truck, CheckCircle2, AlertCircle, Loader2, MapPin, Phone, User, ClipboardList, Navigation, AlertTriangle, ArrowRight, Shield, X } from 'lucide-react'
import { Navigate } from 'react-router-dom'

// Schema:
// riders: student_id(PK), vehicle_type, license_plate, is_active(boolean)
// orders: order_id(PK), product_id, buyer_id(student_id), rider_id, status, created_at

export default function RiderDashboard({ session }) {
  const [userProfile, setUserProfile] = useState(null)
  const [riderInfo, setRiderInfo] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isRider, setIsRider] = useState(false)
  const [activeTab, setActiveTab] = useState('available') // available, my_jobs, history

  const [availableOrders, setAvailableOrders] = useState([])
  const [myJobs, setMyJobs] = useState([])
  const [historyJobs, setHistoryJobs] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [missingProofOrderId, setMissingProofOrderId] = useState(null)

  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [previewImage, setPreviewImage] = useState(null)
  const [expandedProofs, setExpandedProofs] = useState(new Set())

  useEffect(() => {
    if (session) checkRiderStatus()
  }, [session])

  const checkRiderStatus = async () => {
    setAuthLoading(true)
    try {
      const { data: profile, error } = await getUserProfile()
      if (error) throw error
      setUserProfile(profile)

      if (profile) {
        // เช็คในตาราง riders ว่าเป็นไรเดอร์หรือไม่
        const { data: rider, error: rError } = await supabase
          .from('riders')
          .select('*')
          .eq('student_id', profile.student_id)
          .maybeSingle()

        if (rider) {
          setIsRider(true)
          setRiderInfo(rider)
          if (rider.is_active) {
            await loadRiderJobs(profile.student_id)
          }
        } else {
          setIsRider(false)
        }
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการโหลดข้อมูลสิทธิ์: ' + err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const loadRiderJobs = async (riderStudentId) => {
    setDataLoading(true)
    setErrorMsg('')
    try {
      // 1. งานที่สามารถกดรับได้: status = 'pending' และ rider_id เป็น NULL
      const { data: avail, error: aErr } = await supabase
        .from('orders')
        .select(`
          *,
          product:products (
            product_id,
            title,
            price,
            image_url,
            seller_id
          ),
          buyer:users!orders_buyer_id_fkey (
            student_id,
            full_name
          )
        `)
        .eq('status', 'pending')
        .eq('needs_delivery', true) // โชว์เฉพาะงานที่ขอใช้บริการไรเดอร์เข้ามา
        .eq('seller_accepted', true) // โชว์เฉพาะงานที่ผู้ขายกดยอมรับแล้ว
        .is('rider_id', null)
        .neq('buyer_id', riderStudentId) // ห้ามไรเดอร์มองเห็นออเดอร์ของตนเอง
        .order('created_at', { ascending: false })

      if (aErr) throw aErr


      // ดึงข้อมูลผู้ขายสำหรับแต่ละงานว่าง (เพราะ seller_id อยู่ใน products)
      const availWithSeller = await Promise.all(
        (avail || []).map(async (order) => {
          if (order.product?.seller_id) {
            const { data: sellerData } = await supabase
              .from('users')
              .select('student_id, full_name')
              .eq('student_id', order.product.seller_id)
              .single()
            return { ...order, seller: sellerData }
          }
          return { ...order, seller: null }
        })
      )

      setAvailableOrders(availWithSeller)

      // 2. งานที่ตัวไรเดอร์คนนี้รับจัดส่งอยู่: rider_id = ของเรา และ status != 'completed' / 'cancelled'
      const { data: active, error: acErr } = await supabase
        .from('orders')
        .select(`
          *,
          product:products (
            product_id,
            title,
            price,
            image_url,
            seller_id
          ),
          buyer:users!orders_buyer_id_fkey (
            student_id,
            full_name
          )
        `)
        .eq('rider_id', riderStudentId)
        .in('status', ['shipping', 'pending']) // รวม pending เผื่อเปลี่ยนสิทธิ์แล้ว
        .order('created_at', { ascending: false })

      if (acErr) throw acErr

      const activeWithSeller = await Promise.all(
        (active || []).map(async (order) => {
          if (order.product?.seller_id) {
            const { data: sellerData } = await supabase
              .from('users')
              .select('student_id, full_name')
              .eq('student_id', order.product.seller_id)
              .single()
            return { ...order, seller: sellerData }
          }
          return { ...order, seller: null }
        })
      )

      setMyJobs(activeWithSeller.filter(o => o.status !== 'completed' && o.status !== 'cancelled'))

      // 3. ประวัติงานที่จัดส่งสำเร็จแล้ว: status = 'completed' และ rider_id = ของเรา
      const { data: completed, error: cErr } = await supabase
        .from('orders')
        .select(`
          *,
          product:products (
            title,
            price
          )
        `)
        .eq('rider_id', riderStudentId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      if (cErr) throw cErr
      setHistoryJobs(completed || [])

    } catch (err) {
      setErrorMsg('ไม่สามารถโหลดข้อมูลงานได้: ' + err.message)
    } finally {
      setDataLoading(false)
    }
  }

  // State สำหรับเก็บไฟล์หลักฐานจัดส่งสำหรับแต่ละออเดอร์
  const [proofFiles, setProofFiles] = useState({}) // { [orderId]: File }
  const [proofPreviews, setProofPreviews] = useState({}) // { [orderId]: string }

  const handleProofFileChange = (orderId, file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดไฟล์ต้องไม่เกิน 5MB')
      return
    }
    setProofFiles(prev => ({ ...prev, [orderId]: file }))
    setProofPreviews(prev => ({ ...prev, [orderId]: URL.createObjectURL(file) }))
    setMissingProofOrderId(null)
    setErrorMsg('')
  }

  // กดรับงานจัดส่ง (Accept job)
  const handleAcceptJob = async (orderId) => {
    if (!userProfile) return
    setActionLoadingId(orderId)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('buyer_id')
        .eq('order_id', orderId)
        .single()

      if (orderData && orderData.buyer_id === userProfile.student_id) {
        throw new Error('ไม่สามารถรับงานจัดส่งสินค้าของตัวเองที่สั่งซื้อได้')
      }
      // อัปเดตออเดอร์ให้ระบุ rider_id และปรับสถานะเป็น 'shipping' (กำลังจัดส่ง)
      const { error } = await supabase
        .from('orders')
        .update({
          rider_id: userProfile.student_id,
          status: 'shipping'
        })
        .eq('order_id', orderId)
        .is('rider_id', null) // ป้องกันการจองซ้ำซ้อน

      if (error) throw error

      setSuccessMsg('รับงานจัดส่งสินค้าสำเร็จ! กรุณาติดต่อผู้ซื้อและผู้ขายเพื่อดำเนินการจัดส่ง')
      await loadRiderJobs(userProfile.student_id)
      setActiveTab('my_jobs')
    } catch (err) {
      setErrorMsg('ไม่สามารถรับงานได้: ' + err.message)
    } finally {
      setActionLoadingId(null)
    }
  }

  // ยกเลิกการรับงานจัดส่ง (Cancel job)
  const handleCancelJob = async (orderId) => {
    if (!userProfile) return
    if (!window.confirm('ยืนยันที่จะยกเลิกการส่งออเดอร์นี้ใช่หรือไม่? ออเดอร์จะถูกส่งกลับเข้าส่วนกลางเพื่อให้ไรเดอร์คนอื่นรับงาน')) return
    
    setActionLoadingId(orderId)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          rider_id: null,
          status: 'pending'
        })
        .eq('order_id', orderId)

      if (error) throw error

      setSuccessMsg('ยกเลิกงานจัดส่งเรียบร้อย')
      // ล้างข้อมูลรูปภาพหลักฐาน
      setProofFiles(prev => { const n = { ...prev }; delete n[orderId]; return n })
      setProofPreviews(prev => { const n = { ...prev }; delete n[orderId]; return n })

      await loadRiderJobs(userProfile.student_id)
      setActiveTab('available')
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการยกเลิกงาน: ' + err.message)
    } finally {
      setActionLoadingId(null)
    }
  }

  // ส่งสินค้าสำเร็จ (Complete job) - อัปโหลดหลักฐานส่งของ
  const handleCompleteJob = async (orderId) => {
    if (!userProfile) return
    const file = proofFiles[orderId]
    if (!file) {
      setMissingProofOrderId(orderId)
      return
    }

    setActionLoadingId(orderId)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      // 1. อัปโหลดภาพหลักฐานไปที่ Storage Bucket 'product-images'
      const fileExt = file.name.split('.').pop().toLowerCase()
      const fileName = `delivery_proofs/${orderId}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // 2. ดึง Public URL ของรูปหลักฐาน
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)

      // 3. อัปเดตออเดอร์ (เปลี่ยนสถานะเป็น completed และบันทึก URL รูปภาพหลักฐาน)
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          delivery_image_url: publicUrl
        })
        .eq('order_id', orderId)

      if (error) throw error

      setSuccessMsg('อัปเดตสถานะจัดส่งสำเร็จ พร้อมส่งหลักฐานรูปถ่ายให้ผู้รับแล้ว! ขอบคุณครับ')
      
      // ล้างรูปภาพออเดอร์นี้
      setProofFiles(prev => { const n = { ...prev }; delete n[orderId]; return n })
      setProofPreviews(prev => { const n = { ...prev }; delete n[orderId]; return n })

      await loadRiderJobs(userProfile.student_id)
      setActiveTab('history')
    } catch (err) {
      setErrorMsg('ไม่สามารถดำเนินการให้งานเสร็จได้: ' + err.message)
    } finally {
      setActionLoadingId(null)
    }
  }

  const getVehicleLabel = (val) => ({ walking: 'เดินเท้า', bicycle: 'จักรยาน', motorcycle: 'รถมอเตอร์ไซค์' }[val] || 'เดินเท้า')

  if (!session) return <Navigate to="/login" replace />

  if (authLoading) return (
    <div className="flex flex-col justify-center items-center py-24 space-y-4">
      <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
      <p className="text-slate-500 dark:text-slate-400 text-sm">กำลังตรวจสอบข้อมูลสมาชิกไรเดอร์...</p>
    </div>
  )

  // กรณีไม่ได้สมัครไรเดอร์ หรือสมัครแต่ยังไม่อนุมัติ
  if (!isRider) return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center animate-scale-up">
      <Truck className="mx-auto h-16 w-16 text-slate-300 mb-4" />
      <h1 className="text-2xl font-extrabold text-navy-900 dark:text-white mb-2">ยังไม่ได้ลงทะเบียนเป็น Rider</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">ลงสมัครทำงานพิเศษรับส่งสินค้าภายในสถาบัน ปลอดภัย ได้รับรายได้</p>
      <a href="/" className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all">
        <span>ไปสมัครที่หน้าหลัก</span>
      </a>
    </div>
  )

  if (riderInfo && !riderInfo.is_active) return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center animate-scale-up">
      <div className="h-16 w-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-500">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-extrabold text-navy-900 dark:text-white mb-2">รอผู้ดูแลอนุมัติใบสมัคร</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
        ใบสมัครของคุณอยู่ในขั้นตอนการตรวจสอบโดยคณะอาจารย์หรือแอดมิน เพื่อความปลอดภัยของผู้ใช้งานภายในระบบ
      </p>
      <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-navy-950 p-4 rounded-xl border border-slate-100 font-mono">
        <p>ชื่อ: {userProfile?.full_name}</p>
        <p>รหัส: {riderInfo.student_id}</p>
        <p>พาหนะ: {getVehicleLabel(riderInfo.vehicle_type)}</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-navy-700 pb-5">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/50 rounded-full text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-widest flex items-center gap-1">
              <Truck className="h-3 w-3" /> Rider Active
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-navy-900 dark:text-white tracking-tight">ระบบบริการรับส่งสินค้า (Rider)</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">รับออเดอร์ จัดส่งของ และควบคุมการให้บริการภายในวิทยาลัย</p>
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-navy-800/60 px-4 py-2 rounded-xl text-right">
          <p>ผู้ให้บริการ: <span className="font-bold text-navy-950 dark:text-white">{userProfile?.full_name}</span></p>
          <p>พาหนะ: <span className="font-bold text-emerald-700 dark:text-emerald-400">{getVehicleLabel(riderInfo?.vehicle_type)}</span></p>
        </div>
      </div>

      {/* Notification Tip Banner */}
      <div className="mb-6 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 p-4 rounded-xl flex items-start space-x-3 shadow-sm">
        <AlertCircle className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-sky-900 dark:text-sky-100">คำแนะนำเรื่องการแจ้งเตือน 🔔</h4>
          <p className="text-xs text-sky-700 dark:text-sky-300 mt-1">
            เพื่อให้ระบบส่งเสียงแจ้งเตือนเวลามีงานเข้า <span className="font-semibold">กรุณาเปิดหน้าเว็บนี้ค้างไว้และแตะที่หน้าจออย่างน้อย 1 ครั้ง</span> (หากคุณพับจอหรือไปแอปอื่น ระบบมือถืออาจปิดเสียงหรือตัดการเชื่อมต่อโดยอัตโนมัติ)
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center space-x-2 animate-scale-up">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center space-x-2 animate-scale-up">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 border border-slate-200 dark:border-navy-700 bg-slate-100/50 dark:bg-navy-950/50 p-1 rounded-2xl mb-8 shadow-sm transition-colors scrollbar-none snap-x">
        <button onClick={() => setActiveTab('available')}
          className={`flex-shrink-0 snap-start sm:flex-1 py-3 px-5 text-sm font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 whitespace-nowrap ${activeTab === 'available' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800/60'}`}>
          <ClipboardList className="h-4 w-4 shrink-0" /><span>งานรับจัดส่งทั่วไป ({availableOrders.length})</span>
        </button>
        <button onClick={() => setActiveTab('my_jobs')}
          className={`flex-shrink-0 snap-start sm:flex-1 py-3 px-5 text-sm font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 whitespace-nowrap ${activeTab === 'my_jobs' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800/60'}`}>
          <Navigation className="h-4 w-4 shrink-0" /><span>งานจัดส่งปัจจุบัน ({myJobs.length})</span>
        </button>
        <button onClick={() => setActiveTab('history')}
          className={`flex-shrink-0 snap-start sm:flex-1 py-3 px-5 text-sm font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 whitespace-nowrap ${activeTab === 'history' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800/60'}`}>
          <CheckCircle2 className="h-4 w-4 shrink-0" /><span>ส่งของสำเร็จแล้ว ({historyJobs.length})</span>
        </button>
      </div>

      {dataLoading ? (
        <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 text-emerald-600 animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: AVAILABLE JOBS */}
          {activeTab === 'available' && (
            availableOrders.length === 0 ? (
              <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 text-center py-16 px-4 transition-colors">
                <ClipboardList className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">ไม่มีงานจัดส่งในขณะนี้</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">ออเดอร์ใหม่จากผู้ใช้งานที่ต้องการไรเดอร์ส่งของจะแสดงขึ้นตรงนี้</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {availableOrders.map((order) => (
                  <div key={order.order_id} className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 p-5 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-colors">
                    <div>
                      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase font-mono">#ORD-{order.order_id}</span>
                          <h3 className="font-extrabold text-navy-950 dark:text-white text-sm sm:text-base line-clamp-1 mt-0.5">{order.product?.title || 'สินค้าทั่วไป'}</h3>
                        </div>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-outfit">
                          ฿{Number(order.product?.price || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 mb-4 bg-slate-50 dark:bg-navy-950/50 p-3 rounded-lg border border-slate-200/50 dark:border-navy-700/50">
                        <div className="flex items-center space-x-2">
                          <User className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>ผู้รับเงิน/ผู้ขาย: <span className="font-bold text-slate-800 dark:text-slate-100">{order.seller?.full_name || order.product?.seller_id}</span></span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>ผู้จ่ายเงิน/ผู้ซื้อ: <span className="font-bold text-slate-800 dark:text-slate-100">{order.buyer?.full_name || order.buyer_id}</span></span>
                        </div>
                        {order.delivery_address && (
                          <div className="pt-1.5 border-t border-slate-200/60 mt-1.5 flex items-start space-x-2 text-[11px] text-slate-700 dark:text-slate-200">
                            <span className="font-bold shrink-0">📍 จุดนัดรับ:</span>
                            <span className="font-medium whitespace-pre-wrap">{order.delivery_address}</span>
                          </div>
                        )}
                        {order.delivery_fee > 0 && (
                          <div className="flex items-center space-x-2 text-[11px] text-emerald-700 font-extrabold mt-1">
                            <span>💵 ค่าบริการ Rider: ฿{Number(order.delivery_fee).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button onClick={() => handleAcceptJob(order.order_id)} disabled={actionLoadingId === order.order_id}
                      className="w-full flex items-center justify-center space-x-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold py-2.5 rounded-xl text-xs sm:text-sm shadow-sm transition-all disabled:opacity-50">
                      {actionLoadingId === order.order_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Truck className="h-4 w-4" /><span>รับงานส่งของชิ้นนี้</span></>}
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          {/* TAB 2: MY JOBS */}
          {activeTab === 'my_jobs' && (
            myJobs.length === 0 ? (
              <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 text-center py-16 px-4 transition-colors">
                <Navigation className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">ไม่มีงานกำลังจัดส่ง</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">คุณสามารถไปที่แท็บ "งานจัดส่งทั่วไป" เพื่อกดเลือกรับงานได้เลย</p>
              </div>
            ) : (
              <div className="space-y-6">
                {myJobs.map((order) => (
                  <div key={order.order_id} className="bg-white dark:bg-navy-900 rounded-2xl border border-emerald-400/80 shadow-md overflow-hidden animate-scale-up transition-colors">
                    <div className="bg-emerald-50 dark:bg-navy-950/60 px-6 py-4 border-b border-emerald-100 dark:border-navy-700/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-extrabold uppercase font-mono bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md">ออเดอร์ระหว่างจัดส่ง</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2">#ORD-{order.order_id}</span>
                      </div>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-outfit">฿{Number(order.product?.price || 0).toLocaleString()}</span>
                    </div>

                    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Product Detail */}
                      <div className="flex items-start space-x-4">
                        <div className="h-20 w-20 bg-slate-100 dark:bg-navy-800 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-navy-700 cursor-pointer hover:ring-2 hover:ring-emerald-500/50 transition-all duration-200"
                          onClick={() => setPreviewImage(order.product?.image_url)}>
                          <img src={order.product?.image_url} alt={order.product?.title} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-navy-900 dark:text-white text-sm sm:text-base">{order.product?.title || 'สินค้าทั่วไป'}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            รับของจากฝั่งผู้ขายแล้วนำไปเก็บเงิน+ส่งมอบให้ฝั่งผู้ซื้อ นัดหมายส่งของภายในวิทยาลัย
                          </p>
                        </div>
                      </div>

                      {/* Contact Buyer/Seller */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Seller Contact */}
                        <div className="bg-slate-50 dark:bg-navy-950/50 p-4 rounded-xl border border-slate-200 dark:border-navy-700">
                          <span className="text-[9px] font-extrabold text-amber-700 dark:text-amber-500 uppercase tracking-wider block mb-1">1. นัดรับสินค้าจาก (ผู้ขาย)</span>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{order.seller?.full_name || '-'}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">รหัส: {order.product?.seller_id}</p>
                        </div>

                        {/* Buyer Contact */}
                        <div className="bg-slate-50 dark:bg-navy-950/50 p-4 rounded-xl border border-slate-200 dark:border-navy-700">
                          <span className="text-[9px] font-extrabold text-primary-700 dark:text-primary-400 uppercase tracking-wider block mb-1">2. นัดส่งมอบและรับเงินจาก (ผู้ซื้อ)</span>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{order.buyer?.full_name || '-'}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">รหัส: {order.buyer_id}</p>
                          {order.delivery_address && (
                            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-navy-700/60">
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 block">📍 จุดนัดส่งมอบ:</span>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5 whitespace-pre-wrap">{order.delivery_address}</p>
                            </div>
                          )}
                          {order.delivery_fee > 0 && (
                            <div className="mt-2.5">
                              <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-800/50 px-1.5 py-0.5 rounded-md inline-block">
                                ค่าบริการ: ฿{Number(order.delivery_fee).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* อัปโหลดหลักฐานส่งของ */}
                    <div className="px-6 pb-5 pt-1 border-t border-slate-100 dark:border-navy-700 bg-emerald-50/20 dark:bg-navy-950/30">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 uppercase tracking-wider">
                        📸 รูปภาพหลักฐานยืนยันการจัดส่ง <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        <label htmlFor={`proof-upload-${order.order_id}`}
                          className="px-4 py-2 border border-dashed border-emerald-400 bg-white dark:bg-navy-900 hover:bg-emerald-50/50 dark:hover:bg-navy-800/80 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-400 cursor-pointer transition-colors shrink-0">
                          {proofFiles[order.order_id] ? 'เปลี่ยนรูปภาพ' : 'เลือก/ถ่ายรูปหลักฐาน'}
                          <input
                            id={`proof-upload-${order.order_id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleProofFileChange(order.order_id, e.target.files[0])}
                          />
                        </label>
                        {proofPreviews[order.order_id] ? (
                          <button type="button" onClick={() => setExpandedProofs(prev => { const n = new Set(prev); if (n.has(order.order_id)) n.delete(order.order_id); else n.add(order.order_id); return n; })}
                            className={`rounded-lg overflow-hidden border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-0.5 transition-all duration-300 hover:border-emerald-400 cursor-zoom-in shrink-0 ${expandedProofs.has(order.order_id) ? 'w-full max-w-sm h-auto' : 'h-16 w-24'}`}>
                            <img src={proofPreviews[order.order_id]} alt="proof-preview" className={`w-full rounded-md transition-all duration-300 ${expandedProofs.has(order.order_id) ? 'object-contain h-auto' : 'h-full object-cover'}`} />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">กรุณาอัปโหลดรูปภาพขณะส่งมอบสินค้าเพื่อบันทึกงานจัดส่งสำเร็จ</span>
                        )}
                      </div>
                    </div>

                    {missingProofOrderId === order.order_id && (
                      <div className="mx-6 mt-3 bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl flex items-center space-x-2 animate-scale-up">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600 animate-bounce" />
                        <span className="text-xs font-bold">กรุณาอัปโหลดรูปภาพหลักฐานการจัดส่ง</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="bg-slate-50 dark:bg-navy-950/60 px-6 py-4 border-t border-slate-100 dark:border-navy-700 flex justify-end space-x-3">
                      <button onClick={() => handleCancelJob(order.order_id)} disabled={actionLoadingId === order.order_id}
                        className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800/60 disabled:opacity-50 transition-colors">
                        คืนงานจัดส่ง
                      </button>
                      <button onClick={() => handleCompleteJob(order.order_id)} disabled={actionLoadingId === order.order_id}
                        className="flex items-center space-x-1.5 px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 hover:from-emerald-400 hover:to-teal-500 text-white rounded-lg text-xs font-extrabold shadow-sm transition-all disabled:opacity-50">
                        {actionLoadingId === order.order_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5" /><span>จัดส่งสำเร็จเรียบร้อย</span></>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === 'history' && (
            historyJobs.length === 0 ? (
              <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 text-center py-16 px-4 transition-colors">
                <CheckCircle2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">ไม่มีประวัติการส่งสำเร็จ</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">ประวัติงานที่คุณส่งสำเร็จจะแสดงขึ้นตรงนี้หลังกดรับงานและส่งมอบแล้ว</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-navy-700 text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 dark:bg-navy-950/50">
                      <tr>
                        {['หมายเลขออเดอร์', 'ชื่อสินค้า', 'ราคาสินค้า', 'รูปหลักฐาน', 'วันที่จัดส่งสำเร็จ'].map((h) => (
                          <th key={h} className="px-6 py-3.5 font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-navy-700">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-navy-700/60 bg-white dark:bg-navy-900 transition-colors">
                      {historyJobs.map((order) => (
                        <tr key={order.order_id} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-navy-950 dark:text-slate-300">#ORD-{order.order_id}</td>
                          <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{order.product?.title || 'สินค้าทั่วไป'}</td>
                          <td className="px-6 py-4 font-black text-emerald-600 dark:text-emerald-400 font-outfit">฿{Number(order.product?.price || 0).toLocaleString()}</td>
                          <td className="px-6 py-4">
                            {order.delivery_image_url ? (
                              <button type="button" onClick={() => setPreviewImage(order.delivery_image_url)} className="inline-block h-10 w-14 rounded overflow-hidden border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 hover:border-emerald-500 transition-colors">
                                <img src={order.delivery_image_url} alt="delivery-proof" className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-400 dark:text-slate-500 font-mono">
                            {new Date(order.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-black/40 border border-white/10 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 z-10 p-2 bg-black/60 text-white rounded-full hover:bg-black/85 transition-colors shadow-md">
              <X className="h-5 w-5" />
            </button>
            <img src={previewImage} alt="preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  )
}

