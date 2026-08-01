import { useEffect, useState, useRef } from "react";
import type { FormEvent, ChangeEvent } from "react";
import api from "../api/client";
import TabBar from "../components/TabBar";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface Prompt {
  question: string;
  answer: string;
}

interface ProfileData {
  display_name: string;
  preferred_name: string | null;
  bio: string | null;
  orientation: string;
  gender_identity: string | null;
  pronouns: string | null;
  beyond_binary: boolean;
  identity_tags: string[];
  city: string | null;
  incognito_mode: boolean;
  photos: string[];
  age: number | null;
  dating_intentions: string | null;
  relationship_structure: string | null;
  interested_in: string[];
  age_pref_min: number | null;
  age_pref_max: number | null;
  distance_pref_km: number | null;
  interests: string[];
  height_cm: number | null;
  smoking: string | null;
  drinking: string | null;
  drug_friendly: string | null;
  kids: string | null;
  religion: string | null;
  star_sign: string | null;
  education: string | null;
  occupation: string | null;
  languages: string[];
  hometown: string | null;
  prompts: Prompt[] | null;
  location_blur: boolean;
  community_tags: string[];
}

const MAX_PHOTOS = 6;
type Tab = "photos" | "identity" | "preferences" | "lifestyle" | "about";

const GENDER_OPTIONS = [
  "Man", "Woman", "Non-binary", "Trans man", "Trans woman", "Genderqueer",
  "Genderfluid", "Agender", "Bigender", "Two-Spirit", "Intersex", "Questioning", "Other",
];
const ORIENTATION_OPTIONS = [
  "Gay", "Lesbian", "Bisexual", "Pansexual", "Asexual", "Aromantic",
  "Queer", "Demisexual", "Questioning", "Straight", "Other",
];
const IDENTITY_TAG_OPTIONS = [
  "Top", "Bottom", "Switch", "Bear", "Otter", "Twink", "Cub", "Daddy",
  "Butch", "Femme", "Stud", "Andro", "Stone", "Soft", "Hard",
];
const RELATIONSHIP_STRUCTURES = [
  "Monogamous", "Open", "Polyamorous", "Ethically non-monogamous",
  "Solo poly", "Figuring it out", "Prefer not to say",
];
const LOOKING_FOR_OPTIONS = [
  "Casual", "Long-term", "Friendship", "Marriage", "Non-monogamous", "Not sure yet",
];
const INTEREST_OPTIONS = [
  "Music", "Travel", "Fitness/Gym", "Art", "Gaming", "Movies/TV", "Reading",
  "Cooking", "Outdoors/Hiking", "Pets", "Yoga/Meditation", "Photography",
  "Dancing", "Activism/Community organizing", "Sports",
];
const YES_NO_SOMETIMES = ["Yes", "No", "Sometimes", "Prefer not to say"];
const DRUG_OPTIONS = ["Yes", "No", "420-friendly", "Prefer not to say"];
const KIDS_OPTIONS = [
  "Have kids", "Want kids", "Don't want kids", "Open to it", "Prefer not to say",
];
const LANGUAGE_OPTIONS = [
  "English", "Hindi", "Spanish", "French", "German", "Mandarin", "Other",
];
const PROMPT_QUESTIONS = [
  "A perfect weekend looks like...",
  "Something I'm proud of...",
  "My love language is...",
  "You should message me if...",
  "Two truths and a lie...",
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const fieldStyle: React.CSSProperties = { marginBottom: 14 };
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, fontSize: 14 };
const chipRowStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };

