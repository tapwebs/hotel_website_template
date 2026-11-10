import { RouterProvider, type createBrowserRouter } from 'react-router'
import { ErrorBoundary } from '@/components/ErrorBoundary'
export default function App({ router }: { router: ReturnType<typeof createBrowserRouter> }) {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  )
}
