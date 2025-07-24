/**
 * A class that represent that user table
 */
export class User {
  user_id: number;
  username: string;
  admin: boolean;
  password?: string;
  name: string;
  email: string;
  user_token: string;

  constructor(_id: number, _username: string, _admin: boolean, _password: string, _name: string, _email: string, _user_token: string) {
    this.user_id = _id;
    this.username = _username;
    this.admin = _admin;
    this.password = _password;
    this.name = _name;
    this.email = _email;
    this.user_token = _user_token;
  }
}
