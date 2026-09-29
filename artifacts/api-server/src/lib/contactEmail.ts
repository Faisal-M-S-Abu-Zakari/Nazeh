import { ReplitConnectors } from "@replit/connectors-sdk";

const CONTACT_EMAIL = "zkryfysl@gmail.com";
const SUBJECT = "رسالة جديدة من نموذج التواصل";

type ContactMessage = {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
};

export async function sendContactEmail(contact: ContactMessage): Promise<void> {
  // Use the authorized Gmail identity as From rather than trusting visitor input.
  const connectors = new ReplitConnectors();
  const profileResponse = await connectors.proxy(
    "google-mail",
    "/gmail/v1/users/me/profile",
    { method: "GET" },
  );
  if (!profileResponse.ok) {
    throw new Error(`Gmail profile unavailable (${profileResponse.status})`);
  }
  const profile = (await profileResponse.json()) as { emailAddress?: unknown };
  const sender = profile.emailAddress;
  if (typeof sender !== "string" || !/^[^\s<>@\r\n]+@[^\s<>@\r\n]+$/.test(sender)) {
    throw new Error("Gmail sender address unavailable");
  }

  const text = [
    `الاسم: ${contact.name}`,
    `البريد الإلكتروني: ${contact.email}`,
    `رقم الجوال: ${contact.phone || "غير مذكور"}`,
    "",
    "الرسالة:",
    contact.message,
  ].join("\n");
  const encodedSubject = `=?UTF-8?B?${Buffer.from(SUBJECT).toString("base64")}?=`;
  const replyTo = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(contact.email)
    ? `Reply-To: ${contact.email}\r\n`
    : "";
  const mime = [
    `From: ${sender}`,
    `To: ${CONTACT_EMAIL}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    `${replyTo}X-Contact-Form: al-aqsa-camp`,
    "",
    Buffer.from(text).toString("base64"),
  ].join("\r\n");
  const response = await connectors.proxy(
    "google-mail",
    "/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(mime).toString("base64url") }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gmail send failed (${response.status})`);
  }
}