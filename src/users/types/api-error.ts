export interface ErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details: ErrorDetail[];
  };
  requestId: string;
}
