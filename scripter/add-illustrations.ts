// === Konfiguration ===
const TEMPLATE_COMPONENT_NAME = "Template";
const TARGET_LAYER_NAME = "BlenderRender";
const GRID_LAYER_NAME = "Grid";
const ILLUSTRATIONS_FRAME_NAME = "Illustrations-static";
const CHANGELOG_PAGE_NAME = "✨ Changelog";
const CHANGELOG_CONTAINER_NAME = "CHANGELOG-2026";
const LOG_ENTRY_COMPONENT_NAME = "_LogEntry";
const SINGLE_CHANGE_LAYER_NAME = "SingleChange";
const DATE_TEXT_LAYER_NAME = "Date";

// Entfernt eine trailing Zahl, z. B. "Apple 12" -> "Apple"
function stripTrailingNumber(name: string): string {
  const cleaned = name.replace(/\s*\d+$/, "").trim();
  return cleaned.length > 0 ? cleaned : name;
}

function findTemplateComponentByName(name: string): ComponentNode {
  const node = figma.root.findOne(
    (n) => n.type === "COMPONENT" && n.name === name,
  );
  if (!node || node.type !== "COMPONENT") {
    throw new Error('Main Component "' + name + '" nicht gefunden.');
  }
  return node;
}

function findPageByName(name: string): PageNode {
  const page = figma.root.children.find((p) => p.name === name);
  if (!page) {
    throw new Error('Seite "' + name + '" nicht gefunden.');
  }
  return page;
}

function findAutoLayoutFrameByName(name: string): FrameNode {
  const node = figma.root.findOne((n) => n.type === "FRAME" && n.name === name);

  if (!node || node.type !== "FRAME") {
    throw new Error('Autolayout-Frame "' + name + '" nicht gefunden.');
  }

  if (node.layoutMode === "NONE") {
    throw new Error('Frame "' + name + '" ist kein Autolayout-Frame.');
  }

  return node;
}

function hasChildren(node: SceneNode): node is SceneNode & ChildrenMixin {
  return "children" in node;
}

function supportsFills(node: SceneNode): node is SceneNode & GeometryMixin {
  return "fills" in node;
}

function supportsResize(node: SceneNode): node is SceneNode & LayoutMixin {
  return "resize" in node;
}

function findDescendantByName(
  root: SceneNode,
  targetName: string,
): SceneNode | null {
  if (root.name === targetName) return root;
  if (!hasChildren(root)) return null;

  for (const child of root.children) {
    const found = findDescendantByName(child as SceneNode, targetName);
    if (found) return found;
  }
  return null;
}

// Sucht im selektierten Node (rekursiv) das erste IMAGE Paint
function extractFirstImagePaint(root: SceneNode): ImagePaint | null {
  if (supportsFills(root)) {
    const fills = root.fills;
    if (fills !== figma.mixed && Array.isArray(fills)) {
      const imageFill = fills.find(
        (p) => p.type === "IMAGE" && !!p.imageHash,
      ) as ImagePaint | undefined;

      if (imageFill && imageFill.imageHash) {
        return { ...imageFill };
      }
    }
  }

  if (hasChildren(root)) {
    for (const child of root.children) {
      const found = extractFirstImagePaint(child as SceneNode);
      if (found) return found;
    }
  }

  return null;
}

function replaceBlenderRenderWithImage(
  component: ComponentNode,
  sourceImagePaint: ImagePaint,
): void {
  const imageFill: ImagePaint = {
    ...sourceImagePaint,
    scaleMode: "FILL",
    opacity: 1,
    visible: true,
  };

  const target = findDescendantByName(component, TARGET_LAYER_NAME);

  if (target && supportsFills(target)) {
    target.fills = [imageFill];
    target.name = TARGET_LAYER_NAME;
    target.locked = true;
    return;
  }

  // Falls BlenderRender fehlt oder nicht fillbar ist: neuen Layer anlegen
  const rect = figma.createRectangle();
  rect.name = TARGET_LAYER_NAME;
  rect.resize(component.width, component.height);
  rect.x = 0;
  rect.y = 0;
  rect.fills = [imageFill];
  rect.locked = true;
  component.appendChild(rect);

  if (target) {
    target.remove();
  }
}

function removeLayerByName(root: SceneNode, targetName: string): boolean {
  const target = findDescendantByName(root, targetName);
  if (!target) return false;
  target.remove();
  return true;
}

function sortChildrenByNameAZ(frame: FrameNode): void {
  const sorted = [...frame.children].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  for (let i = 0; i < sorted.length; i++) {
    frame.insertChild(i, sorted[i]);
  }
}

