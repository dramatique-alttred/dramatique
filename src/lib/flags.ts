/**
 * Ratings and view counts come from the catalog, which today holds placeholder numbers.
 * They stay hidden until real figures exist; set NEXT_PUBLIC_SHOW_STATS=1 to show them again.
 */
export const SHOW_STATS = process.env.NEXT_PUBLIC_SHOW_STATS === '1'
