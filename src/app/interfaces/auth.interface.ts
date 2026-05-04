export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  avatar: string | null;
  area: string;
  puesto: string;
  empr_id: string;
  is_staff: boolean;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}
