// ==================== UI STATE MANAGEMENT ====================
export interface UIState {
  isGenerating: boolean;
  isConvertingAudio: boolean;
  isSaving: boolean;
  isGeneratingNext: boolean;
  audioProgress: number;
  saveSuccess: boolean;
  audioSuccess: boolean;
  lastError?: string;
}

// ==================== ERROR LOGGING SEAM ====================
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorLog {
  id: string;
  timestamp: Date;
  message: string;
  context: string;
  severity: ErrorSeverity;
  stack?: string;
  details?: any;
}

export interface ErrorLoggingSeam {
  seamName: "Error Tracking → Logging System";
  description: "Captures and manages application errors for debugging";

  input: {
    error: any;
    context: string;
    severity?: ErrorSeverity;
    additionalDetails?: any;
  };

  output: {
    errorId: string;
    logged: boolean;
    timestamp: Date;
    severity: ErrorSeverity;
  };

  errors: {
    LOGGING_FAILED: {
      code: "LOGGING_FAILED";
      message: string;
      originalError: any;
    };
  };
}
