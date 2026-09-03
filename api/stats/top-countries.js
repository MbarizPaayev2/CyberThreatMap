import supabaseAdmin from '../../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('get_top_countries');
    if (error) throw error;
    return res.status(200).json(data);
  } catch (error) {
    console.error("Top countries error:", error);
    return res.status(500).json({ error: error.message });
  }
}
