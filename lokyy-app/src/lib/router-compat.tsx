import * as React from 'react'
import { Link as TanStackLink, useLocation, useNavigate } from '@tanstack/react-router'

/**
 * Drop-in Next.js → TanStack Router adapter.
 *
 * - `<Link href="...">` external (http/https) → renders <a>
 * - `<Link href="...">` internal → renders TanStack Link with `to`
 * - `usePathname()` and `useRouter()` match the Next API used by the imported UI kit.
 */

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href?: string
  to?: string
  prefetch?: boolean | null
  passHref?: boolean
  legacyBehavior?: boolean
  scroll?: boolean
  replace?: boolean
  shallow?: boolean
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, to, prefetch: _p, passHref: _ph, legacyBehavior: _lb, scroll: _s, shallow: _sh, replace, ...rest },
  ref,
) {
  const target = to ?? href ?? '#'
  const isExternal = /^(https?:)?\/\//i.test(target) || target.startsWith('mailto:') || target.startsWith('tel:')
  if (isExternal || rest.target === '_blank') {
    return <a ref={ref} href={target} {...rest} />
  }
  const linkProps = rest as unknown as Record<string, unknown>
  return (
    <TanStackLink
      ref={ref as never}
      to={target as never}
      replace={replace}
      {...linkProps}
    />
  )
})

export function usePathname(): string {
  const location = useLocation()
  return location.pathname
}

export function useRouter() {
  const navigate = useNavigate()
  return {
    push: (path: string) => navigate({ to: path as never }),
    replace: (path: string) => navigate({ to: path as never, replace: true }),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
    prefetch: (_path: string) => {},
  }
}
