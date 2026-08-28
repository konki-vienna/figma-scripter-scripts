// Figma Plugin: Image Mask Group with Screen Overlay
// Für jedes selektierte Layer:
// 1. Duplizieren
// 2. Original zu Maske machen
// 3. Duplikat in die MaskGroup verschieben
// 4. Screen-Rechteck mit gleichen Dimensionen erstellen
// 5. Rechteck mit "Gold" Library-Farbe füllen

const selection = figma.currentPage.selection;
const colorStyleName = "Gold"; // Name der Library-Farbe, die verwendet werden soll

if (selection.length === 0) {
  figma.notify("Bitte wähle mindestens ein Layer aus");
  figma.closePlugin();
}

// Gold-Farbe als Fallback (RGB)
const goldColor = { r: 1, g: 0.843, b: 0 };

// Versuche, die Library-Farbe "Gold" zu finden
let goldStyleId: string | undefined;
const allStyles = figma.getLocalPaintStyles();
for (const style of allStyles) {
  // Prüfe ob der Style "Gold" heißt oder mit "/" getrennt "Gold" enthält (z.B. "LibraryName/Gold")
  const styleName = style.name.split("/").pop() || style.name;
  if (styleName === colorStyleName) {
    goldStyleId = style.id;
    break;
  }
}

// Sammle die neu erstellten Mask Groups
const createdMaskGroups: SceneNode[] = [];

for (const layer of selection) {
  // Duplikat erstellen
  const duplicate = layer.clone();

  // Parent des Original-Layers ermitteln
  const parent = layer.parent;

  if (!parent || !("appendChild" in parent)) {
    figma.notify("Fehler: Parent-Container nicht gefunden");
    continue;
  }

  // Neue Group für die MaskGroup erstellen
  const maskGroup = figma.createFrame();
  maskGroup.name = layer.name;
  maskGroup.x = layer.x;
  maskGroup.y = layer.y;
  maskGroup.resize(layer.width, layer.height);

  // Frame-spezifische Einstellungen entfernen, damit es wie eine Group aussieht
  maskGroup.fills = [];
  maskGroup.strokes = [];
  maskGroup.strokeWeight = 0;

  // Original Layer zur neuen Group verschieben
  maskGroup.appendChild(layer);

  // Original zu Maske machen
  layer.isMask = true;

  // Koordinaten des Original-Layers auf 0 setzen (relativ zur maskGroup)
  layer.x = 0;
  layer.y = 0;

  // Original-Layer zum Skalieren konfigurieren
  layer.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };

  // Duplikat zur MaskGroup hinzufügen
  maskGroup.appendChild(duplicate);

  // Koordinaten des Duplikats auf 0 setzen (relativ zur maskGroup)
  duplicate.x = 0;
  duplicate.y = 0;

  // Duplikat zum Skalieren konfigurieren
  duplicate.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };

  // Rechteck erstellen für Screen-Effekt
  const screenRect = figma.createRectangle();
  screenRect.x = 0;
  screenRect.y = 0;
  screenRect.resize(duplicate.width, duplicate.height);
  screenRect.blendMode = "SCREEN";

  // Fill mit "Gold" Farbe setzen
  if (goldStyleId) {
    // Verwende die Library-Farbe "Gold"
    screenRect.fillStyleId = goldStyleId;
  } else {
    // Fallback auf RGB-Farbe
    screenRect.fills = [
      {
        type: "SOLID" as const,
        color: goldColor,
        opacity: 1,
      },
    ];
  }

  // Rechteck zum Skalieren konfigurieren
  screenRect.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };

  // Rechteck zur MaskGroup hinzufügen
  maskGroup.appendChild(screenRect);

  // MaskGroup zur ursprünglichen Parent-Group hinzufügen
  parent.appendChild(maskGroup);

  // MaskGroup zur Liste der erstellten Groups hinzufügen
  createdMaskGroups.push(maskGroup);
}

// Selektiere die neu erstellten Mask Groups
figma.currentPage.selection = createdMaskGroups;

figma.notify(
  `${selection.length} Layer(s) mit Mask und Screen-Overlay verarbeitet!`,
);
figma.closePlugin();
