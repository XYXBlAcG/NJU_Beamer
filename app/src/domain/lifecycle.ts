export class DocumentLifecycle<Operation> {
  busy = false;
  constructor(private readonly signature: () => string, private readonly perform: (operation: Operation) => Promise<void>) {}
  async run(operation: Operation, save?: () => Promise<boolean>): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    const before = this.signature();
    try {
      if (save && (!(await save()) || before !== this.signature())) return false;
      await this.perform(operation);
      return true;
    } finally { this.busy = false; }
  }
}
