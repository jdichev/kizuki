export type TimerHandle = { id: number | null };

export const createTimerManager = () => ({
  set: (handle: TimerHandle, cb: () => void, delay: number) => {
    handle.id = window.setTimeout(cb, delay);
  },
  clear: (handle: TimerHandle) => {
    if (handle.id !== null) {
      clearTimeout(handle.id);
      handle.id = null;
    }
  },
});
