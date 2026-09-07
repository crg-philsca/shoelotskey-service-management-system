import React, { Component, ReactNode } from 'react';
import ErrorPage from '@/app/pages/ErrorPage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * GLOBAL ERROR BOUNDARY DEFENDER
 * Prevents React "White Screen of Death" by intercepting any runtime bug, exception,
 * or system failure anywhere in the application and rendering the Shoelotskey Error & 404 Screen.
 */
class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SHOELOTSKEY DEFENCE TRAP] Unhandled Runtime Bug Intercepted:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage
          type="crash"
          errorDetails={this.state.error?.toString()}
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}

export default GlobalErrorBoundary;
