enum InputActionBehavior {
  NORMAL,
  DETECT_INITAL_PRESS_ONLY,
}

enum InputActionState {
  PRESSED,
  RELEASED,
  STATE_WAITING_FOR_RELEASE,
}

class InputAction {
  private name: string;
  private behavior: InputActionBehavior;
  private state: InputActionState;
  private amount: number;

  constructor(
    name: string,
    behavior: InputActionBehavior = InputActionBehavior.NORMAL,
  ) {
    this.name = name;
    this.behavior = behavior;
    this.state = InputActionState.RELEASED;
    this.amount = 0;
  }

  public get Name(): string {
    return this.name;
  }

  // reset method
  public reset(): void {
    this.state = InputActionState.RELEASED;
    this.amount = 0;
  }

  public tap(): void {
    this.press(1);
    this.release();
  }

  public press(amount = 1): void {
    if (this.state !== InputActionState.STATE_WAITING_FOR_RELEASE) {
      this.amount += amount;
      this.state = InputActionState.PRESSED;
    }
  }

  public release(): void {
    this.state = InputActionState.RELEASED;
  }

  public isPressed(): boolean {
    return this.getAmount() !== 0;
  }

  private getAmount(): number {
    const result = this.amount;
    if (result) {
      if (this.state === InputActionState.RELEASED) {
        this.amount = 0;
      } else if (
        this.behavior === InputActionBehavior.DETECT_INITAL_PRESS_ONLY
      ) {
        this.amount = 0;
        this.state = InputActionState.STATE_WAITING_FOR_RELEASE;
      }
    }
    return result;
  }
}

export { InputAction, InputActionBehavior };
