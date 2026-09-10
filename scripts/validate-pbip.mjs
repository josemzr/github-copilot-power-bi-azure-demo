import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const powerBiRoot = path.join(repositoryRoot, "powerbi");
const entries = fs.readdirSync(powerBiRoot);
const modelDirectory = entries.find((entry) => entry.endsWith(".SemanticModel"));
const reportDirectory = entries.find((entry) => entry.endsWith(".Report"));
const projectFile = entries.find((entry) => entry.endsWith(".pbip"));

if (!modelDirectory || !reportDirectory || !projectFile) {
  throw new Error("The PBIP descriptor, Report, or SemanticModel artifact is missing.");
}

const jsonExtensions = new Set([".json", ".pbip", ".pbir", ".pbism"]);
let jsonDocuments = 0;
let visualCount = 0;
const forbiddenPaths = [];

function walk(directory, visitor) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".pbi" || entry.name === "__MACOSX") {
        forbiddenPaths.push(path.relative(powerBiRoot, entryPath));
      } else {
        walk(entryPath, visitor);
      }
    } else {
      visitor(entryPath, entry);
    }
  }
}

walk(powerBiRoot, (filePath, entry) => {
  if (
    jsonExtensions.has(path.extname(entry.name)) ||
    entry.name === ".platform"
  ) {
    JSON.parse(fs.readFileSync(filePath, "utf8"));
    jsonDocuments += 1;
  }
  if (entry.name === "visual.json") {
    visualCount += 1;
  }
});

if (forbiddenPaths.length > 0) {
  throw new Error(`Local cache directories are committed: ${forbiddenPaths.join(", ")}`);
}

const tablesDirectory = path.join(powerBiRoot, modelDirectory, "definition", "tables");
const modelObjects = new Map();

for (const fileName of fs.readdirSync(tablesDirectory).filter((name) => name.endsWith(".tmdl"))) {
  const content = fs.readFileSync(path.join(tablesDirectory, fileName), "utf8");
  const tableMatch = content.match(/^table (?:'([^']+)'|([^\r\n]+))/m);
  if (!tableMatch) {
    continue;
  }
  const tableName = (tableMatch[1] ?? tableMatch[2]).trim();
  const properties = new Set();
  for (const match of content.matchAll(
    /^\s*column (?:'([^']+)'|([^=\r\n]+?))(?:\s*=|\r?$)/gm,
  )) {
    properties.add((match[1] ?? match[2]).trim());
  }
  for (const match of content.matchAll(
    /^\s*measure (?:'([^']+)'|([^=\r\n]+?))\s*=/gm,
  )) {
    properties.add((match[1] ?? match[2]).trim());
  }
  modelObjects.set(tableName, properties);
}

const visualReferences = [];

function findSemanticReferences(value, filePath) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => findSemanticReferences(item, filePath));
    return;
  }
  for (const kind of ["Column", "Measure"]) {
    const reference = value[kind];
    const entity = reference?.Expression?.SourceRef?.Entity;
    const property = reference?.Property;
    if (entity && property) {
      visualReferences.push({ filePath, entity, property });
    }
  }
  Object.values(value).forEach((item) => findSemanticReferences(item, filePath));
}

walk(path.join(powerBiRoot, reportDirectory), (filePath, entry) => {
  if (entry.name === "visual.json") {
    findSemanticReferences(JSON.parse(fs.readFileSync(filePath, "utf8")), filePath);
  }
});

const missingReferences = visualReferences.filter(
  ({ entity, property }) =>
    !modelObjects.has(entity) || !modelObjects.get(entity).has(property),
);
if (missingReferences.length > 0) {
  throw new Error(
    `Visuals reference missing model objects: ${JSON.stringify(missingReferences.slice(0, 10))}`,
  );
}

const sourceTmdl = fs.readFileSync(path.join(tablesDirectory, "source.tmdl"), "utf8");
if (
  !sourceTmdl.includes("/api/compatibility-metrics") ||
  !sourceTmdl.includes('ApiKeyName = "code"')
) {
  throw new Error("The PBIP source query is not configured for the protected compatibility endpoint.");
}
if (sourceTmdl.includes("File.Contents(")) {
  throw new Error("The PBIP source query still references a local file.");
}

console.log(
  JSON.stringify(
    {
      jsonDocuments,
      modelTables: modelObjects.size,
      visuals: visualCount,
      visualReferences: visualReferences.length,
      uniqueReferences: new Set(
        visualReferences.map(({ entity, property }) => `${entity}.${property}`),
      ).size,
      missingReferences: 0,
    },
    null,
    2,
  ),
);
