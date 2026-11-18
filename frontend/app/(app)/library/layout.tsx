import { RequireModule } from 'src/components/layout/RequireModule';

/** Every `/library/...` page renders only while the library is on for this business. */
export default function LibraryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <RequireModule module="library">{children}</RequireModule>;
}
