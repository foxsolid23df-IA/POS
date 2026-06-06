import { describe, expect, it } from 'vitest';
import { generateTicketHtml } from '../ticketFormatter';

describe('ticketFormatter', () => {
  it('escapa datos dinámicos antes de generar HTML de ticket', () => {
    const html = generateTicketHtml(
      {
        id: '1',
        total: 10,
        items: [
          {
            quantity: 1,
            name: '<img src=x onerror=alert(1)>',
            price: 10
          }
        ]
      },
      {
        business_name: '<script>alert(1)</script>',
        footer_message: '<b>gracias</b>',
        show_billing_section: false
      },
      { full_name: '<span>cajero</span>' }
    );

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<span>cajero</span>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;span&gt;cajero&lt;/span&gt;');
  });

  it('omite imagenes remotas en modo de impresion rapida', () => {
    const html = generateTicketHtml(
      {
        id: '99',
        total: 25,
        pin_facturacion: '1234',
        items: [{ quantity: 1, name: 'Producto', price: 25 }]
      },
      {
        business_name: 'Tienda',
        logo_url: 'https://example.com/logo.png',
        show_billing_section: true
      },
      { full_name: 'Cajero' },
      { fastPrint: true }
    );

    expect(html).not.toContain('https://example.com/logo.png');
    expect(html).not.toContain('api.qrserver.com');
    expect(html).toContain('1234');
  });
});
