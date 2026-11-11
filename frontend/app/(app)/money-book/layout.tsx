import { RequireModule } from 'src/components/layout/RequireModule';

/** The Money Book: its own app, its own tables, nothing of the Shop's. */
export default function MoneyBookLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <RequireModule module="khata">{children}</RequireModule>;
}
