import supabaseAdmin from '../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Sadə bir SELECT sorğusu ilə bazanın yaşamasını yoxlayırıq
    const { data, error } = await supabaseAdmin
      .from('threat_events')
      .select('id')
      .limit(1);

    if (error) throw error;

    return res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (err) {
    return res.status(503).json({ status: 'error', message: err.message });
  }
}
