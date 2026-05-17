import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/dashboards')({
  component: DashboardsLayout,
})

function DashboardsLayout() {
  return <Outlet />
}
