import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Browse from "./pages/Browse";
import Matches from "./pages/Matches";
import Profile from "./pages/Profile";
import "./App.css";
import PrideFlag from "./components/PrideFlag";

function RequireAuth({ children }: { children: React.JSX.Element }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <div className="pride-flag-bg">
        <PrideFlag />
      </div>
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
      <Route path="*" element={<Navigate to="/browse" replace />} />
      </Routes>
    </>
  );
}


