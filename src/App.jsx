import React, { useState, useEffect, Suspense, lazy } from 'react'
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import PageTransition from './components/PageTransition'
import { supabase } from './supabaseClient'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import DoorAnimation from './components/DoorAnimation'
import { Loader2 } from 'lucide-react'

const Login = lazy(() => import('./pages/Login'))
const ProductList = lazy(() => import('./pages/ProductList'))
const Orders = lazy(() => import('./pages/Orders'))
const Profile = lazy(() => import('./pages/Profile'))
const Reports = lazy(() => import('./pages/Reports'))
const Chat = lazy(() => import('./pages/Chat'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const RiderDashboard = lazy(() => import('./pages/RiderDashboard'))


function AnimatedRoutes({ session, ProtectedRoute }) {
  const location = useLocation()
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/" element={<PageTransition><ProductList session={session} /></PageTransition>} />
        <Route
          path="/login"
          element={<PageTransition>{session ? <Navigate to="/" replace /> : <Login />}</PageTransition>}
        />

        {/* Protected Routes */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <PageTransition><Profile session={session} /></PageTransition>
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <PageTransition><Orders session={session} /></PageTransition>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <PageTransition><Reports session={session} /></PageTransition>
            </ProtectedRoute>
          }
        />
        {/* Chat / Messenger */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <PageTransition><Chat session={session} /></PageTransition>
            </ProtectedRoute>
          }
        />
        {/* Admin Dashboard — role check happens inside the component */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <PageTransition><AdminDashboard session={session} /></PageTransition>
            </ProtectedRoute>
          }
        />
        {/* Rider Dashboard */}
        <Route
          path="/rider"
          element={
            <ProtectedRoute>
              <PageTransition><RiderDashboard session={session} /></PageTransition>
            </ProtectedRoute>
          }
        />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      
      // Keep Welcome screen (door locked) for a moment before opening
      setTimeout(() => {
        setLoading(false)
        window.dispatchEvent(new CustomEvent('door-anim:open'))
      }, 1500)
    })

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Guard for authenticated routes
  const ProtectedRoute = ({ children }) => {
    if (loading) {
      return (
        <div className="flex flex-col justify-center items-center h-screen bg-slate-50 dark:bg-navy-950 space-y-4">
          <Loader2 className="h-10 w-10 text-primary-600 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      )
    }
    if (!session) {
      return <Navigate to="/login" replace />
    }
    return children
  }

  // Remove the global full-screen loading override so DoorAnimation works
  // We just return the normal Router, DoorAnimation will cover the screen while loading is true initially

  return (
    <Router>
      <DoorAnimation />
      <div className="min-h-[100dvh] bg-slate-100 dark:bg-navy-800 font-sarabun flex flex-col justify-between overflow-x-hidden">
        <div>
          <Navbar session={session} />
          <main className="pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-8">
            <Suspense fallback={
              <div className="flex flex-col justify-center items-center h-screen space-y-4">
                <Loader2 className="h-10 w-10 text-primary-600 animate-spin" />
              </div>
            }>
              <AnimatedRoutes session={session} ProtectedRoute={ProtectedRoute} />
            </Suspense>
          </main>
        </div>

        {/* Footer */}
        <Footer />
        <Toaster richColors position="bottom-right" />
      </div>
    </Router>
  )
}
