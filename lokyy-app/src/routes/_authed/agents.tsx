import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/agents')({
  component: AgentsLayout,
})

function AgentsLayout() {
  return <Outlet />
}
