import { AudioService } from '../lib/services/audioService';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const audioService = new AudioService();
    const emotionInfo = audioService.getEmotionInfo();

    return res.status(200).json({
      success: true,
      data: emotionInfo
    });
  } catch (error: any) {
    console.error('Error getting emotion info:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'EMOTION_INFO_ERROR',
        message: error.message
      }
    });
  }
}