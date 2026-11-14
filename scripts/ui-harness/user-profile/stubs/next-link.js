import React from 'react'
const Link = React.forwardRef(function Link({ href, prefetch, replace, scroll, shallow, ...rest }, ref) {
  const h = typeof href === 'string' ? href : (href && href.pathname) || '#'
  return React.createElement('a', {
    ...rest,
    href: h,
    ref,
    onClick: (e) => {
      rest.onClick && rest.onClick(e)
      if (!e.defaultPrevented) {
        e.preventDefault()
        window.__NAV__ = window.__NAV__ || []
        window.__NAV__.push({ op: 'link', href: h })
      }
    },
  })
})
export default Link
