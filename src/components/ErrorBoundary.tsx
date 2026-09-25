import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * BLOCK: Enterprise POS React Error Boundary Component
 * Catches JavaScript errors anywhere in the component tree, prevents total application crash,
 * and allows isolated subsystem recovery.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error(`[POS ErrorBoundary:${this.props.moduleName || 'Global'}] Uncaught error:`, error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleReloadPage = () => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isModule = Boolean(this.props.moduleName);

      return (
        <div className={`error-boundary-card ${isModule ? 'p-6 my-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 text-rose-200' : 'min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-white'}`}>
          <div className={`error-boundary-card__container ${isModule ? 'max-w-xl' : 'max-w-lg w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl'}`}>
            <div className="error-boundary-card__header flex items-center gap-3.5 mb-4">
              <div className="error-boundary-card__icon-wrapper w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div className="error-boundary-card__titles">
                <h3 className="error-boundary-card__title text-lg font-bold text-white tracking-tight">
                  {isModule ? `${this.props.moduleName} Interrupted` : 'Terminal Exception Caught'}
                </h3>
                <p className="error-boundary-card__subtitle text-xs text-zinc-400">
                  {isModule ? 'This subsystem encountered an isolated runtime fault.' : 'The POS interface encountered an unexpected state and recovered safely.'}
                </p>
              </div>
            </div>

            <div className="error-boundary-card__body bg-zinc-950/80 rounded-2xl p-4 border border-zinc-800/80 mb-6">
              <div className="text-xs font-mono text-rose-300 break-words whitespace-pre-wrap max-h-36 overflow-y-auto">
                {this.state.error?.message || 'An unknown runtime error occurred.'}
              </div>
              {this.state.error?.stack && (
                <div className="mt-2 text-[10px] font-mono text-zinc-500 truncate">
                  {this.state.error.stack.split('\n')[1] || ''}
                </div>
              )}
            </div>

            <div className="error-boundary-card__footer flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="error-boundary-card__reset-button px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-purple-900/30"
              >
                <RefreshCw className="w-4 h-4" />
                Recover Subsystem
              </button>

              {!isModule && (
                <button
                  type="button"
                  onClick={this.handleReloadPage}
                  className="error-boundary-card__reload-button px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  Reload Terminal
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
