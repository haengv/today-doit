// api/experiments.js
// Vercel Serverless Function - stores and retrieves published message hypothesis experiments
import fs from 'fs';

const DB_PATH = '/tmp/doit_experiments.json';

// Helper to read database
function getExperiments() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('[Experiments DB Read Error]', e);
  }
  return [];
}

// Helper to write to database
function saveExperiments(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[Experiments DB Write Error]', e);
  }
  return false;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Retrieve all published experiments
  if (req.method === 'GET') {
    const experiments = getExperiments();
    return res.status(200).json(experiments);
  }

  // POST: Log a new published experiment
  if (req.method === 'POST') {
    const {
      post_id,
      hypothesis_id,
      hypothesis_name,
      content_type,
      variation_id,
      content,
      published_at,
      threads_post_id
    } = req.body;

    if (!hypothesis_id || !content_type || !content || !threads_post_id) {
      return res.status(400).json({ error: 'Missing required parameters in body' });
    }

    const experiments = getExperiments();

    const newExperiment = {
      post_id: post_id || `exp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      hypothesis_id,
      hypothesis_name,
      content_type,
      variation_id,
      content,
      published_at: published_at || new Date().toISOString(),
      threads_post_id,
      metrics: {
        views: 0,
        likes: 0,
        replies: 0,
        reposts: 0,
        updated_at: new Date().toISOString()
      }
    };

    experiments.push(newExperiment);
    const success = saveExperiments(experiments);

    if (success) {
      console.log('[Experiments DB] Logged new experiment:', newExperiment.variation_id);
      return res.status(200).json({ success: true, experiment: newExperiment });
    } else {
      return res.status(500).json({ error: 'Failed to write data to database' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
