import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSession } from '@/lib/auth-client'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/sidebar/app-sidebar'
import { SiteHeader } from '@/components/layout/header'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session.data?.user) throw redirect({ to: '/login' })
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 64)',
          '--header-height': 'calc(var(--spacing) * 14)',
          '--content-padding': 'calc(var(--spacing) * 4)',
          '--content-margin': 'calc(var(--spacing) * 1.5)',
          '--content-full-height':
            'calc(100vh - var(--header-height) - (var(--content-padding) * 2) - (var(--content-margin) * 2))',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="bg-muted/40 flex flex-1 flex-col">
          <div className="@container/main p-(--content-padding)">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
