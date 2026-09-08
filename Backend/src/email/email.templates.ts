export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]!));
}

function confirmation(subject: string, paragraphs: string[]): EmailContent {
  return {
    subject,
    text: paragraphs.join('\n\n'),
    html: '<!doctype html><html lang="en"><body>'
      + paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')
      + '</body></html>',
  };
}

export function contactConfirmation(name: string): EmailContent {
  return confirmation('We received your message', [
    `Hello ${name.trim() || 'there'},`,
    'Your message was sent successfully. Our team will get back to you as soon as possible.',
    'Thank you for shopping with us.',
  ]);
}

export function contactNotification(name: string, email: string, message: string): EmailContent {
  const safeName = name.trim();
  const safeEmail = email.trim();
  const safeMessage = message.trim();
  return {
    subject: 'New Contact Us message',
    text: [
      'A new message was submitted through the 3legant Contact Us form.',
      `Name: ${safeName}`,
      `Email: ${safeEmail}`,
      '',
      'Message:',
      safeMessage,
    ].join('\n'),
    html: '<!doctype html><html lang="en"><body>'
      + '<h1>New Contact Us message</h1>'
      + `<p><strong>Name:</strong> ${escapeHtml(safeName)}</p>`
      + `<p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>`
      + `<p><strong>Message:</strong></p><p>${escapeHtml(safeMessage).replace(/\r?\n/g, '<br>')}</p>`
      + '</body></html>',
  };
}

export function newsletterConfirmation(): EmailContent {
  return confirmation('Welcome to our newsletter', [
    'Thank you for subscribing!',
    'Your newsletter subscription is confirmed. Look out for store updates, new arrivals, and offers.',
  ]);
}
