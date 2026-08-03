import { useNavigate } from "react-router-dom";

export default function Safety() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px", color: "#fff" }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          background: "none",
          border: "none",
          color: "#fff",
          opacity: 0.7,
          cursor: "pointer",
          marginBottom: 16,
          fontSize: 14,
        }}
      >
        ← Back
      </button>

      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Safety Center</h1>
      <p style={{ opacity: 0.75, marginBottom: 28 }}>
        A few things to keep in mind while meeting people on BuddiesPride.
      </p>

      <SafetySection
        title="Before you meet"
        items={[
          "Video call your match first before meeting in person.",
          "Tell a friend where you're going and who you're meeting.",
          "Meet in a public place for the first few dates.",
        ]}
      />
      <SafetySection
        title="Protect your privacy"
        items={[
          "Don't share your home address, workplace, or financial details early on.",
          "Be cautious of matches who ask for money or gifts.",
          "Trust your instincts — if something feels off, it's okay to disengage.",
        ]}
      />
      <SafetySection
        title="Reporting & blocking"
        items={[
          "You can block or report any user from their profile.",
          "Reports are reviewed by our safety team.",
          "In an emergency, always contact local authorities first.",
        ]}
      />
    </div>
  );
}

function SafetySection({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>{title}</h2>
      <ul style={{ paddingLeft: 20, lineHeight: 1.7, opacity: 0.85 }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}