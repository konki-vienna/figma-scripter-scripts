declare const figma: any;

type FrameNode = any;
type SceneNode = any;
type BaseNode = any;
type ChildrenMixin = any;
type Reaction = any;

type SelectedFrame = FrameNode;

const FLOW_START_NAME = "GDS";

function getAbsoluteX(node: SceneNode): number {
  return node.absoluteTransform[0][2];
}

function getAbsoluteY(node: SceneNode): number {
  return node.absoluteTransform[1][2];
}

function getMonthTwoLetters(date: Date): string {
  return String(date.getMonth() + 1).padStart(2, "0");
}

function padNumber(num: number, minDigits = 1): string {
  return String(num).padStart(minDigits, "0");
}

function groupByParent(
  nodes: SelectedFrame[],
): Map<BaseNode & ChildrenMixin, SelectedFrame[]> {
  const grouped = new Map<BaseNode & ChildrenMixin, SelectedFrame[]>();

  for (const node of nodes) {
    const parent = node.parent;
    if (
      !parent ||
      !("children" in parent) ||
      typeof parent.insertChild !== "function"
    ) {
      continue;
    }

    const arr = grouped.get(parent as BaseNode & ChildrenMixin) ?? [];
    arr.push(node);
    grouped.set(parent as BaseNode & ChildrenMixin, arr);
  }

  return grouped;
}

function reorderFramesLeftToRightInLayerList(frames: SelectedFrame[]): void {
  const byParent = groupByParent(frames);

  for (const [parent, siblingFrames] of byParent.entries()) {
    const sorted = [...siblingFrames].sort(
      (a, b) => getAbsoluteX(a) - getAbsoluteX(b),
    );
    const existingIndexes = siblingFrames
      .map((n) => parent.children.indexOf(n))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);

    if (existingIndexes.length === 0) {
      continue;
    }

    const startIndex = existingIndexes[0];
    sorted.forEach((node, i) => parent.insertChild(startIndex + i, node));
  }
}

function renameFrames(framesSortedLeftToRight: SelectedFrame[]): void {
  const now = new Date();
  const year = now.getFullYear();
  const month = getMonthTwoLetters(now);

  framesSortedLeftToRight.forEach((frame, index) => {
    const num = padNumber(index + 1, 1);
    frame.name = `${year}_${month}_${num}`;
  });
}

function repositionFrames(framesSortedLeftToRight: SelectedFrame[]): boolean {
  const firstParent = framesSortedLeftToRight[0]?.parent;

  if (!firstParent) {
    return false;
  }

  const hasDifferentParent = framesSortedLeftToRight.some(
    (frame) => frame.parent !== firstParent,
  );

  if (hasDifferentParent) {
    return false;
  }

  const topY = Math.min(...framesSortedLeftToRight.map((frame) => frame.y));
  let nextX = Math.min(...framesSortedLeftToRight.map((frame) => frame.x));

  for (const frame of framesSortedLeftToRight) {
    frame.x = nextX;
    frame.y = topY;
    nextX += frame.width + 100;
  }

  return true;
}

function setFlowStartingPoint(
  startFrame: SelectedFrame,
  flowName: string,
): boolean {
  const page = figma.currentPage;

  try {
    if (typeof page.setFlowStartingPoints === "function") {
      const existing = (page.flowStartingPoints ?? []).filter(
        (f: any) => f.name !== flowName,
      );
      page.setFlowStartingPoints([
        ...existing,
        {
          name: flowName,
          nodeId: startFrame.id,
        },
      ]);
      return true;
    }

    // Compatibility fallback for runtimes exposing flowStartingPoints as a writable property.
    if ("flowStartingPoints" in page) {
      const existing = (page.flowStartingPoints ?? []).filter(
        (f: any) => f.name !== flowName,
      );
      page.flowStartingPoints = [
        ...existing,
        {
          name: flowName,
          nodeId: startFrame.id,
        },
      ];
      return true;
    }
  } catch (_error) {
    // Keep script running even if the runtime does not support this capability.
  }

  return false;
}

function connectFramesWithOnClickNavigate(
  framesSortedLeftToRight: SelectedFrame[],
): void {
  for (let i = 0; i < framesSortedLeftToRight.length - 1; i++) {
    const current = framesSortedLeftToRight[i];
    const next = framesSortedLeftToRight[i + 1];

    const reaction: Reaction = {
      trigger: { type: "ON_CLICK" },
      actions: [
        {
          type: "NODE",
          destinationId: next.id,
          navigation: "NAVIGATE",
          transition: null,
          preserveScrollPosition: false,
          resetVideoPosition: false,
        },
      ],
    };

    current.reactions = [reaction];
  }
}

function run(): void {
  const selectedFrames = figma.currentPage.selection.filter(
    (node: any): node is SelectedFrame => node.type === "FRAME",
  );

  if (selectedFrames.length < 2) {
    figma.notify("Select at least two frames.");
    return;
  }

  const framesSortedLeftToRight = [...selectedFrames].sort(
    (a, b) => getAbsoluteX(a) - getAbsoluteX(b),
  );

  const repositioned = repositionFrames(framesSortedLeftToRight);

  if (!repositioned) {
    figma.notify(
      "Selected frames must share the same parent to reposition them.",
    );
    return;
  }

  reorderFramesLeftToRightInLayerList(framesSortedLeftToRight);
  renameFrames(framesSortedLeftToRight);
  const flowStartSet = setFlowStartingPoint(
    framesSortedLeftToRight[0],
    FLOW_START_NAME,
  );
  connectFramesWithOnClickNavigate(framesSortedLeftToRight);

  if (flowStartSet) {
    figma.notify(
      `Processed ${framesSortedLeftToRight.length} frames: reordered, renamed, flow start \"${FLOW_START_NAME}\" set, and linked.`,
    );
  } else {
    figma.notify(
      `Processed ${framesSortedLeftToRight.length} frames: reordered, renamed, and linked (flow start \"${FLOW_START_NAME}\" unsupported in this runtime).`,
    );
  }
}

run();
