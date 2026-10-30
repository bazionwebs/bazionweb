import { buildWhatsAppLink, SITE_CONTACT } from './contact';

describe('contact config', () => {
  it('uses the official international WhatsApp number without formatting', () => {
    expect(SITE_CONTACT.whatsappNumber).toBe('254721287053');
    expect(SITE_CONTACT.whatsappNumber).not.toContain('+');
    expect(SITE_CONTACT.whatsappNumber).not.toContain(' ');
  });

  it('builds a valid wa.me click-to-chat link', () => {
    expect(buildWhatsAppLink()).toBe('https://wa.me/254721287053');
  });

  it('URL-encodes the prefilled message', () => {
    const href = buildWhatsAppLink("Hello BazionWeb, I'd like a quote & timeline.");
    expect(href.startsWith('https://wa.me/254721287053?text=')).toBe(true);
    expect(href).toContain(encodeURIComponent("Hello BazionWeb, I'd like a quote & timeline."));
    expect(href).not.toContain(' ');
  });

  it('ignores blank prefilled messages', () => {
    expect(buildWhatsAppLink('   ')).toBe('https://wa.me/254721287053');
  });
});
