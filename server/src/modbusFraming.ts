/** One bounded ADU at a time, not one TCP event at a time. No backlog of frames. */
export const MAX_MODBUS_ADU_BYTES = 260;
export class ModbusTcpFramer<T> {
  private buffer = Buffer.alloc(MAX_MODBUS_ADU_BYTES);
  private used = 0;
  private expected = 6;
  private context?: T;
  get bufferedBytes() { return this.used; }
  clear() { this.used = 0; this.expected = 6; this.context = undefined; }
  push(chunk: Buffer, current: () => T | undefined, deliver: (frame: Buffer, context: T | undefined) => void): void {
    let offset = 0;
    try {
      while (offset < chunk.length) {
        if (!this.used) this.context = current();
        const count = Math.min(this.expected - this.used, chunk.length - offset);
        chunk.copy(this.buffer, this.used, offset, offset + count);
        this.used += count; offset += count;
        if (this.used < this.expected) continue;
        if (this.expected === 6) {
          const length = this.buffer.readUInt16BE(4);
          if (this.buffer.readUInt16BE(2) !== 0 || length < 2 || length > 254) {
            throw Error('Invalid Modbus MBAP protocol or length (2–254 required)');
          }
          this.expected = 6 + length;
          continue;
        }
        const frame = Buffer.from(this.buffer.subarray(0, this.expected));
        const context = this.context;
        this.clear();
        deliver(frame, context);
      }
    } catch (error) { this.clear(); throw error; }
  }
}
