/*This plugin takes the TARGET_DOMAIN URL and replaces it for all main component's description URLs with NEW_DOMAIN URL. If the description link URL is longer, it only replaces the first part that is specified in TARGET_DOMAIN.

It looks for main components, component sets, also when they are placed within a section.*/

console.clear();

figma.currentPage.selection = []; // Clear any existing selection

const TARGET_DOMAIN = "https://designsystem.george-labs.com";
const NEW_DOMAIN = "https://designsystem.g-labs.io";
let matchCount = 0;
const processedComponentIds = new Set<string>();

function updateDocumentationLinks(
  node: any,
  pageName: string,
  context: string,
) {
  if (processedComponentIds.has(node.id)) {
    return;
  }

  const updatedLinks = node.documentationLinks.map((link: any) => {
    if (link.uri.includes(TARGET_DOMAIN)) {
      matchCount++;
      const newUri = link.uri.replace(TARGET_DOMAIN, NEW_DOMAIN);
      console.log(`[${pageName}] ${context}: ${link.uri} → ${newUri}`);
      return { uri: newUri };
    }
    return link;
  });

  node.documentationLinks = updatedLinks;
  processedComponentIds.add(node.id);
}

function traverseNode(node: any, pageName: string, inSection = false) {
  const nextInSection = inSection || node.type === "SECTION";

  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    updateDocumentationLinks(node, pageName, node.name);
  }

  if (nextInSection && node.type === "INSTANCE" && node.mainComponent) {
    updateDocumentationLinks(
      node.mainComponent,
      pageName,
      `${node.name} (main component: ${node.mainComponent.name})`,
    );
  }

  if ("children" in node) {
    node.children.forEach((child: any) =>
      traverseNode(child, pageName, nextInSection),
    );
  }
}

// Iterate over all pages in the document
figma.root.children.forEach((page: any) => {
  page.children.forEach((node: any) => traverseNode(node, page.name));
});

figma.notify(`Updated URL ${matchCount} times.`);
