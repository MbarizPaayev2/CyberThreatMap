import supabaseAdmin from '../../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
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
