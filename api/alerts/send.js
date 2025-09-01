// api/alerts/send.js
import twilio from 'twilio';

// Vercel Node functions don't auto-parse JSON; read it safely
async function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminKey = req.headers['x-admin-key'];
  // eslint-disable-next-line no-undef
  if (!process.env.ADMIN_API_KEY || adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const bodyJson = typeof req.body === 'object' ? req.body : await readJson(req);
  const text = (bodyJson && bodyJson.body) || '';

  // eslint-disable-next-line no-control-regex
  if (!text || text.length > 160 || !/^[\x00-\x7F]*$/.test(text)) {
    return res.status(400).json({ error: 'Provide 1–160 ASCII chars (no emoji)' });
  }

  const {
    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
    TWILIO_MESSAGING_SERVICE_SID, TWILIO_FROM, TO_NUMBER
  // eslint-disable-next-line no-undef
  } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return res.status(500).json({ error: 'Twilio credentials not configured' });
  }
  if (!TO_NUMBER) {
    return res.status(500).json({ error: 'TO_NUMBER env var not set (destination phone)' });
  }

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const args = { to: TO_NUMBER, body: text };
    if (TWILIO_MESSAGING_SERVICE_SID) args.messagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
    else if (TWILIO_FROM) args.from = TWILIO_FROM;
    else return res.status(500).json({ error: 'Missing TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM' });

    const msg = await client.messages.create(args);
    return res.status(200).json({ ok: true, messageSid: msg.sid, status: msg.status });
  } catch (err) {
    return res.status(500).json({ error: 'Send failed', code: err.code, message: err.message });
  }
};
