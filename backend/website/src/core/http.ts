import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ZodType } from 'zod'
import type { SessionUser } from '../stores/store.ts'
/** Authenticates (and, when `unsafe`, Origin-checks) a request; sends the error and returns undefined on failure. */
export type Guard = (req: FastifyRequest, reply: FastifyReply, unsafe: boolean) => Promise<SessionUser | undefined>
/** Parses with zod; on failure sends the 422 shape and returns undefined. */
export function parse<T>(schema: ZodType<T>, data: unknown, reply: FastifyReply): T | undefined {
  const r = schema.safeParse(data)
  if (r.success) return r.data
  reply.code(422).send({
    error: 'validation_failed',
    issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  })
  return undefined
}
