import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import "./Onboarding.css";

const ORIENTATIONS = ["Straight", "Gay", "Lesbian", "Bisexual", "Asexual", "Demisexual", "Pansexual", "Queer"];
const LOOKING_FOR = [
  { key: "long_partner", emoji: "\u{1F498}", label: "Long-term partner" },
  { key: "long_short_ok", emoji: "\u{1F60D}", label: "Long-term, but short-term OK" },
  { key: "short_long_ok", emoji: "\u{1F942}", label: "Short-term, but long-term OK" },
  { key: "short_fun", emoji: "\u{1F389}", label: "Short-term fun" },
  { key: "friends", emoji: "\u{1F44B}", label: "New friends" },
  { key: "figuring_out", emoji: "\u{1F914}", label: "Still figuring it out" },
];
const GENDERS = ["Man", "Woman", "Trans man", "Trans woman", "Non-binary", "Genderfluid"];
const INTERESTED_IN = ["Men", "Women", "Everyone"];
const INTERESTS = [
  "Chai addict", "Bollywood", "Indie music", "Trekking", "Foodie", "Cricket",
  "Pride events", "Bookworm", "Gym", "Travel", "Art", "Gaming",
  "Cooking", "Standup comedy", "Yoga", "Astrology", "Cafe hopping", "Theatre",
];

const STEPS = ["orientation", "lookingFor", "name", "gender", "interestedIn", "birthday", "interests", "photos"] as const;
type Step = (typeof STEPS)[number];

const MAX_PHOTOS = 6;
const MAX_INTERESTS = 5;
const MAX_ORIENTATIONS = 3;
const MIN_AGE = 18;

interface DobState {
  day: string;
  month: string;
  year: string;
}

interface OnbState {
  orientation: string[];
  orientationVisible: boolean;
  lookingFor: string | null;
  name: string;
  gender: string | null;
  genderVisible: boolean;
  interestedIn: string | null;
  dob: DobState;
  interests: string[];
  photos: string[];
}

function toggleValue(arr: string[], val: string, max?: number): string[] {
  const i = arr.indexOf(val);
  if (i >= 0) return arr.filter((x) => x !== val);
  if (max && arr.length >= max) return arr;
  return [...arr, val];
}

