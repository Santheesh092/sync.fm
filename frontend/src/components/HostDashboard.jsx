import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';

/**
 * HostDashboard — redirects to the new Room page.
 * Kept for backward compatibility with existing /host route.
 */
export default function HostDashboard() {
    const navigate = useNavigate();

    useEffect(() => {
        // Redirect to create-room flow
        navigate('/create-room', { replace: true });
    }, [navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <Radio size={40} color="#F2C21A" className="mx-auto mb-4 animate-pulse" />
                <p style={{ color: '#6b8fa8' }}>Redirecting to Create Room…</p>
            </div>
        </div>
    );
}
