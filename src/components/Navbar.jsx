import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, ShoppingBag, User, AlertOctagon, Store, MessageSquare, ShieldCheck, Truck, BarChart2, Moon, Sun, Bell, Lock } from 'lucide-react'
import { supabase, getUserProfile } from '../supabaseClient'
import { useDarkMode } from '../hooks/useDarkMode'
import { toast } from 'sonner'

export default function Navbar({ session }) {
  const [theme, setTheme] = useDarkMode()
  const location = useLocation()
  const navigate = useNavigate()
  const [userProfile, setUserProfile] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [isRiderActive, setIsRiderActive] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [newOrdersCount, setNewOrdersCount] = useState(0)
  const [availableJobsCount, setAvailableJobsCount] = useState(0)
  const [pendingRefundsCount, setPendingRefundsCount] = useState(0)
  const [pendingAdminReportsCount, setPendingAdminReportsCount] = useState(0)
  const [unreadUserReportsCount, setUnreadUserReportsCount] = useState(0)

  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const notifRef = useRef(null)
  const audioCtxRef = useRef(null)

  const totalNotifications = unreadCount + newOrdersCount + availableJobsCount + pendingRefundsCount + pendingAdminReportsCount + unreadUserReportsCount

  useEffect(() => {
    const initAudio = () => {
      try {
        if (!audioCtxRef.current) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          audioCtxRef.current = new AudioContext();
        }
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
      } catch (e) {}
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
    document.addEventListener('click', initAudio);
    document.addEventListener('touchstart', initAudio);
    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotificationOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (session) {
      fetchRoleAndRider()
      
      const handleProfileUpdate = () => {
        fetchRoleAndRider()
      }
      
      window.addEventListener('profile-updated', handleProfileUpdate)
      return () => window.removeEventListener('profile-updated', handleProfileUpdate)
    } else {
      setUserProfile(null)
      setUserRole(null)
      setIsRiderActive(false)
    }
  }, [session])

  const fetchRoleAndRider = async () => {
    try {
      const { data } = await getUserProfile()
      if (data) {
        setUserProfile(data)
        setUserRole(data.role)
        
        // ตรวจสอบสถานะการอนุมัติเป็น Rider จากตาราง riders
        const { data: rider } = await supabase
          .from('riders')
          .select('is_active')
          .eq('student_id', data.student_id)
          .maybeSingle()
        
        if (rider) {
          setIsRiderActive(rider.is_active)
        }
      }
    } catch (_) {
      // ignore
    }
  }

  const notifQueueRef = useRef([])
  const isNotifyingRef = useRef(false)
  const lastProcessedRef = useRef(null)

  const processNotificationQueue = () => {
    if (isNotifyingRef.current || notifQueueRef.current.length === 0) return;
    
    isNotifyingRef.current = true;
    const nextNotif = notifQueueRef.current.shift();
    lastProcessedRef.current = nextNotif;
    
    playNotificationSound();
    toast.info(nextNotif.body, { position: 'top-center' });
    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(nextNotif.title, {
          body: nextNotif.body,
          icon: '/vite.svg',
          badge: '/vite.svg',
          vibrate: [200, 100, 200, 100, 200, 100, 200],
          data: { url: nextNotif.url }
        }).catch(e => console.warn('SW notification failed', e));
      });
    }

    // 5 seconds delay before next notification can trigger
    setTimeout(() => {
      isNotifyingRef.current = false;
      processNotificationQueue();
    }, 5000);
  }

  const triggerNotification = (title, body, url = '/') => {
    // 1. Prevent duplicate if it's already in the queue
    const isInQueue = notifQueueRef.current.some(n => n.title === title && n.body === body);
    
    // 2. Prevent duplicate if it was JUST processed (currently waiting its 5s cooldown)
    const wasJustProcessed = lastProcessedRef.current?.title === title && lastProcessedRef.current?.body === body;
    
    if (isInQueue || (isNotifyingRef.current && wasJustProcessed)) {
      return; 
    }

    notifQueueRef.current.push({ title, body, url });
    processNotificationQueue();
  };

  const playNotificationSound = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio play failed:', e);
    }
  }

  const prevTotalNotifs = useRef(totalNotifications)
  const isInitialMount = useRef(true)

  useEffect(() => {
    const initAudio = () => {
      try {
        if (!audioCtxRef.current) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            audioCtxRef.current = new AudioContext();
          }
        }
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        window.removeEventListener('click', initAudio);
        window.removeEventListener('touchstart', initAudio);
        window.removeEventListener('keydown', initAudio);
      } catch (e) {
        console.warn('Audio init failed:', e);
      }
    };

    window.addEventListener('click', initAudio);
    window.addEventListener('touchstart', initAudio);
    window.addEventListener('keydown', initAudio);

    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      prevTotalNotifs.current = totalNotifications
      return
    }

    // Removed the generic notification trigger here because specific realtime listeners 
    // already call triggerNotification with exact titles and bodies.
    // Calling it here caused duplicate notifications.
    prevTotalNotifs.current = totalNotifications
  }, [totalNotifications])

  const fetchUnreadCount = async (studentId) => {
    try {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', studentId)
        .eq('is_read', false)
      if (!error) {
        setUnreadCount(count || 0)
      }
    } catch (_) {}
  }

  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )

  const requestNotificationPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission()
      setNotificationPermission(perm)
    }
  };

  useEffect(() => {
    if (!session || !userProfile) {
      setUnreadCount(0)
      return
    }

    fetchUnreadCount(userProfile.student_id)

    const channel = supabase
      .channel('navbar-unread-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new.receiver_id === userProfile.student_id) {
            triggerNotification('ข้อความใหม่', 'คุณมีข้อความใหม่', '/chat');
            fetchUnreadCount(userProfile.student_id)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => {
          fetchUnreadCount(userProfile.student_id)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'riders', filter: `student_id=eq.${userProfile.student_id}` },
        (payload) => {
          if (payload.old && payload.new) {
            if (payload.old.is_active === true && payload.new.is_active === false) {
              triggerNotification('สิทธิ์ Rider ถูกระงับ', 'สิทธิ์ Rider ของคุณถูกระงับโดยผู้ดูแลระบบ', '/rider');
            } else if (payload.old.is_active === false && payload.new.is_active === true) {
              triggerNotification('อนุมัติสิทธิ์ Rider', 'สิทธิ์ Rider ของคุณได้รับการอนุมัติแล้ว!', '/rider');
            }
          }
          fetchRoleAndRider();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'refund_requests' },
        (payload) => {
          if (payload.old && payload.new && payload.new.buyer_id === userProfile.student_id) {
            if (payload.old.status === 'pending' && payload.new.status === 'approved') {
              triggerNotification('คืนเงินสำเร็จ', 'การขอคืนเงินของคุณได้รับการอนุมัติแล้ว', '/orders');
            } else if (payload.old.status === 'pending' && payload.new.status === 'rejected') {
              triggerNotification('คืนเงินถูกปฏิเสธ', 'การขอคืนเงินของคุณถูกปฏิเสธ', '/orders');
            }
          }
        }
      )
      .subscribe()

    const handleMessagesRead = () => {
      fetchUnreadCount(userProfile.student_id)
    }

    window.addEventListener('messages-read', handleMessagesRead)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('messages-read', handleMessagesRead)
    }
  }, [session, userProfile])

  const fetchNewOrdersCount = async (studentId) => {
    try {
      const { data: sellerProducts } = await supabase
        .from('products')
        .select('product_id')
        .eq('seller_id', studentId)

      const productIds = (sellerProducts || []).map(p => p.product_id)

      const { data: userOrders, error } = await supabase
        .from('orders')
        .select('order_id, status, buyer_id, product_id')
      
      if (!error && userOrders) {
        const buyerOrders = userOrders.filter((o) => o.buyer_id === studentId)
        const sellerOrders = userOrders.filter((o) => productIds.includes(o.product_id))

        const buyerKey = `orders_buyer_statuses_${studentId}`
        const sellerKey = `orders_seller_statuses_${studentId}`

        let rawBuyer = localStorage.getItem(buyerKey)
        let rawSeller = localStorage.getItem(sellerKey)

        if (rawBuyer === null) {
          const initBuyer = {}
          buyerOrders.forEach(o => { initBuyer[o.order_id] = o.status })
          localStorage.setItem(buyerKey, JSON.stringify(initBuyer))
          rawBuyer = JSON.stringify(initBuyer)
        }
        if (rawSeller === null) {
          const initSeller = {}
          sellerOrders.forEach(o => { initSeller[o.order_id] = o.status })
          localStorage.setItem(sellerKey, JSON.stringify(initSeller))
          rawSeller = JSON.stringify(initSeller)
        }

        const savedBuyerStatuses = JSON.parse(rawBuyer || '{}')
        const savedSellerStatuses = JSON.parse(rawSeller || '{}')

        let newBuyerCount = 0
        buyerOrders.forEach((o) => {
          const lastStatus = savedBuyerStatuses[o.order_id]
          if (!lastStatus || lastStatus !== o.status) {
            newBuyerCount++
          }
        })

        let newSellerCount = 0
        sellerOrders.forEach((o) => {
          const lastStatus = savedSellerStatuses[o.order_id]
          if (!lastStatus || lastStatus !== o.status) {
            newSellerCount++
          }
        })

        setNewOrdersCount(newBuyerCount + newSellerCount)
      }
    } catch (_) {}
  }

  useEffect(() => {
    if (!session || !userProfile) {
      setNewOrdersCount(0)
      return
    }

    if (location.pathname === '/orders') {
      setNewOrdersCount(0)
    } else {
      fetchNewOrdersCount(userProfile.student_id)
    }

    const channel = supabase
      .channel('navbar-unread-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        async (payload) => {
          if (payload.old && payload.new && payload.new.status !== payload.old.status) {
            if (payload.new.buyer_id === userProfile.student_id) {
              if (payload.new.status === 'preparing') {
                triggerNotification('อัปเดตคำสั่งซื้อ', 'ผู้ขายอนุมัติคำสั่งซื้อของคุณแล้ว', '/orders');
              } else if (payload.new.status === 'delivering') {
                triggerNotification('อัปเดตคำสั่งซื้อ', 'สินค้าของคุณกำลังถูกจัดส่งโดย Rider', '/orders');
              } else if (payload.new.status === 'completed') {
                triggerNotification('อัปเดตคำสั่งซื้อ', 'คำสั่งซื้อของคุณเสร็จสมบูรณ์แล้ว', '/orders');
              } else if (payload.new.status === 'cancelled') {
                triggerNotification('อัปเดตคำสั่งซื้อ', 'คำสั่งซื้อของคุณถูกยกเลิกแล้ว', '/orders');
              }
            } else {
              // ตรวจสอบว่าเป็นผู้ขายหรือไม่
              const { data: product } = await supabase.from('products').select('seller_id').eq('product_id', payload.new.product_id).maybeSingle();
              if (product && product.seller_id === userProfile.student_id) {
                if (payload.new.status === 'completed') {
                  triggerNotification('อัปเดตคำสั่งซื้อ', 'ผู้ซื้อยืนยันได้รับสินค้าแล้ว', '/orders');
                } else if (payload.new.status === 'cancelled') {
                  triggerNotification('อัปเดตคำสั่งซื้อ', 'คำสั่งซื้อถูกยกเลิกแล้ว', '/orders');
                }
              }
            }
          }
          if (location.pathname !== '/orders') {
            fetchNewOrdersCount(userProfile.student_id)
          } else {
            setNewOrdersCount(0)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          if (payload.new && payload.new.buyer_id !== userProfile.student_id) {
             const { data: product } = await supabase.from('products').select('seller_id').eq('product_id', payload.new.product_id).maybeSingle();
             if (product && product.seller_id === userProfile.student_id) {
                triggerNotification('คำสั่งซื้อใหม่', 'มีคำสั่งซื้อใหม่สำหรับสินค้าของคุณ', '/orders');
             }
          }
          if (location.pathname !== '/orders') {
            fetchNewOrdersCount(userProfile.student_id)
          } else {
            setNewOrdersCount(0)
          }
        }
      )
      .subscribe()

    const handleOrderPlaced = () => {
      if (location.pathname !== '/orders') {
        fetchNewOrdersCount(userProfile.student_id)
      } else {
        setNewOrdersCount(0)
      }
    }

    window.addEventListener('order-placed', handleOrderPlaced)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('order-placed', handleOrderPlaced)
    }
  }, [session, userProfile, location.pathname])

  const fetchAvailableJobsCount = async (studentId) => {
    try {
      if (!studentId) return
      const { data, error } = await supabase
        .from('orders')
        .select('order_id')
        .eq('status', 'pending')
        .eq('needs_delivery', true)
        .eq('seller_accepted', true)
        .is('rider_id', null)
        .neq('buyer_id', studentId)
      if (!error && data) {
        setAvailableJobsCount(data.length)
      }
    } catch (_) {}
  }

  useEffect(() => {
    if (!session || !isRiderActive || !userProfile) {
      setAvailableJobsCount(0)
      return
    }

    fetchAvailableJobsCount(userProfile.student_id)

    const channel = supabase
      .channel('navbar-rider-jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchAvailableJobsCount(userProfile.student_id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, isRiderActive, userProfile, location.pathname])

  const fetchAdminNotifications = async () => {
    try {
      const lastViewedStr = localStorage.getItem('admin_last_viewed') || '1970-01-01T00:00:00.000Z'
      
      const { data: refundsData } = await supabase
        .from('refund_requests')
        .select('refund_id')
        .eq('status', 'pending')
        .gt('created_at', lastViewedStr)
      setPendingRefundsCount(refundsData ? refundsData.length : 0)

      const { data: reportsData } = await supabase
        .from('product_reports')
        .select('id')
        .eq('status', 'pending')
        .gt('created_at', lastViewedStr)
      setPendingAdminReportsCount(reportsData ? reportsData.length : 0)
    } catch (_) {}
  }

  const fetchUserUnreadReportsCount = async (studentId) => {
    try {
      if (!studentId) return
      let savedStatuses = {}
      try {
        savedStatuses = JSON.parse(localStorage.getItem(`reports_user_statuses_${studentId}`) || '{}')
      } catch (e) {}
      
      const { data: reportsData } = await supabase
        .from('product_reports')
        .select('id, status, admin_reply')
        .eq('reporter_id', studentId)
        
      if (reportsData) {
        let unread = 0
        reportsData.forEach(r => {
          const cached = savedStatuses[r.id]
          if (!cached || cached.status !== r.status || cached.admin_reply !== r.admin_reply) {
            unread++
          }
        })
        setUnreadUserReportsCount(unread)
      }
    } catch (_) {}
  }

  useEffect(() => {
    if (!session || userRole !== 'admin') {
      setPendingRefundsCount(0)
      setPendingAdminReportsCount(0)
      return;
    }

    if (location.pathname === '/admin') {
      localStorage.setItem('admin_last_viewed', new Date().toISOString())
      setPendingRefundsCount(0)
      setPendingAdminReportsCount(0)
    } else {
      fetchAdminNotifications()
    }

    const channel = supabase
      .channel('navbar-admin-refunds')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'refund_requests' },
        () => {
          triggerNotification('คำขอคืนเงินใหม่', 'มีคำขอคืนเงินใหม่รอการตรวจสอบจากแอดมิน', '/reports');
          if (location.pathname !== '/admin') {
            fetchAdminNotifications()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'refund_requests' },
        () => {
          if (location.pathname !== '/admin') {
            fetchAdminNotifications()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'product_reports' },
        () => {
          triggerNotification('การรายงานปัญหาใหม่', 'มีการร้องเรียนสินค้าใหม่รอการตรวจสอบ', '/reports');
          if (location.pathname !== '/admin') {
            fetchAdminNotifications()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'product_reports' },
        () => {
          if (location.pathname !== '/admin') {
            fetchAdminNotifications()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'riders' },
        () => {
          triggerNotification('คำขอสมัคร Rider', 'มีผู้ส่งคำขอสมัครเป็น Rider เข้ามาใหม่', '/admin');
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, userRole, location.pathname])

  useEffect(() => {
    if (!session || !userProfile) {
      setUnreadUserReportsCount(0)
      return
    }
    
    if (location.pathname === '/reports') {
      setUnreadUserReportsCount(0)
    } else {
      fetchUserUnreadReportsCount(userProfile.student_id)
    }

    const channel = supabase
      .channel('navbar-user-reports')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_reports', filter: `reporter_id=eq.${userProfile.student_id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new && payload.old && payload.new.admin_reply !== payload.old.admin_reply && payload.new.admin_reply) {
            triggerNotification('ตอบกลับรายงาน', 'แอดมินได้ตอบกลับการรายงานของคุณแล้ว', '/reports');
          }
          if (location.pathname !== '/reports') {
            fetchUserUnreadReportsCount(userProfile.student_id)
          }
        }
      )
      .subscribe()

    const handleReportsRead = () => {
      fetchUserUnreadReportsCount(userProfile.student_id)
    }

    window.addEventListener('reports-read', handleReportsRead)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('reports-read', handleReportsRead)
    }
  }, [session, userProfile, location.pathname])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session && userProfile) {
        fetchRoleAndRider();
        fetchUnreadCount(userProfile.student_id);
        
        if (location.pathname !== '/orders') {
          fetchNewOrdersCount(userProfile.student_id);
        }
        
        if (isRiderActive) {
          fetchAvailableJobsCount(userProfile.student_id);
        }
        
        if (userRole === 'admin' && location.pathname !== '/admin') {
          fetchAdminNotifications();
        }
        
        if (location.pathname !== '/reports') {
          fetchUserUnreadReportsCount(userProfile.student_id);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [session, userProfile, userRole, isRiderActive, location.pathname])

  const handleLogout = async () => {
    // 1. Play door closing animation
    window.dispatchEvent(new CustomEvent('door-anim:close'))
    
    // 2. Wait for doors to close completely (1200ms)
    setTimeout(async () => {
      // 3. Perform actual logout while screen is hidden
      await supabase.auth.signOut()
      navigate('/login')
      
      // 4. Wait a brief moment for the login page to fully render behind the doors
      setTimeout(() => {
        // 5. Open the doors
        window.dispatchEvent(new CustomEvent('door-anim:open'))
      }, 500)
    }, 1200)
  }

  const isActive = (path) => location.pathname === path

  const navItems = [
    { path: '/', label: 'สินค้าทั้งหมด', icon: Store },
    { path: '/chat', label: 'ข้อความ', icon: MessageSquare, requireAuth: true },
    { path: '/profile', label: 'โปรไฟล์', icon: User, requireAuth: true },
    { path: '/orders', label: 'คำสั่งซื้อ', icon: ShoppingBag, requireAuth: true },
    { path: '/reports', label: 'รายงาน', icon: AlertOctagon, requireAuth: true },
    // Rider-only item (แสดงเมื่อไรเดอร์ได้รับอนุมัติแล้ว)
    { path: '/rider', label: 'Rider', icon: Truck, requireAuth: true, riderOnly: true },
    // Admin-only item
    { path: '/admin', label: 'Admin', icon: ShieldCheck, requireAuth: true, adminOnly: true },
  ]


  const visibleItems = navItems.filter((item) => {
    if (!item.requireAuth) return true
    if (!session) return false
    if (item.adminOnly && userRole !== 'admin') return false
    if (item.riderOnly && !isRiderActive) return false
    return true
  })

  const handleNavClick = (e, item) => {
    if (item.path === '/admin' || item.path === '/rider') {
      e.preventDefault()
      const theme = item.path === '/admin' ? 'admin' : 'rider'
      
      // Close doors with specific theme
      window.dispatchEvent(new CustomEvent('door-anim:close', { detail: { theme } }))
      
      // Navigate after doors close
      setTimeout(() => {
        navigate(item.path)
        
        // Open doors after navigating
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('door-anim:open'))
        }, 500)
      }, 1200)
    }
  }

  return (
    <>
    <nav className="bg-navy-900 text-white border-b border-navy-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-1 sm:gap-4 xl:gap-8">
          {/* Logo */}
          <div className="flex items-center space-x-1 sm:space-x-4 mr-0 sm:mr-4 xl:mr-8 shrink-0 min-w-0">


            {/* Main store logo link */}
            <Link to="/" className="flex items-center space-x-1 sm:space-x-3 group min-w-0">
              <div className="p-1.5 sm:p-2 bg-gradient-to-tr from-primary-600 to-sky-500 rounded-xl text-white shadow-md shadow-sky-500/10 group-hover:scale-105 transition-all duration-300 shrink-0">
                <Store className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div>
                <span className="text-sm sm:text-lg font-black tracking-wider block leading-tight font-outfit transition-colors whitespace-nowrap">
                  <span className="text-white group-hover:text-slate-100 transition-colors">REACT </span>
                  <span className="text-sky-400 group-hover:text-sky-300 transition-colors">MARKET</span>
                </span>
                <span className="hidden sm:block text-[9px] text-sky-200/60 font-medium tracking-wider leading-none mt-0.5">
                  E-Commerce Template
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-1">
            {visibleItems.map((item) => {
              const Icon = item.icon
              const isAdminItem = item.adminOnly
              const isRiderItem = item.riderOnly
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={(e) => handleNavClick(e, item)}
                  className={`relative flex items-center space-x-1 xl:space-x-2 px-2 xl:px-3 py-2 rounded-md text-xs xl:text-sm font-medium whitespace-nowrap transition-all duration-200 active:scale-95 ${
                    isActive(item.path)
                      ? isAdminItem
                        ? 'bg-red-600 text-white shadow-md'
                        : isRiderItem
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-primary-600 text-white shadow-md'
                      : isAdminItem
                        ? 'text-red-300 hover:bg-red-900/30 hover:text-red-200'
                        : isRiderItem
                          ? 'text-emerald-300 hover:bg-emerald-900/30 hover:text-emerald-200'
                          : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden lg:inline">{item.label}</span>
                  {item.label === 'ข้อความ' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-navy-900 animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                  {item.label === 'คำสั่งซื้อ' && newOrdersCount > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-navy-900 animate-pulse">
                      {newOrdersCount}
                    </span>
                  )}
                  {item.label === 'Rider' && availableJobsCount > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-navy-900 animate-pulse">
                      {availableJobsCount}
                    </span>
                  )}
                  {item.label === 'Admin' && (pendingRefundsCount + pendingAdminReportsCount) > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-navy-900 animate-pulse">
                      {pendingRefundsCount + pendingAdminReportsCount}
                    </span>
                  )}
                  {item.label === 'รายงาน' && unreadUserReportsCount > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-navy-900 animate-pulse">
                      {unreadUserReportsCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>


          {/* Right Actions */}
          <div className="flex items-center space-x-1 sm:space-x-4 shrink-0">
            {/* Notification Bell */}
            {session && (
              <div className="relative" ref={notifRef}>
                <button 
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="relative p-2 bg-navy-800 hover:bg-navy-700 rounded-full text-slate-300 hover:text-white transition-all active:scale-90 shadow-sm ring-1 ring-white/5 hover:ring-white/10" 
                  title="การแจ้งเตือน"
                >
                  <Bell className="h-4 w-4" />
                  {totalNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-[9px] font-black text-white ring-2 ring-navy-900 animate-pulse shadow-sm shadow-red-500/50">
                      {totalNotifications}
                    </span>
                  )}
                </button>

                {/* Dropdown Menu */}
                {isNotificationOpen && (
                  <div className="absolute right-0 sm:right-0 mt-3 w-[260px] sm:w-80 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden animate-scale-up z-50 origin-top-right backdrop-blur-xl">
                    <div className="bg-gradient-to-r from-sky-600 to-indigo-600 p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Bell className="h-5 w-5 text-white" />
                        <h3 className="text-sm font-bold text-white">การแจ้งเตือน</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        {totalNotifications > 0 && (
                          <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {totalNotifications} ใหม่
                          </span>
                        )}
                        <button onClick={() => {
                          triggerNotification('ทดสอบระบบ', 'เสียงแจ้งเตือนทำงานปกติ!', '/');
                        }} className="p-1 hover:bg-white/20 rounded-md transition-colors text-white/80 hover:text-white" title="ทดสอบเสียงแจ้งเตือน">
                          🔊
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-sky-50 dark:bg-sky-900/20 border-b border-sky-100 dark:border-sky-800/50">
                      <p className="text-[10px] text-sky-800 dark:text-sky-300 font-medium leading-relaxed">
                        💡 <span className="font-bold">เคล็ดลับบนมือถือ:</span> กรุณาเปิดเว็บค้างไว้และแตะหน้าจอ 1 ครั้ง เพื่อให้ระบบมือถืออนุญาตการเล่นเสียงแจ้งเตือน
                      </p>
                    </div>

                    {notificationPermission === 'default' && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/40 border-b border-amber-100 dark:border-amber-800/50 flex flex-col items-center text-center">
                        <p className="text-[11px] text-amber-800 dark:text-amber-400 font-bold mb-2">
                          โปรดเปิดรับการแจ้งเตือน เพื่อไม่ให้พลาดอัปเดตสำคัญ
                        </p>
                        <button onClick={requestNotificationPermission} className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm">
                          อนุญาตการแจ้งเตือน
                        </button>
                      </div>
                    )}
                    {notificationPermission === 'denied' && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/40 border-b border-red-100 dark:border-red-800/50 flex flex-col items-center text-center">
                        <p className="text-[11px] text-red-800 dark:text-red-400 font-bold">
                          การแจ้งเตือนถูกบล็อกโดยเบราว์เซอร์
                        </p>
                        <p className="text-[10px] text-red-600 dark:text-red-300 mt-1">
                          โปรดคลิกที่รูปแม่กุญแจ 🔒 บนช่อง URL เพื่อปลดล็อก
                        </p>
                      </div>
                    )}

                    <div className="max-h-[360px] overflow-y-auto overscroll-contain">
                      {totalNotifications === 0 ? (
                        <div className="py-8 px-4 text-center text-slate-500 dark:text-slate-400">
                          <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-xs font-medium">ไม่มีการแจ้งเตือนใหม่</p>
                        </div>
                      ) : (
                        <div className="flex flex-col divide-y divide-slate-100 dark:divide-navy-800">
                          {unreadCount > 0 && (
                            <Link to="/chat" onClick={() => setIsNotificationOpen(false)} className="flex items-start p-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors group">
                              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 mr-3 group-hover:scale-110 transition-transform">
                                <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">ข้อความใหม่</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">คุณมีข้อความใหม่ยังไม่ได้อ่าน ({unreadCount} ข้อความ)</p>
                              </div>
                              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
                            </Link>
                          )}
                          
                          {newOrdersCount > 0 && (
                            <Link to="/orders" onClick={() => setIsNotificationOpen(false)} className="flex items-start p-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors group">
                              <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0 mr-3 group-hover:scale-110 transition-transform">
                                <Store className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">ออเดอร์ร้านค้าใหม่</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">มีลูกค้ารอคุณดำเนินการ ({newOrdersCount} ออเดอร์)</p>
                              </div>
                              <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5"></div>
                            </Link>
                          )}
                          
                          {availableJobsCount > 0 && (
                            <Link to="/rider" onClick={() => setIsNotificationOpen(false)} className="flex items-start p-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors group">
                              <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 mr-3 group-hover:scale-110 transition-transform">
                                <Truck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">งานจัดส่งใหม่</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">มีงานจัดส่งที่พร้อมให้คุณรับ ({availableJobsCount} งาน)</p>
                              </div>
                              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5"></div>
                            </Link>
                          )}
                          
                          {unreadUserReportsCount > 0 && (
                            <Link to="/reports" onClick={() => setIsNotificationOpen(false)} className="flex items-start p-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors group">
                              <div className="h-8 w-8 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0 mr-3 group-hover:scale-110 transition-transform">
                                <AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">การรายงานของคุณ</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">มีการอัปเดตปัญหาที่คุณแจ้งไว้ ({unreadUserReportsCount} รายการ)</p>
                              </div>
                              <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5"></div>
                            </Link>
                          )}
                          
                          {userRole === 'admin' && pendingRefundsCount > 0 && (
                            <Link to="/reports" onClick={() => setIsNotificationOpen(false)} className="flex items-start p-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors group">
                              <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0 mr-3 group-hover:scale-110 transition-transform">
                                <ShieldCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">คำขอคืนเงิน (Admin)</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">มีคำขอรอการตรวจสอบ ({pendingRefundsCount} รายการ)</p>
                              </div>
                              <div className="w-2 h-2 rounded-full bg-violet-500 mt-1.5"></div>
                            </Link>
                          )}
                          
                          {userRole === 'admin' && pendingAdminReportsCount > 0 && (
                            <Link to="/reports" onClick={() => setIsNotificationOpen(false)} className="flex items-start p-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors group">
                              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0 mr-3 group-hover:scale-110 transition-transform">
                                <AlertOctagon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">รายงานสินค้า (Admin)</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">มีรายการรอตรวจสอบความถูกต้อง ({pendingAdminReportsCount} รายการ)</p>
                              </div>
                              <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5"></div>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 bg-navy-800 hover:bg-navy-700 rounded-full text-yellow-300 transition-all active:scale-90 shadow-sm ring-1 ring-white/5 hover:ring-white/10" title="Toggle Dark Mode">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4 text-slate-300" />}
            </button>
            {session ? (
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="hidden lg:flex items-center space-x-2 border-r border-navy-700 pr-2 sm:pr-3" title={userProfile?.full_name || session.user.email}>
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="profile" className="w-6 h-6 rounded-full object-cover ring-2 ring-primary-500/50 shrink-0" />
                  ) : (
                    <span className="text-sm shrink-0">👤</span>
                  )}
                  <span className="text-xs text-sky-200/90 font-semibold truncate max-w-[80px] xl:max-w-[150px]">
                    {userProfile?.full_name || session.user.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 px-2 sm:px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all duration-200 active:scale-95 shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden xl:inline whitespace-nowrap">ออกจากระบบ</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      {session && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-navy-950/95 backdrop-blur-md border-t border-navy-800 flex justify-around pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.5)] transition-all">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={(e) => handleNavClick(e, item)}
                className={`relative flex flex-col items-center p-1.5 rounded-md text-[10px] font-medium transition-all active:scale-90 ${
                  isActive(item.path)
                    ? item.adminOnly
                      ? 'text-red-400'
                      : item.riderOnly
                        ? 'text-emerald-400'
                        : 'text-primary-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-white'
                }`}
              >
                <div className="relative">
                  {item.label === 'โปรไฟล์' && userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="profile" className={`h-5 w-5 mb-0.5 rounded-full object-cover ring-1 ${isActive(item.path) ? 'ring-primary-500' : 'ring-slate-400 dark:ring-slate-500'}`} />
                  ) : (
                    <Icon className="h-5 w-5 mb-0.5" />
                  )}
                  {item.label === 'ข้อความ' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-1 ring-navy-950 animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                  {item.label === 'คำสั่งซื้อ' && newOrdersCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-1 ring-navy-950 animate-pulse">
                      {newOrdersCount}
                    </span>
                  )}
                  {item.label === 'Rider' && availableJobsCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-1 ring-navy-950 animate-pulse">
                      {availableJobsCount}
                    </span>
                  )}
                  {item.label === 'Admin' && (pendingRefundsCount + pendingAdminReportsCount) > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-1 ring-navy-950 animate-pulse">
                      {pendingRefundsCount + pendingAdminReportsCount}
                    </span>
                  )}
                  {item.label === 'รายงาน' && unreadUserReportsCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-1 ring-navy-950 animate-pulse">
                      {unreadUserReportsCount}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </nav>
    </>
  )
}

