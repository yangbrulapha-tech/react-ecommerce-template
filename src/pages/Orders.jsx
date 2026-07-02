import React, { useState, useEffect, useRef } from 'react'
import { supabase, getUserProfile } from '../supabaseClient'
import { ShoppingBag, CheckCircle2, XCircle, Clock, Loader2, MessageSquare, AlertCircle, Send, X, RotateCcw, ImagePlus, ExternalLink, MapPin } from 'lucide-react'
import EmptyState from '../components/EmptyState'

// Schema จริง:
// orders: order_id(PK), product_id, buyer_id(student_id varchar), rider_id, status, created_at
// products: product_id, seller_id(student_id), title, price, image_url
// users: student_id(PK), full_name, email, role
// refund_requests: refund_id(PK uuid), order_id(bigint FK), buyer_id(varchar FK), reason, evidence_url, status, admin_note, created_at

export default function Orders({ session }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('buyer')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false)
  const [messageTarget, setMessageTarget] = useState(null)
  const [messageText, setMessageText] = useState('')
  const [msgLoading, setMsgLoading] = useState(false)

  // Refund states
  const [refundRequests, setRefundRequests] = useState([])
  const [refundSuccessOrderId, setRefundSuccessOrderId] = useState(null)

  const [refundOrder, setRefundOrder] = useState(null)
  const [refundReason, setRefundReason] = useState('')
  const [refundFile, setRefundFile] = useState(null)
  const [refundFilePreview, setRefundFilePreview] = useState(null)
  const [refundLoading, setRefundLoading] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  const [expandedImages, setExpandedImages] = useState(new Set())
  const lastViewedRef = useRef(localStorage.getItem('orders_last_viewed') || '1970-01-01T00:00:00.000Z')
  const [cancelingOrderId, setCancelingOrderId] = useState(null)
  const [rejectingOrderId, setRejectingOrderId] = useState(null)
  const [showingEvidenceOrderId, setShowingEvidenceOrderId] = useState(null)

  // Inline chat states
  const [inlineChatOrderId, setInlineChatOrderId] = useState(null)
  const [inlineMessageText, setInlineMessageText] = useState('')
  const [inlineMsgLoading, setInlineMsgLoading] = useState(null)
  const [inlineMsgSuccess, setInlineMsgSuccess] = useState(null)

  // Tab-specific last viewed states and refs
  const [buyerStatuses, setBuyerStatuses] = useState(JSON.parse(localStorage.getItem('orders_buyer_statuses') || '{}'))
  const [sellerStatuses, setSellerStatuses] = useState(JSON.parse(localStorage.getItem('orders_seller_statuses') || '{}'))
  const prevBuyerStatuses = useRef(JSON.parse(localStorage.getItem('orders_buyer_statuses') || '{}'))
  const prevSellerStatuses = useRef(JSON.parse(localStorage.getItem('orders_seller_statuses') || '{}'))

  // Seller Acceptance states
  const [acceptingOrderId, setAcceptingOrderId] = useState(null)
  const [acceptFiles, setAcceptFiles] = useState({}) // { [orderId]: File }
  const [acceptFilePreviews, setAcceptFilePreviews] = useState({}) // { [orderId]: string }
  const [acceptLoading, setAcceptLoading] = useState(false)

  useEffect(() => {
    if (session) fetchProfileAndOrders()
  }, [session])

  const fetchProfileAndOrders = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const { data: profile, error: profileError } = await getUserProfile()
      if (profileError) throw profileError
      setUserProfile(profile)

      // orders join products (title, price, image_url, seller_id)
      // แล้ว join seller user และ buyer user จาก student_id
      const { data, error } = await supabase
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
            full_name,
            email,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // ดึงข้อมูล seller แยก (เพราะ seller_id อยู่ใน products ไม่ใช่ orders)
      const ordersWithSeller = await Promise.all(
        (data || []).map(async (order) => {
          // หากมี rider_id ให้ดึงข้อมูล rider เพิ่มด้วย
          let riderData = null
          if (order.rider_id) {
            const { data: r } = await supabase
              .from('users')
              .select('student_id, full_name')
              .eq('student_id', order.rider_id)
              .maybeSingle()
            riderData = r
          }

          if (order.product?.seller_id) {
            const { data: sellerData } = await supabase
              .from('users')
              .select('student_id, full_name, email, avatar_url')
              .eq('student_id', order.product.seller_id)
              .single()
            return { ...order, seller: sellerData, rider: riderData }
          }
          return { ...order, seller: null, rider: riderData }
        })
      )

      setOrders(ordersWithSeller)
      const buyerOrdersList = ordersWithSeller.filter((o) => profile && o.buyer_id === profile.student_id)
      const sellerOrdersList = ordersWithSeller.filter((o) => profile && o.product?.seller_id === profile.student_id)

      if (activeTab === 'buyer') {
        const newBuyerStatuses = {}
        buyerOrdersList.forEach(o => { newBuyerStatuses[o.order_id] = o.status })
        localStorage.setItem(`orders_buyer_statuses_${profile.student_id}`, JSON.stringify(newBuyerStatuses))
        setBuyerStatuses(newBuyerStatuses)
      } else {
        const newSellerStatuses = {}
        sellerOrdersList.forEach(o => { newSellerStatuses[o.order_id] = o.status })
        localStorage.setItem(`orders_seller_statuses_${profile.student_id}`, JSON.stringify(newSellerStatuses))
        setSellerStatuses(newSellerStatuses)
      }

      window.dispatchEvent(new Event('order-placed'))

      // ดึงข้อมูลคำขอคืนเงินของ buyer
      const { data: refunds } = await supabase
        .from('refund_requests')
        .select('*')
        .eq('buyer_id', profile.student_id)
      setRefundRequests(refunds || [])

    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาด: ' + (err.message || JSON.stringify(err)))
    } finally {
      setLoading(false)
    }
  }

  // Seller update order status — seller_id อยู่ใน products ไม่ใช่ orders
  const handleUpdateStatus = async (orderId, newStatus) => {
    setActionLoading(orderId)
    setErrorMsg('')
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('order_id', orderId)
      if (error) throw error
      await fetchProfileAndOrders()
      setSuccessMsg(`อัปเดตสถานะออเดอร์ #ORD-${orderId} เรียบร้อย`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setErrorMsg('ไม่สามารถอัปเดตสถานะได้: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  // ผู้ซื้อขอย้อนหลังเรียกใช้ Rider
  const handleRequestRiderLater = async (orderId) => {
    setActionLoading(orderId)
    setErrorMsg('')
    try {
      const { error } = await supabase
        .from('orders')
        .update({ needs_delivery: true })
        .eq('order_id', orderId)
      if (error) throw error
      await fetchProfileAndOrders()
      setSuccessMsg(`ส่งคำขอใช้บริการ Rider สำหรับออเดอร์ #ORD-${orderId} สำเร็จ!`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setErrorMsg('ไม่สามารถเรียกไรเดอร์ได้: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }


  const openMessageModal = (order) => {
    const isBuyer = activeTab === 'buyer'
    const partner = isBuyer ? order.seller : order.buyer
    setMessageTarget({
      partnerName: partner?.full_name || partner?.student_id || 'ผู้ใช้',
      partnerId: partner?.student_id,
      productId: order.product?.product_id,
      productTitle: order.product?.title || 'สินค้า',
    })
    setMessageText(`สวัสดีครับ สอบถามเรื่องออเดอร์สินค้า "${order.product?.title}" ครับ`)
    setIsMsgModalOpen(true)
  }

  const handleSendOrderMessage = async (e) => {
    e.preventDefault()
    if (!userProfile || !messageTarget) return
    setMsgLoading(true)
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: userProfile.student_id,
        receiver_id: messageTarget.partnerId,
        product_id: messageTarget.productId,
        content: messageText,
        is_read: false,
      })
      if (error) throw error
      setSuccessMsg(`ส่งข้อความหา ${messageTarget.partnerName} เรียบร้อย!`)
      setIsMsgModalOpen(false)
      setMessageText('')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setErrorMsg('ไม่สามารถส่งข้อความได้: ' + err.message)
    } finally {
      setMsgLoading(false)
    }
  }

  const toggleInlineChat = (order) => {
    if (inlineChatOrderId === order.order_id) {
      setInlineChatOrderId(null)
    } else {
      setInlineChatOrderId(order.order_id)
      setInlineMessageText(`สวัสดีครับ สอบถามเรื่องออเดอร์สินค้า "${order.product?.title || 'สินค้า'}" ครับ`)
    }
  }

  const handleSendInlineMessage = async (order) => {
    if (!userProfile || !inlineMessageText.trim()) return
    const isBuyer = activeTab === 'buyer'
    const partnerId = isBuyer ? order.product?.seller_id : order.buyer_id
    if (!partnerId) return
    setInlineMsgLoading(order.order_id)
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: userProfile.student_id,
        receiver_id: partnerId,
        product_id: order.product?.product_id,
        content: inlineMessageText,
        is_read: false,
      })
      if (error) throw error
      setInlineMsgSuccess(order.order_id)
      
      setTimeout(() => {
        setInlineMsgSuccess(null)
        setInlineChatOrderId(null)
        setInlineMessageText('')
      }, 2000)
    } catch (err) {
      setErrorMsg('ไม่สามารถส่งข้อความได้: ' + err.message)
    } finally {
      setInlineMsgLoading(null)
    }
  }



  const handleRefundFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setRefundFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setRefundFilePreview(reader.result)
    reader.readAsDataURL(file)
  }

  // ส่งคำขอคืนเงิน
  const handleSubmitRefund = async (e) => {
    e.preventDefault()
    if (!refundOrder || !userProfile) return
    if (!refundFile) {
      setErrorMsg('กรุณาอัปโหลดรูปหลักฐานก่อนส่งคำขอ')
      return
    }
    setRefundLoading(true)
    try {
      // อัปโหลดรูปไปยัง Supabase Storage
      const fileExt = refundFile.name.split('.').pop()
      const fileName = `${userProfile.student_id}_${refundOrder.order_id}_${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('refund-evidence')
        .upload(fileName, refundFile, { upsert: true })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('refund-evidence')
        .getPublicUrl(fileName)
      const evidenceUrl = urlData.publicUrl

      // บันทึกคำขอลงฐานข้อมูล
      const { error: insertError } = await supabase.from('refund_requests').insert({
        order_id: refundOrder.order_id,
        buyer_id: userProfile.student_id,
        reason: refundReason,
        evidence_url: evidenceUrl,
        status: 'pending',
      })
      if (insertError) throw insertError

      setRefundSuccessOrderId(refundOrder.order_id)
      setTimeout(() => setRefundSuccessOrderId(null), 5000)
      setRefundOrder(null)
      setRefundReason('')
      setRefundFile(null)
      setRefundFilePreview(null)
      await fetchProfileAndOrders()
    } catch (err) {
      setErrorMsg('ไม่สามารถส่งคำขอคืนเงินได้: ' + err.message)
    } finally {
      setRefundLoading(false)
    }
  }

  // ผู้ขายกดยอมรับออเดอร์
  const handleAcceptFileChange = (orderId, file) => {
    if (!file) return
    setAcceptFiles(prev => ({ ...prev, [orderId]: file }))
    const reader = new FileReader()
    reader.onloadend = () => {
      setAcceptFilePreviews(prev => ({ ...prev, [orderId]: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const handleSubmitSellerAccept = async (order) => {
    if (!userProfile) return
    const file = acceptFiles[order.order_id]
    if (!file) {
      setErrorMsg('กรุณาอัปโหลดรูปภาพสินค้าก่อนกดยอมรับออเดอร์')
      return
    }
    setAcceptLoading(true)
    setErrorMsg('')
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `seller_accepts/${order.order_id}/${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          seller_accepted: true,
          seller_proof_image: publicUrl
        })
        .eq('order_id', order.order_id)
      if (updateError) throw updateError

      setSuccessMsg('กดยอมรับออเดอร์ลูกค้าเรียบร้อยแล้ว!')
      setAcceptingOrderId(null)
      setAcceptFiles(prev => { const n = { ...prev }; delete n[order.order_id]; return n })
      setAcceptFilePreviews(prev => { const n = { ...prev }; delete n[order.order_id]; return n })
      setTimeout(() => setSuccessMsg(''), 3000)
      await fetchProfileAndOrders()
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการยอมรับออเดอร์: ' + err.message)
    } finally {
      setAcceptLoading(false)
    }
  }

  const getRefundForOrder = (orderId) =>
    refundRequests.find((r) => r.order_id === orderId)

  const getRefundStatusBadge = (status) => {
    if (status === 'approved') return <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3 w-3" /><span>อนุมัติคืนเงินแล้ว</span></span>
    if (status === 'rejected') return <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200"><XCircle className="h-3 w-3" /><span>ปฏิเสธคำขอ</span></span>
    return <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"><Clock className="h-3 w-3" /><span>รอ Admin ตรวจสอบ</span></span>
  }

  // แยกออเดอร์ตาม buyer_id และ seller_id (seller อยู่ใน product.seller_id)
  const buyerOrders = orders.filter((o) => userProfile && o.buyer_id === userProfile.student_id)
  const sellerOrders = orders.filter((o) => userProfile && o.product?.seller_id === userProfile.student_id)
  const displayed = activeTab === 'buyer' ? buyerOrders : sellerOrders

  const newBuyerOrdersCount = buyerOrders.filter((o) => {
    const lastStatus = buyerStatuses[o.order_id]
    return !lastStatus || lastStatus !== o.status
  }).length

  const newSellerOrdersCount = sellerOrders.filter((o) => {
    const lastStatus = sellerStatuses[o.order_id]
    return !lastStatus || lastStatus !== o.status
  }).length

  const selectTab = (tab) => {
    setActiveTab(tab)
    if (!userProfile) return
    const buyerKey = `orders_buyer_statuses_${userProfile.student_id}`
    const sellerKey = `orders_seller_statuses_${userProfile.student_id}`
    if (tab === 'buyer') {
      const newStatuses = {}
      buyerOrders.forEach(o => {
        newStatuses[o.order_id] = o.status
      })
      localStorage.setItem(buyerKey, JSON.stringify(newStatuses))
      setBuyerStatuses(newStatuses)
      prevBuyerStatuses.current = newStatuses
    } else {
      const newStatuses = {}
      sellerOrders.forEach(o => {
        newStatuses[o.order_id] = o.status
      })
      localStorage.setItem(sellerKey, JSON.stringify(newStatuses))
      setSellerStatuses(newStatuses)
      prevSellerStatuses.current = newStatuses
    }
    window.dispatchEvent(new Event('order-placed'))
  }

  const getStatusBadge = (status, existingRefund) => {
    if (existingRefund?.status === 'approved') return <span className="flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" /><span>อนุมัติคำขอคืนเงินสำเร็จ</span></span>
    if (status === 'completed') return <span className="flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" /><span>สำเร็จ</span></span>
    if (status === 'cancelled') return <span className="flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200"><XCircle className="h-3.5 w-3.5" /><span>ยกเลิก</span></span>
    if (status === 'delivered') return <span className="flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200"><CheckCircle2 className="h-3.5 w-3.5" /><span>ได้รับสินค้าแล้ว</span></span>
    return <span className="flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"><Clock className="h-3.5 w-3.5" /><span>รอดำเนินการ</span></span>
  }

  if (loading) return (
    <div className="flex flex-col justify-center items-center py-24 space-y-4">
      <Loader2 className="h-10 w-10 text-primary-600 animate-spin" />
      <p className="text-slate-500 dark:text-slate-400 text-sm">กำลังโหลดรายการสั่งซื้อ...</p>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-navy-900 dark:text-white tracking-tight">รายการสั่งซื้อของฉัน</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">ติดตามสถานะออเดอร์และการติดต่อผู้ซื้อผู้ขาย</p>
      </div>
{successMsg && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center space-x-2 animate-scale-up">
          <CheckCircle2 className="h-5 w-5 shrink-0" /><span className="font-bold text-sm">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center space-x-2 animate-scale-up">
          <AlertCircle className="h-5 w-5 shrink-0" /><span className="text-sm">{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border border-slate-200 dark:border-navy-700 bg-slate-100/50 dark:bg-navy-950/50 p-1 rounded-2xl mb-6 transition-colors">
        <button onClick={() => selectTab('buyer')}
          className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 ${activeTab === 'buyer' ? 'bg-gradient-to-r from-sky-500 to-indigo-600 dark:from-primary-600 dark:to-indigo-700 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800/60'}`}>
          <span>ฉันเป็นผู้ซื้อ ({buyerOrders.length})</span>
          {newBuyerOrdersCount > 0 && (
            <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>
        <button onClick={() => selectTab('seller')}
          className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 ${activeTab === 'seller' ? 'bg-gradient-to-r from-sky-500 to-indigo-600 dark:from-primary-600 dark:to-indigo-700 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-800/60'}`}>
          <span>ฉันเป็นผู้ขาย ({sellerOrders.length})</span>
          {newSellerOrdersCount > 0 && (
            <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm transition-colors">
          <EmptyState
            icon={ShoppingBag}
            title="ไม่มีรายการสั่งซื้อ"
            description={activeTab === 'buyer' ? 'คุณยังไม่มีประวัติการซื้อในขณะนี้ ลองค้นหาสินค้าที่ถูกใจดูสิครับ' : 'ยังไม่มีออเดอร์สำหรับสินค้าของคุณในขณะนี้ โปรดรอสักนิดนะครับ'}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {displayed.map((order) => {
            const existingRefund = getRefundForOrder(order.order_id)
            return (
              <div key={order.order_id} className={`bg-white dark:bg-navy-900 rounded-3xl border shadow-md overflow-hidden transition-all hover:shadow-lg duration-300 transition-colors ${(order.status === 'delivered' || order.status === 'completed') ? 'border-emerald-500/50 ring-1 ring-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-900/10' : 'border-slate-200/80 dark:border-navy-700/80'}`}>
                {/* Header */}
                <div className={`px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative overflow-hidden ${(order.status === 'delivered' || order.status === 'completed') ? 'bg-gradient-to-r from-emerald-950 via-navy-900 to-navy-900' : 'bg-gradient-to-r from-navy-950 to-navy-900'}`}>
                  {(order.status === 'delivered' || order.status === 'completed') && (
                    <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center justify-center transform translate-x-4">
                      <CheckCircle2 className="h-32 w-32 text-emerald-400" />
                    </div>
                  )}
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-navy-800 rounded-xl">
                      <ShoppingBag className="h-4 w-4 text-primary-400" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest block">หมายเลขออเดอร์</span>
                      <span className="text-sm font-black text-white font-mono tracking-wider flex items-center space-x-2">
                        <span>#ORD-{order.order_id}</span>
                        {(() => {
                          const lastStatus = (activeTab === 'buyer' ? prevBuyerStatuses.current : prevSellerStatuses.current)[order.order_id]
                          const isUpdated = !lastStatus || lastStatus !== order.status
                          return isUpdated && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-red-500 to-orange-500 text-white uppercase tracking-wider animate-pulse shadow-sm shadow-red-500/20">
                              ✨ {!lastStatus ? 'ใหม่' : 'อัปเดต'}
                            </span>
                          )
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 self-end sm:self-center">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      📅 {new Date(order.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                    </span>
                    {getStatusBadge(order.status, existingRefund)}
                  </div>
                </div>

                {/* Body (Grid layout) */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Product & Delivery details */}
                  <div className="lg:col-span-8 space-y-5">
                    {/* Product block */}
                    <div className="flex items-start space-x-4">
                      <div className="h-20 w-20 bg-slate-100 dark:bg-navy-800 rounded-2xl overflow-hidden shrink-0 border border-slate-200 dark:border-navy-700 shadow-inner cursor-pointer hover:ring-2 hover:ring-primary-500/50 transition-all duration-200"
                        onClick={() => setPreviewImage(order.product?.image_url)}>
                        <img src={order.product?.image_url} alt={order.product?.title}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=200' }} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight leading-snug">{order.product?.title || 'สินค้า (ถูกลบแล้ว)'}</h3>
                        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 pt-0.5 flex-wrap gap-y-1">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-navy-800 rounded-md">ผู้ขาย: <strong className="text-slate-800 dark:text-slate-100">{order.seller?.full_name || order.product?.seller_id}</strong></span>
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-navy-800 rounded-md">ผู้ซื้อ: <strong className="text-slate-800 dark:text-slate-100">{order.buyer?.full_name || order.buyer_id}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Info */}
                    <div className="bg-slate-50/70 dark:bg-navy-950/50 rounded-2xl border border-slate-200/60 dark:border-navy-700/60 p-4 space-y-3 transition-colors">
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-navy-700/60 pb-2">
                        <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">🛵 รูปแบบการจัดส่ง</span>
                        <div>
                          {order.needs_delivery ? (
                            order.rider_id ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                🛵 Rider รับส่งแล้ว: {order.rider?.full_name || order.rider_id}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                🛵 รอกลุ่ม Rider กดรับงาน...
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300">
                              📦 นัดพบเจอเอง (รับเอง)
                            </span>
                          )}
                        </div>
                      </div>

                      {order.delivery_address && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center space-x-1">
                            <MapPin className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                            <span>จุดนัดรับ / ที่อยู่จัดส่ง</span>
                          </span>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-navy-950/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-navy-700/80 whitespace-pre-wrap leading-relaxed shadow-sm transition-colors">
                            {order.delivery_address}
                          </p>
                        </div>
                      )}

                      {/* Proof Images Gallery */}
                      {(order.seller_proof_image || order.delivery_image_url) && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          {order.seller_proof_image && (
                            <div className="space-y-1">
                              <span className="block text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">📸 รูปยืนยันจากผู้ขาย</span>
                              <button type="button" onClick={() => setExpandedImages(prev => { const n = new Set(prev); if (n.has(order.seller_proof_image)) n.delete(order.seller_proof_image); else n.add(order.seller_proof_image); return n; })} className={`block w-full rounded-xl overflow-hidden border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-0.5 hover:border-primary-400 transition-all duration-300 shadow-sm ${expandedImages.has(order.seller_proof_image) ? 'aspect-auto' : 'aspect-[4/3]'}`}>
                                <img src={order.seller_proof_image} alt="seller-proof" className={`w-full h-full rounded-lg transition-all duration-300 ${expandedImages.has(order.seller_proof_image) ? 'object-contain' : 'object-cover'}`} />
                              </button>
                            </div>
                          )}
                          {order.delivery_image_url && (
                            <div className="space-y-1">
                              <span className="block text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">📸 รูปหลักฐานจาก Rider</span>
                              <button type="button" onClick={() => setExpandedImages(prev => { const n = new Set(prev); if (n.has(order.delivery_image_url)) n.delete(order.delivery_image_url); else n.add(order.delivery_image_url); return n; })} className={`block w-full rounded-xl overflow-hidden border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-0.5 hover:border-emerald-400 transition-all duration-300 shadow-sm ${expandedImages.has(order.delivery_image_url) ? 'aspect-auto' : 'aspect-[4/3]'}`}>
                                <img src={order.delivery_image_url} alt="delivery-proof" className={`w-full h-full rounded-lg transition-all duration-300 ${expandedImages.has(order.delivery_image_url) ? 'object-contain' : 'object-cover'}`} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Refund request alert box */}
                    {existingRefund && activeTab === 'buyer' && (
                      <div className="bg-red-50/50 dark:bg-red-900/20 border border-red-100 rounded-2xl p-4 space-y-2">
                        {refundSuccessOrderId === order.order_id && (
                          <div className="mb-3 bg-emerald-100/80 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700/50 rounded-xl p-3 flex items-center space-x-2.5 animate-fade-in shadow-sm">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">ส่งคำขอคืนเงิน สำเร็จ</p>
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">แอดมินจะตรวจสอบและแจ้งผลให้ทราบโดยเร็วที่สุด</p>
                            </div>
                          </div>
                        )}
                        <span className="block text-[10px] font-extrabold text-red-500 uppercase tracking-widest">💰 รายละเอียดคำขอคืนเงิน</span>
                        <div className="flex items-center space-x-2">
                          {getRefundStatusBadge(existingRefund.status)}
                        </div>
                        {existingRefund.admin_note && (
                          <div className="text-xs text-red-800 bg-white dark:bg-navy-900 border border-red-100 rounded-xl p-2.5 shadow-sm leading-relaxed transition-colors">
                            <span className="font-bold text-red-900 block mb-0.5">หมายเหตุจาก Admin:</span>
                            {existingRefund.admin_note}
                          </div>
                        )}
                        {existingRefund.evidence_url && (
                          <div className="mt-2 space-y-3">
                            <button 
                              onClick={() => setShowingEvidenceOrderId(prev => prev === order.order_id ? null : order.order_id)}
                              className="inline-flex items-center space-x-1.5 px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors shadow-sm w-fit">
                              {showingEvidenceOrderId === order.order_id ? <X className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
                              <span>{showingEvidenceOrderId === order.order_id ? 'ซ่อนรูปภาพหลักฐาน' : 'ตรวจดูหลักฐาน'}</span>
                            </button>
                            
                            {showingEvidenceOrderId === order.order_id && (
                              <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-navy-700 animate-scale-up cursor-pointer bg-slate-100 dark:bg-navy-950 flex justify-center items-center p-2" onClick={() => setPreviewImage(existingRefund.evidence_url)}>
                                <img src={existingRefund.evidence_url} alt="Refund Evidence" className="w-full max-w-sm rounded-lg object-contain hover:scale-105 transition-transform duration-300" />
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                  <span className="bg-black/70 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">🔍 คลิกเพื่อขยายใหญ่</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Pricing & Contact */}
                  <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
                    {/* Pricing box */}
                    <div className="bg-slate-50 dark:bg-navy-950/50 border border-slate-200/60 dark:border-navy-700/60 p-4 rounded-2xl space-y-2.5 transition-colors">
                      <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block border-b border-slate-200/50 dark:border-navy-700/60 pb-1.5">สรุปยอดชำระเงิน</span>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>ราคาสินค้า</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">฿{Number(order.product?.price || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>ค่าจัดส่ง (Rider)</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">฿{Number(order.delivery_fee || 0).toLocaleString()}</span>
                        </div>
                        <div className="border-t border-slate-200/80 dark:border-navy-700/60 pt-2 flex justify-between text-sm font-black text-navy-950 dark:text-white">
                          <span>ยอดชำระสุทธิ</span>
                          <span className="text-base text-primary-600 font-mono">฿{Number((order.product?.price || 0) + (order.delivery_fee || 0)).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Contact card */}
                    <div className="bg-white dark:bg-navy-900 border border-slate-200/70 dark:border-navy-700/60 p-4 rounded-2xl shadow-sm space-y-3 transition-colors">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-700/60 pb-2">
                        <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          {activeTab === 'buyer' ? 'ผู้ขายสินค้า' : 'ผู้ซื้อสินค้า'}
                        </span>
                        <button onClick={() => toggleInlineChat(order)}
                          className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-sky-600 to-indigo-700 dark:from-primary-600 dark:to-indigo-800 hover:from-sky-500 hover:to-indigo-600 dark:hover:from-primary-500 dark:hover:to-indigo-700 text-white px-3 py-1.5 rounded-xl text-[10px] font-extrabold shadow-sm transition-all duration-200 group">
                          <MessageSquare className="h-3.5 w-3.5 text-sky-100 group-hover:scale-105 transition-transform" />
                          <span>พูดคุยแชท</span>
                        </button>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        {(() => {
                          const partner = activeTab === 'buyer' ? order.seller : order.buyer;
                          const partnerId = activeTab === 'buyer' ? order.product?.seller_id : order.buyer_id;
                          
                          return (
                            <>
                              {partner?.avatar_url ? (
                                <img src={partner.avatar_url} alt="profile" className="h-9 w-9 rounded-full object-cover shadow-sm ring-1 ring-slate-200 dark:ring-navy-700 shrink-0" />
                              ) : (
                                <div className="h-9 w-9 bg-navy-900 text-white text-xs font-black rounded-full flex items-center justify-center shadow-inner uppercase shrink-0">
                                  {(partner?.full_name || 'U').charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate leading-tight">
                                  {partner?.full_name || 'Unknown User'}
                                </p>
                                <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                                  ID: {partnerId}
                                </p>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Inline Chat Box */}
                      {inlineChatOrderId === order.order_id && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-navy-700/60 animate-fade-in">
                          {inlineMsgSuccess === order.order_id ? (
                            <div className="flex flex-col items-center justify-center py-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl animate-scale-up">
                              <CheckCircle2 className="h-6 w-6 text-emerald-500 mb-1" />
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">ส่งข้อความสำเร็จ!</span>
                            </div>
                          ) : (
                            <div className="flex flex-col space-y-2">
                              <textarea
                                value={inlineMessageText}
                                onChange={(e) => setInlineMessageText(e.target.value)}
                                placeholder="พิมพ์ข้อความที่นี่..."
                                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-600 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none"
                                rows={2}
                              />
                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleSendInlineMessage(order)}
                                  disabled={inlineMsgLoading === order.order_id || !inlineMessageText.trim()}
                                  className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-sky-600 to-indigo-700 dark:from-primary-600 dark:to-indigo-800 hover:from-sky-500 hover:to-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition-all"
                                >
                                  {inlineMsgLoading === order.order_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                  <span>ส่งข้อความ</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seller / Buyer Actions Footer */}
                {(activeTab === 'seller' || activeTab === 'buyer') && (
                  <div className="bg-slate-50 dark:bg-navy-950 px-6 py-4 border-t border-slate-100 flex justify-end items-center gap-3">
                    {cancelingOrderId === order.order_id ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full bg-red-50 p-4 rounded-2xl border border-red-200/60 shadow-inner animate-scale-up">
                        <span className="text-xs font-bold text-red-800 flex items-center space-x-1.5">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 animate-bounce" />
                          <span>คุณต้องการยืนยันการยกเลิกคำสั่งซื้อนี้ใช่หรือไม่?</span>
                        </span>
                        <div className="flex space-x-2 w-full sm:w-auto justify-end">
                          <button onClick={() => setCancelingOrderId(null)} className="px-3.5 py-2 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800/60 shadow-sm transition-colors">
                            ย้อนกลับ
                          </button>
                          <button onClick={async () => {
                            setCancelingOrderId(null)
                            await handleUpdateStatus(order.order_id, 'cancelled')
                          }} className="px-3.5 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-500 shadow-md transition-colors">
                            ยืนยันยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : rejectingOrderId === order.order_id ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full bg-red-50 p-4 rounded-2xl border border-red-200/60 shadow-inner animate-scale-up">
                        <span className="text-xs font-bold text-red-800 flex items-center space-x-1.5">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 animate-bounce" />
                          <span>คุณต้องการยืนยันการปฏิเสธการสั่งซื้อนี้ใช่หรือไม่?</span>
                        </span>
                        <div className="flex space-x-2 w-full sm:w-auto justify-end">
                          <button onClick={() => setRejectingOrderId(null)} className="px-3.5 py-2 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800/60 shadow-sm transition-colors">
                            ย้อนกลับ
                          </button>
                          <button onClick={async () => {
                            setRejectingOrderId(null)
                            await handleUpdateStatus(order.order_id, 'cancelled')
                          }} className="px-3.5 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-500 shadow-md transition-colors">
                            ยืนยันปฏิเสธ
                          </button>
                        </div>
                      </div>
                    ) : acceptingOrderId === order.order_id ? (
                      <div className="flex flex-col gap-4 w-full bg-primary-50/20 p-4 rounded-2xl border border-primary-200/60 shadow-inner animate-scale-up">
                        <span className="text-xs font-bold text-primary-800 flex items-center space-x-1.5">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-600 animate-bounce" />
                          <span>ยืนยันยอมรับออเดอร์ #ORD-{order.order_id}</span>
                        </span>
                        
                        {/* Upload area */}
                        <div className="text-left">
                          <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            รูปถ่ายสินค้าจริงเพื่อส่งมอบและยืนยัน <span className="text-red-500">*</span>
                          </label>
                          {acceptFilePreviews[order.order_id] ? (
                            <div className="relative inline-block">
                              <img src={acceptFilePreviews[order.order_id]} alt="accept-preview" className="h-32 w-48 object-cover rounded-xl border-2 border-primary-500" />
                              <button type="button" onClick={() => {
                                setAcceptFiles(prev => { const n = { ...prev }; delete n[order.order_id]; return n })
                                setAcceptFilePreviews(prev => { const n = { ...prev }; delete n[order.order_id]; return n })
                              }}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-primary-300 rounded-xl bg-white dark:bg-navy-900 cursor-pointer hover:bg-primary-50/50 transition-colors">
                              <ImagePlus className="h-7 w-7 text-primary-500 mb-1.5" />
                              <span className="text-xs font-bold text-primary-700">คลิกเพื่อถ่ายรูป/เลือกรูปภาพสินค้า</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">PNG, JPG ขนาดไม่เกิน 5MB</span>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAcceptFileChange(order.order_id, e.target.files[0])} />
                            </label>
                          )}
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
                          <p className="text-[11px] text-amber-800 font-medium">⚠️ เมื่อยอมรับออเดอร์แล้ว ออเดอร์จะถูกส่งต่อไปยังระบบจัดส่ง (หรือรอนัดรับ) ทันที</p>
                        </div>

                        <div className="flex space-x-2 w-full justify-end">
                          <button onClick={() => setAcceptingOrderId(null)} className="px-3.5 py-2 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800/60 shadow-sm transition-colors">
                            ยกเลิก
                          </button>
                          <button onClick={() => handleSubmitSellerAccept(order)} disabled={acceptLoading} className="px-3.5 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-500 shadow-md transition-colors flex items-center space-x-1.5">
                            {acceptLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5" /><span>ยืนยันยอมรับออเดอร์</span></>}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* ผู้ซื้อขอย้อนหลังเรียกไรเดอร์ภายหลัง */}
                        {activeTab === 'buyer' && order.status === 'pending' && !order.needs_delivery && (
                          <button onClick={() => handleRequestRiderLater(order.order_id)} disabled={actionLoading === order.order_id}
                            className="flex items-center space-x-1.5 px-4 py-2 border border-emerald-300 dark:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-navy-900 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm transition-colors">
                            <span>🛵 เรียกใช้บริการ Rider</span>
                          </button>
                        )}

                        {/* ผู้ซื้อกดยยกเลิกออเดอร์ในกรณีที่ผู้ขายยังไม่ได้ตอบรับ */}
                        {activeTab === 'buyer' && order.status === 'pending' && !order.seller_accepted && (
                          <button onClick={() => setCancelingOrderId(order.order_id)} disabled={actionLoading === order.order_id}
                            className="flex items-center space-x-1.5 px-4 py-2 border border-red-300 dark:border-red-500/50 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 bg-white dark:bg-navy-900 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm transition-colors">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>ยกเลิกคำสั่งซื้อ</span>
                          </button>
                        )}

                        {/* ปุ่มขอคืนเงิน — เฉพาะผู้ซื้อ + สถานะ completed/delivered + ยังไม่เคยขอ */}
                        {activeTab === 'buyer' && (order.status === 'delivered' || order.status === 'completed') && !existingRefund && (
                          refundOrder?.order_id === order.order_id ? (
                            <div className="flex flex-col gap-4 w-full bg-orange-50/20 dark:bg-orange-900/10 p-5 rounded-2xl border border-orange-200/60 shadow-inner animate-scale-up col-span-full mt-4">
                              <span className="text-sm font-bold text-orange-800 dark:text-orange-400 flex items-center space-x-1.5">
                                <RotateCcw className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-500 animate-bounce" />
                                <span>ยื่นคำขอคืนเงินสำหรับออเดอร์ #ORD-{order.order_id}</span>
                              </span>
                              
                              <div className="space-y-4 text-left">
                                <div>
                                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">เหตุผลการขอคืนเงิน <span className="text-red-500">*</span></label>
                                  <textarea rows="3" required value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="อธิบายปัญหาที่พบ เช่น สินค้าไม่ตรงปก, ชำรุด..."
                                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-navy-600 rounded-xl bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none font-medium transition-colors"></textarea>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">รูปภาพหลักฐานประกอบ <span className="text-red-500">*</span></label>
                                  {refundFilePreview ? (
                                    <div className="relative inline-block">
                                      <img src={refundFilePreview} alt="refund-preview" className="h-32 w-48 object-cover rounded-xl border-2 border-orange-500" />
                                      <button type="button" onClick={() => { setRefundFile(null); setRefundFilePreview(null); }}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-sm transition-all">
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-orange-300 dark:border-orange-500/50 rounded-xl bg-white dark:bg-navy-900 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                                      <ImagePlus className="h-7 w-7 text-orange-500 dark:text-orange-400 mb-1.5" />
                                      <span className="text-xs font-bold text-orange-700 dark:text-orange-500">คลิกเพื่ออัปโหลดรูปภาพหลักฐาน</span>
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">PNG, JPG ขนาดไม่เกิน 5MB</span>
                                      <input type="file" accept="image/*" className="hidden" onChange={handleRefundFileChange} />
                                    </label>
                                  )}
                                </div>
                              </div>
                              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-left">
                                <p className="text-[11px] text-amber-800 dark:text-amber-400 font-medium">⚠️ หลังส่งคำขอแล้ว Admin จะตรวจสอบและแจ้งผลการพิจารณาในภายหลัง</p>
                              </div>
                              <div className="flex space-x-2 w-full justify-end mt-2">
                                <button onClick={() => { setRefundOrder(null); setRefundReason(''); setRefundFile(null); setRefundFilePreview(null); }} className="px-3.5 py-2 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800/60 shadow-sm transition-colors">
                                  ยกเลิก
                                </button>
                                <button onClick={handleSubmitRefund} disabled={refundLoading || !refundReason.trim() || !refundFile} className="px-3.5 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-500 shadow-md transition-colors flex items-center space-x-1.5 disabled:opacity-50">
                                  {refundLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RotateCcw className="h-3.5 w-3.5" /><span>ส่งคำขอคืนเงิน</span></>}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setRefundOrder(order); setRefundReason(''); setRefundFile(null); setRefundFilePreview(null); }}
                              className="flex items-center space-x-1.5 px-4 py-2 border border-orange-300 dark:border-orange-500/50 hover:bg-orange-50 dark:hover:bg-orange-900/30 text-orange-700 dark:text-orange-400 bg-white dark:bg-navy-900 rounded-xl text-xs font-bold transition-all shadow-sm transition-colors">
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>ขอคืนเงิน</span>
                            </button>
                          )
                        )}
                      </>
                    )}

                    {/* ผู้ขายจัดการออเดอร์ */}
                    {activeTab === 'seller' && order.status === 'pending' && acceptingOrderId !== order.order_id && rejectingOrderId !== order.order_id && (
                      <>
                        {!order.seller_accepted ? (
                          <>
                            <button onClick={() => setRejectingOrderId(order.order_id)} disabled={actionLoading === order.order_id}
                              className="px-4 py-2 border border-red-300 dark:border-red-500/50 rounded-lg text-xs font-semibold text-red-700 dark:text-red-400 bg-white dark:bg-navy-900 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors">
                              ปฏิเสธการสั่งซื้อ
                            </button>
                            <button onClick={() => setAcceptingOrderId(order.order_id)}
                              className="flex items-center space-x-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-500 shadow-sm transition-colors">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>ยอมรับออเดอร์ (อัปโหลดรูป)</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {order.needs_delivery ? (
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800 px-3 py-1.5 rounded-lg border">
                                ✔️ ยอมรับแล้ว (รอกลุ่ม Rider มารับของ)
                              </span>
                            ) : (
                              <>
                                <button onClick={() => setRejectingOrderId(order.order_id)} disabled={actionLoading === order.order_id}
                                  className="px-4 py-2 border border-red-300 dark:border-red-500/50 rounded-lg text-xs font-semibold text-red-700 dark:text-red-400 bg-white dark:bg-navy-900 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors">
                                  ยกเลิกออเดอร์
                                </button>
                                <button onClick={() => handleUpdateStatus(order.order_id, 'completed')} disabled={actionLoading === order.order_id}
                                  className="flex items-center space-x-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 disabled:opacity-50 shadow-sm">
                                  {actionLoading === order.order_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5" /><span>ยืนยันเสร็จสิ้น (ส่งมอบแล้ว)</span></>}
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

            </div>
          )})}
        </div>
      )}

      {/* Message Modal */}
      {isMsgModalOpen && messageTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-lg overflow-hidden animate-scale-up transition-colors">
            <div className="bg-navy-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2"><MessageSquare className="h-5 w-5 text-primary-400" /><h2 className="text-lg font-bold">ส่งข้อความ</h2></div>
              <button onClick={() => setIsMsgModalOpen(false)}><X className="h-5 w-5 text-slate-400 dark:text-slate-500" /></button>
            </div>
            <form onSubmit={handleSendOrderMessage} className="p-6 space-y-4">
              <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-950 p-3 rounded-lg border">
                ส่งถึง: <span className="font-bold text-navy-950">{messageTarget.partnerName}</span> เรื่อง "<span className="font-bold">{messageTarget.productTitle}</span>"
              </div>
              <textarea rows="4" required value={messageText} onChange={(e) => setMessageText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <div className="pt-2 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsMsgModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60">ยกเลิก</button>
                <button type="submit" disabled={msgLoading}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold hover:bg-navy-800 disabled:opacity-50">
                  {msgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 text-primary-300" /><span>ส่ง</span></>}
                </button>
              </div>
            </form>
          </div>
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
