import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

export async function initializeEmailService() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (!smtpUser || !smtpPassword) {
    console.warn('Email credentials not configured. Email sending will not work.');
    return;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  // Verify connection
  try {
    await transporter.verify();
    console.log('Email service initialized successfully');
  } catch (error) {
    console.error('Email service initialization failed:', error);
    transporter = null;
  }
}

export async function sendVerificationCodeEmail(email: string, code: string): Promise<boolean> {
  if (!transporter) {
    console.error('❌ Email service not initialized - transporter is null');
    return false;
  }

  try {
    console.log(`📧 Attempting to send verification code to: ${email}`);
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@rummikub.com',
      to: email,
      subject: 'Your Rummikub Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0b1020 0%, #1b2250 100%); padding: 40px; border-radius: 12px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 0.5px;">Rummikub</h1>
          </div>
          
          <div style="padding: 40px; background-color: #f9fafb;">
            <h2 style="color: #1f2937; margin-top: 0;">Password Reset Request</h2>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              We received a request to reset your password. Use the code below to complete your password reset:
            </p>
            
            <div style="background-color: #ffffff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
              <p style="color: #9ca3af; font-size: 14px; margin: 0 0 10px 0;">Your Verification Code:</p>
              <p style="color: #1f2937; font-size: 48px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                ${code}
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0 0;">This code will expire in 15 minutes</p>
            </div>
            
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #7f1d1d; font-size: 14px; margin: 0;">
                <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your account is still secure.
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Questions? Contact our support team for assistance.
            </p>
          </div>
        </div>
      `,
      text: `Your Rummikub password reset code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this, please ignore this email.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification code email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification code email:', error);
    return false;
  }
}
