export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Public layout - no header since each page has its own navigation
  return <>{children}</>
}
