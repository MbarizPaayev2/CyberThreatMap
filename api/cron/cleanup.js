import supabaseAdmin from '../../lib/supabaseAdmin.js';
import crypto from 'crypto';

// Constant-time comparison to prevent timing attacks
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  // IP whitelisting for additional security
  const allowedCronIPs = process.env.ALLOWED_CRON_IPS ? process.env.ALLOWED_CRON_IPS.split(',') : [];
  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress;
  
  if (allowedCronIPs.length > 0 && !allowedCronIPs.includes(clientIP)) {
    console.warn(`Unauthorized cron access attempt from IP: ${clientIP}`);
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  if (!authHeader || !constantTimeCompare(authHeader, `Bearer ${cronSecret}`)) {
    console.warn('Unauthorized cron access attempt: invalid or missing token');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Supabase DB storage limitlərini qorumaq üçün 7 gündən köhnə qeydləri silək
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateString = sevenDaysAgo.toISOString();

    const { data, error } = await supabaseAdmin
      .from('threat_events')
      .delete()
      .lt('created_at', dateString);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: `Old events prior to ${dateString} deleted.`
    });

  } catch (error) {
    console.error("Cleanup error:", error);
    return res.status(500).json({ error: error.message });
  }
}
