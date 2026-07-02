import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, getUserProfile } from '../supabaseClient'
import { ArrowLeft, Loader2, MessageSquare, Send, Wifi, WifiOff, Trash2, CheckCircle2 } from 'lucide-react'
import EmptyState from '../components/EmptyState'

function SkeletonChat() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-6">
        <div className="h-8 bg-slate-200 dark:bg-navy-700 rounded animate-pulse w-32 mb-2"></div>
        <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded animate-pulse w-48"></div>
      </div>
      <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden flex h-[70vh] transition-colors">
        <div className="w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-navy-700 flex flex-col hidden md:flex">
          <div className="p-4 border-b border-slate-100 bg-slate-50 dark:bg-navy-950">
            <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded animate-pulse w-24 mb-2"></div>
            <div className="h-3 bg-slate-200 dark:bg-navy-700 rounded animate-pulse w-32"></div>
          </div>
          <div className="flex-1 p-4 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-slate-200 dark:bg-navy-700 rounded-full animate-pulse shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-navy-700 rounded animate-pulse w-3/4"></div>
                  <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded animate-pulse w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 p-6 flex flex-col justify-end space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className={`h-12 bg-slate-200 dark:bg-navy-700 rounded-2xl animate-pulse w-48 ${i % 2 === 0 ? 'rounded-br-md' : 'rounded-bl-md'}`}></div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export default function Chat({ session }) {
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false)
  const messagesContainerRef = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    setShowDeleteConfirm(false)
  }, [selectedConv])

  useEffect(() => {
    if (session) initChat()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [session])

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  const initChat = async () => {
    setLoading(true)
    try {
      const { data: profile } = await getUserProfile()
      if (profile) {
        setUserProfile(profile)
        await fetchConversations(profile.student_id)
      }
    } catch (_) {}
    setLoading(false)
  }

  // ดึงข้อความทั้งหมดของ user แล้ว group เป็น conversations
  const fetchConversations = async (myStudentId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${myStudentId},receiver_id.eq.${myStudentId}`)
      .order('created_at', { ascending: false })

    if (error || !data) return

    // Group by partner student_id + product_id
    const convMap = new Map()
    const hiddenConvs = JSON.parse(localStorage.getItem(`hidden_convs_${myStudentId}`) || '{}')
    
    data.forEach((msg) => {
      const partnerId = msg.sender_id === myStudentId ? msg.receiver_id : msg.sender_id
      const key = `${partnerId}_${msg.product_id || 'general'}`
      
      // ซ่อนแชทที่ถูกลบ (เฉพาะข้อความที่ส่งก่อนเวลาที่ลบ)
      const hiddenSince = hiddenConvs[key]
      if (hiddenSince && new Date(msg.created_at) <= new Date(hiddenSince)) return

      if (!convMap.has(key)) {
        convMap.set(key, {
          partnerId,
          productId: msg.product_id,
          lastMsg: msg.content,
          lastTime: msg.created_at,
          unread: 0,
        })
      }
      if (!msg.is_read && msg.receiver_id === myStudentId) {
        const conv = convMap.get(key)
        convMap.set(key, { ...conv, unread: conv.unread + 1 })
      }
    })

    // ดึงชื่อ partner จาก users table
    const convArr = []
    for (const [key, conv] of convMap.entries()) {
      const { data: partnerData } = await supabase
        .from('users')
        .select('student_id, full_name, avatar_url')
        .eq('student_id', conv.partnerId)
        .single()
      convArr.push({ ...conv, key, partnerName: partnerData?.full_name || conv.partnerId, partnerAvatar: partnerData?.avatar_url })
    }

    setConversations(convArr.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime)))
  }

  const openConversation = async (conv) => {
    if (!userProfile) return
    setSelectedConv(conv)
    setMsgLoading(true)
    setMessages([])

    // ยกเลิก channel เก่า
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    setIsLive(false)

    // ดึงข้อความในการสนทนานี้
    const query = supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userProfile.student_id},receiver_id.eq.${conv.partnerId}),and(sender_id.eq.${conv.partnerId},receiver_id.eq.${userProfile.student_id})`)
      .order('created_at', { ascending: true })

    if (conv.productId) query.eq('product_id', conv.productId)

    const { data } = await query
    setMessages(data || [])
    setMsgLoading(false)

    // Mark as read in DB
    const { error: markError } = await supabase.from('messages')
      .update({ is_read: true })
      .eq('receiver_id', userProfile.student_id)
      .eq('sender_id', conv.partnerId)
    if (markError) {
      console.error('Error marking messages as read:', markError)
    }

    // Mark as read in local sidebar
    setConversations((prev) =>
      prev.map((c) => (c.key === conv.key ? { ...c, unread: 0 } : c))
    )

    // Notify Navbar to update badge count
    window.dispatchEvent(new Event('messages-read'))

    // Subscribe Realtime
    const channel = supabase
      .channel(`chat:${userProfile.student_id}:${conv.partnerId}:${conv.productId || 'general'}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userProfile.student_id}`,
      }, (payload) => {
        if (payload.new.sender_id === conv.partnerId) {
          setMessages((prev) => [...prev, payload.new])
          supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id).then(({ error }) => {
            if (error) console.error('Error marking realtime message as read:', error)
          })
          window.dispatchEvent(new Event('messages-read'))
        }
      })
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED')
      })

    channelRef.current = channel
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!inputText.trim() || !userProfile || !selectedConv) return
    setSendLoading(true)

    const optimisticMsg = {
      id: `opt-${Date.now()}`,
      sender_id: userProfile.student_id,
      receiver_id: selectedConv.partnerId,
      product_id: selectedConv.productId,
      content: inputText.trim(),
      is_read: false,
      created_at: new Date().toISOString(),
      _optimistic: true,
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setInputText('')

    try {
      const { data: sent, error } = await supabase.from('messages').insert({
        sender_id: userProfile.student_id,
        receiver_id: selectedConv.partnerId,
        product_id: selectedConv.productId || null,
        content: optimisticMsg.content,
        is_read: false,
      }).select().single()

      if (error) throw error

      // แทน optimistic ด้วย real msg
      setMessages((prev) => prev.map((m) => m.id === optimisticMsg.id ? sent : m))
      fetchConversations(userProfile.student_id)
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
    } finally {
      setSendLoading(false)
    }
  }

  const executeDeleteChat = async () => {
    if (!selectedConv || !userProfile) return
    
    try {
      const messageIds = messages.map(m => m.id)
      
      if (messageIds.length > 0) {
        const { error } = await supabase
          .from('messages')
          .delete()
          .in('id', messageIds)
          
        if (error) throw error
      }

      const deletedKey = selectedConv.key

      // บันทึกเวลาลบเพื่อซ่อนแชทฝั่ง Client (ป้องกัน RLS ที่ลบใน DB ไม่ได้)
      const hiddenConvs = JSON.parse(localStorage.getItem(`hidden_convs_${userProfile.student_id}`) || '{}')
      hiddenConvs[deletedKey] = new Date().toISOString()
      localStorage.setItem(`hidden_convs_${userProfile.student_id}`, JSON.stringify(hiddenConvs))

      setShowDeleteConfirm(false)
      setSelectedConv(null)
      setMessages([])
      
      // ลบออกจาก Sidebar ทันที
      setConversations(prev => prev.filter(c => c.key !== deletedKey))
      
      setShowDeleteSuccess(true)
      setTimeout(() => setShowDeleteSuccess(false), 3000)
      
      // อัปเดตข้อมูลเบื้องหลัง
      fetchConversations(userProfile.student_id)
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการลบแชท: ' + err.message)
    }
  }

  const formatTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <SkeletonChat />

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-navy-900 dark:text-white tracking-tight">ข้อความ</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">ติดต่อผู้ซื้อผู้ขายโดยตรง</p>
      </div>

      <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden transition-colors" style={{ height: '70vh' }}>
        <div className="flex h-full">
          {/* Sidebar */}
          <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-navy-700 flex flex-col ${selectedConv ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-100 bg-slate-50 dark:bg-navy-950">
              <h2 className="text-sm font-extrabold text-navy-900 dark:text-white">การสนทนาทั้งหมด</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{userProfile?.student_id} · {userProfile?.full_name}</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <EmptyState icon={MessageSquare} title="ยังไม่มีการสนทนา" description="กดปุ่มข้อความในหน้าสินค้าเพื่อเริ่มแชทกับผู้ขาย" />
                </div>
              ) : conversations.map((conv) => (
                <button key={conv.key} onClick={() => openConversation(conv)}
                  className={`w-full text-left px-4 py-4 hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors flex items-start space-x-3 ${selectedConv?.key === conv.key ? 'bg-primary-50 dark:bg-navy-800/80 border-l-2 border-primary-600 dark:border-primary-500' : ''}`}>
                  {conv.partnerAvatar ? (
                    <img src={conv.partnerAvatar} alt="profile" className="h-10 w-10 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-navy-700" />
                  ) : (
                    <div className="h-10 w-10 bg-navy-900 rounded-full flex items-center justify-center text-white font-bold shrink-0 text-sm">
                      {(conv.partnerName || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-bold text-navy-900 dark:text-white truncate">{conv.partnerName}</span>
                      {conv.unread > 0 && <span className="ml-1 px-1.5 py-0.5 bg-primary-600 text-white text-[9px] font-bold rounded-full shrink-0">{conv.unread}</span>}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">{conv.partnerId}</p>
                    {conv.productId && <p className="text-[10px] text-primary-600 font-bold mt-0.5">📦 Product #{conv.productId}</p>}
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{conv.lastMsg}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Window */}
          <div className={`flex-1 flex flex-col ${!selectedConv ? 'hidden md:flex' : 'flex'}`}>
            {!selectedConv ? (
              showDeleteSuccess ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in">
                  <div className="p-4 bg-emerald-100 dark:bg-emerald-900/40 rounded-full mb-4 animate-scale-up shadow-inner">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">การลบแชทสำเร็จ</h3>
                  <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 font-medium">ขอให้มีวันที่ดี 😊</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in">
                  <MessageSquare className="h-16 w-16 text-slate-200 dark:text-slate-700 mb-4" />
                  <h3 className="text-xl font-bold text-slate-400 dark:text-slate-500">เลือกการสนทนา</h3>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">กดที่ชื่อผู้ใช้ทางซ้ายเพื่อเปิดแชท</p>
                </div>
              )
            ) : (
              <>
                {/* Delete Confirmation Overlay */}
                {showDeleteConfirm && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 dark:bg-navy-900/95 backdrop-blur-md p-6 text-center animate-fade-in">
                    <Trash2 className="h-16 w-16 text-red-500 mb-4 animate-bounce" />
                    <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-2">ยืนยันที่จะลบทิ้งไหม?</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-sm leading-relaxed">
                      หากลบแล้ว ข้อความจะหายแต่อดีตจะยังคงอยู่ในใจเสมอ คุณแน่ใจหรือไม่?
                    </p>
                    <div className="flex space-x-3">
                      <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                      >
                        ยกเลิก
                      </button>
                      <button 
                        onClick={executeDeleteChat}
                        className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold shadow-md shadow-red-500/20 transition-colors"
                      >
                        ยืนยันการลบ
                      </button>
                    </div>
                  </div>
                )}
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button onClick={() => setSelectedConv(null)} className="md:hidden mr-1 text-slate-500 dark:text-slate-400 hover:text-navy-900">
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    {selectedConv.partnerAvatar ? (
                      <img src={selectedConv.partnerAvatar} alt="profile" className="h-9 w-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-navy-700" />
                    ) : (
                      <div className="h-9 w-9 bg-navy-900 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {(selectedConv.partnerName || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-navy-900 dark:text-white">{selectedConv.partnerName}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{selectedConv.partnerId}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${isLive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-navy-800 text-slate-400 dark:text-slate-500'}`}>
                      {isLive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      <span className="hidden sm:inline">{isLive ? 'Live' : 'Connecting...'}</span>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      title="ลบการสนทนานี้"
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-navy-950/50">
                  {msgLoading ? (
                    <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 text-primary-500 animate-spin" /></div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full scale-75 opacity-80">
                      <EmptyState icon={MessageSquare} title="ยังไม่มีข้อความ" description="เริ่มการสนทนาได้เลย!" />
                    </div>
                  ) : messages.map((msg) => {
                    const isOwn = msg.sender_id === userProfile?.student_id
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        {!isOwn && (
                          selectedConv.partnerAvatar ? (
                            <img src={selectedConv.partnerAvatar} alt="profile" className="h-7 w-7 rounded-full object-cover shrink-0 self-end mr-2 ring-1 ring-slate-200 dark:ring-navy-700" />
                          ) : (
                            <div className="h-7 w-7 bg-navy-900 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0 self-end">
                              {(selectedConv.partnerName || 'U').charAt(0).toUpperCase()}
                            </div>
                          )
                        )}
                        <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${isOwn ? 'bg-gradient-to-br from-sky-600 to-indigo-700 dark:from-primary-600 dark:to-indigo-800 text-white rounded-br-md border border-sky-500/30' : 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white border border-slate-200 dark:border-navy-700 rounded-bl-md'} ${msg._optimistic ? 'opacity-70' : ''}`}>
                          {msg.content.includes('[IMAGE: ') ? (
                            <>
                              <p className="leading-relaxed whitespace-pre-wrap">{msg.content.split('\n\n[IMAGE: ')[0]}</p>
                              {msg.content.includes('[IMAGE: ') && msg.content.split('[IMAGE: ')[1] && (
                                <div className="mt-3 rounded-lg overflow-hidden bg-slate-100 dark:bg-navy-800 max-w-[200px] border border-slate-200 dark:border-navy-700">
                                  <img src={msg.content.split('[IMAGE: ')[1].replace(']', '')} alt="Attached Image" className="w-full h-auto object-cover" />
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          )}
                          <p className={`text-[10px] mt-1.5 ${isOwn ? 'text-slate-400 dark:text-slate-500 text-right' : 'text-slate-400 dark:text-slate-500'}`}>{formatTime(msg.created_at)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="p-4 border-t border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex items-end space-x-3 transition-colors">
                  <div className="flex-1 relative">
                    <textarea
                      rows={1}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
                      placeholder="พิมพ์ข้อความ..."
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-navy-700 rounded-xl text-slate-900 dark:text-white bg-slate-50 dark:bg-navy-950 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none transition-colors"
                    />
                  </div>
                  <button type="submit" disabled={sendLoading || !inputText.trim()}
                    className="p-3 bg-navy-900 hover:bg-navy-800 text-white rounded-xl shadow-md transition-all disabled:opacity-50 shrink-0">
                    {sendLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 text-primary-400" />}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
