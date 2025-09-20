import { AudioService } from '../lib/services/audioService';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { emotion } = req.body;

    if (!emotion) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_EMOTION',
          message: 'Emotion string is required'
        }
      });
    }

    const audioService = new AudioService();
    const testResult = audioService.testEmotionCombination(emotion);

    return res.status(200).json({
      success: true,
      data: testResult
    });
  } catch (error: any) {
    console.error('Error testing emotion combination:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'EMOTION_TEST_ERROR',
        message: error.message
      }
    });
  }
}