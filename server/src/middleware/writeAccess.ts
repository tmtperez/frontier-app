// server/src/middleware/writeAccess.ts
import { requireRole } from './requireRole.js'
export const writeAccess = requireRole('ADMIN', 'ESTIMATOR')
