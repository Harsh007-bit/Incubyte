class DomainError(Exception):
    def __init__(self, message: str, code: str = "invalid"):
        super().__init__(message)
        self.code = code


class NotFoundError(DomainError):
    def __init__(self, message: str):
        super().__init__(message, "not_found")


class ConflictError(DomainError):
    def __init__(self, message: str):
        super().__init__(message, "conflict")
