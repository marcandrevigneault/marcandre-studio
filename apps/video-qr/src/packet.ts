/** Video QR v1. All integers are unsigned, big-endian; see README for the wire format. */
export const MAX_PACKET_BYTES = 2953;
export const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
export const HEADER_BYTES = 48;
const PAYLOAD_BYTES = MAX_PACKET_BYTES - HEADER_BYTES;
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
async function digest(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(data)));
}
function validSize(size: number): void {
  if (size < 1 || size > MAX_VIDEO_BYTES) throw new Error('Video must contain 1 byte to 8 MiB.');
}
export async function packVideo(data: Uint8Array): Promise<Uint8Array[]> {
  validSize(data.length);
  const source = new Uint8Array(data);
  const hash = await digest(source);
  const count = Math.ceil(source.length / PAYLOAD_BYTES);
  return Array.from({ length: count }, (_, index) => {
    const payload = source.subarray(index * PAYLOAD_BYTES, (index + 1) * PAYLOAD_BYTES);
    const packet = new Uint8Array(HEADER_BYTES + payload.length);
    const view = new DataView(packet.buffer);
    packet.set([0x56, 0x51, 0x52, 1, 0, 1]); // VQR, version, flags, WebM
    view.setUint16(6, index); view.setUint16(8, count);
    view.setUint32(10, source.length); view.setUint16(14, payload.length);
    packet.set(hash, 16); packet.set(payload, HEADER_BYTES);
    return packet;
  });
}
type Result = { received: number; total: number; complete?: Uint8Array };
type Header = { index: number; count: number; size: number; hash: Uint8Array };
function parse(packet: Uint8Array): Header {
  if (packet.length <= HEADER_BYTES || packet.length > MAX_PACKET_BYTES) throw new Error('Invalid packet size.');
  if (!equal(packet.subarray(0,6), new Uint8Array([0x56,0x51,0x52,1,0,1]))) {
    throw new Error('Unsupported or malformed Video QR header.');
  }
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  const index = view.getUint16(6), count = view.getUint16(8), size = view.getUint32(10);
  validSize(size);
  if (count !== Math.ceil(size / PAYLOAD_BYTES) || index >= count) throw new Error('Invalid packet count or index.');
  const length = Math.min(PAYLOAD_BYTES, size - index * PAYLOAD_BYTES);
  if (view.getUint16(14) !== length || packet.length !== HEADER_BYTES + length) throw new Error('Invalid packet payload length.');
  return { index, count, size, hash: packet.slice(16,48) };
}
export class PacketCollector {
  private header?: Header;
  private parts = new Map<number, Uint8Array>();
  private complete?: Uint8Array;
  private generation = 0;
  private queue: Promise<unknown> = Promise.resolve();
  reset(): void {
    this.generation++;
    this.header = undefined; this.parts.clear(); this.complete = undefined;
    this.queue = Promise.resolve();
  }
  add(packet: Uint8Array): Promise<Result> {
    // Bound allocation before copying input; all errors use the promised API.
    if (packet.length <= HEADER_BYTES || packet.length > MAX_PACKET_BYTES) return Promise.reject(new Error('Invalid packet size.'));
    const snapshot = new Uint8Array(packet), generation = this.generation;
    const pending = this.queue.then(() => this.accept(snapshot, generation));
    this.queue = pending.catch(() => undefined);
    return pending;
  }
  private async accept(packet: Uint8Array, generation: number): Promise<Result> {
    const current = () => { if (generation !== this.generation) throw new Error('Collection reset; packet cancelled.'); };
    current();
    const header = parse(packet);
    if (this.header && (header.size !== this.header.size || header.count !== this.header.count || !equal(header.hash, this.header.hash))) {
      throw new Error('Mixed video sequences. Reset before scanning another video.');
    }
    const payload = packet.slice(HEADER_BYTES), previous = this.parts.get(header.index);
    if (previous && !equal(previous, payload)) throw new Error('Conflicting duplicate packet.');
    this.header ??= header;
    this.parts.set(header.index, payload);
    if (this.parts.size === header.count && !this.complete) {
      const result = new Uint8Array(header.size);
      for (const [index, part] of this.parts) result.set(part, index * PAYLOAD_BYTES);
      const hash = await digest(result);
      current();
      if (!equal(hash, header.hash)) { this.reset(); throw new Error('Video integrity check failed (SHA-256). Scan the sequence again.'); }
      this.complete = result;
    }
    return { received: this.parts.size, total: header.count, ...(this.complete ? {complete: this.complete.slice()} : {}) };
  }
}
