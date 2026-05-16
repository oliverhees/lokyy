import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { BellIcon, CreditCardIcon, LogOutIcon, UserCircle2Icon } from 'lucide-react'
import { DotsVerticalIcon } from '@radix-ui/react-icons'
import { useNavigate } from '@tanstack/react-router'
import { useSession, signOut } from '@/lib/auth-client'
import { generateAvatarFallback } from '@/lib/utils'

export function NavUser() {
  const { isMobile } = useSidebar()
  const { data: session } = useSession()
  const navigate = useNavigate()

  const name = session?.user?.name ?? 'Lokyy User'
  const email = session?.user?.email ?? ''
  const avatar = (session?.user as { image?: string } | undefined)?.image
  const fallback = generateAvatarFallback(name)

  async function handleSignOut() {
    await signOut()
    await navigate({ to: '/login' })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              data-testid="nav-user-trigger"
            >
              <Avatar className="rounded-full">
                {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
                <AvatarFallback className="rounded-lg">{fallback}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium" data-testid="nav-user-name">{name}</span>
                <span className="text-muted-foreground truncate text-xs" data-testid="nav-user-email">{email}</span>
              </div>
              <DotsVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
                  <AvatarFallback className="rounded-lg">{fallback}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="text-muted-foreground truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                <UserCircle2Icon />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <CreditCardIcon />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <BellIcon />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut} data-testid="nav-user-signout">
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
