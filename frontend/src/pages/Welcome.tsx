import { Link } from "react-router-dom";
import PumpingHeart from "../components/PumpingHeart";
import heroImg from "../assets/hero.png";
import "./Welcome.css";

export default function Welcome() {
  return (
    <div className="welcome-page">
      <header className="welcome-hero">
        <PumpingHeart />
        <div className="brand">Buddies Pride</div>
        <h1>India's Safe Space for LGBTQ+ Dating &amp; Connection</h1>
        <p className="welcome-subtext">
          Meet, match, and connect with people who get you. A dating app
          built for the queer community — safe, verified, and inclusive.
        </p>
        <div className="welcome-cta-group">
          <Link to="/signup" className="welcome-btn welcome-btn-primary">
            Get Started
          </Link>
          <Link to="/login" className="welcome-btn welcome-btn-secondary">
            Log In
          </Link>
        </div>
        <img src={heroImg} alt="BuddiesPride app preview" className="welcome-hero-img" />
      </header>

      <section className="welcome-section welcome-about">
        <h2>What is BuddiesPride?</h2>
        <p>
          BuddiesPride is a dating platform built specifically for India's
          LGBTQ+ community. Whether you're looking for a relationship,
          friendship, or people who simply understand you, we help you
          connect with genuine, verified profiles in a space designed to
          feel safe.
        </p>
      </section>

      <section className="welcome-section welcome-features">
        <h2>Features</h2>
        <div className="welcome-feature-grid">
          <div className="welcome-feature-card">
            <h3>🔍 Discover</h3>
            <p>Browse profiles near you and find people who match your vibe.</p>
          </div>
          <div className="welcome-feature-card">
            <h3>💬 Match &amp; Chat</h3>
            <p>Connect instantly once both of you like each other — no pressure.</p>
          </div>
          <div className="welcome-feature-card">
            <h3>✅ Verified Profiles</h3>
            <p>Identity checks help keep the community genuine and safe.</p>
          </div>
          <div className="welcome-feature-card">
            <h3>🔒 Privacy Controls</h3>
            <p>You decide who sees your profile and what they can see.</p>
          </div>
        </div>
      </section>

      <section className="welcome-section welcome-safety">
        <h2>Your Safety Comes First</h2>
        <ul>
          <li>Profile verification to reduce fake accounts</li>
          <li>Easy reporting and blocking tools</li>
          <li>Full control over your visibility and privacy settings</li>
          <li>A community moderated with respect and inclusivity in mind</li>
        </ul>
      </section>

      <footer className="welcome-footer-cta">
        <h2>Ready to find your people?</h2>
        <Link to="/signup" className="welcome-btn welcome-btn-primary welcome-btn-large">
          Join BuddiesPride Today
        </Link>
      </footer>
    </div>
  );
}
