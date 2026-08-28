// Figma Scripter snippet:
// Single-script flow for export and import of language variable values.
// Export opens a copy UI window (or falls back to Console).
// Import can read JSON from a paste UI window.

declare const createWindow: any;

(() => {
  const figmaApi = (globalThis as any).figma;

  const createWindowApi =
    typeof createWindow === "function" ? createWindow : undefined;

  console.clear();

  const CONFIG = {
    collectionName: "Language",

    /* -------------------------------------------*/
    /* EDIT HERE - START -------------------------*/
    /* -------------------------------------------*/
    action: "export" as "export" | "import",
    /*---
		"🇬🇧 EN", "🇦🇹 AT", "🇨🇿 CZ", "🇭🇷 HR", "🇭🇺 HU", "🇵🇱 PL", "🇷🇴 RO", "🇷🇸 RS", "🇸🇰 SK"
		---*/
    referenceModeNames: [
      "🇦🇹 AT",
      //"🇨🇿 CZ",
      "🇬🇧 EN",
      //"🇭🇷 HR",
      //"🇭🇺 HU",
      //"🇵🇱 PL",
      //"🇷🇴 RO",
      //"🇷🇸 RS",
      //"🇸🇰 SK",
    ],
    targetLanguageModeNames: [
      //"🇦🇹 AT",
      "🇨🇿 CZ",
      //"🇬🇧 EN",
      "🇭🇷 HR",
      "🇭🇺 HU",
      //"🇵🇱 PL",
      "🇷🇴 RO",
      "🇷🇸 RS",
      "🇸🇰 SK",
    ] as string[], // e.g. ["🇨🇿 CZ"] or ["🇨🇿 CZ", "🇵🇱 PL"]
    variableNamePrefixes: [] as string[], //"App/Bottom Navigation/Retail", "App/Contact Tab", OR leave empty
    exportOnlyMissing: true, // true: skip variables where all target languages are already translated
    importOnlyIfMissing: true, // true: only update target languages that are currently missing (alias to missing translation variable)
    /* -------------------------------------------*/
    /* EDIT HERE - END ---------------------------*/
    /* -------------------------------------------*/

    missingTranslationVariableName: "General/Missing Translation",
    importIgnoreValues: [
      "[Missing Translation]",
      "General/Missing Translation",
    ],
    importDryRun: false,
    importJsonFallback: "",
    importWindow: {
      width: 620,
      height: 500,
    },
    exportWindow: {
      width: 700,
      height: 560,
    },
    notifyTimeoutMs: Infinity,
  };

  type ExportRow = {
    variableName: string;
    variableKey?: string;
    references: Record<string, string | null>;
    missingTranslations: Record<string, string | null>;
  };

  type NestedTranslationsTree = Record<string, any>;

  function sendMessage(handle: any, message: any): boolean {
    try {
      if (handle && typeof handle.send === "function") {
        handle.send(message);
        return true;
      }
    } catch {
      // no-op
    }

    try {
      if (handle && typeof handle.postMessage === "function") {
        handle.postMessage(message);
        return true;
      }
    } catch {
      // no-op
    }

    return false;
  }

  function readMessageData(ev: any): any {
    return ev?.data ?? ev ?? {};
  }

  function normalizePrefix(value: string): string {
    return value.trim().replace(/\/+$/, "");
  }

  function isInConfiguredScope(variableName: string): boolean {
    if (!Array.isArray(CONFIG.variableNamePrefixes)) {
      return true;
    }

    const prefixes = CONFIG.variableNamePrefixes
      .map((p) => normalizePrefix(String(p || "")))
      .filter((p) => p.length > 0);

    if (prefixes.length === 0) {
      return true;
    }

    const name = String(variableName || "");
    return prefixes.some(
      (prefix) => name === prefix || name.startsWith(`${prefix}/`),
    );
  }

  function formatModeCountSummary(countByMode: Map<string, number>): string {
    return Array.from(countByMode.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([modeName, count]) => `${modeName}: ${count}`)
      .join(" | ");
  }

  function splitVariablePath(variableName: string): string[] {
    return String(variableName || "")
      .split("/")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  function sortedObject<T>(input: Record<string, T>): Record<string, T> {
    return Object.fromEntries(
      Object.entries(input).sort((a, b) => a[0].localeCompare(b[0])),
    ) as Record<string, T>;
  }

  function sortTreeKeys(node: any): any {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return node;
    }

    const hasLeafShape = "missingTranslations" in node && "references" in node;
    if (hasLeafShape) {
      return {
        variableKey: node.variableKey,
        references: sortedObject(node.references || {}),
        missingTranslations: sortedObject(node.missingTranslations || {}),
      };
    }

    const sortedEntries = Object.entries(node)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => [key, sortTreeKeys(value)] as const);

    return Object.fromEntries(sortedEntries);
  }

  function rowsToNestedTree(rows: ExportRow[]): NestedTranslationsTree {
    const root: NestedTranslationsTree = {};

    for (const row of rows) {
      const parts = splitVariablePath(row.variableName);
      if (parts.length === 0) {
        continue;
      }

      let node: NestedTranslationsTree = root;
      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        const isLeaf = i === parts.length - 1;

        if (isLeaf) {
          node[part] = {
            variableKey: row.variableKey,
            references: sortedObject(row.references),
            missingTranslations: sortedObject(row.missingTranslations),
          };
        } else {
          if (!node[part] || typeof node[part] !== "object") {
            node[part] = {};
          }
          node = node[part];
        }
      }
    }

    return sortTreeKeys(root);
  }

  function nestedTreeToRows(tree: NestedTranslationsTree): ExportRow[] {
    const rows: ExportRow[] = [];

    const walk = (node: any, path: string[]) => {
      if (!node || typeof node !== "object") {
        return;
      }

      const hasLeafShape =
        "missingTranslations" in node && "references" in node;
      if (hasLeafShape) {
        if (path.length === 0) {
          throw new Error("Invalid nested JSON: leaf without variable path.");
        }

        const refs = node.references;
        const missing = node.missingTranslations;
        if (!refs || typeof refs !== "object") {
          throw new Error(
            `Invalid leaf at "${path.join("/")}": references must be an object.`,
          );
        }
        if (!missing || typeof missing !== "object") {
          throw new Error(
            `Invalid leaf at "${path.join("/")}": missingTranslations must be an object.`,
          );
        }

        const missingTranslations: Record<string, string | null> = {};
        for (const [modeName, value] of Object.entries(missing)) {
          if (typeof modeName !== "string" || modeName.trim().length === 0) {
            throw new Error(
              `Invalid leaf at "${path.join("/")}": invalid missingTranslations language key.`,
            );
          }
          if (value !== null && typeof value !== "string") {
            throw new Error(
              `Invalid leaf at "${path.join("/")}": missingTranslations values must be string or null.`,
            );
          }
          missingTranslations[modeName] = value;
        }

        if (Object.keys(missingTranslations).length === 0) {
          throw new Error(
            `Invalid leaf at "${path.join("/")}": missingTranslations cannot be empty.`,
          );
        }

        rows.push({
          variableName: path.join("/"),
          variableKey:
            typeof node.variableKey === "string" ? node.variableKey : undefined,
          references: refs,
          missingTranslations,
        });
        return;
      }

      for (const [key, value] of Object.entries(node)) {
        walk(value, [...path, key]);
      }
    };

    walk(tree, []);
    return rows;
  }

  async function promptImportJsonWithWindow(): Promise<string | null> {
    if (typeof createWindowApi !== "function") {
      return null;
    }

    const win = createWindowApi(
      {
        width: CONFIG.importWindow.width,
        height: CONFIG.importWindow.height,
      },
      (w: any) => {
        const sendToHost = (message: any): boolean => {
          try {
            if (typeof w.send === "function") {
              w.send(message);
              return true;
            }
          } catch {
            // no-op
          }

          try {
            if (typeof w.postMessage === "function") {
              w.postMessage(message);
              return true;
            }
          } catch {
            // no-op
          }

          return false;
        };

        const root = w.document.createElement("div");
        root.style.display = "flex";
        root.style.flexDirection = "column";
        root.style.gap = "8px";
        root.style.padding = "12px";
        root.style.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";

        const title = w.document.createElement("div");
        title.textContent = "Import translations JSON";
        title.style.fontWeight = "600";

        const info = w.document.createElement("div");
        info.textContent =
          "Paste edited export JSON and click Apply Import. Values are updated in host script. Close with X to cancel.";

        const textarea = w.document.createElement("textarea");
        textarea.style.width = "100%";
        textarea.style.height = "320px";
        textarea.style.boxSizing = "border-box";
        textarea.placeholder = "Paste JSON here...";

        const row = w.document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "8px";

        const applyButton = w.document.createElement("button");
        applyButton.textContent = "Apply Import";
        applyButton.onclick = () => {
          sendToHost({
            type: "import_json_apply",
            json: String(textarea.value || ""),
          });
          if (typeof w.close === "function") {
            setTimeout(() => w.close(), 0);
          }
        };

        row.appendChild(applyButton);
        root.appendChild(title);
        root.appendChild(info);
        root.appendChild(textarea);
        root.appendChild(row);
        w.document.body.innerHTML = "";
        w.document.body.appendChild(root);
      },
    );

    if (!win) {
      return null;
    }

    return await new Promise<string | null>((resolve) => {
      let settled = false;

      const settle = (value: string | null) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      };

      win.onmessage = (ev: any) => {
        const data = readMessageData(ev);
        if (data?.type === "import_json_apply") {
          settle(typeof data.json === "string" ? data.json : "");
          return;
        }
        if (data?.type === "import_json_cancel") {
          settle(null);
        }
      };

      // Closing the window via X should cancel immediately.
      if (typeof win.onclose !== "undefined") {
        win.onclose = () => settle(null);
      }

      // Safety fallback: if no message arrives (host bridge issue), return null.
      setTimeout(
        () => {
          settle(null);
        },
        30 * 60 * 1000,
      );
    });
  }

  async function showExportJsonInWindow(jsonText: string): Promise<boolean> {
    if (typeof createWindowApi !== "function") {
      return false;
    }

    const win = createWindowApi(
      {
        width: CONFIG.exportWindow.width,
        height: CONFIG.exportWindow.height,
      },
      (w: any) => {
        const root = w.document.createElement("div");
        root.style.display = "flex";
        root.style.flexDirection = "column";
        root.style.gap = "8px";
        root.style.padding = "12px";
        root.style.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";

        const title = w.document.createElement("div");
        title.textContent = "Export translations JSON";
        title.style.fontWeight = "600";

        const info = w.document.createElement("div");
        info.textContent =
          "Copy this JSON and paste it into your translator/import workflow.";

        const textarea = w.document.createElement("textarea");
        textarea.style.width = "100%";
        textarea.style.height = "400px";
        textarea.style.boxSizing = "border-box";
        textarea.readOnly = true;
        textarea.placeholder = "Waiting for export JSON from host script...";

        const row = w.document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "8px";

        const status = w.document.createElement("div");
        status.style.color = "#666";
        status.textContent = "Ready";

        const copyButton = w.document.createElement("button");
        copyButton.textContent = "Copy JSON";
        copyButton.onclick = async () => {
          textarea.focus();
          textarea.select();

          let copied = false;

          try {
            if (w.navigator?.clipboard?.writeText) {
              await w.navigator.clipboard.writeText(
                String(textarea.value || ""),
              );
              copied = true;
            }
          } catch {
            // Ignore and continue with legacy fallback.
          }

          if (!copied) {
            try {
              copied =
                typeof w.document.execCommand === "function" &&
                w.document.execCommand("copy");
            } catch {
              copied = false;
            }
          }

          status.textContent = copied
            ? "Copied to clipboard."
            : "Clipboard blocked. Use Cmd+C after selecting the text.";
        };

        const closeButton = w.document.createElement("button");
        closeButton.textContent = "Close";
        closeButton.onclick = () => {
          if (typeof w.close === "function") {
            w.close();
          }
        };

        const handleMessage = (ev: any) => {
          const data = ev?.data ?? ev ?? {};
          if (data?.type !== "export_json_payload") {
            return;
          }

          const value = typeof data.json === "string" ? data.json : "";
          textarea.value = value;
          textarea.focus();
          textarea.select();
          status.textContent = value
            ? "JSON loaded. Click Copy JSON or press Cmd+C."
            : "No JSON payload received.";
        };

        if (typeof w.addEventListener === "function") {
          w.addEventListener("message", handleMessage);
        }
        w.onmessage = handleMessage;

        row.appendChild(copyButton);
        row.appendChild(closeButton);
        root.appendChild(title);
        root.appendChild(info);
        root.appendChild(textarea);
        root.appendChild(row);
        root.appendChild(status);

        w.document.body.innerHTML = "";
        w.document.body.appendChild(root);
      },
    );

    if (!win) {
      return false;
    }

    const payload = { type: "export_json_payload", json: jsonText };
    // The bridge may not be ready immediately after opening.
    sendMessage(win, payload);
    setTimeout(() => sendMessage(win, payload), 30);
    setTimeout(() => sendMessage(win, payload), 150);
    setTimeout(() => sendMessage(win, payload), 350);

    return true;
  }

  function asStringValue(value: any): string | null {
    return typeof value === "string" ? value : null;
  }

  function getAliasId(value: any): string | null {
    if (
      value &&
      typeof value === "object" &&
      "type" in value &&
      value.type === "VARIABLE_ALIAS" &&
      "id" in value &&
      typeof value.id === "string"
    ) {
      return value.id;
    }
    return null;
  }

  function resolveStringForMode(
    variable: any,
    modeId: string,
    variablesById: Map<string, any>,
    visited: Set<string> = new Set(),
  ): string | null {
    const rawValue = variable.valuesByMode[modeId];
    const directString = asStringValue(rawValue);
    if (directString !== null) {
      return directString;
    }

    const aliasId = getAliasId(rawValue);
    if (!aliasId) {
      return null;
    }
    if (visited.has(aliasId)) {
      return null;
    }

    visited.add(aliasId);
    const aliasVariable = variablesById.get(aliasId);
    if (!aliasVariable) {
      return null;
    }

    return resolveStringForMode(aliasVariable, modeId, variablesById, visited);
  }

  async function getLanguageCollectionContext() {
    const collections =
      await figmaApi.variables.getLocalVariableCollectionsAsync();
    const collection = collections.find(
      (c: any) => c.name === CONFIG.collectionName,
    );

    if (!collection) {
      throw new Error(
        `Collection "${CONFIG.collectionName}" not found. Available: ${collections
          .map((c: any) => c.name)
          .join(", ")}`,
      );
    }

    const allStringVariables = (
      await figmaApi.variables.getLocalVariablesAsync("STRING")
    ).filter((v: any) => v.variableCollectionId === collection.id);

    const variablesById = new Map<string, any>(
      allStringVariables.map((v: any) => [v.id, v]),
    );
    const variablesByName = new Map<string, any>(
      allStringVariables.map((v: any) => [v.name, v]),
    );
    const variablesByKey = new Map<string, any>(
      allStringVariables.map((v: any) => [v.key, v]),
    );

    const missingTranslationVariable = allStringVariables.find(
      (v: any) => v.name === CONFIG.missingTranslationVariableName,
    );
    if (!missingTranslationVariable) {
      throw new Error(
        `Missing translation variable "${CONFIG.missingTranslationVariableName}" not found in collection "${collection.name}".`,
      );
    }

    return {
      collection,
      allStringVariables,
      variablesById,
      variablesByName,
      variablesByKey,
      missingTranslationVariable,
    };
  }

  function getConfiguredTargetModes(collection: any): any[] {
    const configuredNames = CONFIG.targetLanguageModeNames
      .map((name) => String(name || "").trim())
      .filter((name) => name.length > 0);

    if (configuredNames.length === 0) {
      throw new Error("No targetLanguageModeNames configured.");
    }

    const seen = new Set<string>();
    const uniqueNames: string[] = [];
    for (const name of configuredNames) {
      if (!seen.has(name)) {
        seen.add(name);
        uniqueNames.push(name);
      }
    }

    return uniqueNames.map((modeName) => {
      const mode = collection.modes.find((m: any) => m.name === modeName);
      if (!mode) {
        throw new Error(
          `Target mode "${modeName}" not found in collection "${collection.name}".`,
        );
      }
      return mode;
    });
  }

  function parseAndValidateImportPayload(jsonText: string): ExportRow[] {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error: any) {
      throw new Error(`Invalid JSON: ${String(error)}`);
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Import JSON must be an object.");
    }
    if (
      !parsed.missingTranslations ||
      typeof parsed.missingTranslations !== "object"
    ) {
      throw new Error(
        'Import JSON must contain an object "missingTranslations" with nested folders.',
      );
    }

    return nestedTreeToRows(
      parsed.missingTranslations as NestedTranslationsTree,
    );
  }

  async function runExport() {
    const {
      collection,
      allStringVariables,
      variablesById,
      missingTranslationVariable,
    } = await getLanguageCollectionContext();

    const targetModes = getConfiguredTargetModes(collection);

    const referenceModes = CONFIG.referenceModeNames.map((modeName: string) => {
      const mode = collection.modes.find((m: any) => m.name === modeName);
      if (!mode) {
        throw new Error(
          `Reference mode "${modeName}" not found in collection "${collection.name}".`,
        );
      }
      return mode;
    });

    const rows = allStringVariables
      .filter((variable: any) => variable.id !== missingTranslationVariable.id)
      .filter((variable: any) => isInConfiguredScope(variable.name))
      .map((variable: any) => {
        const references: Record<string, string | null> = {};
        for (const mode of referenceModes) {
          references[mode.name] = resolveStringForMode(
            variable,
            mode.modeId,
            variablesById,
          );
        }

        const missingTranslations: Record<string, string | null> = {};
        let hasAtLeastOneMissing = false;
        for (const targetMode of targetModes) {
          const currentRaw = variable.valuesByMode[targetMode.modeId];
          const isMissing =
            getAliasId(currentRaw) === missingTranslationVariable.id;
          if (isMissing) {
            hasAtLeastOneMissing = true;
          }

          const resolved = resolveStringForMode(
            variable,
            targetMode.modeId,
            variablesById,
          );
          missingTranslations[targetMode.name] = resolved;
        }

        if (CONFIG.exportOnlyMissing && !hasAtLeastOneMissing) {
          return null;
        }

        return {
          variableName: variable.name,
          variableKey: variable.key,
          references,
          missingTranslations,
        };
      })
      .filter((row: ExportRow | null): row is ExportRow => row !== null)
      .sort((a: ExportRow, b: ExportRow) =>
        a.variableName.localeCompare(b.variableName),
      );

    const countByMode = new Map<string, number>(
      targetModes.map((m: any) => [m.name, 0]),
    );
    for (const row of rows) {
      for (const modeName of Object.keys(row.missingTranslations)) {
        countByMode.set(modeName, (countByMode.get(modeName) || 0) + 1);
      }
    }
    const countByTargetLanguage = Object.fromEntries(
      Array.from(countByMode.entries()).sort((a, b) =>
        a[0].localeCompare(b[0]),
      ),
    );

    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        collectionName: collection.name,
        countByTargetLanguage,
        missingTranslationVariable: missingTranslationVariable.name,
        referenceModes: referenceModes.map((m: any) => m.name),
        variableNamePrefixes: CONFIG.variableNamePrefixes,
        count: Array.from(countByMode.values()).reduce((sum, n) => sum + n, 0),
        variableCount: rows.length,
      },
      missingTranslations: rowsToNestedTree(rows),
    };

    const json = JSON.stringify(payload, null, 2);
    const openedWindow = await showExportJsonInWindow(json);

    if (!openedWindow) {
      console.log("===== MISSING TRANSLATIONS JSON START =====");
      console.log(json);
      console.log("===== MISSING TRANSLATIONS JSON END =====");
    }

    figmaApi.notify(
      openedWindow
        ? `Found ${rows.length} missing translations across ${targetModes.length} target language mode(s). ${formatModeCountSummary(countByMode)}. JSON window opened.`
        : `Found ${rows.length} missing translations across ${targetModes.length} target language mode(s). ${formatModeCountSummary(countByMode)}. JSON is in Console.`,
      { timeout: CONFIG.notifyTimeoutMs },
    );
  }

  async function runImport() {
    const {
      collection,
      variablesByName,
      variablesByKey,
      missingTranslationVariable,
    } = await getLanguageCollectionContext();
    const targetModes = getConfiguredTargetModes(collection);
    const allowedTargetModeNames = new Set(
      targetModes.map((mode: any) => mode.name),
    );

    let jsonText = "";
    const pastedJson = await promptImportJsonWithWindow();

    if (typeof pastedJson === "string" && pastedJson.trim()) {
      jsonText = pastedJson;
    } else if (CONFIG.importJsonFallback.trim()) {
      jsonText = CONFIG.importJsonFallback;
      console.warn(
        "Using importJsonFallback because no JSON was received from window UI.",
      );
    } else {
      throw new Error(
        "No JSON received. Paste JSON in the import window or set CONFIG.importJsonFallback.",
      );
    }

    const rows = parseAndValidateImportPayload(jsonText);

    let updated = 0;
    let wouldUpdate = 0;
    let skippedExisting = 0;
    let skippedInvalid = 0;
    let skippedPlaceholder = 0;
    let skippedOutOfScope = 0;
    let skippedOutOfTargetLanguages = 0;
    let missingVariable = 0;
    let missingMode = 0;
    const wouldUpdateByMode = new Map<string, number>(
      targetModes.map((m: any) => [m.name, 0]),
    );
    const updatedByMode = new Map<string, number>(
      targetModes.map((m: any) => [m.name, 0]),
    );

    for (const row of rows) {
      if (!isInConfiguredScope(row.variableName)) {
        skippedOutOfScope += 1;
        continue;
      }

      const variable =
        variablesByName.get(row.variableName) ??
        (row.variableKey ? variablesByKey.get(row.variableKey) : undefined);
      if (!variable) {
        missingVariable += 1;
        continue;
      }

      for (const [languageName, candidateRaw] of Object.entries(
        row.missingTranslations,
      )) {
        if (!allowedTargetModeNames.has(languageName)) {
          skippedOutOfTargetLanguages += 1;
          continue;
        }

        const targetMode = collection.modes.find(
          (m: any) => m.name === languageName,
        );
        if (!targetMode) {
          missingMode += 1;
          continue;
        }

        const candidateValue =
          typeof candidateRaw === "string" ? candidateRaw.trim() : "";
        if (!candidateValue) {
          skippedInvalid += 1;
          continue;
        }

        if (CONFIG.importIgnoreValues.includes(candidateValue)) {
          skippedPlaceholder += 1;
          continue;
        }

        if (CONFIG.importOnlyIfMissing) {
          const currentValue = variable.valuesByMode[targetMode.modeId];
          const isMissingAlias =
            getAliasId(currentValue) === missingTranslationVariable.id;
          const isEmptyString = asStringValue(currentValue) === "";
          const isUnset = currentValue === undefined || currentValue === null;

          if (!isMissingAlias && !isEmptyString && !isUnset) {
            skippedExisting += 1;
            continue;
          }
        }

        if (CONFIG.importDryRun) {
          wouldUpdate += 1;
          wouldUpdateByMode.set(
            targetMode.name,
            (wouldUpdateByMode.get(targetMode.name) || 0) + 1,
          );
        } else {
          variable.setValueForMode(targetMode.modeId, candidateValue);
          updated += 1;
          updatedByMode.set(
            targetMode.name,
            (updatedByMode.get(targetMode.name) || 0) + 1,
          );
        }
      }
    }

    const summary = {
      dryRun: CONFIG.importDryRun,
      totalRows: rows.length,
      updated,
      wouldUpdate,
      skippedExisting,
      skippedInvalid,
      skippedPlaceholder,
      skippedOutOfScope,
      skippedOutOfTargetLanguages,
      missingVariable,
      missingMode,
    };

    console.log("===== IMPORT SUMMARY START =====");
    console.log(JSON.stringify(summary, null, 2));
    console.log("===== IMPORT SUMMARY END =====");

    figmaApi.notify(
      CONFIG.importDryRun
        ? `Import dry-run complete. Would update ${wouldUpdate} rows. ${formatModeCountSummary(wouldUpdateByMode)}.`
        : `Import complete. Updated ${updated} rows. ${formatModeCountSummary(updatedByMode)}.`,
      { timeout: CONFIG.notifyTimeoutMs },
    );
  }

  async function run() {
    if (CONFIG.action === "export") {
      await runExport();
      return;
    }

    await runImport();
  }

  run().catch((error: any) => {
    console.error("Script failed:", error);
    figmaApi.notify(`Script failed: ${String(error)}`, {
      timeout: CONFIG.notifyTimeoutMs,
    });
  });
})();
