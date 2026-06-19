// Boots the real game (needs a pty), renders a few seconds of frames against
// a live world, then exits. Verifies createCliRenderer + the draw path don't
// throw at runtime. Run via: script -q /dev/null bun run scripts/boot-check.ts
setTimeout(() => {
  process.stderr.write("[boot-check] survived render loop, exiting OK\n")
  process.exit(0)
}, 2000)

try {
  await import("../main.ts")
  process.stderr.write("[boot-check] main imported, renderer started\n")
} catch (e) {
  process.stderr.write("[boot-check] BOOT ERROR: " + (e as Error).stack + "\n")
  process.exit(1)
}
