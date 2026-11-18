/**
 * The Money Book: its own app, its own tables, nothing of the Shop's.
 *
 * It belongs to the person, not a business (`apps/moneybook`: every row is
 * owned by the signed-in user and the API asks for nothing else), so it opens
 * whichever business is open, or none. Since 18 Nov 2026 it is where a sign-in
 * lands when no business is starred (owner), including a new account with no
 * business at all, so a business's own app list must not hide it.
 */
export default function MoneyBookLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <>{children}</>;
}
