import { AuthForm } from '@/components/auth/AuthForm';

export default function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">Family Days Reminder</h1>
                    <p className="text-gray-600">Never forget a special Jewish date again.</p>
                </div>
                <div className="flex justify-center">
                    <AuthForm />
                </div>
            </div>
        </div>
    );
}
