import { AudioService } from '../lib/services/audioService';
import { AudioConversionSeam } from '../lib/types/contracts';

/**
 * Vercel Serverless Function to handle audio conversion requests.
 * This function acts as a public API endpoint that delegates the core logic
 * to the AudioService, following the Seam-Driven Development pattern.
 *
 * @param {any} req - The incoming request object.
 * @param {any} res - The outgoing response object.
 */
export default async function handler(req: any, res: any) {
  // --- CORS and Preflight Handling ---
  // Set permissive CORS headers to allow requests from the frontend.
  const origin = process.env.FRONTEND_URL || 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight (OPTIONS) requests, which are sent by browsers
  // to check CORS permissions before making the actual request.
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // --- Request Validation ---
  // Ensure that only POST requests are processed.
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed'
      }
    });
  }

  try {
    // Extract the input data from the request body, conforming to the seam contract.
    const input: AudioConversionSeam['input'] = req.body;

    // Basic input validation to ensure required fields are present.
    if (!input.storyId || !input.content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId and content'
        }
      });
    }

    // --- Service Delegation ---
    // Instantiate the AudioService to handle the business logic.
    const audioService = new AudioService();
    // Call the service method to perform the audio conversion.
    const result = await audioService.convertToAudio(input);
    
    // Send the successful response back to the client.
    res.status(200).json(result);

  } catch (error: any) {
    // --- Error Handling ---
    console.error('Audio conversion serverless function error:', error);
    // Send a generic 500 error response if anything goes wrong.
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during audio conversion.'
      }
    });
  }
}