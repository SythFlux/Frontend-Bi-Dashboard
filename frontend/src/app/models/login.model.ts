export class Login {
  token: string;
  expiresAt: number;

  constructor(token: string, expiresAt: number) {
    this.token = token;
    this.expiresAt = expiresAt;
  }
}
