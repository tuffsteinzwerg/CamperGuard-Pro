// @ts-nocheck
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  key?: React.Key;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div className="cg-panel p-6 max-w-sm w-full space-y-4">
            <div className="text-[var(--status-danger)] text-[14px] font-bold uppercase tracking-wider">
              Anzeigefehler
            </div>
            <p className="text-[13px] text-[var(--text-muted)]">
              In dieser Ansicht ist ein Fehler aufgetreten. Deine Daten sind sicher.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="cg-master-button w-full py-3"
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
