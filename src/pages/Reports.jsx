import React, { useState, useEffect } from 'react'
import { supabase, getUserProfile } from '../supabaseClient'
import { AlertTriangle, Plus, ClipboardList, Loader2, Send, CheckCircle2, AlertCircle, X, ShieldAlert, ImagePlus } from 'lucide-react'
import EmptyState from '../components/EmptyState'

export default function Reports({ session }) {
  const [reports, setReports] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // New Report Fields
  const [issueType, setIssueType] = useState('mismatch')
  const [description, setDescription] = useState('')
  const [reportFile, setReportFile] = useState(null)
  const [reportFilePreview, setReportFilePreview] = useState(null)

  const issueCategories = [
    { value: 'mismatch', label: 'สินค้าไม่ตรงกับที่ระบุ (ไม่ตรงปก)' },
    { value: 'fraud', label: 'พฤติกรรมส่อไปในทางทุจริต' },
    { value: 'behavior', label: 'ผู้ขายมีพฤติกรรมไม่เหมาะสม/พ่นคำหยาบคาย' },
    { value: 'spam', label: 'โฆษณาชวนเชื่อ หรือสินค้าที่ไม่อนุญาตในวิทยาลัย' },
    { value: 'others', label: 'อื่นๆ (ระบุรายละเอียดด้านล่าง)' },
  ]

  useEffect(() => {
    if (session) {
      fetchProfileReportsAndProducts()
    }
  }, [session])

  const fetchProfileReportsAndProducts = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      // 1. ดึงข้อมูล user จากตาราง users (ไม่ใช่ profiles)
      const { data: profile, error: profileError } = await getUserProfile()
      if (profileError) throw profileError
      setUserProfile(profile)

      // 2. ดึงรายงานที่ user คนนี้ส่งไว้ (RLS กรองอัตโนมัติ)
      const { data: reportsData, error: reportsError } = await supabase
        .from('product_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (reportsError) {
        // ถ้าตาราง product_reports ยังไม่ได้สร้าง ให้แสดง empty state แทน error
        if (reportsError.code === '42P01') {
          console.warn('ตาราง product_reports ยังไม่ได้สร้าง')
          setReports([])
        } else {
          console.warn('Reports query warning:', reportsError.message)
          setReports([])
        }
      } else {
        setReports(reportsData || [])
        // บันทึกสถานะล่าสุดลงใน localStorage เพื่อเคลียร์การแจ้งเตือน
        if (profile?.student_id && reportsData) {
          const statusesToSave = {}
          reportsData.forEach(r => {
            statusesToSave[r.id] = { status: r.status, admin_reply: r.admin_reply }
          })
          localStorage.setItem(`reports_user_statuses_${profile.student_id}`, JSON.stringify(statusesToSave))
          // กระตุ้นให้ Navbar อัปเดตการแจ้งเตือนทันที
          window.dispatchEvent(new Event('reports-read'))
        }
      }

      // 3. ไม่ต้องดึง product สำหรับ dropdown แล้ว เพราะเป็นรายงานทั่วไป
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Real-time listener สำหรับหน้ารายงาน
  useEffect(() => {
    if (!userProfile) return;

    const channel = supabase
      .channel('reports-page-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_reports', filter: `reporter_id=eq.${userProfile.student_id}` },
        () => {
          fetchProfileReportsAndProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.student_id]);

  const handleSubmitReport = async (e) => {
    e.preventDefault()
    if (!userProfile) return

    setFormLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      let uploadedImageUrl = null

      if (reportFile) {
        const fileExt = reportFile.name.split('.').pop()
        const fileName = `reports/${userProfile.student_id}_${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, reportFile, { upsert: true })
        
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName)
        
        uploadedImageUrl = publicUrl
      }

      const { error } = await supabase
        .from('product_reports')
        .insert({
          reporter_id: userProfile.student_id,
          issue_type: issueType,
          description: description,
          image_url: uploadedImageUrl,
          status: 'pending',
        })

      if (error) throw error

      setSuccessMsg('ส่งรายงานปัญหาเรียบร้อยแล้ว! ฝ่ายธุรการ/อาจารย์จะตรวจสอบข้อเท็จจริงโดยเร็วที่สุด')
      setIsModalOpen(false)
      setDescription('')
      setReportFile(null)
      setReportFilePreview(null)
      fetchProfileReportsAndProducts()
    } catch (err) {
      if (err.message.includes('42P01') || err.code === '42P01') {
        setErrorMsg('ยังไม่มีตารางรับรายงานในระบบ กรุณาติดต่อผู้ดูแลระบบ')
      } else {
        setErrorMsg('ไม่สามารถส่งรายงานได้: ' + err.message)
      }
    } finally {
      setFormLoading(false)
    }
  }

  const getIssueLabel = (val) => {
    const cat = issueCategories.find((c) => c.value === val)
    return cat ? cat.label : 'ทั่วไป'
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'resolved':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            ดำเนินการแก้ไขแล้ว
          </span>
        )
      case 'resolved':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            ดำเนินการแก้ไขแล้ว
          </span>
        )
      case 'dismissed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700">
            ยกเลิก/ไม่พบปัญหา
          </span>
        )
      case 'investigating':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            กำลังตรวจสอบข้อมูล
          </span>
        )
      case 'pending':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            รอตรวจสอบ
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-24 space-y-4">
        <Loader2 className="h-10 w-10 text-primary-600 animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">กำลังโหลดประวัติการรายงานปัญหา...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 pb-4 border-b border-slate-200 dark:border-navy-700">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-900 dark:text-white tracking-tight">รายงานปัญหาความปลอดภัย</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">แจ้งเรื่องร้องเรียน สินค้าไม่ตรงปก หรือพฤติกรรมที่ไม่น่าไว้วางใจเพื่อสังคมที่ปลอดภัย</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-4 md:mt-0 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-lg shadow-md transition-all duration-200"
        >
          <AlertTriangle className="h-5 w-5 text-white" />
          <span>แจ้งรายงานปัญหา</span>
        </button>
      </div>

      {successMsg && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center space-x-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Reports History */}
      <h2 className="text-lg font-bold text-navy-900 dark:text-white mb-4 flex items-center space-x-2">
        <ClipboardList className="h-5 w-5 text-slate-400 dark:text-slate-500" />
        <span>ประวัติการรายงานปัญหาของคุณ</span>
      </h2>

      {reports.length === 0 ? (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm transition-colors">
          <EmptyState
            icon={CheckCircle2}
            title="ไม่มีรายงานปัญหาความประพฤติ"
            description="ยินดีด้วย! คุณไม่พบปัญหาการหลอกลวงหรือสินค้าผิดกฎระเบียบในการใช้งาน"
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden shadow-sm transition-colors">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 dark:bg-navy-950">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">หมายเลขรายงาน</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">รายละเอียด</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">หมวดหมู่ปัญหา</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">วันที่ส่งรายงาน</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">สถานะ</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">การตอบกลับ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:bg-navy-900 transition-colors">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-navy-900 dark:text-white font-outfit">
                      #REP-{report.id}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white max-w-[300px] whitespace-normal break-words">
                      {report.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {getIssueLabel(report.issue_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                      {new Date(report.created_at).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200 max-w-[300px] whitespace-normal break-words">
                      {report.admin_reply ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {report.admin_reply}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Report Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-scale-up transition-colors">

            <div className="bg-red-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <h2 className="text-lg font-bold">แจ้งรายงานปัญหาและข้อร้องเรียน</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-red-200 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
              <div className="flex items-start space-x-2 bg-red-50 text-red-800 p-3 rounded-lg border border-red-200 text-xs">
                <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
                <span>การแจ้งเท็จหรือมีเจตนากลั่นแกล้งผู้ใช้งานอื่น อาจถูกดำเนินการทางวินัยจากทางสถาบันการศึกษาได้ กรุณากรอกข้อมูลที่เป็นจริงเท่านั้น</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">ร้องเรียนเรื่อง</label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {issueCategories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">รายละเอียดการรายงาน</label>
                <textarea
                  rows="4"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="กรุณาบรรยายข้อเท็จจริง เช่น สภาพของสินค้าไม่ตรงตามตกลงในจุดใดบ้าง หรือพฤติกรรมที่ไม่สุภาพ..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">อัปโหลดรูปภาพประกอบ (ถ้ามี)</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-navy-600 border-dashed rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors">
                  <div className="space-y-1 text-center">
                    {reportFilePreview ? (
                      <div className="relative inline-block">
                        <img src={reportFilePreview} alt="Preview" className="max-h-32 rounded-md mx-auto" />
                        <button
                          type="button"
                          onClick={() => {
                            setReportFile(null)
                            setReportFilePreview(null)
                          }}
                          className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <ImagePlus className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" />
                        <div className="flex text-sm text-slate-600 dark:text-slate-300 justify-center">
                          <label className="relative cursor-pointer bg-white dark:bg-navy-900 rounded-md font-medium text-red-600 hover:text-red-500 focus-within:outline-none transition-colors">
                            <span>อัปโหลดรูปภาพ</span>
                            <input
                              type="file"
                              className="sr-only"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files[0]
                                if (file) {
                                  setReportFile(file)
                                  const reader = new FileReader()
                                  reader.onloadend = () => setReportFilePreview(reader.result)
                                  reader.readAsDataURL(file)
                                }
                              }}
                            />
                          </label>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG, GIF สูงสุด 5MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 flex justify-end space-x-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-red-700 text-white rounded-lg text-sm font-bold hover:bg-red-800 transition-colors disabled:opacity-50"
                >
                  {formLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>กำลังส่งเรื่อง...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 text-red-200" />
                      <span>ส่งรายงาน</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


