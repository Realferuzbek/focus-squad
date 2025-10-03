import AdminSettings from '@/components/AdminSettings';

export const metadata = { title: 'Admin · Focus Squad' };

export default function AdminPage() {
  return (
    <main className="p-4 max-w-4xl mx-auto">
      <AdminSettings />
    </main>
  );
}
