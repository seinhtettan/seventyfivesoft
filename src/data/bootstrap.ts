interface BootstrapOptions {
  isHydrated: () => boolean
  subscribeHydration: (listener: () => void) => () => void
  subscribeEntities: () => void
  synchronize: () => Promise<void>
  render: () => void
}

function waitForHydration(options: BootstrapOptions): Promise<void> {
  if (options.isHydrated()) return Promise.resolve()
  return new Promise((resolve) => {
    const unsubscribe = options.subscribeHydration(() => {
      if (!options.isHydrated()) return
      unsubscribe()
      resolve()
    })
  })
}

export async function bootstrapOfflineClient(options: BootstrapOptions): Promise<void> {
  await waitForHydration(options)
  options.subscribeEntities()
  try {
    await options.synchronize()
  } finally {
    options.render()
  }
}
