// Sends transactional email via Resend's HTTP API.
// Requires RESEND_API_KEY and EMAIL_FROM environment variables.

export async function sendOtpEmail(to: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn("⚠️ RESEND_API_KEY or EMAIL_FROM not set — logging OTP instead of emailing it.");
    console.log(`OTP for ${to}: ${code}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Your Buddies Pride verification code",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Verify your email</h2>
          <p>Your Buddies Pride verification code is:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${code}</p>
          <p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}

// Sends the OTP used for the "forgot password" flow.
// Kept separate from sendOtpEmail so the subject/copy is unambiguous —
// users shouldn't confuse a signup-verification email with a password-reset email.
export async function sendPasswordResetOtpEmail(to: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn("⚠️ RESEND_API_KEY or EMAIL_FROM not set — logging OTP instead of emailing it.");
    console.log(`Password reset OTP for ${to}: ${code}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Reset your Buddies Pride password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Reset your password</h2>
          <p>We received a request to reset your Buddies Pride password. Use this code:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${code}</p>
          <p>This code expires in 10 minutes. If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}
