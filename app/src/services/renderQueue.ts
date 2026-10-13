export class RenderQueue {
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  constructor(private readonly concurrency: number) {
    if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("无效的渲染并发数");
  }
  async run<T>(work: () => Promise<T>, active: () => boolean = () => true): Promise<T> {
    if (this.active >= this.concurrency) await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.active++;
    try {
      if (!active()) throw new Error("渲染已取消");
      return await work();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}

export const pdfRenderQueue = new RenderQueue(2);
