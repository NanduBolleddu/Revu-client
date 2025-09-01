import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function HomePage({ keycloak }) {
  const router = useRouter();

  useEffect(() => {
    // Redirect to documents page
    router.replace('/documents');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to documents...</p>
      </div>
    </div>
  );
}
