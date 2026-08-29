declare module "cors" {
  function cors(options?: { origin?: boolean | string | string[] }): (
    req: unknown,
    res: unknown,
    next: (err?: unknown) => void,
  ) => void;
  export default cors;
}
