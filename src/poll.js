import { router } from '@inertiajs/core'
import { getPageScope, onPageChange } from './page.js'

export function usePoll(interval, requestOptions = {}, options = {}) {
  if (!Number.isFinite(interval) || interval <= 0) throw new Error('Polling interval must be a positive number')
  const scope = getPageScope()
  const poll = router.poll(interval, requestOptions, options)
  let destroyed = false
  const unsubscribe = onPageChange(() => {
    if (getPageScope() !== scope) destroy()
  })
  function destroy() {
    if (destroyed) return
    destroyed = true
    unsubscribe()
    poll.destroy()
  }
  return {
    start: () => { if (!destroyed) poll.start() },
    stop: () => poll.stop(),
    destroy,
  }
}
