import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/workflows')({
  component: WorkflowsLayout,
})

function WorkflowsLayout() {
  return <Outlet />
}
