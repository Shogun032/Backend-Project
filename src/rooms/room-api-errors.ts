// Shared Swagger examples; runtime errors still come from validation/guards/service.
export const roomValidationError = {
  status: 400,
  code: 'VALIDATION_ERROR',
  message: 'Invalid request data',
};
export const roomNotFoundError = {
  status: 404,
  code: 'RESOURCE_NOT_FOUND',
  message: 'Room not found',
};
export const roomAuthErrors = [
  { status: 401, code: 'UNAUTHORIZED', message: 'Authentication required' },
  { status: 403, code: 'FORBIDDEN', message: 'Admin role required' },
  {
    status: 503,
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service unavailable',
  },
];
