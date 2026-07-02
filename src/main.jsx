import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, isChunkError: false };
  }
  static getDerivedStateFromError(error) {
    const isChunkError = error && (
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    );
    return { hasError: true, error, isChunkError };
  }
  componentDidCatch(error, errorInfo) {
    if (this.state.isChunkError) {
      // Auto refresh for chunk errors (max 1 time per session to avoid loops)
      const hasRetried = sessionStorage.getItem('chunk_retried');
      if (!hasRetried) {
        sessionStorage.setItem('chunk_retried', 'true');
        window.location.reload();
        return;
      }
    }
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  componentDidMount() {
    // If mounted successfully, we can clear the retry flag after a few seconds
    setTimeout(() => {
      sessionStorage.removeItem('chunk_retried');
    }, 2000);
  }
  render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) {
        return (
          <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', color: '#334155' }}>
            <h2>กำลังอัปเดตระบบ...</h2>
            <p>กรุณารอสักครู่ ระบบกำลังโหลดข้อมูลเวอร์ชันใหม่</p>
            <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px' }}>
              คลิกที่นี่หากหน้าจอไม่โหลดอัตโนมัติ
            </button>
          </div>
        );
      }
      return (
        <div style={{ padding: '20px', background: '#fee2e2', color: '#991b1b', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>แอปพลิเคชันเกิดข้อผิดพลาด (Runtime Error)</h1>
          <p style={{ marginTop: '10px' }}>{this.state.error && this.state.error.toString()}</p>
          <pre style={{ marginTop: '20px', background: 'white', padding: '10px', overflowX: 'auto', fontSize: '12px' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
