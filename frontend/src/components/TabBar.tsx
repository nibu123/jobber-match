import { Link } from "react-router-dom";

export default function TabBar({ active }: { active: "browse" | "matches" | "profile" }) {
  return (
    <nav className="tabbar">
      <Link to="/browse" className={active === "browse" ? "active" : ""}>
        Discover
      </Link>
      <Link to="/matches" className={active === "matches" ? "active" : ""}>
        Matches
      </Link>
      <Link to="/profile" className={active === "profile" ? "active" : ""}>
        Profile
      </Link>
    </nav>
  );
}
