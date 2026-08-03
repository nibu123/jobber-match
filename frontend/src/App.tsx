import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Browse from "./pages/Browse";
import Matches from "./pages/Matches";
import Profile from "./pages/Profile";
import Onboarding from "./pages/Onboarding";
import Safety from "./pages/Safety";
import Communities from "./pages/Communities";
import VideoCall from "./pages/VideoCall";
import "./App.css";
import PrideFlag from "./components/PrideFlag";
import CallManager from "./components/CallManager";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminReports from "./pages/admin/AdminReports";

function RequireAuth({ children }: { children: React.JSX.Element }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { token } = useAuth();
  return (
    <>
      <div className="pride-flag-bg">
        <PrideFlag />
      </div>
      {token && <CallManager />}
      <AdminAuthProvider>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/browse"
        element={
          <RequireAuth>
            <Browse />
          </RequireAuth>
        }
      />
      <Route
        path="/matches"
        element={
          <RequireAuth>
            <Matches />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />
      <Route
        path="/safety"
        element={
          <RequireAuth>
            <Safety />
          </RequireAuth>
        }
      />
      <Route
        path="/communities"
        element={
          <RequireAuth>
            <Communities />
          </RequireAuth>
        }
      />
      <Route
        path="/call/:matchId"
        element={
          <RequireAuth>
            <VideoCall />
          </RequireAuth>
        }
      />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="reports" element={<AdminReports />} />
      </Route>
      <Route path="*" element={<Navigate to="/browse" replace />} />
      </Routes>
      </AdminAuthProvider>
    </>
  );
}

