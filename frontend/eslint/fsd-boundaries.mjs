import path from "node:path";

const sourceRoot = path.resolve(import.meta.dirname, "../src");
const layers = ["app", "_pages", "widgets", "features", "entities", "shared"];

function location(filename) {
  const relative = path.relative(sourceRoot, filename);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const [layer, slice] = relative.split(path.sep);
  const rank = layers.indexOf(layer);
  if (rank === -1) return null;
  return {
    layer,
    rank,
    slice: layer === "app" || layer === "shared" ? null : slice,
  };
}

export const boundaries = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      layer:
        "{{from}} may only import slices from lower FSD layers; received {{to}}.",
      slice:
        "Sibling FSD slices are independent: {{from}} cannot import {{to}}.",
      publicApi:
        "Import {{slice}} through its public API instead of its internal files.",
    },
  },
  create(context) {
    const filename = context.filename;
    const from = location(filename);
    if (!from) return {};

    function check(node) {
      const source = node.source ?? node;
      if (typeof source.value !== "string") return;
      const specifier = source.value;
      const target = specifier.startsWith("@/")
        ? path.resolve(sourceRoot, specifier.slice(2))
        : specifier.startsWith(".")
          ? path.resolve(path.dirname(filename), specifier)
          : null;
      if (!target) return;
      const to = location(target);
      if (!to) return;
      const fromName = from.slice ? `${from.layer}/${from.slice}` : from.layer;
      const toName = to.slice ? `${to.layer}/${to.slice}` : to.layer;
      if (to.rank < from.rank) {
        context.report({
          node: source,
          messageId: "layer",
          data: { from: fromName, to: toName },
        });
        return;
      }
      if (to.rank === from.rank) {
        if (from.slice !== to.slice) {
          context.report({
            node: source,
            messageId: "slice",
            data: { from: fromName, to: toName },
          });
        }
        return;
      }
      if (!to.slice) return;
      const internalPath = path.relative(
        path.join(sourceRoot, to.layer, to.slice),
        target,
      );
      if (internalPath && !/^index(?:\.[cm]?[jt]sx?)?$/.test(internalPath)) {
        context.report({
          node: source,
          messageId: "publicApi",
          data: { slice: toName },
        });
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression(node) {
        check(node.source);
      },
    };
  },
};

const fsd = { rules: { boundaries } };
export default fsd;
