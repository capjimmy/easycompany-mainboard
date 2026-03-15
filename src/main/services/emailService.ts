import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

let transporter: nodemailer.Transporter | null = null;

export async function initEmailTransporter(config: EmailConfig) {
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  return transporter;
}

export function getTransporter(): nodemailer.Transporter | null {
  return transporter;
}

export async function testEmailConnection(config: EmailConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const testTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
    await testTransporter.verify();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'SMTP 연결에 실패했습니다.' };
  }
}

export async function sendQuoteEmail(options: {
  to: string;
  subject: string;
  body: string;
  attachmentPath?: string;
  attachmentName?: string;
}) {
  if (!transporter) throw new Error('이메일 설정이 되어있지 않습니다.');
  const mailOptions: any = {
    from: (transporter.options as any)?.auth?.user || '',
    to: options.to,
    subject: options.subject,
    html: options.body,
  };
  if (options.attachmentPath) {
    mailOptions.attachments = [{
      filename: options.attachmentName || 'document.pdf',
      path: options.attachmentPath,
    }];
  }
  return transporter.sendMail(mailOptions);
}
