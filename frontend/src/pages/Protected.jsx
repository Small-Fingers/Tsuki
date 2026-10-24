import { Navigate } from 'react-router-dom';
import { useAuth } from '../app/shared.jsx';

export function Protected({children,role,roles,allowPasswordChange=false}) { const auth=useAuth();if(!auth?.user)return <Navigate to="/login" replace/>;if(auth.user.mustChangePassword&&!allowPasswordChange)return <Navigate to="/profile" replace/>;if(role&&auth.user.role!==role)return <Navigate to="/properties" replace/>;if(roles&&!roles.includes(auth.user.role))return <Navigate to="/properties" replace/>;return children; }
