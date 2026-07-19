import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly failed: boolean;
}

const fallbackStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  height: '100vh',
  fontFamily: 'Segoe UI, sans-serif',
  textAlign: 'center',
} as const;

/**
 * Last-resort catch for render errors: shows a plain failure message
 * instead of a dead white window. Styled inline because the Fluent
 * provider above it may be what failed.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('unrecoverable render error:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <div style={fallbackStyle}>
        <h1>Something went wrong</h1>
        <p>CoreControl hit an unexpected error. Close the window and start it again.</p>
      </div>
    );
  }
}

/**
 * Installs last-resort handlers for failures nothing else caught, so they
 * land in the console instead of disappearing. Call once at startup.
 */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('unhandled promise rejection:', event.reason);
    event.preventDefault();
  });
  window.addEventListener('error', (event) => {
    console.error('unhandled error:', event.error ?? event.message);
  });
}
