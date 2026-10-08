/** `sensitive`: the content carries a secret (a confirmation code), so a log-only provider must not write it out. */
export type EmailContent = { subject: string; html: string; text: string; sensitive?: boolean };
