// Patient messaging boundary. Production: an SMS provider under a BAA.
// Messages only ever contain first name, status and the tracking link, never clinical details.

export interface SmsAdapter {
  send(to: string, body: string): Promise<{ messageRef: string }>;
}

export const mockSms: SmsAdapter = {
  async send() {
    return { messageRef: `sms_${Date.now().toString(36)}` };
  },
};

export const smsAdapter: SmsAdapter = mockSms;
