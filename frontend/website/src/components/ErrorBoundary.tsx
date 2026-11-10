import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorFallback } from './ErrorFallback'
/** Root boundary for crashes outside the router (router errors use `errorElement`). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('App crashed:', error, info.componentStack)
  }
  render() {
    return this.state.failed ? <ErrorFallback /> : this.props.children
  }
}
