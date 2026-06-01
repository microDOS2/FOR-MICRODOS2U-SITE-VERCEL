import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, BrainCircuit } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#0a0514] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <BrainCircuit className="w-8 h-8 text-[#44f80c]" />
          <span className="text-2xl font-bold">
            <span className="text-[#44f80c]">micro</span>
            <span className="text-[#9a02d0]">DOS</span>
            <span className="text-[#ff66c4]">(2)</span>
          </span>
        </div>

        <h1 className="text-6xl font-bold text-white mb-2">404</h1>
        <h2 className="text-xl text-gray-400 mb-4">Page Not Found</h2>
        <p className="text-gray-500 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <Link to="/">
          <Button className="bg-[#9a02d0] hover:bg-[#9a02d0]/80 text-white">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
