let nodemailer = null;
try { nodemailer = require("nodemailer"); } catch (e) { nodemailer = null; }

let transporter = null;

if (nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log("[mailer] SMTP configured:", process.env.SMTP_HOST);
} else {
  console.log("[mailer] SMTP not configured - email codes will print to console");
}

async function sendMail(to, subject, text, html) {
  if (!transporter) {
    console.log("[mailer] ---- WOULD SEND EMAIL ----");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("Body:", text);
    console.log("[mailer] ------------------------");
    return { ok: true, dev: true };
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: to,
      subject: subject,
      text: text,
      html: html || text
    });
    return { ok: true };
  } catch (err) {
    console.error("[mailer] send failed:", err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendMail };