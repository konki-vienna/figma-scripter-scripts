{
  // === Konfiguration ===
  const CHANGELOG_PAGE_NAME = "✨ Changelog";
  const CHANGELOG_CONTAINER_NAME = "CHANGELOG-2026";
  const LOG_ENTRY_COMPONENT_NAME = "_LogEntry";
  const SINGLE_CHANGE_LAYER_NAME = "SingleChange";
  const DATE_TEXT_LAYER_NAME = "Date";
  const TITLE_TEXT_LAYER_NAME = "Title";
  const DESCRIPTION_TEXT_LAYER_NAME = "Description";
  const TITLE_TEXT_VALUE = "Updated Illustration(s)";
  const DESCRIPTION_TEXT_OLD = "| Added illustration";
  const DESCRIPTION_TEXT_NEW = "- #ASSETS-77 | Updated illustration(s)";

  function hasChildren(node: SceneNode): node is SceneNode & ChildrenMixin {
    return "children" in node;
  }

  function supportsResize(node: SceneNode): node is SceneNode & LayoutMixin {
    return "resize" in node;
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

  function findFirstTextNode(root: SceneNode): TextNode | null {
    if (root.type === "TEXT") return root;
    if (!hasChildren(root)) return null;

    for (const child of root.children) {
      const found = findFirstTextNode(child as SceneNode);
      if (found) return found;
    }

    return null;
  }

  function collectTextNodes(root: SceneNode, acc: TextNode[] = []): TextNode[] {
    if (root.type === "TEXT") {
      acc.push(root);
      return acc;
    }

    if (!hasChildren(root)) return acc;
    for (const child of root.children) {
      collectTextNodes(child as SceneNode, acc);
    }
    return acc;
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
    const descriptionText = DESCRIPTION_TEXT_NEW;

    await setNamedTextFieldValue(
      logEntryInstance,
      DATE_TEXT_LAYER_NAME,
      monthYearEn,
    );

    // Title im LogEntry setzen.
    await setNamedTextFieldValue(
      logEntryInstance,
      TITLE_TEXT_LAYER_NAME,
      TITLE_TEXT_VALUE,
    );

    // Description bevorzugt ueber den benannten Layer setzen,
    // sonst per Text-Match auf den bestehenden Placeholder.
    let descriptionUpdated = false;
    try {
      await setNamedTextFieldValue(
        logEntryInstance,
        DESCRIPTION_TEXT_LAYER_NAME,
        descriptionText,
      );
      descriptionUpdated = true;
    } catch {
      descriptionUpdated = false;
    }

    if (!descriptionUpdated) {
      const textNodes = collectTextNodes(
        logEntryInstance as unknown as SceneNode,
      );
      for (const textNode of textNodes) {
        if (textNode.characters === DESCRIPTION_TEXT_OLD) {
          await loadAllFontsForTextNode(textNode);
          textNode.characters = descriptionText;
          break;
        }
      }
    }
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

  async function populateLogEntryWithComponents(
    logEntryInstance: InstanceNode,
    components: ComponentNode[],
  ): Promise<void> {
    const singleChangeTemplate = findDescendantByName(
      logEntryInstance,
      SINGLE_CHANGE_LAYER_NAME,
    );

    if (!singleChangeTemplate) {
      throw new Error(
        'Layer "' + SINGLE_CHANGE_LAYER_NAME + '" nicht gefunden.',
      );
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

    for (let i = 0; i < components.length; i++) {
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

      const componentInstance = components[i].createInstance();
      clonedSingleChange.insertChild(0, componentInstance);

      if (supportsResize(componentInstance)) {
        componentInstance.resize(firstChildWidth, firstChildHeight);
      }

      await setTextInSecondChild(clonedSingleChange, components[i].name);

      parent.insertChild(safeInsertionIndex + i, clonedSingleChange);
    }

    singleChangePrototype.remove();
  }

  async function run() {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.notify("Please select components first.");
      figma.closePlugin();
      return;
    }

    const selectedComponents = selection.filter(
      (node): node is ComponentNode => node.type === "COMPONENT",
    );

    if (selectedComponents.length === 0) {
      figma.notify("No components found in the selection.");
      figma.closePlugin();
      return;
    }

    if (selectedComponents.length !== selection.length) {
      figma.notify("Note: Only components will be processed.");
    }

    const insertedLogEntry = insertLogEntryAsSecondItem();
    await updateLogEntryMetadata(insertedLogEntry);
    await populateLogEntryWithComponents(insertedLogEntry, selectedComponents);

    // Auf der Changelog-Seite bleiben und den neuen Entry fokussieren.
    figma.currentPage.selection = [insertedLogEntry];
    figma.viewport.scrollAndZoomIntoView([insertedLogEntry]);

    figma.notify("Done. Changelog-Entry created: " + selectedComponents.length);
    figma.closePlugin();
  }

  run().catch((err) => {
    if (String(err) === "Error: Abgebrochen") {
      figma.notify("Abgebrochen.");
      figma.closePlugin();
      return;
    }

    figma.notify("Fehler: " + String(err));
    console.log("Fehler: " + String(err));
    figma.closePlugin();
  });
}
