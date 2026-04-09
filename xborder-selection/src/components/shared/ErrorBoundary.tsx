import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    const pageName = this.props.pageName ?? '未知页面';
    console.error(`[ErrorBoundary][${pageName}] 页面组件异常:`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">页面加载异常</h2>
            <p className="text-sm text-slate-500 max-w-sm">
              请刷新页面重试。如持续出现，请联系管理员。
            </p>
            {this.state.errorMessage && (
              <p className="text-xs text-slate-400 mt-2 font-mono max-w-md break-all">
                {this.state.errorMessage}
              </p>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={15} />
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
