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
    'Thank you for contacting us. We have received your message and our team will get back to you.',
    'Thank you for shopping with us.',
  ]);
}

export function newsletterConfirmation(): EmailContent {
  return confirmation('Welcome to our newsletter', [
    'Thank you for subscribing!',
    'Your newsletter subscription is confirmed. Look out for store updates, new arrivals, and offers.',
  ]);
}
