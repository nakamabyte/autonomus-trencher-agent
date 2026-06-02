import { executeBuybackAndBurn } from './autoBurn.js'

const BURN_INTERVAL_HOURS = parseFloat(process.env.BURN_INTERVAL_HOURS || '6')
const BURN_INTERVAL_MS = BURN_INTERVAL_HOURS * 60 * 60 * 1000

export function startBurnScheduler(connection) {
  console.log(`[burn] scheduler started, running every ${BURN_INTERVAL_HOURS} hours`)

  setInterval(async () => {
    try {
      const result = await executeBuybackAndBurn(connection)
      if (result) {
        // notifyBurn(result)  // Telegram notification
        // logBurn(result)     // Database logging
      }
    } catch (err) {
      console.error('[burn] scheduler error:', err.message)
    }
  }, BURN_INTERVAL_MS)
}
