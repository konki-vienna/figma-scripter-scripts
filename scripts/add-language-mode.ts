// Figma Scripter snippet:
// Adds a new language mode to a variable collection and points each string
// variable in that collection to the alias variable "Missing Translation".
declare const figma: any;

const CONFIG = {
  collectionName: "Language", // <- your variable collection name
  newLanguageModeName: "🇵🇱 PL", // <- the language/mode to add
  // If this mode name is not found, the script falls back to the first mode.
  fallbackModeName: "🇬🇧 EN",
  missingTranslationVariableName: "General/Missing Translation",
};

async function run() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collection = collections.find(
    (c: any) => c.name === CONFIG.collectionName,
  );

  if (!collection) {
    throw new Error(
      `Collection \"${CONFIG.collectionName}\" not found. Available: ${collections
        .map((c: any) => c.name)
        .join(", ")}`,
    );
  }

  const configuredFallbackMode = collection.modes.find(
    (m: any) => m.name === CONFIG.fallbackModeName,
  );
  const fallbackMode = configuredFallbackMode ?? collection.modes[0];
  if (!fallbackMode) {
    throw new Error(`Collection \"${collection.name}\" has no modes.`);
  }
  if (!configuredFallbackMode) {
    console.warn(
      `Fallback mode \"${CONFIG.fallbackModeName}\" not found. Using first mode \"${fallbackMode.name}\".`,
    );
  }

  const modeAlreadyExists = collection.modes.find(
    (m: any) => m.name === CONFIG.newLanguageModeName,
  );
  const newModeId = modeAlreadyExists
    ? modeAlreadyExists.modeId
    : collection.addMode(CONFIG.newLanguageModeName);

  const stringVariables = (
    await figma.variables.getLocalVariablesAsync("STRING")
  ).filter((v: any) => v.variableCollectionId === collection.id);

  const missingTranslationVar = stringVariables.find(
    (v: any) => v.name === CONFIG.missingTranslationVariableName,
  );

  if (!missingTranslationVar) {
    throw new Error(
      `Variable \"${CONFIG.missingTranslationVariableName}\" not found in collection \"${collection.name}\".`,
    );
  }

  const fallbackValue = missingTranslationVar.valuesByMode[fallbackMode.modeId];
  if (fallbackValue === undefined) {
    throw new Error(
      `Variable \"${missingTranslationVar.name}\" has no value in mode \"${fallbackMode.name}\".`,
    );
  }

  let updatedCount = 0;

  for (const variable of stringVariables) {
    if (variable.id === missingTranslationVar.id) {
      continue;
    }

    variable.setValueForMode(newModeId, {
      type: "VARIABLE_ALIAS",
      id: missingTranslationVar.id,
    });

    updatedCount += 1;
  }

  console.log(
    [
      modeAlreadyExists
        ? `Mode already existed: \"${CONFIG.newLanguageModeName}\"`
        : `Created mode: \"${CONFIG.newLanguageModeName}\"`,
      `Aliased ${updatedCount} variables to \"${missingTranslationVar.name}\".`,
    ].join("\n"),
  );
}

run().catch((error) => {
  console.error("Failed to add language mode:", error);
});
