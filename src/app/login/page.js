import LoginForm from '@/components/admin/LoginForm';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

// This is a Server Component (default in /app)
export default function LoginPage() {
    return (
        <div className="flex items-center justify-center min-h-[80vh]">
            <LoginForm />
        </div>
    );
}
