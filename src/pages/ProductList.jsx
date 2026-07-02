import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase, getUserProfile } from '../supabaseClient'
import {
  Search, Plus, Filter, Tag, ShoppingCart, User, Loader2, X,
  MessageSquare, Send, Truck, Upload, Trash2, CheckCircle2, AlertCircle, ImageIcon, Pencil, Save
} from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

// Schema จริง:
// products: product_id(PK bigint), seller_id(varchar=student_id), title, description, price, category, image_url, status, created_at
// users: student_id(PK varchar), full_name, email, role, created_at
// orders: order_id(PK bigint), product_id, buyer_id(varchar=student_id), rider_id, status, created_at
// messages: id(PK bigint), sender_id(varchar), receiver_id(varchar), product_id, content, is_read, created_at

// Toast system replaced by sonner

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 overflow-hidden animate-pulse transition-colors">
      <div className="aspect-[4/3] bg-slate-200 dark:bg-navy-700" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded w-3/4" />
        <div className="h-3 bg-slate-200 dark:bg-navy-700 rounded w-full" />
        <div className="h-6 bg-slate-200 dark:bg-navy-700 rounded w-1/3 mt-2" />
        <div className="border-t border-slate-100 pt-3 flex gap-2">
          <div className="h-8 bg-slate-200 dark:bg-navy-700 rounded-lg flex-1" />
          <div className="h-8 bg-slate-200 dark:bg-navy-700 rounded-lg flex-1" />
        </div>
      </div>
    </div>
  )
}

