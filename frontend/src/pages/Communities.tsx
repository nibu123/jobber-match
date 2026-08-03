export default function Communities() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px", color: "#fff" }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Communities</h1>
      <p style={{ opacity: 0.75, marginBottom: 28 }}>
        Connect with groups that share your interests. Coming soon.
      </p>

      <div
        style={{
          padding: 24,
          borderRadius: 12,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏳️‍🌈</div>
        <div style={{ fontSize: 15, opacity: 0.7 }}>
          Community spaces are launching soon — stay tuned!
        </div>
      </div>
    </div>
  );
}