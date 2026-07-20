export interface StudentJwtPayload {
  sub: string;
  actor: 'student';
  name: string;
  email: string;
}
