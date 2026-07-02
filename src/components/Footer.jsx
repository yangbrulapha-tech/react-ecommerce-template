import { Shield, Heart } from 'lucide-react'

const Facebook = (props) => (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
)

const Instagram = (props) => (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

export default function Footer() {
  // ผู้จัดทำเว็บ (คน)
  const people = [
    {
      name: 'Marshal Mars',
      sub: 'ผู้จัดทำเว็บ',
      avatar: `${import.meta.env.BASE_URL}marshal_avatar.png`,
      facebook: 'https://www.facebook.com/guest178',
      instagram: 'https://www.instagram.com/kkhxphidph/',
      igHandle: 'kkhxphidph'
    },
    {
      name: 'Ramita Rxn (เรน)',
      sub: 'ผู้จัดทำเว็บ',
      avatarFb: ``,
      avatarIg: ``,
      facebook: 'https://www.facebook.com/profile.php?id=61579985292940',
      instagram: 'https://www.instagram.com/r__axnbxw/',
      igHandle: 'r__axnbxw'
    }
  ]

  // เพจองค์กร
  const pages = [
    {
      name: 'Community Page',
      sub: 'Our Community',
      avatar: ``,
      link: '#'
    },
    {
      name: 'PR Department',
      sub: 'Public Relations',
      avatar: ``,
      link: '#'
    }
  ]

  return (
    <footer className="bg-navy-950 text-slate-400 dark:text-slate-500 py-12 border-t border-navy-900 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black font-outfit tracking-wider">
                <span className="text-white">REACT </span>
                <span className="text-sky-400">MARKET</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 max-w-sm">
              A modern e-commerce platform and marketplace template built with React. Start your online business quickly and securely.
            </p>
            <div className="text-[10px] text-slate-600 dark:text-slate-300 font-mono mt-4 pt-4 border-t border-navy-900/60">
              © {new Date().getFullYear()} React Market. All rights reserved.
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-6 lg:col-span-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-navy-900 pb-2">
              Contact / Links
            </h3>

            {/* ─── ส่วน: คน (ผู้จัดทำ) ─── */}
            <div className="space-y-3">
              <p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center space-x-1.5">
                <span>👤</span><span>ผู้จัดทำเว็บ</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Facebook Column */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-sky-400 uppercase tracking-widest flex items-center space-x-1.5 border-b border-navy-900/50 pb-1">
                    <Facebook className="h-3.5 w-3.5 text-sky-400" />
                    <span>Facebook</span>
                  </h4>
                  <div className="space-y-2">
                    {people.map((person, idx) => (
                      <a key={idx} href={person.facebook} target="_blank" rel="noopener noreferrer"
                        className="flex items-center space-x-3 bg-navy-900/50 hover:bg-navy-900 border border-navy-900 hover:border-sky-500/30 p-3 rounded-xl transition-all duration-300 group shadow-sm">
                        <div className="w-9 h-9 rounded-full border border-navy-800 bg-slate-950 overflow-hidden shrink-0 shadow-inner">
                          <img src={person.avatarFb || person.avatar} alt={person.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80' }} />
                        </div>
                        <div className="overflow-hidden flex-1">
                          <h5 className="font-bold text-xs text-slate-200 group-hover:text-sky-400 transition-colors truncate">{person.name}</h5>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{person.sub}</p>
                        </div>
                        <Facebook className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300 group-hover:text-sky-400 shrink-0 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>

                {/* Instagram Column */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-pink-400 uppercase tracking-widest flex items-center space-x-1.5 border-b border-navy-900/50 pb-1">
                    <Instagram className="h-3.5 w-3.5 text-pink-400" />
                    <span>Instagram</span>
                  </h4>
                  <div className="space-y-2">
                    {people.map((person, idx) => (
                      <a key={idx} href={person.instagram} target="_blank" rel="noopener noreferrer"
                        className="flex items-center space-x-3 bg-navy-900/50 hover:bg-navy-900 border border-navy-900 hover:border-pink-500/30 p-3 rounded-xl transition-all duration-300 group shadow-sm">
                        <div className="w-9 h-9 rounded-full border border-navy-800 bg-slate-950 overflow-hidden shrink-0 shadow-inner">
                          <img src={person.avatarIg || person.avatar} alt={person.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80' }} />
                        </div>
                        <div className="overflow-hidden flex-1">
                          <h5 className="font-bold text-xs text-slate-200 group-hover:text-pink-400 transition-colors truncate">{person.name}</h5>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">@{person.igHandle}</p>
                        </div>
                        <Instagram className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300 group-hover:text-pink-500 shrink-0 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── ส่วน: เพจ (องค์กร) ─── */}
            <div className="space-y-3 pt-2 border-t border-navy-900/60">
              <p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center space-x-1.5">
                <Facebook className="h-3.5 w-3.5" /><span>เพจองค์กร</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {pages.map((page, idx) => (
                  <a key={idx} href={page.link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center space-x-3 bg-navy-900/50 hover:bg-navy-900 border border-navy-900 hover:border-sky-500/30 p-3 rounded-xl transition-all duration-300 group shadow-sm">
                    <div className="w-9 h-9 rounded-full border border-navy-800 bg-slate-950 overflow-hidden shrink-0 shadow-inner">
                      <img src={page.avatar} alt={page.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80' }} />
                    </div>
                    <div className="overflow-hidden flex-1">
                      <h5 className="font-bold text-xs text-slate-200 group-hover:text-sky-400 transition-colors truncate">{page.name}</h5>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{page.sub}</p>
                    </div>
                    <Facebook className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300 group-hover:text-sky-400 shrink-0 transition-colors" />
                  </a>
                ))}
              </div>
            </div>

          </div>
        </div>




        {/* Footer Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-navy-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 dark:text-slate-300 gap-4">
          <div className="flex items-center space-x-1.5">
            <Shield className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span>ดูแลและสนับสนุนระบบโดย สาขาวิชาเทคโนโลยีธุรกิจดิจิทัล</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>Made with</span>
            <Heart className="h-3 w-3 text-red-500 fill-red-500 animate-pulse" />
            <span>for MTC students</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
