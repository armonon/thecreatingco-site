/** Reserve a native export before any async preparation or destination picker.
 * A process-only registry cannot cancel a job which has not spawned yet. */
export function createRenderLaunchRegistry() {
  const pending = new Map();
  return {
    begin(id) {
      if (pending.has(id)) throw new Error("That native render job is already being prepared.");
      const launch = { canceled: false };
      pending.set(id, launch);
      return launch;
    },
    cancel(id) { const launch = pending.get(id); if (!launch) return false; launch.canceled = true; return true; },
    finish(id) { pending.delete(id); },
  };
}
