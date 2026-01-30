export type JwtUser = {
  sub: string;
  // `username` is preferred but may be absent in older tokens
  username?: string;
  // `email` is optional and may be null/absent
  email?: string | null;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
};
