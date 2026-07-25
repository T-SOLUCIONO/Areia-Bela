/**
 * No barrel export on purpose (matches the shadcn/ui convention this
 * package was migrated from): import each primitive from its own
 * subpath, e.g. `@areia-bela/ui/button`, `@areia-bela/ui/hooks/use-toast`.
 * A barrel here would pull all 55 primitives into every bundle that
 * imports even one.
 */
export const UI_PACKAGE_VERSION = '0.0.0'
