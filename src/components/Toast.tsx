import { useEffect } from 'react';
import { usePopupStore } from '@/stores/popupStore';

export function Toast() {
  const { toast, hideToast } = usePopupStore();
  
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        hideToast();
      }, 5000); // Auto-hide after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [toast, hideToast]);
  
  if (!toast) return null;
  
  const bgColor = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
  }[toast.type];
  
  const textColor = {
    success: 'text-green-800',
    error: 'text-red-800',
    info: 'text-blue-800',
  }[toast.type];
  
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`toast-enter fixed bottom-4 left-4 right-4 ${bgColor} border rounded-lg p-4 shadow-lg flex items-start justify-between gap-3`}
    >
      <div className="flex-1">
        <p className={`${textColor} font-medium`}>{toast.message}</p>
      </div>
      
      <div className="flex items-center gap-2">
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className={`${textColor} text-sm font-medium hover:underline`}
          >
            {toast.action.label}
          </button>
        )}
        
        <button
          onClick={hideToast}
          className={`${textColor} hover:opacity-70 p-1`}
          aria-label="Close notification"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
