import { Link } from "react-router-dom";

const icons = {
  browse: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5 12 8l3.5 6.5-3.5-2-3.5 2z" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  matches: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 8.6c0-2.6-2.1-4.6-4.6-4.6-1.6 0-3 .8-3.8 2-.8-1.2-2.2-2-3.8-2-2.5 0-4.6 2-4.6 4.6 0 5 8.4 10.4 8.4 10.4s8.4-5.4 8.4-10.4z" />
    </svg>
  ),
  profile: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  ),
};

const labels = {
  browse: "Discover",
  matches: "Matches",
  profile: "Profile",
};

export default function TabBar({ active }: { active: "browse" | "matches" | "profile" }) {
  const tabs: Array<"browse" | "matches" | "profile"> = ["browse", "matches", "profile"];
  return (
    <nav className="tabbar tabbar-icononly">
      {tabs.map((tab) => (
        <Link
          key={tab}
          to={`/${tab}`}
          className={"tabbar-link" + (active === tab ? " active" : "")}
          title={labels[tab]}
          aria-label={labels[tab]}
        >
          <span className="tabbar-icon">{icons[tab]}</span>
        </Link>
      ))}
    </nav>
  );
}
