// Vercel Serverless Function — G&C Hair Quiz API Proxy
// File: api/assess.js

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { answers, products } = req.body;
    if (!answers) return res.status(400).json({ error: 'Missing answers' });

    const goals = Array.isArray(answers.stylingGoals)
      ? answers.stylingGoals.join(', ')
      : (answers.stylingGoals || '');

    const productList = (products || []).map(p =>
      '- ' + p.name + (p.priceStr ? ' ' + p.priceStr : '') + (p.isGift ? ' (FREE with any tool purchase)' : '')
    ).join('\n');

    const prompt = `You are a warm, expert hair consultant for G&C Gold Class, a premium Australian hair tools brand in Sydney. Deliver a personalised hair assessment.

Customer profile:
- Hair type: ${answers.hairType}
- Texture: ${answers.hairTexture}
- Length: ${answers.hairLength}
- Scalp condition: ${answers.hairCondition}
- Styling goals: ${goals}
- Heat tool experience: ${answers.heatExperience}
- Notes: ${answers.freeText || 'None'}

Products:
${productList}

Respond ONLY with valid JSON, no markdown:
{
  "assessment": {
    "profile": "1 sentence describing their hair beautifully and positively. Reference their type, texture and length naturally. Never say 'workable', 'problematic', 'difficult', 'mid-lengths' or any clinical/AI-sounding words. Speak like a warm hairdresser friend.",
    "care": "1-2 sentences of hair care advice specific to their scalp condition. Natural language only. Focus on washing frequency, products to look for, and how to maintain shine and health.",
    "heat": "1-2 sentences on heat protection. Mention applying G&C Heat Protectant Spray on DRY hair before styling. Temperature range: fine hair 150-180C, medium 180-200C, thick up to 230C. IMPORTANT: The Straightener Brush and Auto Curler must ONLY be used on completely dry hair. Only the Blowout Brushes (Mini Blowout and Blowout Brush) can be used on towel-dried damp hair."
  },
  "recommendations": [
    {
      "productId": "exact-id",
      "reason": "1 sentence why this tool suits them. Then 1 sentence practical tip. Keep it concise and natural. No words like 'powerhouse', 'compact powerhouse', 'mid-lengths'. IMPORTANT: Only recommend the Blowout Brush or Mini Blowout for use on damp/towel-dried hair. Straightener Brush and Auto Curler must only be used on dry hair."
    }
  ]
}

Strict rules:
- assessment must have 3 separate fields: profile, care, heat
- NEVER use: em dashes, 'workable', 'mid-lengths', 'powerhouse', 'problematic', 'difficult', 'medium texture' (say 'your texture' instead), clinical or AI-sounding language
- ALL language must be uplifting, warm, feminine and natural
- Straightener Brush and Auto Curler: DRY HAIR ONLY - never suggest damp/wet use
- Blowout Brush and Mini Blowout: can be used on towel-dried damp hair
- Tool matching: curling goals or curly/wavy hair = auto-curler. Quick blowout + pixie/bob/shoulder = mini-blowout. Quick blowout + medium-long/long hair = blowout-brush (bigger, more powerful, better for longer hair). Straightening or frizz goals = straightener-brush.
- Mini Blowout is best for shorter to shoulder-length hair. For medium-long or long hair wanting a blowout, recommend the full Blowout Brush instead.
- Recommend 1-2 styling tools then always add detangling-brush last
- detangling-brush reason: "A gentle daily essential for detangling before and after styling to keep your hair smooth and healthy. It comes free with any G&C tool purchase."
- productId must be one of: auto-curler, mini-blowout, blowout-brush, straightener-brush, detangling-brush
- Australian spelling throughout`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
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

    // Format the structured assessment into display sections
    if (result.assessment && typeof result.assessment === 'object') {
      result.assessmentStructured = result.assessment;
      result.assessment = [
        result.assessment.profile,
        result.assessment.care,
        result.assessment.heat
      ].filter(Boolean).join(' ');
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
