export interface LiveQueueEvent {
  payload: string;
  bytes: number;
  critical: boolean;
  coalesceKey?: string;
  createdAt?: number;
  resync?: boolean;
}

export interface BoundedLiveQueueOptions {
  maxMessages: number;
  maxBytes: number;
  coalesceWindowMs?: number;
}

/**
 * Per-client FIFO with separate pressure policy for telemetry and state.
 * Telemetry can be replaced/dropped. State events are retained when possible;
 * if only state events remain, the caller-provided resync event is retained so
 * the client never has to infer that control data was lost.
 */
export class BoundedLiveQueue {
  private readonly queue: LiveQueueEvent[] = [];
  private totalBytes = 0;
  private needsResync = false;
  private telemetryDrops = 0;
  private readonly coalesceWindowMs: number;

  constructor(private readonly options: BoundedLiveQueueOptions) {
    this.coalesceWindowMs = Math.max(0, Math.trunc(options.coalesceWindowMs ?? 100));
  }

  get length() {
    return this.queue.length;
  }

  get bytes() {
    return this.totalBytes;
  }

  get droppedTelemetry() {
    return this.telemetryDrops;
  }

  get resyncRequired() {
    return this.needsResync;
  }

  enqueue(event: LiveQueueEvent, resyncEvent: LiveQueueEvent): boolean {
    const now = event.createdAt ?? Date.now();
    event.createdAt = now;
    if (event.bytes > this.options.maxBytes) {
      if (event.critical) {
        this.resetForResync(resyncEvent);
      } else {
        this.telemetryDrops += 1;
      }
      return false;
    }

    if (!event.critical && event.coalesceKey) {
      const previous = this.queue.findIndex(item => item.coalesceKey === event.coalesceKey && now - (item.createdAt ?? now) <= this.coalesceWindowMs);
      if (previous >= 0) {
        this.remove(previous);
        this.telemetryDrops += 1;
      }
    }

    while (this.queue.length >= this.options.maxMessages || this.totalBytes + event.bytes > this.options.maxBytes) {
      const telemetry = this.queue.findIndex(item => !item.critical);
      if (telemetry >= 0) {
        this.remove(telemetry);
        this.telemetryDrops += 1;
        continue;
      }
      if (event.critical) this.resetForResync(resyncEvent);
      else this.telemetryDrops += 1;
      return event.critical && this.queue.length < this.options.maxMessages && this.totalBytes + event.bytes <= this.options.maxBytes
        ? this.push(event)
        : false;
    }

    if (this.needsResync && !event.resync) {
      if (!this.canFit(resyncEvent)) this.resetForResync(resyncEvent);
      else this.push(resyncEvent);
      this.needsResync = false;
    }
    return this.push(event);
  }

  shift() {
    const event = this.queue.shift();
    if (event) this.totalBytes -= event.bytes;
    return event;
  }

  clear() {
    this.queue.length = 0;
    this.totalBytes = 0;
  }

  private resetForResync(resyncEvent: LiveQueueEvent) {
    this.clear();
    this.needsResync = true;
    if (resyncEvent.bytes <= this.options.maxBytes && this.options.maxMessages > 0) {
      this.push(resyncEvent);
      this.needsResync = false;
    }
  }

  private canFit(event: LiveQueueEvent) {
    return event.bytes <= this.options.maxBytes && this.queue.length < this.options.maxMessages && this.totalBytes + event.bytes <= this.options.maxBytes;
  }

  private push(event: LiveQueueEvent) {
    if (!this.canFit(event)) return false;
    this.queue.push(event);
    this.totalBytes += event.bytes;
    return true;
  }

  private remove(index: number) {
    const [event] = this.queue.splice(index, 1);
    if (event) this.totalBytes -= event.bytes;
  }
}
