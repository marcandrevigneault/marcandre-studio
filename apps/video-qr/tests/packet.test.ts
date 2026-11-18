import { describe, it, expect } from 'vitest';
import { packVideo, PacketCollector, MAX_PACKET_BYTES } from '../src/packet';
const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => i % 251);
const edit = (p: Uint8Array, offset: number, value: number, size = 1) => {
  const q = p.slice(); const d = new DataView(q.buffer);
  if (size === 4) d.setUint32(offset, value); else if (size === 2) d.setUint16(offset, value); else q[offset] = value;
  return q;
};
describe('Video QR v1', () => {
  it.each([1, 2310, 2905, 2906, 10000, 8 * 1024 * 1024])('round trips %i bytes exactly', async n => {
    const data = bytes(n); const packets = await packVideo(data); const c = new PacketCollector();
    expect(packets.every(p => p.length <= MAX_PACKET_BYTES)).toBe(true);
    let result;
    for (const p of packets.reverse()) result = await c.add(p);
    expect(result?.complete).toBeDefined();
    expect(Buffer.compare(Buffer.from(result!.complete!), Buffer.from(data))).toBe(0);
  });
  it('fills a single code exactly at the binary QR limit', async () => {
    expect((await packVideo(bytes(2905)))[0].length).toBe(2953);
    expect((await packVideo(bytes(2906))).length).toBe(2);
  });
  it('deduplicates out of order and returns independent buffers', async () => {
    const data = bytes(6000); const p = await packVideo(data); const c = new PacketCollector();
    expect(await c.add(p[2])).toEqual({received:1,total:3});
    expect(await c.add(p[2])).toEqual({received:1,total:3});
    await c.add(p[0]); const r = await c.add(p[1]); expect(r.complete).toEqual(data);
    r.complete!.fill(0); expect((await c.add(p[0])).complete).toEqual(data);
  });
  it('snapshots inputs before asynchronous hashing/collection', async () => {
    const data = bytes(4000); const work = packVideo(data); data.fill(0);
    const p = await work; const c = new PacketCollector(); const added = c.add(p[0]); p[0].fill(0);
    await added; expect((await c.add(p[1])).complete).toEqual(bytes(4000));
  });
  it('serializes simultaneous adds without duplicate counting', async () => {
    const data = bytes(6000); const p = await packVideo(data); const c = new PacketCollector();
    const result = await Promise.all([c.add(p[2]),c.add(p[0]),c.add(p[0]),c.add(p[1])]);
    expect(result.map(r => r.received)).toEqual([1,2,2,3]); expect(result[3].complete).toEqual(data);
  });
  it('reset invalidates queued work and accepts a new sequence', async () => {
    const p = await packVideo(bytes(4000)); const c = new PacketCollector();
    const pending = c.add(p[0]); c.reset(); await expect(pending).rejects.toThrow(/reset|cancel/i);
    expect(await c.add(p[1])).toEqual({received:1,total:2}); c.reset();
    expect((await c.add((await packVideo(bytes(10)))[0])).complete).toEqual(bytes(10));
  });
  it('rejects conflicting duplicates without losing good packets', async () => {
    const p = await packVideo(bytes(4000)); const c = new PacketCollector(); await c.add(p[0]);
    await expect(c.add(edit(p[0],48,255))).rejects.toThrow(/conflict/i);
    expect((await c.add(p[1])).complete).toEqual(bytes(4000));
  });
  it('rejects mixed sequences without poisoning collection', async () => {
    const p = await packVideo(bytes(4000)); const q = await packVideo(new Uint8Array(4000)); const c = new PacketCollector();
    await c.add(p[0]); await expect(c.add(q[1])).rejects.toThrow(/mixed/i);
    expect((await c.add(p[1])).complete).toEqual(bytes(4000));
  });
  it('rejects corrupt payload and can recover after integrity failure', async () => {
    const p = (await packVideo(bytes(20)))[0]; const c = new PacketCollector();
    await expect(c.add(edit(p,48,255))).rejects.toThrow(/integrity/i);
    expect((await c.add(p)).complete).toEqual(bytes(20));
  });
  it.each([
    ['magic',0,0,1],['version',3,2,1],['flags',4,1,1],['media type',5,2,1],
    ['index',6,2,2],['count zero',8,0,2],['count mismatch',8,3,2],
    ['total zero',10,0,4],['total too big',10,8388609,4],['length',14,1,2],
  ])('rejects malformed %s', async (_name, offset, value, size) => {
    const p = (await packVideo(bytes(4000)))[0];
    await expect(new PacketCollector().add(edit(p,offset as number,value as number,size as number))).rejects.toThrow();
  });
  it('rejects short, oversized, truncated and trailing bytes', async () => {
    const p = (await packVideo(bytes(20)))[0];
    for (const bad of [new Uint8Array(),new Uint8Array(47),new Uint8Array(2954),p.slice(0,-1),new Uint8Array([...p,0])]) {
      await expect(new PacketCollector().add(bad)).rejects.toThrow();
    }
  });
  it('rejects empty and oversized source', async () => {
    await expect(packVideo(new Uint8Array())).rejects.toThrow();
    await expect(packVideo(new Uint8Array(8388609))).rejects.toThrow();
  });
  it('uses SHA-256 of source bytes in its v1 header (known abc vector)', async () => {
    const p = (await packVideo(new TextEncoder().encode('abc')))[0];
    expect(Buffer.from(p.subarray(16,48)).toString('hex')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
