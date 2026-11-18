import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentSession } from './admin-service';
import { createSessionCookie } from './auth';
beforeEach(()=>{vi.stubEnv('SESSION_SECRET','test-secret');vi.stubEnv('STUDIO_ADMIN_URL','https://private.test');vi.stubEnv('STUDIO_ADMIN_KEY','test-key');});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('password revision session checks',()=>{
 it('rejects old signed sessions after a password change',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>Response.json({hash:'unused',revision:'new-revision'})));
  expect(await currentSession(createSessionCookie(true,'old-revision').split(';')[0])).toBe(false);
  expect(await currentSession(createSessionCookie(true,'new-revision').split(';')[0])).toBe(true);
 });
 it('fails closed when the credential store is unavailable',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:503})));
  await expect(currentSession(createSessionCookie(true,'revision').split(';')[0])).rejects.toThrow();
 });
 it('does not contact storage for anonymous users',async()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect(await currentSession(null)).toBe(false);expect(fetcher).not.toHaveBeenCalled();});
});
