// Vercel Serverless Function — G&C Hair Quiz API Proxy
// File: api/assess.js
// This keeps your Anthropic API key private and handles CORS
 
export default async function handler(req, res) {
  // Allow requests from your Shopify store
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
 
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  try {
    const { answers, products } = req.body;
 
    if (!answers) {
      return res.status(400).json({ error: 'Missing answers' });
    }
 
    const goals = Array.isArray(answers.stylingGoals)
      ? answers.stylingGoals.join(', ')
      : (answers.stylingGoals || '');
 
    const productList = (products || []).map(p =>
      '- ' + p.name + (p.priceStr ? ' ' + p.priceStr : '') + (p.isGift ? ' (FREE with any tool purchase)' : '')
    ).join('\n');
 
    const prompt = 'You are an expert hair consultant for G&C Gold Class, a premium Australian hair tools brand in Sydney. Give a warm, personalised assessment.\n\nCustomer:\n- Hair type: ' + answers.hairType + '\n- Texture: ' + answers.hairTexture + '\n- Length: ' + answers.hairLength + '\n- Scalp condition: ' + answers.hairCondition + '\n- Goals: ' + goals + '\n- Heat experience: ' + answers.heatExperience + '\n- Notes: ' + (answers.freeText || 'None') + '\n\nProducts:\n' + productList + '\n\nRespond ONLY with valid JSON, no markdown:\n{\n  "assessment": "3 warm encouraging sentences. 1: Their unique hair profile. 2: Hair care advice for their condition and texture. 3: Heat protection advice including temperature range (fine 150-180C, medium 180-200C, thick up to 230C) and G&C Heat Protectant Spray tip. No em dashes. Australian spelling. Only uplifting positive language.",\n  "recommendations": [{"productId": "id", "reason": "2 sentences: why this tool suits them specifically, then a practical usage tip."}]\n}\n\nRules: recommend 1-2 styling tools then always add detangling-brush last. Detangling brush reason: "A gentle daily essential for detangling before and after styling to keep hair smooth and healthy. It comes free with any G&C tool purchase." productId must be one of: auto-curler, mini-blowout, blowout-brush, straightener-brush, detangling-brush. Match: curling goals or curly/wavy = auto-curler, blowout + fine/medium = mini-blowout, blowout + thick = blowout-brush, straightening or frizz = straightener-brush.';
 
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
 
    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic error:', errText);
      return res.status(500).json({ error: 'AI service error' });
    }
 
    const data = await response.json();
    const text = data.content[0].text.trim().replace(/```json|```/g, '').trim();
    const result = JSON.parse(text);
 
    return res.status(200).json(result);
 
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