function buzz(ms = 8) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [state, setState] = useState<OnbState>({
    orientation: [],
    orientationVisible: false,
    lookingFor: null,
    name: "",
    gender: null,
    genderVisible: true,
    interestedIn: null,
    dob: { day: "", month: "", year: "" },
    interests: [],
    photos: [],
  });

  const step: Step = STEPS[stepIndex];

  function stepIsValid(): boolean {
    if (step === "orientation") return state.orientation.length > 0;
    if (step === "lookingFor") return !!state.lookingFor;
    if (step === "name") return state.name.trim().length >= 2;
    if (step === "gender") return !!state.gender;
    if (step === "interestedIn") return !!state.interestedIn;
    if (step === "birthday") {
      const { day, month, year } = state.dob;
      if (!day || !month || !year || year.length < 4) return false;
      const age = new Date().getFullYear() - parseInt(year, 10);
      return age >= MIN_AGE;
    }
    if (step === "interests") return true;
    if (step === "photos") return state.photos.length >= 2;
    return true;
  }

  async function nextStep() {
    if (!stepIsValid()) return;
    buzz(12);
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      await finishOnboarding();
    }
  }

  function prevStep() {
    if (stepIndex > 0) {
      buzz();
      setStepIndex((i) => i - 1);
    }
  }

  function selectOrientation(o: string) {
    buzz();
    setState((s) => ({ ...s, orientation: toggleValue(s.orientation, o, MAX_ORIENTATIONS) }));
  }

  function calculateAge(dob: DobState): number | null {
    const day = parseInt(dob.day, 10);
    const month = parseInt(dob.month, 10);
    const year = parseInt(dob.year, 10);
    if (!day || !month || !year) return null;
    const today = new Date();
    const birthDate = new Date(year, month - 1, day);
    let age = today.getFullYear() - birthDate.getFullYear();
    const hasHadBirthdayThisYear =
      today.getMonth() > birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
    if (!hasHadBirthdayThisYear) age--;
    return age;
  }

  async function finishOnboarding() {
    setSaving(true);
    setSaveError("");
    try {
      // Backend's `orientation` column is a single string, not an array.
      // The wizard UI allows selecting up to 3 for future-proofing; only
      // the first pick is persisted for now.
      await api.patch("/profiles/me", {
        displayName: state.name.trim(),
        orientation: state.orientation[0] ?? null,
        orientationVisible: state.orientationVisible,
        relationshipStructure: state.lookingFor,
        genderIdentity: state.gender,
        genderVisible: state.genderVisible,
        interestedIn: state.interestedIn ? [state.interestedIn] : [],
        age: calculateAge(state.dob),
        interests: state.interests,
      });
      setFinished(true);
    } catch (err) {
      console.error("Onboarding save failed", err);
      setSaveError("Something went wrong saving your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function triggerPhotoUpload() {
    if (state.photos.length >= MAX_PHOTOS) return;
    fileInputRef.current?.click();
  }

  async function handlePhotoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please select an image file");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Image must be under 5MB");
      e.target.value = "";
      return;
    }
    const formData = new FormData();
    formData.append("photo", file);
    setUploading(true);
    try {
      const res = await api.post("/profiles/photos/upload", formData);
      buzz();
      setState((s) => ({
        ...s,
        photos: Array.isArray(res.data?.photos) ? res.data.photos : [...s.photos, res.data?.url].filter(Boolean),
      }));
    } catch (err) {
      console.error("Photo upload failed", err);
      setPhotoError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function removePhoto(url: string) {
    buzz();
    try {
      const res = await api.delete("/profiles/photos", { data: { url } });
      setState((s) => ({
        ...s,
        photos: Array.isArray(res.data?.photos) ? res.data.photos : s.photos.filter((p) => p !== url),
      }));
    } catch (err) {
      console.error("Remove photo failed", err);
    }
  }

  useEffect(() => {
    if (!finished) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#eab564", "#d9698c", "#5fb3a9", "#f6f1e8"];
    const particles = Array.from({ length: 120 }, () => ({
      x: canvas.width / 2,
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -12 - 4,
      size: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      gravity: 0.35 + Math.random() * 0.1,
    }));
    let frame = 0;
    let raf: number;
    function tick() {
      frame++;
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      particles.forEach((p) => {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = Math.max(0, 1 - frame / 150);
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx!.restore();
      });
      if (frame < 150) raf = requestAnimationFrame(tick);
      else ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
    }
    tick();
    return () => cancelAnimationFrame(raf);
  }, [finished]);

  const showSkip = step === "orientation" || step === "interests";
  const ctaLabel =
    step === "interests" && state.interests.length > 0
      ? `Next (${state.interests.length}/${MAX_INTERESTS})`
      : stepIndex === STEPS.length - 1
      ? "Finish"
      : "Next";

  return (
    <div className="onb-page">
      <div className="onb-bg-mesh">
        <div className="onb-orb onb-orb-1" />
        <div className="onb-orb onb-orb-2" />
        <div className="onb-orb onb-orb-3" />
      </div>
      <div className="onb-grain" />
      {finished && <canvas ref={canvasRef} className="onb-confetti-canvas" />}

      <div className="onb-shell">
        {!finished && (
          <div className="onb-progress-track">
            {STEPS.map((_, i) => (
              <div key={i} className={"onb-progress-seg" + (i <= stepIndex ? " done" : "")}>
                <div className="onb-progress-fill" />
              </div>
            ))}
          </div>
        )}

        <div className="onb-topbar">
          <button
            className={"onb-icon-btn" + (stepIndex === 0 || finished ? " onb-hidden" : "")}
            onClick={prevStep}
            type="button"
          >
            {"\u2039"}
          </button>
          <button
            className={"onb-skip-btn" + (showSkip && !finished ? "" : " onb-display-none")}
            onClick={nextStep}
            type="button"
          >
            Skip
          </button>
        </div>

        <div className="onb-content onb-step-anim" key={finished ? "finish" : step}>
          {finished ? (
            <div className="onb-finish-wrap">
              <div className="onb-finish-ring">
                <CheckIcon />
              </div>
              <p className="onb-eyebrow">all set</p>
              <h1 className="onb-h1">
                Welcome to saanjh,
                <br />
                <em>{state.name || "friend"}.</em>
              </h1>
              <p className="onb-subtext">Your profile is ready. Time to set your visibility dial and start exploring.</p>
            </div>
          ) : (
            <>
              {step === "orientation" && (
                <>
                  <p className="onb-eyebrow">step {stepIndex + 1} of {STEPS.length}</p>
                  <h1 className="onb-h1">Your sexual <em>orientation?</em></h1>
                  <p className="onb-subtext">Select up to 3. This helps us tune who shows up in your feed.</p>
                  <div className="onb-option-list">
                    {ORIENTATIONS.map((o) => (
                      <div
                        key={o}
                        className={"onb-option-row" + (state.orientation.includes(o) ? " selected" : "")}
                        onClick={() => selectOrientation(o)}
                      >
                        <span className="onb-label">{o}</span>
                        <span className="onb-check"><CheckIcon /></span>
                      </div>
                    ))}
                  </div>
                  <div
                    className={"onb-checkbox-row" + (state.orientationVisible ? " checked" : "")}
                    onClick={() => {
                      buzz();
                      setState((s) => ({ ...s, orientationVisible: !s.orientationVisible }));
                    }}
                  >
                    <span className="onb-box"><CheckIcon /></span>
                    <span>Show my orientation on my profile</span>
                  </div>
                </>
              )}

              {step === "lookingFor" && (
                <>
                  <p className="onb-eyebrow">step {stepIndex + 1} of {STEPS.length}</p>
                  <h1 className="onb-h1">What are you <em>looking for?</em></h1>
                  <p className="onb-subtext">All good if it changes. There's something for everyone.</p>
                  <div className="onb-card-grid">
                    {LOOKING_FOR.map((o) => (
                      <div
                        key={o.key}
                        className={"onb-grid-card" + (state.lookingFor === o.key ? " selected" : "")}
                        onClick={() => {
                          buzz();
                          setState((s) => ({ ...s, lookingFor: o.key }));
                        }}
                      >
                        <span className="onb-emoji">{o.emoji}</span>
                        <span>{o.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {step === "name" && (
                <>
                  <p className="onb-eyebrow">step {stepIndex + 1} of {STEPS.length}</p>
                  <h1 className="onb-h1">What's your <em>first name?</em></h1>
                  <input
                    type="text"
                    value={state.name}
                    placeholder="e.g. Amit"
                    onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                  />
                  <p className="onb-helper">This is how it'll appear on your profile. <strong>Can't change it later.</strong></p>
                </>
              )}

              {step === "gender" && (
                <>
                  <p className="onb-eyebrow">step {stepIndex + 1} of {STEPS.length}</p>
                  <h1 className="onb-h1">What's your <em>gender?</em></h1>
                  <div className="onb-pill-list">
                    {GENDERS.map((g) => (
                      <div
                        key={g}
                        className={"onb-pill" + (state.gender === g ? " selected" : "")}
                        onClick={() => {
                          buzz();
                          setState((s) => ({ ...s, gender: g }));
                        }}
                      >
                        {g}
                      </div>
                    ))}
                  </div>
                  <div
                    className={"onb-checkbox-row" + (state.genderVisible ? " checked" : "")}
                    onClick={() => {
                      buzz();
                      setState((s) => ({ ...s, genderVisible: !s.genderVisible }));
                    }}
                  >
                    <span className="onb-box"><CheckIcon /></span>
                    <span>Show my gender on my profile</span>
                  </div>
                </>
              )}

              {step === "interestedIn" && (
                <>
                  <p className="onb-eyebrow">step {stepIndex + 1} of {STEPS.length}</p>
                  <h1 className="onb-h1">Who are you <em>interested in?</em></h1>
                  <div className="onb-pill-list">
                    {INTERESTED_IN.map((o) => (
                      <div
                        key={o}
                        className={"onb-pill" + (state.interestedIn === o ? " selected" : "")}
                        onClick={() => {
                          buzz();
                          setState((s) => ({ ...s, interestedIn: o }));
                        }}
                      >
                        {o}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {step === "birthday" && (
                <>
                  <p className="onb-eyebrow">step {stepIndex + 1} of {STEPS.length}</p>
                  <h1 className="onb-h1">Your <em>b-day?</em></h1>
                  <div className="onb-dob-row">
                    <div className="onb-dob-field">
                      <label>Day</label>
                      <input
                        type="number" min={1} max={31} placeholder="DD"
                        value={state.dob.day}
                        onChange={(e) => setState((s) => ({ ...s, dob: { ...s.dob, day: e.target.value } }))}
                      />
                    </div>
                    <div className="onb-dob-field">
                      <label>Month</label>
                      <input
                        type="number" min={1} max={12} placeholder="MM"
                        value={state.dob.month}
                        onChange={(e) => setState((s) => ({ ...s, dob: { ...s.dob, month: e.target.value } }))}
                      />
                    </div>
                    <div className="onb-dob-field">
                      <label>Year</label>
                      <input
                        type="number" min={1940} max={2010} placeholder="YYYY"
                        value={state.dob.year}
                        onChange={(e) => setState((s) => ({ ...s, dob: { ...s.dob, year: e.target.value } }))}
                      />
                    </div>
                  </div>
                  <p className="onb-helper">Your profile shows your age, not your date of birth. You must be 18+ to use saanjh.</p>
                </>
              )}

              {step === "interests" && (
                <>
                  <p className="onb-eyebrow">step {stepIndex + 1} of {STEPS.length}</p>
                  <h1 className="onb-h1">What are you <em>into?</em></h1>
                  <p className="onb-subtext">You like what you like. Now, let everyone know.</p>
                  <div className="onb-chip-cloud">
                    {INTERESTS.map((i) => (
                      <div
                        key={i}
                        className={"onb-chip" + (state.interests.includes(i) ? " selected" : "")}
                        onClick={() => {
                          buzz();
                          setState((s) => ({ ...s, interests: toggleValue(s.interests, i, MAX_INTERESTS) }));
                        }}
                      >
                        {i}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {step === "photos" && (
                <>
                  <p className="onb-eyebrow">step {stepIndex + 1} of {STEPS.length}</p>
                  <h1 className="onb-h1">Add your <em>recent pics</em></h1>
                  <p className="onb-subtext">Upload 2 photos to start. Add 4 or more to make your profile stand out.</p>
                  <div className="onb-photo-grid">
                    {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
                      const url = state.photos[i];
                      return (
                        <div
                          key={i}
                          className={"onb-photo-slot" + (url ? " filled" : "")}
                          onClick={() => (url ? undefined : triggerPhotoUpload())}
                        >
                          {url ? (
                            <>
                              <img src={url} alt="" />
                              <div
                                className="onb-remove-badge"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removePhoto(url);
                                }}
                              >
                                {"\u00D7"}
                              </div>
                            </>
                          ) : (
                            <div className="onb-plus-badge">+</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handlePhotoFile}
                  />
                  {photoError && <p className="onb-error-text">{photoError}</p>}
                  {uploading && <p className="onb-helper">Uploading...</p>}
                  <p className="onb-photo-note">Photos are reviewed for authenticity before your profile goes live. No screenshots or group photos as your main picture.</p>
                </>
              )}
            </>
          )}
        </div>

        <div className={"onb-footer" + (finished ? " onb-display-none" : "")}>
          {saveError && <p className="onb-error-text" style={{ marginBottom: 10 }}>{saveError}</p>}
          <button className="onb-cta" onClick={nextStep} disabled={!stepIsValid() || saving} type="button">
            {saving ? "Saving..." : ctaLabel}
          </button>
        </div>

        {finished && (
          <div className="onb-footer">
            <button className="onb-cta" onClick={() => navigate("/browse")} type="button">
              Start exploring
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
