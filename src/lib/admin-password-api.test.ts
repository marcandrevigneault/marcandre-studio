import { beforeEach, describe, it, expect, vi } from 'vitest';
import { POST } from '../pages/api/auth/password';
import { hashPassword } from './admin-security';
import { sessionRevision } from './auth';
const service=vi.hoisted(()=>({currentSession:vi.fn(),credentials:vi.fn(),adminService:vi.fn(),allowPasswordAttempt:vi.fn()}));
vi.mock('./admin-service',()=>({...service,sameOrigin:(r:Request)=>r.headers.get('origin')===new URL(r.url).origin}));
beforeEach(async()=>{vi.stubEnv('SESSION_SECRET','only-testing');service.currentSession.mockResolvedValue(true);service.allowPasswordAttempt.mockResolvedValue(true);service.adminService.mockReset().mockResolvedValue({ok:true});service.credentials.mockResolvedValue({hash:await hashPassword('current-password'),revision:'old-version'});});
const call=(data:any,origin='https://studio.test')=>POST({request:new Request('https://studio.test/api/auth/password',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)})} as any);
describe('change administrator password',()=>{
 it('rejects foreign origins, logged-out clients, weak passwords and incorrect current passwords',async()=>{
  expect((await call({},'https://evil.test')).status).toBe(403);
  service.currentSession.mockResolvedValueOnce(false);expect((await call({})).status).toBe(401);
  expect((await call({currentPassword:'current-password',newPassword:'short'})).status).toBe(400);
  expect((await call({currentPassword:'wrong',newPassword:'a-new-password'})).status).toBe(401);
  expect(service.adminService).not.toHaveBeenCalled();
 });
 it('persists only a hash and a new revision, and returns a matching fresh session',async()=>{
  const r=await call({currentPassword:'current-password',newPassword:'a-new-password'});expect(r.status).toBe(200);
  const data=service.adminService.mock.calls[0][1];expect(data.hash).toMatch(/^scrypt:/);expect(data.expectedRevision).toBe('old-version');expect(JSON.stringify(data)).not.toContain('a-new-password');
  expect(sessionRevision(r.headers.get('set-cookie')!.split(';')[0])).toBe(data.revision);
 });
 it('does not claim success on a concurrent update or storage failure',async()=>{
  service.adminService.mockRejectedValueOnce({status:409});expect((await call({currentPassword:'current-password',newPassword:'a-new-password'})).status).toBe(409);
  service.adminService.mockRejectedValueOnce(new Error('offline'));expect((await call({currentPassword:'current-password',newPassword:'a-new-password'})).status).toBe(503);
 });
});
