// Placeholder — the emitter will generate calls into this for every
// `server action`. See language/modules.md ("Server/client boundary").
export async function rpcCall<T>(_endpoint: string, _payload: unknown): Promise<T> {
  throw new Error("@nova/http: not implemented yet");
}