export default function ProductList({ session }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [userProfile, setUserProfile] = useState(null)
  const [isRider, setIsRider] = useState(false)

  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isRiderModalOpen, setIsRiderModalOpen] = useState(false)
  const [isRiderSuccessModalOpen, setIsRiderSuccessModalOpen] = useState(false)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false)
  const [isMessageSuccessModalOpen, setIsMessageSuccessModalOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [orderLoading, setOrderLoading] = useState(false)
  const [msgLoading, setMsgLoading] = useState(false)
  const [deleteLoadingId, setDeleteLoadingId] = useState(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')
  
  // States สำหรับระบบแก้ไขสินค้า
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [productToEdit, setProductToEdit] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', price: '', category: 'school_supplies', stock: 1 })
  const [editFile, setEditFile] = useState(null)
  const [editImagePreview, setEditImagePreview] = useState(null)

  const [checkoutProduct, setCheckoutProduct] = useState(null)
  const [messageProduct, setMessageProduct] = useState(null)
  const [checkoutStep, setCheckoutStep] = useState(1)
  const [deliveryAddress, setDeliveryAddress] = useState('')

  const [newProduct, setNewProduct] = useState({ title: '', description: '', price: '', category: 'school_supplies', stock: 1 })
  const [productFile, setProductFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  const [riderForm, setRiderForm] = useState({ vehicle_type: 'walking', license_plate: '' })
  const [messageText, setMessageText] = useState('')

  const categories = [
    { value: '', label: 'ทั้งหมด' },
    { value: 'school_supplies', label: 'อุปกรณ์การเรียน' },
    { value: 'electronics', label: 'อุปกรณ์อิเล็กทรอนิกส์' },
    { value: 'books', label: 'หนังสือเรียน' },
    { value: 'clothing', label: 'เครื่องแต่งกาย' },
    { value: 'others', label: 'อื่นๆ' },
  ]

  const addToast = useCallback((message, type = 'success') => {
    if (type === 'error') {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    if (session) fetchUserProfile()
  }, [session, selectedCategory])

  const fetchUserProfile = async () => {
    try {
      const { data } = await getUserProfile()
      if (data) {
        setUserProfile(data)
        const { data: riderData } = await supabase
          .from('riders')
          .select('student_id, is_active')
          .eq('student_id', data.student_id)
          .maybeSingle()
        if (riderData && riderData.is_active) setIsRider(true)
      }
    } catch (_) {}
  }

  // products: product_id(PK), seller_id(student_id), title, price, image_url, category, status
  const fetchProducts = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('products')
        .select('*, seller:users(student_id, full_name, role)')
        .eq('status', 'available')

      if (selectedCategory) query = query.eq('category', selectedCategory)

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      setProducts(data || [])
    } catch (err) {
      addToast('ไม่สามารถโหลดสินค้าได้: ' + (err.message || ''), 'error')
    } finally {
      setLoading(false)
    }
  }

  // ลบประกาศขายสินค้า — สำหรับผู้ลงประกาศ (Seller) หรือผู้ดูแลระบบ (Admin)
  const handleDeleteProduct = async () => {
    if (!userProfile || !productToDelete) return
    const { product_id: productId, title: productTitle, seller_id: sellerId } = productToDelete

    const isSeller = userProfile.student_id === sellerId
    const isAdmin = userProfile.role === 'admin'

    if (!isSeller && !isAdmin) {
      addToast('คุณไม่มีสิทธิ์ลบสินค้าชิ้นนี้', 'error'); return
    }
    
    if (isAdmin && !isSeller && !deleteReason.trim()) {
      addToast('กรุณาระบุเหตุผลในการลบเพื่อแจ้งเตือนผู้ขาย', 'error'); return
    }

    setDeleteLoadingId(productId)
    try {
      const { error } = await supabase.from('products').delete().eq('product_id', productId)
      if (error) throw error

      if (isAdmin && !isSeller) {
        const { error: msgError } = await supabase.from('messages').insert({
          sender_id: userProfile.student_id,
          receiver_id: sellerId,
          product_id: null,
          content: `[ประกาศจากผู้ดูแลระบบ] สินค้า "${productTitle}" ของคุณถูกลบออกจากระบบ เนื่องจาก: ${deleteReason.trim()}\n\n[IMAGE: ${productToDelete.image_url}]`,
          is_read: false
        })
        if (msgError) console.warn('ส่งข้อความแจ้งเตือนไม่ได้:', msgError.message)
      }

      addToast(`ลบสินค้า "${productTitle}" เรียบร้อยแล้ว`, 'success')
      setIsDeleteModalOpen(false)
      setProductToDelete(null)
      fetchProducts()
    } catch (err) {
      addToast('ไม่สามารถลบสินค้าได้: ' + err.message, 'error')
    } finally {
      setDeleteLoadingId(null)
    }
  }

  // เปิดโมดอลแก้ไขข้อมูลสินค้า
  const openEditModal = (product) => {
    console.log("openEditModal called with product:", product)
    try {
      setProductToEdit(product)
      setEditForm({
        title: product.title || '',
        description: product.description || '',
        price: product.price || '',
        category: product.category || 'school_supplies',
        stock: product.stock || 1,
      })
      setEditFile(null)
      setEditImagePreview(product.image_url)
      setIsEditModalOpen(true)
      console.log("isEditModalOpen set to true, productToEdit:", product)
    } catch (err) {
      console.error("Error in openEditModal:", err)
      alert("เกิดข้อผิดพลาดในการเปิดหน้าต่างแก้ไข: " + err.message)
    }
  }

  // บันทึกการแก้ไขข้อมูลสินค้า
  const handleUpdateProduct = async (e) => {
    e.preventDefault()
    if (!productToEdit || !userProfile) return
    setFormLoading(true)
    try {
      let finalImageUrl = productToEdit.image_url

      // 1. ตรวจสอบการเปลี่ยนภาพใหม่
      if (editFile) {
        const fileExt = editFile.name.split('.').pop().toLowerCase()
        const fileName = `${userProfile.student_id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('product-images').upload(fileName, editFile, { upsert: false })
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName)
        finalImageUrl = publicUrl
      }

      // 2. อัปเดตข้อมูลลง Database
      const { error: dbError } = await supabase.from('products').update({
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        price: parseFloat(editForm.price),
        category: editForm.category,
        image_url: finalImageUrl,
        stock: parseInt(editForm.stock || 1, 10),
      }).eq('product_id', productToEdit.product_id)

      if (dbError) throw dbError

      addToast('แก้ไขรายละเอียดสินค้าเรียบร้อยแล้ว!', 'success')
      setIsEditModalOpen(false)
      setProductToEdit(null)
      setEditFile(null)
      setEditImagePreview(null)
      fetchProducts()
    } catch (err) {
      addToast('ไม่สามารถแก้ไขข้อมูลได้: ' + err.message, 'error')
    } finally {
      setFormLoading(false)
    }
  }

  const [requestRider, setRequestRider] = useState(false)

  const openCheckout = (product) => {
    if (!session || !userProfile) { addToast('กรุณาเข้าสู่ระบบก่อน', 'error'); return }
    if (userProfile.student_id === product.seller_id) { addToast('ไม่สามารถสั่งซื้อสินค้าตัวเองได้', 'error'); return }
    setCheckoutProduct(product)
    setRequestRider(false) // reset ทุกครั้งที่เปิด
    setCheckoutStep(1)
    setDeliveryAddress('')
    setIsCheckoutModalOpen(true)
  }

  const handleConfirmOrder = async (e) => {
    if (e) e.preventDefault()
    if (!userProfile || !checkoutProduct) return
    setOrderLoading(true)
    try {
      // ตรวจสอบลิมิต 5 ออเดอร์สำหรับผู้ซื้อคนนี้
      const { data: existingOrders, error: fetchErr } = await supabase
        .from('orders')
        .select('order_id, created_at')
        .eq('buyer_id', userProfile.student_id)
        .order('created_at', { ascending: true }) // เก่าสุดขึ้นก่อน

      if (fetchErr) throw fetchErr

      // หากมีครบ 5 ออเดอร์แล้ว ให้ลบตัวที่เก่าที่สุดออก 1 ตัว เพื่อให้แอดตัวใหม่แล้วรวมเป็น 5
      if (existingOrders && existingOrders.length >= 5) {
        const deleteCount = existingOrders.length - 4
        const idsToDelete = existingOrders.slice(0, deleteCount).map(o => o.order_id)
        const { error: delErr } = await supabase
          .from('orders')
          .delete()
          .in('order_id', idsToDelete)
        if (delErr) throw delErr
      }

      // ตรวจสอบลิมิต 10 ออเดอร์สำหรับผู้ขายคนนี้
      const { data: sellerProducts, error: prodErr } = await supabase
        .from('products')
        .select('product_id')
        .eq('seller_id', checkoutProduct.seller_id)

      if (prodErr) throw prodErr

      if (sellerProducts && sellerProducts.length > 0) {
        const productIds = sellerProducts.map(p => p.product_id)
        const { data: existingSellerOrders, error: fetchSellerErr } = await supabase
          .from('orders')
          .select('order_id, created_at')
          .in('product_id', productIds)
          .order('created_at', { ascending: true }) // เก่าสุดขึ้นก่อน

        if (fetchSellerErr) throw fetchSellerErr

        // หากมีครบ 10 ออเดอร์แล้ว ให้ลบตัวที่เก่าที่สุดออก 1 ตัว เพื่อให้แอดตัวใหม่แล้วรวมเป็น 10
        if (existingSellerOrders && existingSellerOrders.length >= 10) {
          const deleteCount = existingSellerOrders.length - 9
          const idsToDelete = existingSellerOrders.slice(0, deleteCount).map(o => o.order_id)
          const { error: delSellerErr } = await supabase
            .from('orders')
            .delete()
            .in('order_id', idsToDelete)
          if (delSellerErr) throw delSellerErr
        }
      }

      const { error } = await supabase.from('orders').insert({
        product_id: checkoutProduct.product_id,
        buyer_id: userProfile.student_id,
        status: 'pending',
        needs_delivery: requestRider, // บันทึกคำขอ Rider
        delivery_address: deliveryAddress.trim(),
        delivery_fee: requestRider ? 30 : 0,
      })
      if (error) throw error
      addToast(`สั่งซื้อ "${checkoutProduct.title}" สำเร็จแล้ว!`, 'success')
      setIsCheckoutModalOpen(false)
      window.dispatchEvent(new Event('order-placed'))
    } catch (err) {
      addToast('เกิดข้อผิดพลาดในการสั่งซื้อ: ' + err.message, 'error')
    } finally {
      setOrderLoading(false)
    }
  }


  // Direct Message — messages(sender_id=student_id, receiver_id=student_id, product_id)
  const openMessage = (product) => {
    if (!session || !userProfile) { addToast('กรุณาเข้าสู่ระบบก่อน', 'error'); return }
    if (userProfile.student_id === product.seller_id) { addToast('ไม่สามารถส่งข้อความหาตัวเองได้', 'error'); return }
    setMessageProduct(product)
    setMessageText(`สวัสดีครับ สนใจสินค้า "${product.title}" ราคา ฿${product.price} ครับ ขอนัดรับได้เลยไหมครับ?`)
    setIsMessageModalOpen(true)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!userProfile || !messageProduct) return
    setMsgLoading(true)
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: userProfile.student_id,
        receiver_id: messageProduct.seller_id,
        product_id: messageProduct.product_id,
        content: messageText,
        is_read: false,
      })
      if (error) throw error
      setIsMessageModalOpen(false)
      setIsMessageSuccessModalOpen(true)
      setMessageText('')
    } catch (err) {
      addToast('ไม่สามารถส่งข้อความได้: ' + err.message, 'error')
    } finally {
      setMsgLoading(false)
    }
  }

  // Rider Application — riders(student_id PK, vehicle_type, license_plate, is_active, rating)
  const handleApplyRider = async (e) => {
    e.preventDefault()
    if (!userProfile) return
    setFormLoading(true)
    try {
      const { error } = await supabase.from('riders').upsert({
        student_id: userProfile.student_id,
        vehicle_type: riderForm.vehicle_type,
        license_plate: riderForm.license_plate || '',
        is_active: false,
      }, { onConflict: 'student_id' })
      if (error) throw error
      setIsRiderModalOpen(false)
      setIsRiderSuccessModalOpen(true)
    } catch (err) {
      addToast('ไม่สามารถส่งใบสมัครได้: ' + err.message, 'error')
    } finally {
      setFormLoading(false)
    }
  }

  // Upload product image → bucket product-images
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { addToast('ขนาดไฟล์ต้องไม่เกิน 5MB', 'error'); return }
    setProductFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  // Create Product — products(seller_id=student_id, title, description, price, category, image_url, status)
  const handleCreateProduct = async (e) => {
    e.preventDefault()
    if (!userProfile || !productFile) { addToast('กรุณาเลือกรูปภาพสินค้าก่อน', 'error'); return }
    setFormLoading(true)
    try {
      const fileExt = productFile.name.split('.').pop().toLowerCase()
      const fileName = `${userProfile.student_id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('product-images').upload(fileName, productFile, { upsert: false })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName)

      const { error: dbError } = await supabase.from('products').insert({
        seller_id: userProfile.student_id,
        title: newProduct.title.trim(),
        description: newProduct.description.trim(),
        price: parseFloat(newProduct.price),
        category: newProduct.category,
        image_url: publicUrl,
        status: 'available',
        stock: parseInt(newProduct.stock || 1, 10), // บันทึกจำนวนสินค้า
      })
      if (dbError) throw dbError

      addToast('ลงประกาศขายสินค้าเรียบร้อยแล้ว!', 'success')
      setIsProductModalOpen(false)
      setProductFile(null)
      setImagePreview(null)
      setNewProduct({ title: '', description: '', price: '', category: 'school_supplies', stock: 1 })
      fetchProducts()

    } catch (err) {
      addToast('ไม่สามารถลงขายสินค้าได้: ' + err.message, 'error')
    } finally {
      setFormLoading(false)
    }
  }

  const filtered = products.filter((p) =>
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getCatLabel = (v) => categories.find((c) => c.value === v)?.label || 'อื่นๆ'
  const isAdmin = userProfile?.role === 'admin'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Sonner replaces local Toast component */}

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-navy-900 to-primary-900 text-white p-8 sm:p-12 mb-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <span className="px-3 py-1 bg-sky-500/10 backdrop-blur-md rounded-full text-xs font-bold text-sky-400 border border-sky-400/25 uppercase tracking-widest">
            REACT MARKET — Template
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mt-6 leading-relaxed tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
            Discover Great Products<br />
            <span className="text-sky-400 drop-shadow-[0_0_20px_rgba(56,189,248,0.6)] block mt-2 animate-pulse-subtle">
              In Our Community
            </span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed font-light">
            Buy and sell items easily within our modern e-commerce platform
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            {session ? (
              <>
                <button onClick={() => setIsProductModalOpen(true)} className="btn-gradient-primary flex items-center space-x-2 px-6 py-3 rounded-xl shadow-lg font-bold text-sm">
                  <Plus className="h-5 w-5" /><span>ลงประกาศขายสินค้า</span>
                </button>
                {!isRider && (
                  <button onClick={() => setIsRiderModalOpen(true)} className="btn-gradient-rider flex items-center space-x-2 px-6 py-3 rounded-xl shadow-lg font-bold text-sm">
                    <Truck className="h-5 w-5" /><span>สมัครเป็น Rider</span>
                  </button>
                )}
              </>
            ) : (
              <Link to="/login" className="btn-gradient-primary px-8 py-3 rounded-xl font-bold text-sm">เข้าสู่ระบบเพื่อเริ่มใช้งาน</Link>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-navy-900 p-4 rounded-2xl shadow-sm border border-slate-200/80 dark:border-navy-800 mb-8 flex flex-col lg:flex-row gap-4 justify-between items-center transition-colors">
        <div className="relative w-full lg:w-96">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 dark:text-slate-500"><Search className="h-5 w-5" /></span>
          <input type="text" placeholder="ค้นหาชื่อสินค้า..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm transition-all" />
        </div>
        <div className="flex items-center space-x-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 scrollbar-none transform-gpu relative z-10">
          <Filter className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0 hidden sm:inline" />
          <div className="flex space-x-1.5">
            {categories.map((cat) => (
              <button key={cat.value} onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${selectedCategory === cat.value ? 'bg-navy-900 dark:bg-primary-600 text-white shadow-md' : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700'}`}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-navy-900 rounded-3xl border border-slate-200/80 dark:border-navy-800 shadow-sm mx-auto animate-scale-up transition-colors max-w-2xl w-full">
          <EmptyState
            icon={Tag}
            title="ไม่มีสินค้าในขณะนี้"
            description="คุณต้องการเป็นผู้ลงประกาศขายสินค้าชิ้นแรกไหม?"
            action={
              session && (
                <button onClick={() => setIsProductModalOpen(true)}
                  className="mt-2 inline-flex items-center space-x-2 bg-navy-900 hover:bg-navy-800 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95">
                  <Plus className="h-4 w-4 text-primary-400" /><span>ลงประกาศขาย</span>
                </button>
              )
            }
          />
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 transform-gpu relative z-10"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          initial="hidden"
          animate="show"
        >
          {filtered.map((product) => (
            <motion.div 
              key={product.product_id} 
              className="ecommerce-card group relative"
              variants={{
                hidden: { opacity: 0, y: 30 },
                show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
              }}
            >
              {(isAdmin || (userProfile && userProfile.student_id === product.seller_id)) && (
                <button onClick={() => { setProductToDelete(product); setDeleteReason(''); setIsDeleteModalOpen(true); }} disabled={deleteLoadingId === product.product_id}
                  className="absolute top-2 left-2 z-20 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg shadow-lg transition-all md:opacity-0 md:group-hover:opacity-100 disabled:opacity-50" 
                  title={userProfile?.student_id === product.seller_id ? "ลบประกาศขาย" : "Admin: ลบ"}>
                  {deleteLoadingId === product.product_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              )}

              {userProfile && userProfile.student_id === product.seller_id && (
                <button onClick={() => openEditModal(product)}
                  className="absolute top-2 left-10 z-20 bg-amber-600 hover:bg-amber-700 text-white p-1.5 rounded-lg shadow-lg transition-all md:opacity-0 md:group-hover:opacity-100 disabled:opacity-50" 
                  title="แก้ไขรายละเอียดสินค้า">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}

              <div className="relative aspect-video sm:aspect-[4/3] bg-slate-100 dark:bg-navy-800 overflow-hidden">
                <img src={product.image_url} alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400' }} />
                <span className="absolute top-3 right-3 bg-navy-900/90 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide">
                  {getCatLabel(product.category)}
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{product.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 line-clamp-2 min-h-[2rem] font-light">{product.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                  <span className="text-lg font-black text-navy-900 dark:text-white font-outfit mt-2 block">
                    ฿{Number(product.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-navy-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400">
                      <User className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                      <span className="text-[10px] font-bold truncate max-w-[100px] text-slate-600 dark:text-slate-300">{product.seller?.full_name || product.seller_id}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">{product.seller_id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => openMessage(product)}
                      className="flex items-center justify-center space-x-1 border border-slate-300 dark:border-navy-700 hover:border-navy-600 dark:hover:border-navy-500 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 font-bold py-2 rounded-lg text-[10px] sm:text-xs transition-all transition-colors">
                      <MessageSquare className="h-3.5 w-3.5" /><span>ส่งข้อความ</span>
                    </button>
                    <button onClick={() => openCheckout(product)}
                      className="flex items-center justify-center space-x-1 bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 rounded-lg text-[10px] sm:text-xs shadow-sm transition-all">
                      <ShoppingCart className="h-3.5 w-3.5" /><span>สั่งซื้อ</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    {/* MODAL: RIDER SUCCESS */}
    {isRiderSuccessModalOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-sm overflow-hidden animate-scale-up text-center p-8">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-navy-900 dark:text-white mb-2">ส่งคำขอสมัคร สำเร็จ</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            ขอบคุณที่ร่วมเป็นส่วนหนึ่งกับเรา<br/>กรุณารอแอดมินตรวจสอบและอนุมัติสิทธิ์ของคุณ
          </p>
          <button onClick={() => setIsRiderSuccessModalOpen(false)}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/30">
            ตกลง
          </button>
        </div>
      </div>
    )}

    {/* MODAL: RIDER */}
    {isRiderModalOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-md overflow-hidden animate-scale-up transition-colors">
          <div className="bg-gradient-to-r from-emerald-700 to-teal-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2"><Truck className="h-5 w-5" /><h2 className="text-lg font-bold">สมัครเป็น Rider</h2></div>
            <button onClick={() => setIsRiderModalOpen(false)}><X className="h-5 w-5 text-emerald-100" /></button>
          </div>
          <form onSubmit={handleApplyRider} className="p-6 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-950 p-3 rounded-lg border border-slate-200 dark:border-navy-700">
              รหัสนักศึกษา: <span className="font-bold text-navy-900 dark:text-white">{userProfile?.student_id}</span> จะถูกบันทึกเป็น Rider อัตโนมัติ
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">ประเภทพาหนะ</label>
              <select value={riderForm.vehicle_type} onChange={(e) => setRiderForm({ ...riderForm, vehicle_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-navy-800 transition-colors">
                <option value="walking">เดินเท้า</option>
                <option value="bicycle">จักรยาน</option>
                <option value="motorcycle">รถมอเตอร์ไซค์</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">ป้ายทะเบียน (ถ้ามี)</label>
              <input type="text" value={riderForm.license_plate} onChange={(e) => setRiderForm({ ...riderForm, license_plate: e.target.value })}
                placeholder="เช่น กข 1234 ตาก"
                className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-navy-800 transition-colors" />
            </div>
            <div className="pt-2 flex justify-end space-x-3">
              <button type="button" onClick={() => setIsRiderModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60">ยกเลิก</button>
              <button type="submit" disabled={formLoading}
                className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-500 disabled:opacity-50">
                {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>ส่งใบสมัคร</span>}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* MODAL: CHECKOUT */}
    {isCheckoutModalOpen && checkoutProduct && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-md overflow-hidden animate-scale-up transition-colors">
          {/* Header */}
          <div className="bg-navy-900 text-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="h-5 w-5 text-primary-400" />
                <h2 className="text-base font-bold">สั่งซื้อสินค้า</h2>
              </div>
              <button onClick={() => setIsCheckoutModalOpen(false)}><X className="h-5 w-5 text-slate-400 dark:text-slate-500 hover:text-white" /></button>
            </div>
            
            {/* Step Indicators */}
            <div className="flex items-center justify-center space-x-2 text-[11px] mt-2 pt-2 border-t border-navy-800">
              <span className={`px-2 py-0.5 rounded-full font-bold transition-all ${checkoutStep === 1 ? 'bg-gradient-to-r from-sky-500 to-indigo-600 dark:from-primary-500 dark:to-indigo-600 text-white shadow-sm' : 'bg-navy-800 text-slate-400 dark:text-slate-500'}`}>1. รูปแบบการรับ</span>
              <span className="text-slate-600 dark:text-slate-300">→</span>
              <span className={`px-2 py-0.5 rounded-full font-bold transition-all ${checkoutStep === 2 ? 'bg-gradient-to-r from-sky-500 to-indigo-600 dark:from-primary-500 dark:to-indigo-600 text-white shadow-sm' : 'bg-navy-800 text-slate-400 dark:text-slate-500'}`}>2. จุดนัดพบ</span>
              <span className="text-slate-600 dark:text-slate-300">→</span>
              <span className={`px-2 py-0.5 rounded-full font-bold transition-all ${checkoutStep === 3 ? 'bg-gradient-to-r from-sky-500 to-indigo-600 dark:from-primary-500 dark:to-indigo-600 text-white shadow-sm' : 'bg-navy-800 text-slate-400 dark:text-slate-500'}`}>3. สรุปยอด</span>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* STEP 1: SELECT METHOD */}
            {checkoutStep === 1 && (
              <div className="space-y-4">
                <div className="flex space-x-3.5 bg-slate-50 dark:bg-navy-950 p-3.5 rounded-xl border border-slate-200 dark:border-navy-700">
                  <div className="h-16 w-16 bg-slate-200 dark:bg-navy-700 rounded-lg overflow-hidden shrink-0">
                    <img src={checkoutProduct.image_url} alt={checkoutProduct.title} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{checkoutProduct.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ผู้ขาย: {checkoutProduct.seller?.full_name || checkoutProduct.seller_id}</p>
                    <p className="text-sm font-black text-navy-900 dark:text-white mt-1">฿{Number(checkoutProduct.price).toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    เลือกรูปแบบการรับสินค้า <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {/* Option 1: Pick up */}
                    <div
                      onClick={() => setRequestRider(false)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                        !requestRider ? 'border-navy-900 dark:border-primary-500 bg-navy-50/20 dark:bg-primary-900/20 shadow-sm' : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 bg-white dark:bg-navy-950'
                      }`}
                    >
                      <div className="flex-1">
                        <span className="font-extrabold text-xs text-navy-900 dark:text-white block">📦 นัดพบเจอเอง (รับเอง)</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5 block">
                          นัดหมายสถานที่และชำระเงิน/รับสินค้ากับผู้ขายโดยตรง (ไม่มีค่าบริการเพิ่มเติม)
                        </span>
                      </div>
                      <span className="text-xs font-black text-slate-500 dark:text-slate-400 shrink-0 ml-3">฿0</span>
                    </div>

                    {/* Option 2: Rider */}
                    <div
                      onClick={() => setRequestRider(true)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                        requestRider ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/20 dark:bg-emerald-900/20 shadow-sm' : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 bg-white dark:bg-navy-950'
                      }`}
                    >
                      <div className="flex-1">
                        <span className="font-extrabold text-xs text-emerald-800 dark:text-emerald-400 block">🛵 ใช้บริการ Rider</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5 block">
                          ให้ Rider รับของจากผู้ขายและนำส่ง ณ จุดที่คุณระบุภายในวิทยาลัย
                        </span>
                      </div>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0 ml-3">+฿30</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end space-x-3">
                  <button type="button" onClick={() => setIsCheckoutModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60">ยกเลิก</button>
                  <button type="button" onClick={() => setCheckoutStep(2)} className="px-5 py-2 bg-gradient-to-r from-sky-600 to-indigo-700 dark:from-primary-600 dark:to-indigo-800 hover:from-sky-500 hover:to-indigo-600 dark:hover:from-primary-500 dark:hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all">ถัดไป</button>
                </div>
              </div>
            )}

            {/* STEP 2: ADDRESS INPUT */}
            {checkoutStep === 2 && (
              <div className="space-y-4">
                <div className="bg-orange-50/60 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/50 p-3 rounded-xl transition-colors">
                  <p className="text-xs text-orange-800 dark:text-orange-400 font-bold">📍 จุดนัดรับสินค้า / จุดจัดส่ง</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">กรุณาระบุรายละเอียดให้ชัดเจนเพื่อให้ผู้ขายหรือ Rider จัดส่งได้ถูกต้อง</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    ที่อยู่ / จุดนัดพบ / หมายเหตุ <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows="3"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder={requestRider ? "ระบุสถานที่ส่ง เช่น: ตึก 3 ชั้น 1 หน้าห้องสมุด หรือ หน้าแผนกคอมพิวเตอร์" : "ระบุจุดนัดเจอกับผู้ขาย เช่น: โดมวิทยาลัย เวลา 12:00 น."}
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-navy-600 rounded-xl bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-medium transition-colors"
                  />
                </div>

                <div className="pt-2 flex justify-between">
                  <button type="button" onClick={() => setCheckoutStep(1)} className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60">ย้อนกลับ</button>
                  <button
                    type="button"
                    disabled={!deliveryAddress.trim()}
                    onClick={() => setCheckoutStep(3)}
                    className="px-5 py-2 bg-gradient-to-r from-sky-600 to-indigo-700 dark:from-primary-600 dark:to-indigo-800 hover:from-sky-500 hover:to-indigo-600 dark:hover:from-primary-500 dark:hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-40 disabled:grayscale"
                  >
                    ดูสรุปยอดสั่งซื้อ
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: ORDER SUMMARY */}
            {checkoutStep === 3 && (
              <div className="space-y-4">
                <div className="border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-navy-950">
                  <div className="bg-slate-100/80 dark:bg-navy-800/80 px-4 py-2 border-b border-slate-200 dark:border-navy-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                    สรุปรายการสั่งซื้อ
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span>สินค้า</span>
                      <span className="font-medium text-slate-900 dark:text-white">{checkoutProduct.title}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span>ราคาชิ้นสินค้า</span>
                      <span className="font-bold text-slate-950 dark:text-white">฿{Number(checkoutProduct.price).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span>รูปแบบการรับ</span>
                      <span className="font-bold text-slate-950 dark:text-white">{requestRider ? '🛵 Rider ส่งให้' : '📦 นัดรับเอง'}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span>ค่าบริการ Rider</span>
                      <span className="font-bold text-slate-950 dark:text-white">฿{requestRider ? '30' : '0'}</span>
                    </div>
                    
                    <div className="border-t border-slate-200 dark:border-navy-700 pt-2.5 flex justify-between text-sm font-black text-navy-900 dark:text-white">
                      <span>ยอดชำระสุทธิ</span>
                      <span className="text-primary-600 text-base">฿{Number(Number(checkoutProduct.price) + (requestRider ? 30 : 0)).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 p-3.5 rounded-xl">
                  <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">📍 จุดนัดรับของคุณ</span>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100 mt-1 whitespace-pre-wrap">{deliveryAddress}</p>
                </div>

                <div className="pt-2 flex justify-between">
                  <button type="button" onClick={() => setCheckoutStep(2)} className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60">ย้อนกลับ</button>
                  <button
                    type="button"
                    onClick={handleConfirmOrder}
                    disabled={orderLoading}
                    className="flex items-center space-x-1.5 px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 hover:from-emerald-400 hover:to-teal-500 dark:hover:from-emerald-500 dark:hover:to-teal-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 shadow-md transition-all disabled:grayscale"
                  >
                    {orderLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>ยืนยันสั่งซื้อสินค้า</span>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* MODAL: MESSAGE */}
    {isMessageModalOpen && messageProduct && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-lg overflow-hidden animate-scale-up transition-colors">
          <div className="bg-navy-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2"><MessageSquare className="h-5 w-5 text-primary-400" /><h2 className="text-lg font-bold">ส่งข้อความหาผู้ขาย</h2></div>
            <button onClick={() => setIsMessageModalOpen(false)}><X className="h-5 w-5 text-slate-400 dark:text-slate-500" /></button>
          </div>
          <form onSubmit={handleSendMessage} className="p-6 space-y-4">
            <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-950 p-3 rounded-lg border">
              ส่งถึง: <span className="font-bold text-navy-900 dark:text-white">{messageProduct.seller?.full_name || messageProduct.seller_id}</span> สำหรับสินค้า "<span className="font-bold">{messageProduct.title}</span>"
            </div>
            <textarea rows="4" required value={messageText} onChange={(e) => setMessageText(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors" />
            <div className="pt-2 flex justify-end space-x-3">
              <button type="button" onClick={() => setIsMessageModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60">ยกเลิก</button>
              <button type="submit" disabled={msgLoading}
                className="flex items-center space-x-1.5 px-5 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold hover:bg-navy-800 disabled:opacity-50">
                {msgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 text-primary-300" /><span>ส่งข้อความ</span></>}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* MODAL: ADD PRODUCT */}
    {isProductModalOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-lg overflow-hidden animate-scale-up max-h-[90vh] overflow-y-auto transition-colors">
          <div className="bg-navy-900 text-white p-4 flex items-center justify-between sticky top-0 z-10">
            <h2 className="text-lg font-bold">ลงประกาศขายสินค้า</h2>
            <button onClick={() => { setIsProductModalOpen(false); setImagePreview(null); setProductFile(null) }}><X className="h-5 w-5 text-slate-400 dark:text-slate-500" /></button>
          </div>
          <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">ชื่อสินค้า (title)</label>
              <input type="text" required value={newProduct.title} onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                placeholder="เช่น หนังสือเรียนเขียนแบบ, เมาส์ไร้สาย"
                className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">หมวดหมู่</label>
                <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-navy-900 transition-colors">
                  <option value="school_supplies">อุปกรณ์การเรียน</option>
                  <option value="electronics">อุปกรณ์อิเล็กทรอนิกส์</option>
                  <option value="books">หนังสือเรียน</option>
                  <option value="clothing">เครื่องแต่งกาย</option>
                  <option value="others">อื่นๆ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">ราคา (บาท)</label>
                <input type="number" step="0.01" min="0" required value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  placeholder="250"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">จำนวนสต็อก (ชิ้น)</label>
                <input type="number" min="1" step="1" required value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value, 10) })}
                  placeholder="1"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">รายละเอียด</label>
              <textarea rows="3" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                placeholder="สภาพสินค้า ตำหนิ สถานที่นัดรับ..."
                className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">รูปภาพสินค้า <span className="text-red-500">*</span></label>
              <label htmlFor="img-upload"
                className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all ${imagePreview ? 'border-primary-400 bg-primary-50' : 'border-slate-300 dark:border-navy-600 bg-slate-50 dark:bg-navy-950 hover:border-primary-400'}`}>
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="w-full h-full object-contain rounded-xl p-1" />
                ) : (
                  <><ImageIcon className="h-10 w-10 text-slate-300 mb-2" /><span className="text-xs font-bold text-slate-500 dark:text-slate-400">คลิกเพื่อเลือกรูป</span><span className="text-[10px] text-slate-400 dark:text-slate-500">JPG, PNG, WebP (สูงสุด 5MB)</span></>
                )}
                <input id="img-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
            <div className="pt-2 flex justify-end space-x-3">
              <button type="button" onClick={() => { setIsProductModalOpen(false); setImagePreview(null); setProductFile(null) }}
                className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60">ยกเลิก</button>
              <button type="submit" disabled={formLoading}
                className="flex items-center space-x-1.5 px-5 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold hover:bg-navy-800 disabled:opacity-50">
                {formLoading ? <><Loader2 className="h-4 w-4 animate-spin" /><span>กำลังอัปโหลด...</span></> : <><Upload className="h-4 w-4 text-primary-400" /><span>ลงประกาศขาย</span></>}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* MODAL: EDIT PRODUCT */}
    {isEditModalOpen && productToEdit && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-lg overflow-hidden animate-scale-up max-h-[90vh] overflow-y-auto transition-colors">
          <div className="bg-navy-900 text-white p-4 flex items-center justify-between sticky top-0 z-10">
            <h2 className="text-lg font-bold">แก้ไขรายละเอียดสินค้า</h2>
            <button onClick={() => { setIsEditModalOpen(false); setEditImagePreview(null); setEditFile(null) }}><X className="h-5 w-5 text-slate-400 dark:text-slate-500" /></button>
          </div>
          <form onSubmit={handleUpdateProduct} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">ชื่อสินค้า (title)</label>
              <input type="text" required value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="เช่น หนังสือเรียนเขียนแบบ, เมาส์ไร้สาย"
                className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">หมวดหมู่</label>
                <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-navy-900 transition-colors">
                  <option value="school_supplies">อุปกรณ์การเรียน</option>
                  <option value="electronics">อุปกรณ์อิเล็กทรอนิกส์</option>
                  <option value="books">หนังสือเรียน</option>
                  <option value="clothing">เครื่องแต่งกาย</option>
                  <option value="others">อื่นๆ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">ราคา (บาท)</label>
                <input type="number" step="0.01" min="0" required value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                  placeholder="250"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">จำนวนสต็อก (ชิ้น)</label>
                <input type="number" min="0" step="1" required value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: parseInt(e.target.value, 10) })}
                  placeholder="1"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">รายละเอียด</label>
              <textarea rows="3" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="สภาพสินค้า ตำหนิ สถานที่นัดรับ..."
                className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">รูปภาพสินค้า (ปล่อยว่างไว้หากต้องการใช้รูปเดิม)</label>
              <label htmlFor="edit-img-upload"
                className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all ${editImagePreview ? 'border-primary-400 bg-primary-50' : 'border-slate-300 dark:border-navy-600 bg-slate-50 dark:bg-navy-950 hover:border-primary-400'}`}>
                {editImagePreview ? (
                  <img src={editImagePreview} alt="preview" className="w-full h-full object-contain rounded-xl p-1" />
                ) : (
                  <><ImageIcon className="h-10 w-10 text-slate-300 mb-2" /><span className="text-xs font-bold text-slate-500 dark:text-slate-400">คลิกเพื่อเปลี่ยนรูป</span><span className="text-[10px] text-slate-400 dark:text-slate-500">JPG, PNG, WebP (สูงสุด 5MB)</span></>
                )}
                <input id="edit-img-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files[0]
                  if (file) {
                    setEditFile(file)
                    setEditImagePreview(URL.createObjectURL(file))
                  }
                }} />
              </label>
            </div>
            <div className="pt-2 flex justify-end space-x-3">
              <button type="button" onClick={() => { setIsEditModalOpen(false); setEditImagePreview(null); setEditFile(null) }}
                className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60">ยกเลิก</button>
              <button type="submit" disabled={formLoading}
                className="flex items-center space-x-1.5 px-5 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold hover:bg-navy-800 disabled:opacity-50">
                {formLoading ? <><Loader2 className="h-4 w-4 animate-spin" /><span>กำลังอัปโหลด...</span></> : <><Save className="h-4 w-4 text-primary-400" /><span>บันทึกการแก้ไข</span></>}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* MODAL: DELETE CONFIRMATION */}
    {isDeleteModalOpen && productToDelete && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-md overflow-hidden animate-scale-up transition-colors">
          <div className="bg-red-700 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Trash2 className="h-5 w-5" />
              <h2 className="text-lg font-bold">ยืนยันการลบประกาศขาย</h2>
            </div>
            <button onClick={() => { setIsDeleteModalOpen(false); setProductToDelete(null); }} className="text-red-200 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="flex items-start space-x-3 bg-red-50 text-red-800 p-3.5 rounded-xl border border-red-200 text-xs leading-relaxed">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <span>คำเตือน: การลบประกาศขายสินค้าชิ้นนี้จะเป็นการลบข้อมูลถาวรออกจากหน้าร้านค้าและตารางสินค้าในระบบ ไม่สามารถย้อนคืนได้</span>
            </div>

            {/* Product Preview */}
            <div className="flex space-x-3.5 bg-slate-50 dark:bg-navy-950 p-3.5 rounded-xl border border-slate-200 dark:border-navy-700">
              <div className="h-16 w-16 bg-slate-200 dark:bg-navy-700 rounded-lg overflow-hidden shrink-0">
                <img src={productToDelete.image_url} alt={productToDelete.title} className="w-full h-full object-cover" />
              </div>
              <div className="overflow-hidden">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{productToDelete.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">หมวดหมู่: {getCatLabel(productToDelete.category)}</p>
                <p className="text-sm font-black text-red-700 mt-1">฿{Number(productToDelete.price).toLocaleString()}</p>
              </div>
            </div>

            {userProfile?.role === 'admin' && userProfile?.student_id !== productToDelete.seller_id && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">ระบุสาเหตุที่ลบ (จะถูกส่งไปยังผู้ขาย):</label>
                <textarea rows="3"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="เช่น ผิดกฎของระบบ..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-3">
              <button 
                type="button" 
                onClick={() => { setIsDeleteModalOpen(false); setProductToDelete(null); }} 
                className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                type="button" 
                onClick={handleDeleteProduct} 
                disabled={deleteLoadingId === productToDelete.product_id || (userProfile?.role === 'admin' && userProfile?.student_id !== productToDelete.seller_id && !deleteReason.trim())}
                className="flex items-center space-x-1.5 px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {deleteLoadingId === productToDelete.product_id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 text-red-200" />
                    <span>ยืนยันลบประกาศ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Message Success Modal */}
    {isMessageSuccessModalOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-sm overflow-hidden animate-scale-up text-center p-8">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-navy-900 dark:text-white mb-2">ส่งข้อความ สำเร็จ</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            ข้อความของคุณถูกส่งไปยังผู้ขายเรียบร้อยแล้ว<br/>คุณสามารถรอการตอบกลับได้ที่หน้า "ข้อความ"
          </p>
          <button onClick={() => setIsMessageSuccessModalOpen(false)}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/30">
            ตกลง
          </button>
        </div>
      </div>
    )}
  </div>
)
}


