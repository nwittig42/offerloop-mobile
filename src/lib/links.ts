/**
 * Outward-facing links. One place, so a launch doesn't mean grepping the app.
 */

/**
 * Where a shared job (or any "get the app" prompt) sends someone.
 *
 * TODO at App Store launch: swap this for the direct App Store product URL
 * (https://apps.apple.com/app/id<APP_ID>). Until the app is actually listed,
 * pointing at a store URL that 404s is worse than pointing at the site — so it
 * goes to offerloop.ai, which exists today and can route people to the app.
 *
 * NOTE (App Store compliance): this is a link to GET THE APP, not to buy
 * anything. The app sells nothing in-app and must never steer users to the web
 * to purchase or manage credits — see the read-only credits screen. Keep it that
 * way: a download/marketing link is fine, a payment link is not.
 */
export const APP_DOWNLOAD_URL = 'https://offerloop.ai';
