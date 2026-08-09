interface WriteBarrier {
  ready: () => Promise<void>
  writeRevision: () => number
}

export async function dispatchSettledValue<T>(
  barrier: WriteBarrier,
  read: () => Promise<T>,
  dispatch: (value: T) => void,
): Promise<void> {
  while (true) {
    const revision = barrier.writeRevision()
    await barrier.ready()
    const value = await read()
    if (revision !== barrier.writeRevision()) continue
    dispatch(value)
    return
  }
}
