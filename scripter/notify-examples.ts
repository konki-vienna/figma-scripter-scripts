// Figma Scripter snippet:
// Demonstrates all figma.notify capabilities in one place.

console.clear();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function logDequeue(label: string, reason: string) {
  console.log(`[${label}] dequeued because: ${reason}`);
}

async function runNotifyExamples() {
  console.log("Running figma.notify examples...");

  // 1) Basic notification (default timeout = 3000ms)
  figma.notify("1) Basic notification (default timeout)");

  // 2) Error styling
  figma.notify("2) Error notification", {
    error: true,
    timeout: 2500,
    onDequeue: (reason: string) => logDequeue("Error", reason),
  });

  // 3) Custom timeout + onDequeue callback
  figma.notify("3) Custom timeout (1500ms)", {
    timeout: 1500,
    onDequeue: (reason: string) => logDequeue("Custom timeout", reason),
  });

  // 4) Infinite timeout + manual cancel via NotificationHandler.cancel()
  const infiniteNotification = figma.notify(
    "4) Infinite notification (will be cancelled in 4s)",
    {
      timeout: Infinity,
      onDequeue: (reason: string) => logDequeue("Infinite", reason),
    },
  );

  setTimeout(() => {
    console.log("Cancelling infinite notification via handler.cancel()");
    infiniteNotification.cancel();
  }, 4000);

  // 5) Action button that auto-dismisses (action returns void/true)
  figma.notify("5) Button example: click 'Undo'", {
    timeout: 10000,
    button: {
      text: "Undo",
      action: () => {
        console.log("Undo clicked. Notification will close.");
      },
    },
    onDequeue: (reason: string) => logDequeue("Button auto-dismiss", reason),
  });

  // 6) Action button that keeps the notification open (action returns false)
  const stickyButtonNotification = figma.notify(
    "6) Button returns false (stays open). Click 'Keep'.",
    {
      timeout: 12000,
      button: {
        text: "Keep",
        action: () => {
          console.log("Keep clicked. Returning false keeps the message open.");
          return false;
        },
      },
      onDequeue: (reason: string) => logDequeue("Button keep-open", reason),
    },
  );

  // Cleanup so no notification remains forever if button is clicked repeatedly.
  setTimeout(() => {
    console.log("Cancelling keep-open notification for cleanup.");
    stickyButtonNotification.cancel();
  }, 15000);

  // 7) Message length behavior (messages >100 chars are truncated by Figma)
  figma.notify(
    "7) This message is intentionally made very long to demonstrate that Figma truncates notify messages after 100 characters.",
    {
      timeout: 5000,
      onDequeue: (reason: string) => logDequeue("Long message", reason),
    },
  );

  // Let async cancellation timers run and keep logs readable in order.
  await wait(16000);
  console.log(
    "Done. Interact with notification buttons to observe dequeue reasons.",
  );
}

runNotifyExamples().catch((error) => {
  console.error("notify example failed:", error);
  figma.notify(`notify example failed: ${String(error)}`, { error: true });
});
