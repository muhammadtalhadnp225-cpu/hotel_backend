import nodemailer, { Transporter } from 'nodemailer';
import { ENV } from '../config/env.js';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
  mock?: boolean;
  provider?: string;
}

export class EmailService {
  private static transporter: Transporter | null = null;

  /**
   * Clears the cached transporter instance (useful on connection errors or config updates)
   */
  public static resetTransporter(): void {
    if (this.transporter) {
      try {
        this.transporter.close();
      } catch (_) {
        // ignore close error
      }
      this.transporter = null;
    }
  }

  /**
   * Initializes or returns the cached Nodemailer SMTP transporter with strict timeouts
   */
  public static getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = (ENV.SMTP_HOST || 'smtp.gmail.com').trim();
    const port = Number(ENV.SMTP_PORT) || 587;
    const user = (ENV.SMTP_USER || ENV.HOTEL_EMAIL || 't02407446@gmail.com').trim();
    const pass = (ENV.SMTP_PASS || '').trim();
    const isGmail = host.toLowerCase().includes('gmail') || user.toLowerCase().endsWith('@gmail.com');

    if (pass && pass.length > 0) {
      if (isGmail) {
        // High-reliability Gmail Transporter with fast connection timeouts (3.5s)
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user,
            pass,
          },
          pool: true,
          maxConnections: 3,
          maxMessages: 100,
          rateLimit: 14,
          connectionTimeout: 4000,
          greetingTimeout: 4000,
          socketTimeout: 5000,
          tls: {
            rejectUnauthorized: false,
          },
        });
        console.log(`[EmailService] Initialized Gmail SMTP Pool for [${user}] (timeout: 4s)`);
      } else {
        // Generic Custom SMTP Transporter
        const secure = port === 465 || ENV.SMTP_SECURE === true;
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
            user,
            pass,
          },
          pool: true,
          maxConnections: 3,
          maxMessages: 100,
          connectionTimeout: 4000,
          greetingTimeout: 4000,
          socketTimeout: 5000,
          tls: {
            rejectUnauthorized: false,
          },
        });
        console.log(`[EmailService] Initialized SMTP Transporter for [${user}] on ${host}:${port} (secure: ${secure})`);
      }
    } else {
      // Development / Fallback mode: Logs email to console & simulates instant delivery
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'windows',
        buffer: true,
      });
      console.log(
        `[EmailService] Notice: SMTP_PASS not set. Running in Stream Mode. Real emails will dispatch as soon as SMTP_PASS is provided in backend/.env.`
      );
    }

    return this.transporter;
  }

  /**
   * Verifies SMTP connection health and returns status
   */
  public static async verifyTransporter(): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const transporter = this.getTransporter();
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SMTP connection timed out after 4000ms. Cloud network might block raw SMTP sockets.')), 4000)
      );
      await Promise.race([verifyPromise, timeoutPromise]);
      const user = ENV.SMTP_USER || ENV.HOTEL_EMAIL || 't02407446@gmail.com';
      console.log(`[EmailService] ✅ SMTP Transporter verified and connected successfully for [${user}]`);
      return {
        success: true,
        message: `SMTP Transporter verified successfully for [${user}].`,
      };
    } catch (error: any) {
      console.warn('[EmailService] ⚠️ SMTP Verification Notice:', error.message);
      return {
        success: false,
        message: 'SMTP Verification Notice: Cloud network or socket timed out',
        error: error.message,
      };
    }
  }

  /**
   * Dispatches automated VIP welcome email upon new user / patron account creation
   */
  static async sendWelcomeEmail(user: any): Promise<EmailSendResult> {
    const rawUser = user && typeof user.toObject === 'function' ? user.toObject() : (user || {});
    const toEmail = rawUser.email || rawUser.guestEmail || rawUser.data?.email || rawUser.username;

    if (!toEmail) {
      console.warn('[EmailService] Skipped welcome email: No recipient email specified.');
      return { success: false, error: 'No recipient email found' };
    }

    const hotelName = ENV.HOTEL_NAME || 'Aethelgard Resort & Sanctuary';
    const portalUrl = ENV.WEBSITE_URL || 'https://hotel-website-pi-five.vercel.app';
    const guestTitle = rawUser.title ? `${rawUser.title} ` : '';
    const guestName = rawUser.firstName
      ? `${guestTitle}${rawUser.firstName} ${rawUser.lastName || ''}`.trim()
      : (rawUser.name || rawUser.fullName || 'Esteemed Patron');

    const rawId = (rawUser.id || rawUser._id || '').toString();
    const memberCode = rawId.length >= 6 ? rawId.slice(-6).toUpperCase() : (rawId ? rawId.toUpperCase() : 'VIP');
    const memberId = `AETH-${memberCode}`;
    const membershipTier = rawUser.membershipTier || 'Patron Circle VIP';
    const senderEmail = ENV.SMTP_USER || ENV.HOTEL_EMAIL || 't02407446@gmail.com';
    const fromAddress = `"${hotelName} Patron Desk" <${senderEmail}>`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${hotelName}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #070708; color: #E4E4E7; margin: 0; padding: 0; }
    .container { max-width: 640px; margin: 30px auto; background-color: #121214; border: 1px solid #27272A; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); }
    .header { background: linear-gradient(135deg, #18181B 0%, #0A0A0B 100%); padding: 40px 30px; text-align: center; border-bottom: 2px solid #C5A059; position: relative; }
    .crown-badge { display: inline-block; width: 44px; height: 44px; line-height: 44px; background: rgba(197,160,89,0.15); border: 1px solid rgba(197,160,89,0.4); border-radius: 50%; color: #DFBA73; font-size: 20px; margin-bottom: 12px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; letter-spacing: 4px; color: #DFBA73; text-transform: uppercase; font-family: Georgia, serif; font-weight: 700; }
    .header p { margin: 8px 0 0 0; font-size: 11px; letter-spacing: 3px; color: #A1A1AA; text-transform: uppercase; }
    .content { padding: 36px 32px; line-height: 1.75; font-size: 14px; color: #D4D4D8; }
    .salutation { font-size: 18px; font-weight: 600; color: #FFFFFF; margin-bottom: 14px; font-family: Georgia, serif; }
    .welcome-intro { font-size: 14px; color: #A1A1AA; line-height: 1.8; margin-bottom: 24px; }
    
    .benefit-item { background-color: #161618; border-left: 3px solid #C5A059; border-radius: 0 10px 10px 0; padding: 14px 18px; margin-bottom: 12px; }
    .benefit-title { font-weight: 600; color: #FFFFFF; font-size: 13px; margin-bottom: 3px; }
    .benefit-desc { font-size: 12px; color: #A1A1AA; line-height: 1.5; margin: 0; }
    
    .cta-container { text-align: center; margin: 32px 0 20px 0; }
    .btn-gold { display: inline-block; background: linear-gradient(135deg, #DFBA73 0%, #C5A059 50%, #9E7D3B 100%); color: #0A0A0B !important; text-decoration: none; font-weight: 700; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; padding: 16px 36px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(197,160,89,0.4); }
    
    .support-box { background-color: #0E0E10; border: 1px solid #27272A; border-radius: 12px; padding: 20px; margin-top: 30px; font-size: 12px; color: #A1A1AA; text-align: center; }
    .support-box a { color: #DFBA73; text-decoration: none; font-weight: bold; }
    
    .footer { background-color: #0A0A0B; padding: 24px 30px; text-align: center; border-top: 1px solid #27272A; font-size: 11px; color: #52525B; line-height: 1.6; }
    .footer a { color: #A1A1AA; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header Banner -->
    <div class="header">
      <div class="crown-badge">♚</div>
      <h1>${hotelName}</h1>
      <p>Patron Circle Membership Enrollment</p>
    </div>

    <!-- Main Content -->
    <div class="content">
      <div class="salutation">Dear ${guestName},</div>
      
      <p class="welcome-intro">
        It is our distinct honor to welcome you into the <strong>${hotelName} Patron Circle</strong>. Your personal guest membership account has been officially established and verified across our sanctuary portal.
      </p>

      <!-- Member Credentials Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #18181B; border: 1px solid #3F3F46; border-radius: 16px; padding: 20px; margin: 20px 0;">
        <tr>
          <td style="padding-bottom: 12px; border-bottom: 1px solid #27272A;">
            <span style="font-size: 11px; font-family: monospace; text-transform: uppercase; letter-spacing: 2px; color: #DFBA73; font-weight: bold;">Patron Membership Profile</span>
          </td>
          <td align="right" style="padding-bottom: 12px; border-bottom: 1px solid #27272A;">
            <span style="background: #C5A059; color: #0A0A0B; font-weight: bold; font-size: 10px; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 1px;">${membershipTier}</span>
          </td>
        </tr>
        <tr>
          <td style="padding-top: 14px; color: #71717A; font-size: 12px; text-transform: uppercase;">Patron Name</td>
          <td align="right" style="padding-top: 14px; color: #FFFFFF; font-size: 13px; font-weight: bold;">${guestName}</td>
        </tr>
        <tr>
          <td style="padding-top: 8px; color: #71717A; font-size: 12px; text-transform: uppercase;">Membership ID</td>
          <td align="right" style="padding-top: 8px; color: #DFBA73; font-size: 13px; font-weight: bold; font-family: monospace;">${memberId}</td>
        </tr>
        <tr>
          <td style="padding-top: 8px; color: #71717A; font-size: 12px; text-transform: uppercase;">Registered Email</td>
          <td align="right" style="padding-top: 8px; color: #FFFFFF; font-size: 13px;">${toEmail}</td>
        </tr>
        <tr>
          <td style="padding-top: 8px; color: #71717A; font-size: 12px; text-transform: uppercase;">Account Status</td>
          <td align="right" style="padding-top: 8px; color: #34D399; font-size: 12px; font-weight: bold;">● Active & Verified</td>
        </tr>
      </table>

      <!-- Member Privileges -->
      <div style="font-size: 13px; font-weight: bold; color: #FFFFFF; text-transform: uppercase; letter-spacing: 1.5px; margin: 24px 0 12px 0;">
        Your Exclusive Patron Privileges:
      </div>

      <div class="benefit-item">
        <div class="benefit-title">🗝️ Guaranteed Suite Privilege Rates</div>
        <p class="benefit-desc">Enjoy private member-only reservation rates and complimentary suite upgrades upon availability.</p>
      </div>

      <div class="benefit-item">
        <div class="benefit-title">🛎️ Dedicated Chief Concierge & Butler Desk</div>
        <p class="benefit-desc">Direct line to our concierge team for custom travel itineraries, private transfers, and special arrangements.</p>
      </div>

      <div class="benefit-item">
        <div class="benefit-title">⚡ Seamless Real-Time Guest Portal</div>
        <p class="benefit-desc">Manage upcoming reservations, view booking folios, and submit bespoke in-suite service requests anytime.</p>
      </div>

      <div class="benefit-item">
        <div class="benefit-title">🍽️ Priority Sanctuary Dining & Spa Access</div>
        <p class="benefit-desc">Advance reservations for fine dining tables, private lounge tastings, and wellness spa therapies.</p>
      </div>

      <!-- Action Button -->
      <div class="cta-container">
        <a href="${portalUrl}/dashboard" class="btn-gold" target="_blank">
          Enter Guest Sanctuary Portal →
        </a>
      </div>

      <!-- Support Box -->
      <div class="support-box">
        <div><strong>Need Concierge Assistance?</strong></div>
        <p style="margin: 6px 0 0 0;">
          Our Chief Concierge Desk is at your service 24/7.<br>
          Direct Email: <a href="mailto:${ENV.HOTEL_EMAIL}">${ENV.HOTEL_EMAIL}</a>
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 0 0 6px 0;">© ${new Date().getFullYear()} ${hotelName}. All Rights Reserved.</p>
      <p style="margin: 0;">This email confirms your official enrollment into the ${hotelName} Patron Circle.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
${hotelName} - Patron Circle Welcome
==================================================

Dear ${guestName},

Welcome to ${hotelName}. It is our distinct honor to welcome you into our inner circle of distinguished guests. Your Patron Circle account has been successfully established and verified.

MEMBERSHIP DETAILS:
--------------------------------------------------
Patron Name:     ${guestName}
Membership Tier: ${membershipTier}
Membership ID:   ${memberId}
Registered Email:${toEmail}
Status:          Active & Verified

YOUR EXCLUSIVE PRIVILEGES:
- Guaranteed Private Suite Rates & Upgrade Eligibility
- 24/7 Dedicated Concierge & Butler Direct Service
- Seamless Guest Portal for Booking Management & In-Suite Requests
- Priority Reservations for Sanctuary Dining & Wellness Spa

Access Your Portal:
${portalUrl}/dashboard

Should you require any personalized arrangements prior to your arrival, our Chief Concierge Desk is delighted to assist you directly at ${ENV.HOTEL_EMAIL}.

With our highest regards,
The Chief Concierge Desk
${hotelName}
    `.trim();

    return await this.sendEmail({
      to: toEmail,
      from: fromAddress,
      replyTo: ENV.HOTEL_EMAIL,
      subject: `Welcome to ${hotelName} • Your Patron Membership Confirmation (${memberId})`,
      html: htmlContent,
      text: textContent,
    });
  }

  /**
   * Dispatches official Concierge response directly to the guest's email address
   */
  static async sendInquiryReplyToGuest(
    inquiry: any,
    responseMessage: string,
    respondedBy: string = 'The Chief Concierge'
  ): Promise<EmailSendResult> {
    const rawInquiry = inquiry && typeof inquiry.toObject === 'function' ? inquiry.toObject() : (inquiry || {});
    const toEmail = rawInquiry.email;

    if (!toEmail) {
      console.warn('[EmailService] Skipped inquiry reply: No recipient email specified.');
      return { success: false, error: 'No recipient email found' };
    }

    const guestName = rawInquiry.name || 'Esteemed Patron';
    const ticketId = rawInquiry.ticketId || 'INQ-REF';
    const subjectTitle = rawInquiry.subject || 'Website Inquiry';
    const hotelName = ENV.HOTEL_NAME || 'Aethelgard Resort & Sanctuary';
    const senderEmail = ENV.SMTP_USER || ENV.HOTEL_EMAIL || 't02407446@gmail.com';
    const fromAddress = `"${hotelName} Concierge" <${senderEmail}>`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Response to Your Inquiry: ${ticketId}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0A0A0B; color: #E4E4E7; margin: 0; padding: 0; }
    .container { max-width: 640px; margin: 30px auto; background-color: #121214; border: 1px solid #27272A; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    .header { background: linear-gradient(135deg, #18181B 0%, #0A0A0B 100%); padding: 36px 30px; text-align: center; border-bottom: 2px solid #C5A059; }
    .header h1 { margin: 0; font-size: 24px; letter-spacing: 4px; color: #DFBA73; text-transform: uppercase; font-family: Georgia, serif; }
    .header p { margin: 6px 0 0 0; font-size: 11px; letter-spacing: 2px; color: #A1A1AA; text-transform: uppercase; }
    .content { padding: 32px 30px; line-height: 1.7; font-size: 14px; color: #D4D4D8; }
    .salutation { font-size: 16px; font-weight: bold; color: #FFFFFF; margin-bottom: 16px; }
    .ticket-badge { display: inline-block; background-color: #27272A; color: #DFBA73; padding: 4px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; font-weight: bold; margin-bottom: 20px; border: 1px solid #3F3F46; }
    .reply-card { background-color: #18181B; border-left: 4px solid #C5A059; padding: 20px; border-radius: 0 12px 12px 0; margin: 20px 0; font-size: 14px; color: #F4F4F5; white-space: pre-wrap; line-height: 1.8; }
    .original-summary { background-color: #0A0A0B; border: 1px solid #27272A; border-radius: 12px; padding: 18px; margin: 24px 0; font-size: 12px; color: #A1A1AA; }
    .original-summary strong { color: #E4E4E7; }
    .footer { background-color: #0E0E10; padding: 24px 30px; text-align: center; border-top: 1px solid #27272A; font-size: 11px; color: #71717A; }
    .footer a { color: #C5A059; text-decoration: none; font-weight: bold; }
    .signature { margin-top: 28px; padding-top: 20px; border-top: 1px solid #27272A; color: #E4E4E7; }
    .signature-title { color: #DFBA73; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${hotelName}</h1>
      <p>Chief Concierge Desk • Official Response</p>
    </div>
    <div class="content">
      <div class="salutation">Dear ${guestName},</div>
      <div class="ticket-badge">Ticket Ref: ${ticketId}</div>
      <p>Thank you for reaching out to <strong>${hotelName}</strong>. Our Concierge Desk has reviewed your inquiry and prepared the following official response:</p>
      
      <div class="reply-card">${responseMessage}</div>

      <div class="original-summary">
        <div style="font-weight: bold; color: #DFBA73; margin-bottom: 8px; text-transform: uppercase; font-size: 10px; letter-spacing: 1px;">Your Original Inquiry Details:</div>
        <div><strong>Subject:</strong> ${subjectTitle}</div>
        ${rawInquiry.travelDates ? `<div><strong>Travel Dates:</strong> ${rawInquiry.travelDates}</div>` : ''}
        ${rawInquiry.phone ? `<div><strong>Phone:</strong> ${rawInquiry.phone}</div>` : ''}
        <div style="margin-top: 6px;"><strong>Message:</strong> "${rawInquiry.message}"</div>
      </div>

      <div class="signature">
        <strong>${respondedBy}</strong><br>
        <span class="signature-title">${hotelName} Executive Concierge</span><br>
        <span>Direct Email: <a href="mailto:${ENV.HOTEL_EMAIL}" style="color: #DFBA73;">${ENV.HOTEL_EMAIL}</a></span>
      </div>
    </div>
    <div class="footer">
      <p>This is an official communication dispatched from <strong>${hotelName}</strong>.</p>
      <p>If you have any further questions or wish to amend your reservation, please reply directly to <a href="mailto:${ENV.HOTEL_EMAIL}">${ENV.HOTEL_EMAIL}</a>.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
${hotelName} - Chief Concierge Desk
Ticket Reference: ${ticketId}
--------------------------------------------------

Dear ${guestName},

Thank you for reaching out to ${hotelName}. Here is the official response to your inquiry regarding "${subjectTitle}":

${responseMessage}

---
Your Original Message:
"${rawInquiry.message}"
${rawInquiry.travelDates ? `Travel Dates: ${rawInquiry.travelDates}` : ''}

With our highest regards,
${respondedBy}
${hotelName}
Email: ${ENV.HOTEL_EMAIL}
    `.trim();

    return await this.sendEmail({
      to: toEmail,
      from: fromAddress,
      replyTo: ENV.HOTEL_EMAIL,
      subject: `[${ticketId}] Official Response: ${subjectTitle} - ${hotelName}`,
      html: htmlContent,
      text: textContent,
    });
  }

  /**
   * Dispatches instant acknowledgement email to guest when contact inquiry is submitted on website
   */
  static async sendContactInquiryConfirmation(inquiry: any): Promise<EmailSendResult> {
    const rawInquiry = inquiry && typeof inquiry.toObject === 'function' ? inquiry.toObject() : (inquiry || {});
    const toEmail = rawInquiry.email;

    if (!toEmail) {
      console.warn('[EmailService] Skipped contact inquiry confirmation: No recipient email specified.');
      return { success: false, error: 'No recipient email found' };
    }

    const guestName = rawInquiry.name || 'Esteemed Patron';
    const ticketId = rawInquiry.ticketId || 'INQ-REF';
    const subjectTitle = rawInquiry.subject || 'General Sanctuary Inquiry';
    const hotelName = ENV.HOTEL_NAME || 'Aethelgard Resort & Sanctuary';
    const senderEmail = ENV.SMTP_USER || ENV.HOTEL_EMAIL || 't02407446@gmail.com';
    const fromAddress = `"${hotelName} Concierge" <${senderEmail}>`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Inquiry Confirmation: ${ticketId}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0A0A0B; color: #E4E4E7; margin: 0; padding: 0; }
    .container { max-width: 640px; margin: 30px auto; background-color: #121214; border: 1px solid #27272A; border-radius: 20px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #18181B 0%, #0A0A0B 100%); padding: 32px; text-align: center; border-bottom: 2px solid #C5A059; }
    .header h1 { margin: 0; font-size: 22px; letter-spacing: 4px; color: #DFBA73; text-transform: uppercase; font-family: Georgia, serif; }
    .content { padding: 30px; font-size: 14px; line-height: 1.7; color: #D4D4D8; }
    .ticket { display: inline-block; background-color: #27272A; color: #DFBA73; padding: 6px 14px; border-radius: 8px; font-family: monospace; font-size: 13px; font-weight: bold; margin: 15px 0; }
    .details { background-color: #18181B; border: 1px solid #27272A; border-radius: 12px; padding: 20px; margin: 20px 0; font-size: 13px; }
    .footer { background-color: #0E0E10; padding: 20px; text-align: center; font-size: 11px; color: #71717A; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${hotelName}</h1>
      <p style="margin: 4px 0 0 0; color: #A1A1AA; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Chief Concierge Desk</p>
    </div>
    <div class="content">
      <h2 style="color: #FFFFFF; margin-top: 0; font-size: 18px;">We Have Received Your Inquiry</h2>
      <p>Dear ${guestName},</p>
      <p>Thank you for contacting <strong>${hotelName}</strong>. Your confidential inquiry has been logged in our real-time concierge portal.</p>
      
      <div class="ticket">Tracking Reference: ${ticketId}</div>

      <div class="details">
        <p style="margin: 0 0 8px 0;"><strong>Inquiry Subject:</strong> ${subjectTitle}</p>
        ${rawInquiry.travelDates ? `<p style="margin: 0 0 8px 0;"><strong>Travel Dates:</strong> ${rawInquiry.travelDates}</p>` : ''}
        <p style="margin: 0;"><strong>Your Message:</strong> "${rawInquiry.message}"</p>
      </div>

      <p>Our concierge liaison is reviewing your request and will respond directly to this email address shortly.</p>
      
      <p style="margin-top: 24px;">Warmest regards,<br>
      <strong style="color: #DFBA73;">The Chief Concierge Desk</strong><br>
      ${hotelName}<br>
      Official Desk: <a href="mailto:${ENV.HOTEL_EMAIL}" style="color: #DFBA73;">${ENV.HOTEL_EMAIL}</a></p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${hotelName}. All inquiries are strictly confidential.</p>
    </div>
  </div>
</body>
</html>
    `;

    return await this.sendEmail({
      to: toEmail,
      from: fromAddress,
      replyTo: ENV.HOTEL_EMAIL,
      subject: `[${ticketId}] We Have Received Your Inquiry - ${hotelName}`,
      html: htmlContent,
      text: `Dear ${guestName},\n\nWe have received your inquiry (${ticketId}) regarding "${subjectTitle}". Our concierge desk will respond shortly.\n\nWarm regards,\n${hotelName} Concierge (${ENV.HOTEL_EMAIL})`,
    });
  }

  /**
   * Dispatches automated, luxury reservation confirmation email with stay details, total persons, total stay days & total bill
   */
  static async sendBookingConfirmationEmail(booking: any, recipientEmail?: string): Promise<EmailSendResult> {
    const rawBooking = booking && typeof booking.toObject === 'function' ? booking.toObject() : (booking || {});
    const toEmail = recipientEmail || rawBooking.guestEmail || rawBooking.email || rawBooking.guest?.email;

    if (!toEmail) {
      console.warn('[EmailService] Skipped booking confirmation email: No recipient email specified.');
      return { success: false, error: 'No recipient email found' };
    }

    const hotelName = ENV.HOTEL_NAME || 'Aethelgard Luxury Sanctuary & Resort';
    const portalUrl = ENV.WEBSITE_URL || 'https://hotel-website-pi-five.vercel.app';
    const guestName = rawBooking.guestName || rawBooking.name || rawBooking.guest?.name || rawBooking.guest?.fullName || 'Esteemed Patron';
    const bookingRef = rawBooking.bookingNumber || rawBooking.reservationNumber || rawBooking.referenceNumber || 'RES-CONFIRMED';
    const roomName = rawBooking.roomName || (rawBooking.roomNumber ? `Suite ${rawBooking.roomNumber}` : 'Luxury Sanctuary Suite');
    const roomNumber = rawBooking.roomNumber || (rawBooking.room?.roomNumber ? String(rawBooking.room.roomNumber) : 'Assigned on Arrival');
    const roomCategory = rawBooking.roomCategory || rawBooking.roomType || rawBooking.room?.category || 'Ultra-Luxury';

    // Dates & Duration Calculations
    const checkInDate = new Date(rawBooking.checkInDate || rawBooking.checkIn);
    const checkOutDate = new Date(rawBooking.checkOutDate || rawBooking.checkOut);
    const nights = Math.max(
      1,
      Number(rawBooking.totalNights) ||
        Math.ceil(Math.abs(checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)) ||
        1
    );
    const stayDays = nights + 1;

    const formattedCheckIn = !isNaN(checkInDate.getTime())
      ? checkInDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : String(rawBooking.checkInDate || 'Arrival Day');

    const formattedCheckOut = !isNaN(checkOutDate.getTime())
      ? checkOutDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : String(rawBooking.checkOutDate || 'Departure Day');

    // Total Persons
    const adults = Number(rawBooking.numberOfAdults || rawBooking.numberOfGuests || 1);
    const children = Number(rawBooking.numberOfChildren || 0);
    const totalPersons = adults + children;
    const personsText = children > 0 ? `${totalPersons} Persons (${adults} Adults, ${children} Children)` : `${adults} ${adults === 1 ? 'Person' : 'Persons'}`;

    // Financials
    const totalBill = Number(rawBooking.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const paidAmount = Number(rawBooking.paidAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const balanceDue = Math.max(0, Number(rawBooking.totalAmount || 0) - Number(rawBooking.paidAmount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const paymentStatus = (rawBooking.paymentStatus || 'confirmed').toUpperCase();

    const senderEmail = ENV.SMTP_USER || ENV.HOTEL_EMAIL || 't02407446@gmail.com';
    const fromAddress = `"${hotelName} Reservations" <${senderEmail}>`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Reservation Confirmation - ${bookingRef}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #070708; color: #E4E4E7; margin: 0; padding: 0; }
    .container { max-width: 640px; margin: 30px auto; background-color: #121214; border: 1px solid #27272A; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); }
    .header { background: linear-gradient(135deg, #1C1917 0%, #0C0A09 100%); padding: 40px 30px; text-align: center; border-bottom: 2px solid #C5A059; position: relative; }
    .crown-badge { display: inline-block; width: 48px; height: 48px; line-height: 48px; background: rgba(197,160,89,0.15); border: 1px solid rgba(197,160,89,0.5); border-radius: 50%; color: #DFBA73; font-size: 22px; margin-bottom: 12px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; letter-spacing: 3px; color: #DFBA73; text-transform: uppercase; font-family: Georgia, serif; font-weight: 700; }
    .header p { margin: 8px 0 0 0; font-size: 11px; letter-spacing: 2.5px; color: #A1A1AA; text-transform: uppercase; }
    .content { padding: 36px 32px; line-height: 1.7; font-size: 14px; color: #D4D4D8; }
    .salutation { font-size: 18px; font-weight: 600; color: #FFFFFF; margin-bottom: 12px; font-family: Georgia, serif; }
    .conf-badge { display: inline-block; background: #1C1917; border: 1px solid #C5A059; color: #DFBA73; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; font-family: monospace; letter-spacing: 1px; margin-bottom: 20px; }
    
    .summary-grid { width: 100%; border-collapse: separate; border-spacing: 0; background-color: #18181B; border: 1px solid #27272A; border-radius: 16px; margin: 24px 0; overflow: hidden; }
    .summary-grid td { padding: 14px 18px; border-bottom: 1px solid #27272A; font-size: 13px; }
    .summary-grid tr:last-child td { border-bottom: none; }
    .label { color: #A1A1AA; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
    .value { color: #FFFFFF; font-weight: 600; text-align: right; }
    .highlight-value { color: #DFBA73; font-weight: 700; text-align: right; }
    
    .bill-card { background: linear-gradient(135deg, rgba(197,160,89,0.12) 0%, rgba(197,160,89,0.03) 100%); border: 1px solid #C5A059; border-radius: 16px; padding: 22px; margin: 26px 0; }
    .bill-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #DFBA73; margin-bottom: 14px; }
    .bill-total { font-size: 28px; font-weight: 800; color: #FFFFFF; font-family: Georgia, serif; }
    .bill-status { display: inline-block; background: #059669; color: #FFFFFF; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 3px 10px; border-radius: 10px; margin-left: 8px; vertical-align: middle; }
    
    .perk-box { background-color: #141416; border-left: 3px solid #C5A059; border-radius: 0 12px 12px 0; padding: 14px 18px; margin-bottom: 10px; }
    .perk-title { font-weight: 700; color: #FFFFFF; font-size: 13px; margin-bottom: 2px; }
    .perk-desc { font-size: 12px; color: #A1A1AA; margin: 0; line-height: 1.5; }
    
    .cta-container { text-align: center; margin: 34px 0 20px 0; }
    .btn-gold { display: inline-block; background: linear-gradient(135deg, #DFBA73 0%, #C5A059 50%, #9E7D3B 100%); color: #0A0A0B !important; text-decoration: none; font-weight: 700; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; padding: 16px 36px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(197,160,89,0.4); }
    
    .footer { background-color: #0A0A0B; padding: 24px 30px; text-align: center; border-top: 1px solid #27272A; font-size: 11px; color: #52525B; line-height: 1.6; }
    .footer a { color: #A1A1AA; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header Banner -->
    <div class="header">
      <div class="crown-badge">♚</div>
      <h1>${hotelName}</h1>
      <p>Official Reservation Confirmation</p>
    </div>

    <!-- Main Content -->
    <div class="content">
      <div class="salutation">Dear ${guestName},</div>
      
      <p style="color: #A1A1AA; line-height: 1.8; margin-bottom: 20px;">
        We are thrilled to confirm that your reservation has been secured at <strong>${hotelName}</strong>. Our sanctuary staff is preparing your bespoke arrival itinerary.
      </p>

      <div style="text-align: center;">
        <div class="conf-badge">BOOKING REFERENCE: ${bookingRef}</div>
      </div>

      <!-- Stay & Room Summary Table -->
      <table class="summary-grid">
        <tr>
          <td class="label">Reserved Room / Suite</td>
          <td class="value">${roomName} (Room ${roomNumber})</td>
        </tr>
        <tr>
          <td class="label">Category</td>
          <td class="value">${roomCategory}</td>
        </tr>
        <tr>
          <td class="label">Total Stay Duration</td>
          <td class="highlight-value">${nights} Nights (${stayDays} Days)</td>
        </tr>
        <tr>
          <td class="label">Total Guests / Persons</td>
          <td class="highlight-value">${personsText}</td>
        </tr>
        <tr>
          <td class="label">Check-In Date</td>
          <td class="value">${formattedCheckIn} (From 03:00 PM)</td>
        </tr>
        <tr>
          <td class="label">Check-Out Date</td>
          <td class="value">${formattedCheckOut} (Until 11:00 AM)</td>
        </tr>
      </table>

      <!-- Total Bill Card -->
      <div class="bill-card">
        <div class="bill-title">Billing & Folio Summary</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span class="label" style="display: block; margin-bottom: 4px;">Total Bill Amount</span>
              <span class="bill-total">$${totalBill}</span>
              <span class="bill-status">${paymentStatus}</span>
            </td>
            <td align="right" style="vertical-align: bottom;">
              ${Number(rawBooking.paidAmount || 0) > 0 ? `<div style="font-size: 12px; color: #34D399; margin-bottom: 3px;">Paid Deposit: $${paidAmount}</div>` : ''}
              <div style="font-size: 12px; color: #A1A1AA;">Balance Due: <strong style="color: #FFFFFF;">$${balanceDue}</strong></div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Complimentary Sanctuary Inclusions -->
      <div style="font-size: 12px; font-weight: 700; color: #DFBA73; text-transform: uppercase; letter-spacing: 1.5px; margin: 24px 0 12px 0;">
        Included With Your Stay:
      </div>

      <div class="perk-box">
        <div class="perk-title">🛎️ Dedicated Concierge & Butler Service</div>
        <p class="perk-desc">Your dedicated concierge desk is available 24/7 for bespoke dining, spa, and private island excursions.</p>
      </div>

      <div class="perk-box">
        <div class="perk-title">✨ Ultra-High-Speed Sanctuary Fiber WiFi</div>
        <p class="perk-desc">Seamless gigabit connectivity across all private villas, suites, lounges, and oceanfront pavilions.</p>
      </div>

      <div class="perk-box">
        <div class="perk-title">🥂 Curated In-Suite Welcome Refreshments</div>
        <p class="perk-desc">Artisanal welcome amenities and chilled sparkling refreshment prepared fresh upon arrival.</p>
      </div>

      <!-- Action Button -->
      <div class="cta-container">
        <a href="${portalUrl}/dashboard/bookings" class="btn-gold" target="_blank">
          View & Manage Your Reservation →
        </a>
      </div>

      <!-- Support Details -->
      <div style="background-color: #0E0E10; border: 1px solid #27272A; border-radius: 12px; padding: 18px; text-align: center; margin-top: 28px; font-size: 12px; color: #A1A1AA;">
        <strong>Questions regarding your stay?</strong><br>
        Contact our Chief Concierge at <a href="mailto:${ENV.HOTEL_EMAIL}" style="color: #DFBA73; font-weight: bold;">${ENV.HOTEL_EMAIL}</a> with reference <strong>${bookingRef}</strong>.
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 0 0 6px 0;">© ${new Date().getFullYear()} ${hotelName}. All Rights Reserved.</p>
      <p style="margin: 0;">Dispatched automatically upon reservation confirmation.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
${hotelName} - Reservation Confirmation
==================================================

Dear ${guestName},

Thank you for choosing ${hotelName}. Your reservation has been officially confirmed.

RESERVATION DETAILS:
--------------------------------------------------
Booking Reference:    ${bookingRef}
Room / Suite:         ${roomName} (Room ${roomNumber})
Room Category:        ${roomCategory}
Total Stay Duration:  ${nights} Nights (${stayDays} Days)
Total Guests/Persons: ${personsText}
Check-In Date:        ${formattedCheckIn} (From 03:00 PM)
Check-Out Date:       ${formattedCheckOut} (Until 11:00 AM)

BILLING & FOLIO SUMMARY:
--------------------------------------------------
Total Bill:           $${totalBill}
Paid Deposit:         $${paidAmount}
Balance Due:          $${balanceDue}
Payment Status:       ${paymentStatus}

Access & Manage Your Stay Online:
${portalUrl}/dashboard/bookings

Should you require private transfer arrangements or tailored dietary requests prior to arrival, our Concierge Desk is delighted to assist at ${ENV.HOTEL_EMAIL}.

With our warmest regards,
The Chief Concierge Desk
${hotelName}
    `.trim();

    return await this.sendEmail({
      to: toEmail,
      from: fromAddress,
      replyTo: ENV.HOTEL_EMAIL,
      subject: `Reservation Confirmed: ${roomName} • ${nights} Nights (${bookingRef}) - ${hotelName}`,
      html: htmlContent,
      text: textContent,
    });
  }

  /**
   * Diagnostic test email dispatcher for administration and health verification
   */
  static async sendTestEmail(targetEmail?: string): Promise<EmailSendResult> {
    const to = targetEmail || ENV.SMTP_USER || ENV.HOTEL_EMAIL || 't02407446@gmail.com';
    const hotelName = ENV.HOTEL_NAME || 'Aethelgard Resort & Sanctuary';
    const senderEmail = ENV.SMTP_USER || ENV.HOTEL_EMAIL || 't02407446@gmail.com';
    const fromAddress = `"${hotelName} System Diagnostic" <${senderEmail}>`;
    const timestamp = new Date().toUTCString();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; background: #09090b; color: #f4f4f5; padding: 20px; }
    .card { max-width: 540px; margin: auto; background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; }
    .badge { background: #059669; color: white; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; }
    h2 { color: #DFBA73; margin-top: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h2>⚡ Hotel ERP Mail System Operational Test</h2>
    <p><span class="badge">DIAGNOSTIC PASSED</span></p>
    <p>This automated diagnostic message confirms that the <strong>${hotelName}</strong> mail delivery system is functioning with full end-to-end delivery capability.</p>
    <hr style="border-color: #27272a; margin: 18px 0;" />
    <p style="font-size: 12px; color: #a1a1aa;">
      <strong>Timestamp:</strong> ${timestamp}<br>
      <strong>Host / Service:</strong> ${ENV.RESEND_API_KEY ? 'Resend HTTPS API' : (ENV.SMTP_HOST || 'smtp.gmail.com')}<br>
      <strong>Sender Account:</strong> ${senderEmail}
    </p>
  </div>
</body>
</html>
    `;

    return await this.sendEmail({
      to,
      from: fromAddress,
      replyTo: senderEmail,
      subject: `[Diagnostic] ${hotelName} Email Delivery System Verification - ${new Date().toLocaleTimeString()}`,
      html: htmlContent,
      text: `Hotel ERP Mail System Diagnostic Test Passed.\nTimestamp: ${timestamp}\nSender: ${senderEmail}`,
    });
  }

  /**
   * Internal helper: Dispatches email via HTTPS API (Resend) or Nodemailer SMTP with strict timeouts
   */
  static async sendEmail(options: {
    to: string;
    from?: string;
    replyTo?: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<EmailSendResult> {
    const senderEmail = ENV.SMTP_USER || ENV.HOTEL_EMAIL || 't02407446@gmail.com';
    const hotelName = ENV.HOTEL_NAME || 'Aethelgard Resort & Sanctuary';
    const from = options.from || `"${hotelName}" <${senderEmail}>`;
    const replyTo = options.replyTo || ENV.HOTEL_EMAIL || senderEmail;

    // 1. Check if Resend HTTPS API Key is provided (Port 443 HTTPS - 100% reliable on Cloud/Render)
    if (ENV.RESEND_API_KEY && ENV.RESEND_API_KEY.trim().length > 0) {
      try {
        const resendFrom = `"${hotelName}" <onboarding@resend.dev>`;
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ENV.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: resendFrom,
            to: [options.to],
            reply_to: replyTo,
            subject: options.subject,
            html: options.html,
            text: options.text,
          }),
        });

        const data: any = await response.json();
        if (response.ok && data.id) {
          console.log(`[EmailService] ✉ Email dispatched via Resend HTTPS API to [${options.to}]. Subject: "${options.subject}". (ID: ${data.id})`);
          return {
            success: true,
            messageId: data.id,
            provider: 'resend_https',
          };
        } else {
          console.warn(`[EmailService] Resend HTTPS API returned error:`, data);
        }
      } catch (resendErr: any) {
        console.warn(`[EmailService] Resend dispatch attempt warning: ${resendErr.message}. Falling back to SMTP...`);
      }
    }

    // 2. SMTP Transporter Attempt with strict 4.5s race timeout
    try {
      const transporter = this.getTransporter();
      const sendPromise = transporter.sendMail({
        from,
        to: options.to,
        replyTo,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SMTP connection timed out after 4500ms')), 4500)
      );

      const info: any = await Promise.race([sendPromise, timeoutPromise]);

      console.log(`[EmailService] ✉ Email dispatched to [${options.to}]. Subject: "${options.subject}". From: [${from}] (ID: ${info.messageId})`);
      
      return {
        success: true,
        messageId: info.messageId,
        provider: 'smtp',
      };
    } catch (error: any) {
      console.warn(`[EmailService] ⚠️ SMTP dispatch warning for [${options.to}]: ${error.message}`);
      return {
        success: false,
        error: error.message,
        provider: 'smtp_failed',
      };
    }
  }
}

export default EmailService;
