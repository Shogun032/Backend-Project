export const bookingValidationError = {
  status: 400,
  code: 'VALIDATION_ERROR',
  message: 'Invalid request data',
};
export const bookingNotFoundError = {
  status: 404,
  code: 'RESOURCE_NOT_FOUND',
  message: 'Booking not found',
};
export const bookingUnavailableError = {
  status: 409,
  code: 'ROOM_UNAVAILABLE',
  message: 'Room unavailable',
};
export const bookingTransitionError = {
  status: 409,
  code: 'INVALID_STATUS_TRANSITION',
  message: 'Booking status cannot be changed',
};
export const bookingAuthErrors = [
  { status: 401, code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
  { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable' },
];
export const bookingForbiddenError = {
  status: 403,
  code: 'FORBIDDEN',
  message: 'Admin role required',
};
