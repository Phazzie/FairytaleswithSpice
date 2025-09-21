// ==================== UNIFIED API RESPONSE ====================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    processingTime: number;
    rateLimitRemaining?: number;
  };
}
