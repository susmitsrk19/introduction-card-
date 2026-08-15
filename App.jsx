import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Phone,
  Mail,
  Globe,
  MessageCircle,
  Instagram,
  Linkedin,
  Download,
  Copy,
  Check,
  Sparkles,
  Camera,
} from "lucide-react";

const BG = "#14161A";
const CARD_TOP = "#1D2229";
const CARD_BOTTOM = "#0E1013";
const GOLD = "#D4AF6A";
const ICE = "#7FD9D4";
const CREAM = "#F3F1EA";
const MUTED = "#9A9690";
const PANEL = "#1B1E24";
const LINE = "#2A2E36";
const CORAL_ERR = "#E07856";

const displayFont = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
const uiFont = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "?";
}

// Escape special vCard characters so a crafted value (e.g. containing
// newlines, semicolons, or backslashes) can't break the exported file
// or inject extra vCard fields.
function escapeVCard(str) {
  return String(str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

const MAX_FIELD_LENGTH = 120;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB raw upload cap, before resize

function buildVCard(d) {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(d.name)}`,
    `TITLE:${escapeVCard(d.title)}`,
    `ORG:${escapeVCard(d.company)}`,
    d.phone ? `TEL;TYPE=CELL:${escapeVCard(d.phone)}` : "",
    d.email ? `EMAIL:${escapeVCard(d.email)}` : "",
    d.website ? `URL:${escapeVCard(d.website)}` : "",
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\n");
}

const FIELDS = [
  { key: "name", label: "Full name", placeholder: "e.g. Priya Sharma" },
  { key: "title", label: "Title / role", placeholder: "e.g. Freelance Designer" },
  { key: "company", label: "Company (optional)", placeholder: "e.g. Studio Petal" },
  { key: "phone", label: "Phone", placeholder: "+91 98765 43210" },
  { key: "email", label: "Email", placeholder: "you@email.com" },
  { key: "whatsapp", label: "WhatsApp (optional)", placeholder: "+91 98765 43210" },
  { key: "instagram", label: "Instagram (optional)", placeholder: "@yourhandle" },
  { key: "linkedin", label: "LinkedIn (optional)", placeholder: "linkedin.com/in/you" },
  { key: "website", label: "Website (optional)", placeholder: "yoursite.com" },
];

export default function DigitalCard() {
  const [data, setData] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [entered, setEntered] = useState(false);
  const [burst, setBurst] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const cardRef = useRef(null);
  const fileInputRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("card-data");
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          // Only trust a plain object shape; ignore anything malformed.
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            setData(parsed);
          }
        }
      } catch (e) {}
      finally {
        setLoaded(true);
        setTimeout(() => setEntered(true), 80);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set("card-data", JSON.stringify(data)).catch(() => {});
  }, [data, loaded]);

  function set(key, value) {
    setData((d) => ({ ...d, [key]: String(value).slice(0, MAX_FIELD_LENGTH) }));
  }

  function handlePhotoPick() {
    fileInputRef.current?.click();
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset input so the same file can be re-picked later
    if (!file) return;

    // Reject anything that isn't actually an image, and cap size before
    // we ever touch it — avoids processing huge or spoofed files.
    if (!file.type || !file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file.");
      setTimeout(() => setPhotoError(""), 2500);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("That image is too large (max 8MB).");
      setTimeout(() => setPhotoError(""), 2500);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setPhotoError("Couldn't read that image — try another.");
      setTimeout(() => setPhotoError(""), 2500);
    };
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => {
        setPhotoError("That file isn't a valid image.");
        setTimeout(() => setPhotoError(""), 2500);
      };
      img.onload = () => {
        const size = 240;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        // Re-encoding through canvas strips any embedded scripts/metadata
        // from the original file — only pixel data survives.
        set("photo", canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function handleMouseMove(e) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -8, y: px * 10 });
  }
  function handleMouseLeave() {
    setTilt({ x: 0, y: 0 });
  }

  function downloadCard() {
    const blob = new Blob([buildVCard(data)], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.name || "contact").replace(/\s+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
    setBurst(true);
    setTimeout(() => setBurst(false), 900);
  }

  function copyLink() {
    const text = `${data.name || ""} — ${data.title || ""}\n${data.phone || ""}\n${data.email || ""}`;
    try {
      navigator.clipboard?.writeText(text);
    } catch (e) {
      // Clipboard API can be blocked by the browser; fail silently and
      // let the user copy manually rather than throwing.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const socials = useMemo(() => {
    const s = [];
    if (data.whatsapp) s.push({ icon: MessageCircle, color: "#3FBF63", key: "whatsapp" });
    if (data.instagram) s.push({ icon: Instagram, color: "#D6558C", key: "instagram" });
    if (data.linkedin) s.push({ icon: Linkedin, color: "#4C8FD9", key: "linkedin" });
    if (data.website) s.push({ icon: Globe, color: ICE, key: "website" });
    return s;
  }, [data]);

  const hasName = !!(data.name && data.name.trim());

  return (
    <div
      style={{
        background: BG,
        minHeight: "100%",
        fontFamily: uiFont,
        color: CREAM,
        padding: "34px 16px 60px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        .dc-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(70px);
          opacity: 0.35;
          animation: dc-float 14s ease-in-out infinite;
        }
        @keyframes dc-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -20px) scale(1.08); }
        }
        .dc-input {
          width: 100%;
          padding: 11px 13px;
          border: 1.5px solid ${LINE};
          border-radius: 9px;
          background: ${PANEL};
          font-family: ${uiFont};
          font-size: 14.5px;
          color: ${CREAM};
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .dc-input::placeholder { color: #5A5850; }
        .dc-input:focus { border-color: ${GOLD}; box-shadow: 0 0 0 3px rgba(212,175,106,0.15); }
        .dc-card-wrap {
          perspective: 1000px;
        }
        .dc-card {
          position: relative;
          border-radius: 20px;
          background: linear-gradient(155deg, ${CARD_TOP}, ${CARD_BOTTOM});
          border: 1px solid rgba(212,175,106,0.25);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset;
          padding: 32px 28px;
          overflow: hidden;
          transition: transform 0.15s ease-out;
          transform-style: preserve-3d;
        }
        .dc-shine {
          position: absolute;
          inset: -50%;
          background: linear-gradient(115deg, transparent 40%, rgba(212,175,106,0.16) 48%, rgba(255,255,255,0.25) 50%, rgba(212,175,106,0.16) 52%, transparent 60%);
          animation: dc-sweep 5s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes dc-sweep {
          0% { transform: translateX(-30%) translateY(-10%); }
          50% { transform: translateX(20%) translateY(10%); }
          100% { transform: translateX(-30%) translateY(-10%); }
        }
        .dc-avatar {
          width: 68px;
          height: 68px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${GOLD}, #8A6A2E);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: ${displayFont};
          font-size: 24px;
          font-weight: 700;
          color: #14161A;
          position: relative;
          animation: dc-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          cursor: pointer;
          overflow: hidden;
          flex-shrink: 0;
        }
        .dc-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .dc-avatar-overlay {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: rgba(20,22,26,0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .dc-avatar:hover .dc-avatar-overlay { opacity: 1; }
        .dc-avatar::after {
          content: '';
          position: absolute;
          inset: -5px;
          border-radius: 50%;
          border: 1.5px solid rgba(212,175,106,0.4);
          animation: dc-ring 2.4s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes dc-ring {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.12); opacity: 0.15; }
        }
        @keyframes dc-pop {
          0% { opacity: 0; transform: scale(0.5) rotate(-8deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        .dc-card-wrap {
          perspective: 1000px;
          animation: dc-sway 7s ease-in-out infinite;
        }
        @keyframes dc-sway {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          50% { transform: rotate(0.6deg) translateY(-4px); }
        }
        .dc-confetti {
          position: absolute;
          left: 50%;
          top: 20%;
          pointer-events: none;
        }
        .dc-confetti span {
          position: absolute;
          font-size: 15px;
          animation: dc-confetti-fall 0.9s ease-out forwards;
        }
        @keyframes dc-confetti-fall {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(0.5) rotate(0deg); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(1) rotate(240deg); }
        }
        .dc-row {
          opacity: 0;
          transform: translateX(-10px);
          animation: dc-slidein 0.5s ease forwards;
        }
        @keyframes dc-slidein {
          to { opacity: 1; transform: translateX(0); }
        }
        .dc-social {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease;
          cursor: pointer;
        }
        .dc-social:hover { transform: translateY(-4px) scale(1.08); }
        .dc-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 13px;
          border-radius: 10px;
          border: none;
          font-size: 14.5px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .dc-btn:hover { transform: translateY(-2px); }
        .dc-btn:active { transform: scale(0.97); }
        .dc-btn.primary { background: linear-gradient(135deg, ${GOLD}, #B8925A); color: #14161A; }
        .dc-btn.primary:hover { box-shadow: 0 8px 20px rgba(212,175,106,0.3); }
        .dc-btn.ghost { background: ${PANEL}; color: ${CREAM}; border: 1px solid ${LINE}; }
        .dc-btn:focus-visible, .dc-input:focus-visible, .dc-social:focus-visible {
          outline: 2px solid ${GOLD};
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .dc-shine, .dc-blob, .dc-avatar::after, .dc-card-wrap { animation: none; }
        }
      `}</style>

      <div className="dc-blob" style={{ width: 320, height: 320, background: GOLD, top: -80, left: -100 }} />
      <div className="dc-blob" style={{ width: 260, height: 260, background: ICE, bottom: -60, right: -60, animationDelay: "3s" }} />

      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 28,
        }}
        className="dc-grid"
      >
        <style>{`
          @media (min-width: 860px) {
            .dc-grid { grid-template-columns: 1fr 360px !important; align-items: start; }
          }
        `}</style>

        <header style={{ gridColumn: "1 / -1", textAlign: "center", marginBottom: 4 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: displayFont,
              fontSize: 28,
              fontStyle: "italic",
              fontWeight: 700,
              color: CREAM,
            }}
          >
            <Sparkles size={20} color={GOLD} />
            Your Digital Card
          </div>
          <div style={{ color: MUTED, fontSize: 14, marginTop: 4 }}>
            Fill it in, watch it come to life, share it anywhere.
          </div>
        </header>

        {/* Form */}
        <section
          style={{
            background: PANEL,
            border: `1px solid ${LINE}`,
            borderRadius: 16,
            padding: 22,
          }}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, marginBottom: 8, letterSpacing: "0.03em" }}>
                PROFILE PHOTO
              </div>
              <div
                onClick={handlePhotoPick}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  border: `1.5px dashed ${LINE}`,
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: data.photo ? "transparent" : "rgba(212,175,106,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {data.photo ? (
                    <img src={data.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Camera size={16} color={GOLD} />
                  )}
                </div>
                <span style={{ fontSize: 13.5, color: MUTED }}>
                  {data.photo ? "Tap to change photo" : "Tap to upload a photo"}
                </span>
              </div>
              {photoError && (
                <div style={{ fontSize: 12, color: CORAL_ERR, marginTop: 6 }}>{photoError}</div>
              )}
            </div>
            {FIELDS.map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, marginBottom: 5, letterSpacing: "0.03em" }}>
                  {f.label.toUpperCase()}
                </div>
                <input
                  className="dc-input"
                  placeholder={f.placeholder}
                  value={data[f.key] || ""}
                  maxLength={MAX_FIELD_LENGTH}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Card preview */}
        <div style={{ position: "sticky", top: 20 }}>
          <div className="dc-card-wrap">
            <div
              ref={cardRef}
              className="dc-card"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                transform: entered
                  ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
                  : "scale(0.9)",
                opacity: entered ? 1 : 0,
                transition: entered
                  ? "transform 0.15s ease-out"
                  : "opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <div className="dc-shine" />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
                  <div className="dc-avatar" onClick={handlePhotoPick} title="Add photo">
                    {data.photo ? (
                      <img src={data.photo} alt="" />
                    ) : (
                      initials(data.name || "")
                    )}
                    <div className="dc-avatar-overlay">
                      <Camera size={18} color={CREAM} />
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handlePhotoChange}
                  />
                  <div>
                    <div
                      className="dc-row"
                      style={{ animationDelay: "0.1s", fontFamily: displayFont, fontSize: 21, fontWeight: 700 }}
                    >
                      {data.name || "Your name"}
                    </div>
                    <div className="dc-row" style={{ animationDelay: "0.18s", fontSize: 13, color: GOLD, marginTop: 2 }}>
                      {data.title || "Your title"}
                    </div>
                    {data.company && (
                      <div className="dc-row" style={{ animationDelay: "0.24s", fontSize: 12, color: MUTED, marginTop: 1 }}>
                        {data.company}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 9, marginBottom: socials.length ? 20 : 4 }}>
                  {data.phone && (
                    <div className="dc-row" style={{ animationDelay: "0.3s", display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                      <Phone size={14} color={ICE} /> {data.phone}
                    </div>
                  )}
                  {data.email && (
                    <div className="dc-row" style={{ animationDelay: "0.36s", display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                      <Mail size={14} color={ICE} /> {data.email}
                    </div>
                  )}
                </div>

                {socials.length > 0 && (
                  <div className="dc-row" style={{ animationDelay: "0.42s", display: "flex", gap: 10 }}>
                    {socials.map((s) => {
                      const Icon = s.icon;
                      return (
                        <div key={s.key} className="dc-social">
                          <Icon size={16} color={s.color} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18, position: "relative" }}>
            {burst && (
              <span className="dc-confetti">
                {["🎉", "✨", "⭐", "🎊", "✨", "⭐"].map((s, i) => {
                  const angle = (i / 6) * Math.PI * 2;
                  const dist = 50;
                  return (
                    <span
                      key={i}
                      style={{
                        "--tx": `calc(-50% + ${Math.cos(angle) * dist}px)`,
                        "--ty": `calc(-50% + ${Math.sin(angle) * dist - 20}px)`,
                        animationDelay: `${i * 0.03}s`,
                      }}
                    >
                      {s}
                    </span>
                  );
                })}
              </span>
            )}
            <button className="dc-btn primary" style={{ flex: 1 }} onClick={downloadCard} disabled={!hasName}>
              <Download size={16} /> Save Contact
            </button>
            <button className="dc-btn ghost" style={{ flex: 1 }} onClick={copyLink} disabled={!hasName}>
              {copied ? <Check size={16} color={GOLD} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy Info"}
            </button>
          </div>
          <div style={{ textAlign: "center", color: MUTED, fontSize: 11.5, marginTop: 14 }}>
            Saved on this device · tilt the card with your cursor
          </div>
        </div>
      </div>
    </div>
  );
}