function findFirstTextNode(root: SceneNode): TextNode | null {
  if (root.type === "TEXT") return root;
  if (!hasChildren(root)) return null;

  for (const child of root.children) {
    const found = findFirstTextNode(child as SceneNode);
    if (found) return found;
  }

  return null;
}

async function loadAllFontsForTextNode(node: TextNode): Promise<void> {
  if (node.characters.length === 0) {
    const fontName = node.fontName;
    if (fontName !== figma.mixed) {
      await figma.loadFontAsync(fontName);
    }
    return;
  }

  const fontName = node.fontName;
  if (fontName !== figma.mixed) {
    await figma.loadFontAsync(fontName);
    return;
  }

  const uniqueFonts = new Map<string, FontName>();
  for (let i = 0; i < node.characters.length; i++) {
    const rangeFont = node.getRangeFontName(i, i + 1);
    if (rangeFont !== figma.mixed) {
      uniqueFonts.set(rangeFont.family + "__" + rangeFont.style, rangeFont);
    }
  }

  for (const font of uniqueFonts.values()) {
    await figma.loadFontAsync(font);
  }
}

async function setTextInSecondChild(
  root: SceneNode,
  value: string,
): Promise<void> {
  if (!hasChildren(root) || root.children.length < 2) {
    throw new Error(
      'Layer "' + SINGLE_CHANGE_LAYER_NAME + '" hat weniger als 2 Children.',
    );
  }

  const secondChild = root.children[1] as SceneNode;
  const textNode = findFirstTextNode(secondChild);
  if (!textNode) {
    throw new Error(
      'Im zweiten Child von "' +
        SINGLE_CHANGE_LAYER_NAME +
        '" wurde kein Text gefunden.',
    );
  }

  await loadAllFontsForTextNode(textNode);
  textNode.characters = value;
}

async function setNamedTextFieldValue(
  root: SceneNode,
  fieldLayerName: string,
  value: string,
): Promise<void> {
  const fieldLayer = findDescendantByName(root, fieldLayerName);
  if (!fieldLayer) {
    throw new Error('Layer "' + fieldLayerName + '" nicht gefunden.');
  }

  const textNode = findFirstTextNode(fieldLayer);
  if (!textNode) {
    throw new Error(
      'Im Layer "' + fieldLayerName + '" wurde kein Text gefunden.',
    );
  }

  await loadAllFontsForTextNode(textNode);
  textNode.characters = value;
}

function formatMonthYearEn(date: Date): string {
  const monthsEn = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return monthsEn[date.getMonth()] + " " + String(date.getFullYear());
}

async function updateLogEntryMetadata(
  logEntryInstance: InstanceNode,
): Promise<void> {
  const monthYearEn = formatMonthYearEn(new Date());

  await setNamedTextFieldValue(
    logEntryInstance,
    DATE_TEXT_LAYER_NAME,
    monthYearEn,
  );
}

function insertLogEntryAsSecondItem(): InstanceNode {
  const changelogPage = findPageByName(CHANGELOG_PAGE_NAME);
  figma.currentPage = changelogPage;

  const changelogContainer = figma.currentPage.findOne(
    (n) => n.name === CHANGELOG_CONTAINER_NAME,
  );

  if (!changelogContainer || !hasChildren(changelogContainer as SceneNode)) {
    throw new Error(
      'Layer "' +
        CHANGELOG_CONTAINER_NAME +
        '" nicht gefunden oder ohne Children.',
    );
  }

  const logEntryMainComponent = findTemplateComponentByName(
    LOG_ENTRY_COMPONENT_NAME,
  );
  const logEntryInstance = logEntryMainComponent.createInstance();

  const container = changelogContainer as SceneNode & ChildrenMixin;
  const targetIndex = Math.min(1, container.children.length);
  container.insertChild(targetIndex, logEntryInstance);

  return logEntryInstance;
}

