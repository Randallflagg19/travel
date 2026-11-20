import path from "node:path";
import { RuleTester } from "eslint";
import { boundaries } from "./fsd-boundaries.mjs";

const sourceRoot = path.resolve(import.meta.dirname, "../src");
const file = (name) => path.join(sourceRoot, name);
const tester = new RuleTester({
  languageOptions: { ecmaVersion: "latest", sourceType: "module" },
});

tester.run("fsd/boundaries", boundaries, {
  valid: [
    {
      filename: file("_pages/journal/ui/journal-page.tsx"),
      code: 'import { Feed } from "@/widgets/post-feed";',
    },
    {
      filename: file("features/comments/ui/comments.tsx"),
      code: 'import { Button } from "@/shared/ui/button";',
    },
    {
      filename: file("features/comments/ui/comments.tsx"),
      code: 'import { useComments } from "../model/comments";',
    },
    {
      filename: file("app/layout.tsx"),
      code: 'import { Providers } from "./providers";',
    },
    {
      filename: file("shared/ui/button.tsx"),
      code: 'import { cn } from "../lib/utils";',
    },
    {
      filename: file("widgets/post-feed/ui/grid.tsx"),
      code: 'export { Comments } from "@/features/comments/index";',
    },
  ],
  invalid: [
    {
      filename: file("features/create-post/ui/button.tsx"),
      code: 'import { useNavigation } from "@/features/journal-navigation";',
      errors: [{ messageId: "slice" }],
    },
    {
      filename: file("features/create-post/ui/button.tsx"),
      code: 'import { useNavigation } from "../../journal-navigation/model/navigation";',
      errors: [{ messageId: "slice" }],
    },
    {
      filename: file("entities/author/model/authors.ts"),
      code: 'import { Navigation } from "@/widgets/journal-sidebar";',
      errors: [{ messageId: "layer" }],
    },
    {
      filename: file("widgets/post-feed/ui/grid.tsx"),
      code: 'import { Comments } from "@/features/comments/ui/comments";',
      errors: [{ messageId: "publicApi" }],
    },
    {
      filename: file("widgets/post-feed/ui/grid.tsx"),
      code: 'export { Comments } from "../../../features/comments/ui/comments";',
      errors: [{ messageId: "publicApi" }],
    },
    {
      filename: file("features/comments/model/comments.ts"),
      code: 'const load = () => import("@/features/manage-post");',
      errors: [{ messageId: "slice" }],
    },
    {
      filename: file("shared/api/client.ts"),
      code: 'export * from "@/entities/session";',
      errors: [{ messageId: "layer" }],
    },
  ],
});
