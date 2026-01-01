import nodemailer from "nodemailer";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function parseBool(v: string) {
  return v === "true" || v === "1" || v.toLowerCase() === "yes";
}

export type SendInvoiceEmailArgs = {
  to: string;
  subject: string;
  text: string;
  pdfBytes: Uint8Array; // pdf-lib output
  filename?: string; // default set below
};

export async function sendInvoiceEmail(args: SendInvoiceEmailArgs) {
  const host = requireEnv("SMTP_HOST");
  const port = Number(requireEnv("SMTP_PORT"));
  const secure = parseBool(requireEnv("SMTP_SECURE"));
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");
  const from = requireEnv("SMTP_FROM");

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const filename = args.filename ?? "rentrig-invoice.pdf";

  await transporter.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    attachments: [
      {
        filename,
        content: Buffer.from(args.pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });
}
