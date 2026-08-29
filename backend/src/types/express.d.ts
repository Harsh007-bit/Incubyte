declare module "express" {
  function express(): express.Express;

  namespace express {
    type RequestHandler = (req: Request, res: Response, next: NextFunction) => unknown;
    type ErrorRequestHandler = (
      err: unknown,
      req: Request,
      res: Response,
      next: NextFunction,
    ) => unknown;

    interface Request {
      params: Record<string, string>;
      query: Record<string, unknown>;
      body: unknown;
    }

    interface Response {
      status(code: number): this;
      json(body: unknown): this;
    }

    interface NextFunction {
      (err?: unknown): void;
    }

    interface Router {
      (req: Request, res: Response, next: NextFunction): unknown;
      get(path: string, handler: RequestHandler): this;
      post(path: string, handler: RequestHandler): this;
      patch(path: string, handler: RequestHandler): this;
      use(path: string, handler: RequestHandler | Router): this;
      use(handler: RequestHandler | ErrorRequestHandler): this;
    }

    interface Express extends Router {
      listen(port: number, cb?: () => void): { close(): void };
    }

    function json(options?: { limit?: string }): RequestHandler;
    function Router(): Router;
  }

  export = express;
}
