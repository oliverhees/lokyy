import { createFileRoute } from '@tanstack/react-router'
import DashboardPage from '@/screens/dashboard/page'

export const Route = createFileRoute('/_authed/dashboard')({
  component: DashboardPage,
})