function Chip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: active ? "1px solid var(--accent, #a78bfa)" : "1px solid var(--text-muted)",
        background: active ? "var(--accent, #a78bfa)" : "transparent",
        color: active ? "#fff" : "var(--text-muted)",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export default function Profile() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tab, setTab] = useState<Tab>("photos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get("/profiles/me")
      .then((res) =>
        setProfile({
          identity_tags: [], interested_in: [], interests: [], languages: [],
          community_tags: [], prompts: [], beyond_binary: false, location_blur: false,
          ...res.data,
        })
      )
      .catch((err) => console.error("Failed to load profile", err))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  function setPrompt(index: number, patch: Partial<Prompt>) {
    if (!profile) return;
    const prompts = [...(profile.prompts || [])];
    while (prompts.length <= index) prompts.push({ question: PROMPT_QUESTIONS[prompts.length], answer: "" });
    prompts[index] = { ...prompts[index], ...patch };
    set("prompts", prompts);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.patch("/profiles/me", {
        displayName: profile.display_name,
        preferredName: profile.preferred_name || undefined,
        bio: profile.bio,
        orientation: profile.orientation,
        genderIdentity: profile.gender_identity || undefined,
        pronouns: profile.pronouns,
        beyondBinary: profile.beyond_binary,
        identityTags: profile.identity_tags,
        city: profile.city,
        incognitoMode: profile.incognito_mode,
        datingIntentions: profile.dating_intentions || undefined,
        relationshipStructure: profile.relationship_structure || undefined,
        interestedIn: profile.interested_in,
        agePrefMin: profile.age_pref_min || undefined,
        agePrefMax: profile.age_pref_max || undefined,
        distancePrefKm: profile.distance_pref_km || undefined,
        interests: profile.interests,
        heightCm: profile.height_cm || undefined,
        smoking: profile.smoking || undefined,
        drinking: profile.drinking || undefined,
        drugFriendly: profile.drug_friendly || undefined,
        kids: profile.kids || undefined,
        religion: profile.religion || undefined,
        starSign: profile.star_sign || undefined,
        education: profile.education || undefined,
        occupation: profile.occupation || undefined,
        languages: profile.languages,
        hometown: profile.hometown || undefined,
        prompts: (profile.prompts || []).filter((p) => p.answer?.trim()),
        locationBlur: profile.location_blur,
        communityTags: profile.community_tags,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save profile", err);
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setPhotoError("");
    if (profile.photos.length >= MAX_PHOTOS) {
      setPhotoError(`Maximum ${MAX_PHOTOS} photos allowed`);
      e.target.value = "";
      return;
    }
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
      setProfile((p) => (p ? { ...p, ...res.data } : p));
    } catch (err) {
      console.error("Photo upload failed", err);
      setPhotoError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeletePhoto(url: string) {
    if (!profile) return;
    try {
      const res = await api.delete("/profiles/photos", { data: { url } });
      setProfile((p) => (p ? { ...p, ...res.data } : p));
    } catch (err) {
      console.error("Failed to delete photo", err);
      setPhotoError("Could not delete photo. Please try again.");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (loading) {
    return (
      <div className="container">
        <p style={{ color: "var(--text-muted)" }}>Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container">
        <p style={{ color: "var(--text-muted)" }}>Could not load your profile.</p>
        <TabBar active="profile" />
      </div>
    );
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "photos", label: "Photos" },
    { id: "identity", label: "Identity" },
    { id: "preferences", label: "Preferences" },
    { id: "lifestyle", label: "Lifestyle" },
    { id: "about", label: "About" },
  ];

  return (
    <div className="container">
      <div style={{ margin: "24px 0 16px", textAlign: "center" }}>
        <div className="brand">Your Profile</div>
      </div>

      <div className="profile-preview-card">
        <div className="swipe-photo-wrap profile-preview-photo">
          {profile.photos && profile.photos.length > 0 ? (
            <img src={profile.photos[0]} alt={profile.display_name} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-hover)" }}>
              <div className="avatar" style={{ width: 96, height: 96, fontSize: 36 }}>
                {profile.display_name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          <div className="swipe-overlay">
            <div className="swipe-name">
              {profile.display_name}{" "}
              {profile.pronouns && (
                <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 400, fontSize: 16 }}>
                  ({profile.pronouns})
                </span>
              )}
            </div>
            <div className="swipe-tags">
              {profile.orientation && <span className="tag">{profile.orientation}</span>}
              {profile.city && <span className="tag">{profile.city}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={"profile-tab" + (tab === t.id ? " active" : "")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave}>
        {tab === "photos" && (
          <div className="card" style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 10 }}>
              Photos ({profile.photos.length}/{MAX_PHOTOS})
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              {profile.photos.map((url) => (
                <div key={url} style={{ position: "relative" }}>
                  <img
                    src={url}
                    alt="Profile"
                    style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 8 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(url)}
                    style={{
                      position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)",
                      color: "#fff", border: "none", borderRadius: "50%", width: 24, height: 24,
                      cursor: "pointer", lineHeight: 1,
                    }}
                    aria-label="Delete photo"
                  >
                    &times;
                  </button>
                </div>
              ))}
              {profile.photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    aspectRatio: "1 / 1", border: "2px dashed var(--text-muted)", borderRadius: 8,
                    background: "transparent", color: "var(--text-muted)",
                    cursor: uploading ? "not-allowed" : "pointer", fontSize: 24,
                  }}
                >
                  {uploading ? "..." : "+"}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              style={{ display: "none" }}
            />
            {photoError && <p style={{ color: "#f87171", fontSize: 13, marginTop: 4 }}>{photoError}</p>}
          </div>
        )}

        {tab === "identity" && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Display name</label>
              <input value={profile.display_name} onChange={(e) => set("display_name", e.target.value)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Preferred / chosen name</label>
              <input value={profile.preferred_name || ""} onChange={(e) => set("preferred_name", e.target.value)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Gender identity</label>
              <select value={profile.gender_identity || ""} onChange={(e) => set("gender_identity", e.target.value)}>
                <option value="">Select...</option>
                {GENDER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <input
                type="checkbox"
                id="beyondBinary"
                checked={profile.beyond_binary}
                onChange={(e) => set("beyond_binary", e.target.checked)}
              />
              <label htmlFor="beyondBinary" style={{ fontSize: 14, color: "var(--text-muted)" }}>
                Beyond Binary (don't specify Man/Woman)
              </label>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Sexual orientation</label>
              <select value={profile.orientation || ""} onChange={(e) => set("orientation", e.target.value)}>
                <option value="">Select...</option>
                {ORIENTATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Pronouns</label>
              <input
                value={profile.pronouns || ""}
                onChange={(e) => set("pronouns", e.target.value)}
                placeholder="e.g. they/them"
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Identity tags</label>
              <div style={chipRowStyle}>
                {IDENTITY_TAG_OPTIONS.map((tg) => (
                  <Chip
                    key={tg}
                    label={tg}
                    active={profile.identity_tags.includes(tg)}
                    onClick={() => set("identity_tags", toggle(profile.identity_tags, tg))}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "preferences" && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Relationship structure</label>
              <select
                value={profile.relationship_structure || ""}
                onChange={(e) => set("relationship_structure", e.target.value)}
              >
                <option value="">Select...</option>
                {RELATIONSHIP_STRUCTURES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Looking for</label>
              <select
                value={profile.dating_intentions || ""}
                onChange={(e) => set("dating_intentions", e.target.value)}
              >
                <option value="">Select...</option>
                {LOOKING_FOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Interested in</label>
              <div style={chipRowStyle}>
                {GENDER_OPTIONS.map((g) => (
                  <Chip
                    key={g}
                    label={g}
                    active={profile.interested_in.includes(g)}
                    onClick={() => set("interested_in", toggle(profile.interested_in, g))}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, ...fieldStyle }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Age min</label>
                <input
                  type="number"
                  value={profile.age_pref_min ?? ""}
                  onChange={(e) => set("age_pref_min", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Age max</label>
                <input
                  type="number"
                  value={profile.age_pref_max ?? ""}
                  onChange={(e) => set("age_pref_max", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Max distance (km)</label>
              <input
                type="number"
                value={profile.distance_pref_km ?? ""}
                onChange={(e) => set("distance_pref_km", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>
        )}

        {tab === "lifestyle" && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Interests</label>
              <div style={chipRowStyle}>
                {INTEREST_OPTIONS.map((i) => (
                  <Chip
                    key={i}
                    label={i}
                    active={profile.interests.includes(i)}
                    onClick={() => set("interests", toggle(profile.interests, i))}
                  />
                ))}
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Height (cm)</label>
              <input
                type="number"
                value={profile.height_cm ?? ""}
                onChange={(e) => set("height_cm", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Smoking</label>
              <select value={profile.smoking || ""} onChange={(e) => set("smoking", e.target.value)}>
                <option value="">Select...</option>
                {YES_NO_SOMETIMES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Drinking</label>
              <select value={profile.drinking || ""} onChange={(e) => set("drinking", e.target.value)}>
                <option value="">Select...</option>
                {YES_NO_SOMETIMES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>420-friendly</label>
              <select value={profile.drug_friendly || ""} onChange={(e) => set("drug_friendly", e.target.value)}>
                <option value="">Select...</option>
                {DRUG_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Kids</label>
              <select value={profile.kids || ""} onChange={(e) => set("kids", e.target.value)}>
                <option value="">Select...</option>
                {KIDS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Religion / Spirituality (optional)</label>
              <input value={profile.religion || ""} onChange={(e) => set("religion", e.target.value)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Star sign (optional)</label>
              <input value={profile.star_sign || ""} onChange={(e) => set("star_sign", e.target.value)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Education (optional)</label>
              <input value={profile.education || ""} onChange={(e) => set("education", e.target.value)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Occupation (optional)</label>
              <input value={profile.occupation || ""} onChange={(e) => set("occupation", e.target.value)} />
            </div>
          </div>
        )}

        {tab === "about" && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>City</label>
              <input value={profile.city || ""} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Hometown (optional)</label>
              <input value={profile.hometown || ""} onChange={(e) => set("hometown", e.target.value)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Languages spoken</label>
              <div style={chipRowStyle}>
                {LANGUAGE_OPTIONS.map((l) => (
                  <Chip
                    key={l}
                    label={l}
                    active={profile.languages.includes(l)}
                    onClick={() => set("languages", toggle(profile.languages, l))}
                  />
                ))}
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Bio</label>
              <textarea rows={4} value={profile.bio || ""} onChange={(e) => set("bio", e.target.value)} />
            </div>

            <label style={{ ...labelStyle, marginTop: 8 }}>Prompts (up to 3)</label>
            {[0, 1, 2].map((idx) => {
              const p = (profile.prompts || [])[idx] || { question: PROMPT_QUESTIONS[idx], answer: "" };
              return (
                <div key={idx} style={fieldStyle}>
                  <select value={p.question} onChange={(e) => setPrompt(idx, { question: e.target.value })}>
                    {PROMPT_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={p.answer}
                    onChange={(e) => setPrompt(idx, { answer: e.target.value })}
                    style={{ marginTop: 6 }}
                  />
                </div>
              );
            })}

            <div style={fieldStyle}>
              <label style={labelStyle}>Community tags</label>
              <input
                value={profile.community_tags.join(", ")}
                onChange={(e) =>
                  set("community_tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                }
                placeholder="e.g. Ally, Part of LGBTQ+ community since 2015"
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <input
                type="checkbox"
                id="incognito"
                checked={profile.incognito_mode}
                onChange={(e) => set("incognito_mode", e.target.checked)}
              />
              <label htmlFor="incognito" style={{ fontSize: 14, color: "var(--text-muted)" }}>
                Incognito mode (hide my profile from Discover)
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <input
                type="checkbox"
                id="locationBlur"
                checked={profile.location_blur}
                onChange={(e) => set("location_blur", e.target.checked)}
              />
              <label htmlFor="locationBlur" style={{ fontSize: 14, color: "var(--text-muted)" }}>
                Blur my exact distance from others
              </label>
            </div>
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : saved ? "Saved \u2713" : "Save changes"}
        </button>
      </form>

      <button className="btn btn-secondary" style={{ marginTop: 16 }} type="button" onClick={handleLogout}>
        Log out
      </button>

      <TabBar active="profile" />
    </div>
  );
}
