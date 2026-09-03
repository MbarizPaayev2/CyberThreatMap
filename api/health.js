import supabaseAdmin from '../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  // Restrict CORS to specific origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  try {
    // Sadə bir SELECT sorğusu ilə bazanın yaşamasını yoxlayırıq
    const { data, error } = await supabaseAdmin
      .from('threat_events')
      .select('id')
      .limit(1);

    if (error) throw error;

    return res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (err) {
    const errorMessage = process.env.NODE_ENV === 'production' ? 'Service unavailable' : err.message;
    return res.status(503).json({ status: 'error', message: errorMessage });
  }
}
