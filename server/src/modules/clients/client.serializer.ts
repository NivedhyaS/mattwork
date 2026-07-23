import { Role, Client } from '@prisma/client';
import { AuthUser } from '../../types/express';

export type RawClient = any; // matches what clientSelect returns

export function serializeClient(raw: RawClient, requester: AuthUser) {
  if (!raw) return null;

  const { advancePaid, ...rest } = raw;

  switch (requester.role) {
    case Role.ADMIN:
      // Admins see everything, including advancePaid formatted as a string/number
      return {
        ...raw,
        advancePaid: raw.advancePaid != null ? Number(raw.advancePaid) : null,
      };

    case Role.CLIENT:
      // Clients see their own profile, including advancePaid
      return {
        ...raw,
        advancePaid: raw.advancePaid != null ? Number(raw.advancePaid) : null,
      };

    case Role.EDITOR:
    default:
      // Editors should never see advancePaid or any admin-only financial fields
      return rest;
  }
}

export function serializeClients(rawList: RawClient[], requester: AuthUser) {
  return rawList.map((c) => serializeClient(c, requester));
}