async function populateLogEntryWithIllustrations(
  logEntryInstance: InstanceNode,
  illustrations: ComponentNode[],
): Promise<void> {
  const singleChangeTemplate = findDescendantByName(
    logEntryInstance,
    SINGLE_CHANGE_LAYER_NAME,
  );

  if (!singleChangeTemplate) {
    throw new Error('Layer "' + SINGLE_CHANGE_LAYER_NAME + '" nicht gefunden.');
  }

  if (!("clone" in singleChangeTemplate)) {
    throw new Error(
      'Layer "' + SINGLE_CHANGE_LAYER_NAME + '" kann nicht geklont werden.',
    );
  }

  const singleChangePrototype = (
    singleChangeTemplate as SceneNode & CloneMixin
  ).clone();

  const parent = singleChangeTemplate.parent;
  if (!parent || !("insertChild" in parent) || !("children" in parent)) {
    throw new Error(
      'Parent von "' +
        SINGLE_CHANGE_LAYER_NAME +
        '" unterstützt keine Children.',
    );
  }

  const parentWithChildren = parent as ChildrenMixin;
  const insertionIndex = parentWithChildren.children.findIndex(
    (child) => child.id === singleChangeTemplate.id,
  );

  singleChangeTemplate.remove();
  const safeInsertionIndex =
    insertionIndex >= 0 ? insertionIndex : parentWithChildren.children.length;

  for (let i = 0; i < illustrations.length; i++) {
    const clonedSingleChange = singleChangePrototype.clone();
    clonedSingleChange.name = SINGLE_CHANGE_LAYER_NAME;

    if (
      !hasChildren(clonedSingleChange) ||
      clonedSingleChange.children.length < 1
    ) {
      throw new Error(
        'Geklonter Layer "' +
          SINGLE_CHANGE_LAYER_NAME +
          '" hat keine Children.',
      );
    }

    const firstChild = clonedSingleChange.children[0];
    const firstChildWidth = firstChild.width;
    const firstChildHeight = firstChild.height;
    firstChild.remove();

    const illustrationInstance = illustrations[i].createInstance();
    clonedSingleChange.insertChild(0, illustrationInstance);

    if (supportsResize(illustrationInstance)) {
      illustrationInstance.resize(firstChildWidth, firstChildHeight);
    }

    await setTextInSecondChild(clonedSingleChange, illustrations[i].name);

    parent.insertChild(safeInsertionIndex + i, clonedSingleChange);
  }

  singleChangePrototype.remove();
}

async function run() {
  const selection = figma.currentPage.selection;
  const sourceSelection = [...selection];

  if (selection.length === 0) {
    figma.notify("Bitte zuerst Bild-Layer auswählen.");
    figma.closePlugin();
    return;
  }

  let processed = 0;
  let skipped = 0;
  const createdComponents: ComponentNode[] = [];

  let template: ComponentNode;
  let illustrationsFrame: FrameNode;
  try {
    template = findTemplateComponentByName(TEMPLATE_COMPONENT_NAME);
    illustrationsFrame = findAutoLayoutFrameByName(ILLUSTRATIONS_FRAME_NAME);
  } catch (err) {
    figma.notify(String(err));
    figma.closePlugin();
    return;
  }

  for (const selected of selection) {
    const imagePaint = extractFirstImagePaint(selected);
    if (!imagePaint) {
      skipped++;
      continue;
    }

    try {
      // 1) Instance der Template-Main-Component
      const instance = template.createInstance();

      // Optional: am Ort der Auswahl platzieren
      instance.x = selected.x;
      instance.y = selected.y;

      // 2) Detach
      const detached = instance.detachInstance();

      // 3) Umbenennen (Trailing Nummer entfernen)
      detached.name = stripTrailingNumber(selected.name);

      // 4) Neuen Component aus detached Node machen
      const newComponent = figma.createComponentFromNode(detached);

      // 5) BlenderRender mit Bild ersetzen, Namen behalten, locken
      replaceBlenderRenderWithImage(newComponent, imagePaint);

      // 6) Grid-Layer aus neuer Komponente entfernen
      removeLayerByName(newComponent, GRID_LAYER_NAME);

      // 7) Neue Main-Komponente in Autolayout-Frame einfügen
      illustrationsFrame.appendChild(newComponent);

      createdComponents.push(newComponent);

      processed++;
    } catch {
      skipped++;
    }
  }

  // 8) Items im Ziel-Frame alphabetisch sortieren (A-Z)
  sortChildrenByNameAZ(illustrationsFrame);

  // 9) Alle neu hinzugefügten Komponenten selektieren
  figma.currentPage.selection = createdComponents;
  if (createdComponents.length > 0) {
    figma.viewport.scrollAndZoomIntoView(createdComponents);
  }

  // 10) Auf Changelog-Seite wechseln und LogEntry als zweites Item einfügen
  const insertedLogEntry = insertLogEntryAsSecondItem();

  // 10.1) Metadaten in LogEntry setzen
  await updateLogEntryMetadata(insertedLogEntry);

  // 11) Für jede neue Illustration einen SingleChange-Eintrag in LogEntry erzeugen
  await populateLogEntryWithIllustrations(insertedLogEntry, createdComponents);

  // 12) Ausgangs-Selektion entfernen
  for (const sourceNode of sourceSelection) {
    if (sourceNode.parent) {
      sourceNode.remove();
    }
  }

  figma.notify("Done. Erstellt: " + processed + ", übersprungen: " + skipped);
  figma.closePlugin();
}

run().catch((err) => {
  figma.notify("Fehler: " + String(err));
  console.log("Fehler: " + String(err));
  figma.closePlugin();
});
