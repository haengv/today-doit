// api/auth/toss.js
// Vercel Serverless Function - handles Toss OAuth2 exchange and JWT sign
import fs from 'fs';
import crypto from 'crypto';

const DB_PATH = '/tmp/doit_users.json';

// Get all users from JSON file db
function getUsers() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('[DB Read Error]', e);
  }
  return {};
}

// Save or update a user in JSON file db
function saveUser(userKey, userData) {
  try {
    const users = getUsers();
    users[userKey] = {
      ...users[userKey],
      ...userData,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2), 'utf8');
    return users[userKey];
  } catch (e) {
    console.error('[DB Write Error]', e);
  }
  return userData;
}

// Generate HS256 JWT Token (Dependency-free crypto helper)
function generateJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const base64UrlEncode = (obj) => {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };
  const tokenHeader = base64UrlEncode(header);
  const tokenPayload = base64UrlEncode(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${tokenHeader}.${tokenPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${tokenHeader}.${tokenPayload}.${signature}`;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { authorizationCode, referrer } = req.body;

  if (!authorizationCode) {
    return res.status(400).json({ error: 'Missing authorizationCode in request body' });
  }

  const clientId = process.env.TOSS_CLIENT_ID;
  const clientSecret = process.env.TOSS_CLIENT_SECRET;
  const jwtSecret = process.env.JWT_SECRET || 'doit_secret_jwt_sign_key_change_me_in_production';

  console.log('[Toss Auth Backend] Received code:', authorizationCode, 'referrer:', referrer);

  let userKey = '';

  // 1. Dual Mode: Check if we should use sandbox mock or real Toss API exchange
  const isPlaceholderEnv = !clientId || clientId === 'your_toss_client_id_here';
  const isSandboxCode = authorizationCode.startsWith('toss_simulated_') || referrer === 'SANDBOX' || authorizationCode.includes('sandbox');

  if (isPlaceholderEnv || isSandboxCode) {
    console.log('[Toss Auth Backend] Running in SANDBOX / fallback mode');
    // Generate stable userKey based on authorizationCode for testing
    userKey = `mock_toss_user_${crypto.createHash('md5').update(authorizationCode).digest('hex').substring(0, 12)}`;
  } else {
    // Real Server-to-Server Token exchange
    try {
      console.log('[Toss Auth Backend] Initiating server-to-server token exchange with Toss API');
      const tossRes = await fetch('https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorizationCode,
          referrer: referrer || 'deeplink'
        })
      });

      const tossData = await tossRes.json();
      
      if (!tossRes.ok || tossData.resultType === 'FAIL') {
        console.error('[Toss Token Exchange Failed]', tossData);
        return res.status(tossRes.status || 400).json({
          error: tossData.errorDescription || tossData.errorMessage || 'Toss login verification failed'
        });
      }

      userKey = tossData.userKey;
      if (!userKey) {
        throw new Error('userKey missing in generate-token response');
      }
    } catch (err) {
      console.error('[Toss S2S Auth Error]', err.message);
      return res.status(500).json({ error: `Toss server communication error: ${err.message}` });
    }
  }

  // 2. Lookup or create user in DB
  let user = getUsers()[userKey];
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    user = {
      userKey,
      createdAt: new Date().toISOString(),
      nickname: `Doer_${Math.random().toString(36).substring(2, 7).toUpperCase()}`
    };
    user = saveUser(userKey, user);
    console.log('[Toss Auth Backend] Created new user:', userKey);
  } else {
    console.log('[Toss Auth Backend] Found existing user:', userKey);
  }

  // 3. Issue our service JWT token
  const tokenPayload = {
    userKey: user.userKey,
    nickname: user.nickname,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) // 30 days expiry
  };

  const jwtToken = generateJWT(tokenPayload, jwtSecret);

  // Return token and user profile
  return res.status(200).json({
    accessToken: jwtToken,
    user: {
      userKey: user.userKey,
      nickname: user.nickname,
      isNewUser
    }
  });
}
