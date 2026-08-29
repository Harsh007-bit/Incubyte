export class DomainError extends Error {
  readonly code: string;
  constructor(message: string, code = "invalid") {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, "not_found");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "conflict");
    this.name = "ConflictError";
  }
}
