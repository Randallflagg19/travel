/** The composing widget supplies journal selection; this feature owns creation. */
export type CreatePostContext = {
  authorId: string | null;
  ready: boolean;
  country: string;
  city: string;
};
