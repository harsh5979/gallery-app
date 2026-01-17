
import LoginForm from '@/components/LoginForm';

// This is a Server Component (default in /app)
export default function LoginPage() {
    return (
        <div className="flex items-center justify-center min-h-[80vh]">
            <LoginForm />
        </div>
    );
}
