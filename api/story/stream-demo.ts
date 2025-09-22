/**
 * Simple Streaming Test API
 * Easy way to test text streaming without complex setups
 */

export default async function handler(req: any, res: any) {
  // Set CORS headers  
  const origin = process.env.FRONTEND_URL || 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET allowed for this demo' }
    });
  }

  try {
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send initial connection message
    res.write('data: {"type": "connected", "message": "Demo streaming started"}\\n\\n');

    // Demo story text
    const demoStory = \`Once upon a time, in a dark forest where moonlight danced through ancient oak trees, a mysterious figure emerged from the shadows. The vampire lord Damien had roamed these woods for centuries, but tonight felt different. Tonight, he sensed something—someone—calling to him through the ethereal mist.\`;

    const words = demoStory.split(' ');
    let accumulatedText = '';
    const totalWords = words.length;

    // Stream words gradually
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      accumulatedText += (i === 0 ? '' : ' ') + word;
      
      const progress = {
        type: 'chunk',
        content: accumulatedText,
        isComplete: false,
        metadata: {
          wordsGenerated: i + 1,
          totalWords: totalWords,
          percentage: Math.round(((i + 1) / totalWords) * 100)
        }
      };

      res.write(\`data: \${JSON.stringify(progress)}\\n\\n\`);
      
      // Simulate realistic typing speed (adjust for demo)
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Send completion message
    res.write('data: {"type": "complete", "message": "Demo story complete"}\\n\\n');
    res.end();

  } catch (error: any) {
    console.error('Demo streaming error:', error);
    
    const errorData = {
      type: 'error',
      error: {
        code: 'DEMO_FAILED',
        message: 'Demo streaming failed',
        details: error.message
      }
    };
    
    res.write(\`data: \${JSON.stringify(errorData)}\\n\\n\`);
    res.end();
  }
}