import { Navigate } from 'react-router-dom';
import { useAuth } from '../../app/auth.jsx';

export function Protected({ children, requiredRole, requiredRoles, allowPasswordChange = false }) {
  const auth = useAuth();
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (auth.user.mustChangePassword && !allowPasswordChange)
    return <Navigate to="/profile" replace />;
  if (requiredRole && auth.user.role !== requiredRole) return <Navigate to="/properties" replace />;
  if (requiredRoles && !requiredRoles.includes(auth.user.role))
    return <Navigate to="/properties" replace />;
  return children;
}
