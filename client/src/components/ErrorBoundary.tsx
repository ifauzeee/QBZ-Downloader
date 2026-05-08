import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ color: '#ef4444', marginBottom: '16px' }}>Oops! Something went wrong.</h1>
          <p style={{ color: '#a1a1aa', marginBottom: '24px', maxWidth: '500px' }}>
            The application encountered an unexpected error. We've logged the issue. 
            Try refreshing the page or clearing the playback queue.
          </p>
          <div style={{ 
            background: '#18181b', 
            padding: '16px', 
            borderRadius: '8px', 
            fontSize: '14px', 
            color: '#71717a',
            marginBottom: '24px',
            maxWidth: '100%',
            overflow: 'auto'
          }}>
            {this.state.error?.message}
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: '#ffffff',
              color: '#000000',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

