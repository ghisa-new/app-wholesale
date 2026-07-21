import nodemailer from "nodemailer";
import { CartItem } from "./types";

interface OrderUser {
  name: string;
  company: string;
  email: string;
  phone: string;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendOrderEmail(
  user: OrderUser,
  items: CartItem[],
  notes: string,
  orderId?: number
) {
  const totalAmount = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${item.productTitle}</td>
        <td style="padding:8px;border:1px solid #ddd;">${item.color}</td>
        <td style="padding:8px;border:1px solid #ddd;font-size:12px;">${
          item.seriDistribution
            ? Object.entries(item.seriDistribution)
                .flatMap(([size, qty]: [string, number]) =>
                  Array(qty).fill(size)
                )
                .join("-")
            : "-"
        } (${
          item.seriDistribution
            ? Object.values(item.seriDistribution).reduce(
                (s: number, q: number) => s + q,
                0
              )
            : 1
        } adet)</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">₺${item.price.toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">₺${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
      <h2 style="color:#111827;">Yeni Toptan Siparis Talebi</h2>

      <h3 style="color:#111827;">Musteri Bilgileri</h3>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
        <tr><td style="padding:6px;font-weight:bold;width:120px;">Ad Soyad:</td><td style="padding:6px;">${user.name}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Firma:</td><td style="padding:6px;">${user.company}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">E-posta:</td><td style="padding:6px;">${user.email}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Telefon:</td><td style="padding:6px;">${user.phone}</td></tr>
      </table>

      <h3 style="color:#111827;">Siparis Detaylari</h3>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
        <thead>
          <tr style="background:#111827;color:#fff;">
            <th style="padding:8px;text-align:left;">Urun</th>
            <th style="padding:8px;text-align:left;">Renk</th>
            <th style="padding:8px;text-align:left;">Bedenler</th>
            <th style="padding:8px;text-align:center;">Seri Adedi</th>
            <th style="padding:8px;text-align:right;">Seri Fiyat</th>
            <th style="padding:8px;text-align:right;">Toplam</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
        <tfoot>
          <tr style="font-weight:bold;">
            <td colspan="5" style="padding:8px;border:1px solid #ddd;text-align:right;">Genel Toplam:</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;">₺${totalAmount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      ${notes ? `<h3 style="color:#111827;">Notlar</h3><p style="background:#f5f5f5;padding:12px;border-radius:4px;">${notes}</p>` : ""}
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.ORDER_RECIPIENT,
    subject: `Toptan Siparis Talebi #${orderId ?? "?"} - ${user.company} - ${user.name}`,
    html,
  });
}

export async function sendResetEmail(to: string, name: string, link: string) {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject: "GHISA Toptan - Sifre Sifirlama",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
        <h2 style="color:#111827;">Sifre Sifirlama</h2>
        <p>Merhaba ${name},</p>
        <p>GHISA toptan portali hesabiniz icin sifre sifirlama talebi aldik.
        Asagidaki baglanti <b>1 saat</b> gecerlidir:</p>
        <p style="margin:24px 0;">
          <a href="${link}" style="background:#111827;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Yeni Sifre Belirle
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px;">Bu talebi siz yapmadiysaniz bu e-postayi yok sayabilirsiniz.</p>
      </div>
    `,
  });
}
