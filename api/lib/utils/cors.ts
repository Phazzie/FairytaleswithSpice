/**
 * Sets CORS headers based on environment and request origin
 */
export function setCorsHeaders(req: any, res: any) {
  // Get the origin from the request
  const origin = req.headers.origin;
  
  // Allowed origins based on environment
  const allowedOrigins = [
    'http://localhost:4200',           // Local development
    'http://localhost:3000',           // Alternative local port
    'https://fairytaleswithspice.vercel.app',  // Production domain
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,  // Vercel preview URLs
    process.env.FRONTEND_URL || null   // Custom frontend URL from env
  ].filter(Boolean);

  // Check if the origin is allowed
  const isAllowedOrigin = allowedOrigins.includes(origin) || 
                          (origin && origin.endsWith('.vercel.app'));

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

/**
 * Handles preflight OPTIONS requests
 */
export function handlePreflight(req: any, res: any): boolean {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * Validates HTTP method
 */
export function validateMethod(req: any, res: any, allowedMethods: string[]): boolean {
  if (!allowedMethods.includes(req.method)) {
    res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: `Only ${allowedMethods.join(', ')} requests are allowed`
      }
    });
    return false;
  }
  return true;
}