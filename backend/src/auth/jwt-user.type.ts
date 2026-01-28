export type JwtUser = {
  sub: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
};
