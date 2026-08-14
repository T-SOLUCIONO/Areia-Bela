/**
 * The id of the single site settings row.
 *
 * Pinned so the row can be upserted without a lookup — there is one house, so
 * there is one row. It lives in its own file because it stopped being the CMS's
 * private business the day a second module needed to read the same row: the
 * calendar sync declared its own copy, spelled it `settings`, and quietly read
 * a row that does not exist. Every import returned "nothing configured" while
 * the panel showed the URL saved.
 */
export const SETTINGS_ID = 'site'
