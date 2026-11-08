export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string) {
    super(404, code, message)
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message)
  }
}

export class BadRequestError extends AppError {
  constructor(code: string, message: string) {
    super(400, code, message)
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: string, message: string) {
    super(401, code, message)
  }
}
